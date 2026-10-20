import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { catalog } from '@run-planner/hades2-catalog';
import { traitGiverForAcquisitionRole } from '../../src/authored-project/traits/state';
import { authoredShopOffer } from '../../src/authored-project/shop';
import type { ProjectDocument } from '../../src/authored-project';
import { draftProject, simulateProjectAssembly, type DraftSpec } from '../../src/simulation';
import type { DraftReport } from '../../src/simulation/draft/report';
import { draftProvider } from '../../src/simulation/draft/schedule';
import { draftCappedGiver } from '../../src/simulation/draft/basket';
import type { ResolvedRewardOffer } from '../../src/reward-kernel';
import type { DraftCorpusEntry } from './corpus';

/** One draft's measured outcome; written per run and aggregated by the lane's teardown. */
export interface DraftCorpusRun {
  readonly specIndex: number;
  readonly spec: string;
  readonly seed: number;
  readonly outcome: 'drafted' | 'failed';
  readonly failure?: string;
  readonly digest: string;
  /** Met and total by target kind; drafted runs only. */
  readonly targets: Readonly<Record<string, { readonly met: number; readonly total: number }>>;
  /** Pairs of one god's met basket traits acquired against basket order. */
  readonly orderInversions: number;
  readonly purchases: Readonly<Record<string, number>>;
  readonly attempts: number;
  readonly ms: number;
}

export const TARGET_KINDS = [
  'god',
  'hermes',
  'hammer',
  'selene',
  'npcTrait',
  'story',
  'field',
  'rack',
] as const;

function basketTargetKind(traitKey: string): (typeof TARGET_KINDS)[number] {
  const kinds = new Set(
    catalog.traitGivers.values
      .filter((giver) => giver.traitKeys.includes(traitKey))
      .map((giver) => giver.providerKind),
  );
  if (kinds.has('hermes')) return 'hermes';
  if (kinds.has('hammer')) return 'hammer';
  if (kinds.has('spell')) return 'selene';
  if (kinds.has('npc')) return 'npcTrait';
  return 'god';
}

function targetCounts(report: DraftReport): DraftCorpusRun['targets'] {
  const counts: Record<string, { met: number; total: number }> = {};
  for (const target of report.targets) {
    const kind =
      target.kind === 'basketTrait'
        ? basketTargetKind(target.key)
        : target.kind === 'storyNpc'
          ? 'story'
          : target.kind === 'fieldNpc'
            ? 'field'
            : 'rack';
    const entry = (counts[kind] ??= { met: 0, total: 0 });
    entry.total += 1;
    if (target.met) entry.met += 1;
  }
  return counts;
}

/** First history sequence at which each trait is equipped in any Run State snapshot. */
function firstEquipped(project: ProjectDocument): ReadonlyMap<string, number> {
  const assembly = simulateProjectAssembly(catalog, project);
  const first = new Map<string, number>();
  const snapshots = assembly.evaluation.route.biomes
    .flatMap((biome) => ('rewards' in biome ? biome.rewards.runStateSnapshots : []))
    .sort((a, b) => a.historySequence - b.historySequence);
  for (const snapshot of snapshots)
    for (const traitKey of Object.keys(snapshot.traits.equippedTraits))
      if (!first.has(traitKey)) first.set(traitKey, snapshot.historySequence);
  return first;
}

function orderInversions(spec: DraftSpec, first: ReadonlyMap<string, number>): number {
  let inversions = 0;
  for (const godKey of spec.world.godKeys) {
    const own = spec.basketTraitKeys.filter(
      (key) => draftCappedGiver(catalog, spec, key)?.giverKey === godKey && first.has(key),
    );
    for (const [index, earlier] of own.entries())
      for (const later of own.slice(index + 1))
        if (first.get(later)! < first.get(earlier)!) inversions += 1;
  }
  return inversions;
}

function purchaseKind(offer: ResolvedRewardOffer): string {
  const provider = draftProvider(catalog, offer);
  if (provider !== undefined) return provider === 'spell' ? 'selene' : provider;
  const roles = catalog.rewards.rewardTypes.byKey[offer.rewardType]?.acquisitionRoles.values ?? [];
  const olympian = roles.some((role) => {
    const giverKey = traitGiverForAcquisitionRole(catalog, offer, role.key);
    return catalog.traitGivers.byKey[giverKey ?? '']?.providerKind === 'olympian';
  });
  return olympian ? 'boon' : offer.rewardType;
}

/** Authored Shop purchases by kind: god boons (Mystery included), Hermes, Hammer and others. */
function purchases(project: ProjectDocument): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      for (const action of occurrence.roomActions?.order ?? []) {
        if (action.kind !== 'interactShopOffer') continue;
        const offer = authoredShopOffer(occurrence, action.offerKey)?.reward?.offer;
        const kind = offer === undefined ? 'unresolved' : purchaseKind(offer);
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
  return counts;
}

function digestOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** Drafts one seed and measures it; a refusal or a throw is a corpus defect. */
export function measureDraft(
  entry: DraftCorpusEntry,
  specIndex: number,
  seed: number,
): DraftCorpusRun {
  const start = performance.now();
  const result = draftProject(catalog, entry.base, entry.spec, seed);
  const ms = Math.round(performance.now() - start);
  if (result.kind === 'refused')
    throw new Error(`${entry.name} refused: ${JSON.stringify(result.refusals)}`);
  const common = { specIndex, spec: entry.name, seed, ms };
  if (result.kind === 'failed')
    return {
      ...common,
      outcome: 'failed',
      failure: `${result.biomeKey}: ${result.reasons.at(-1) ?? ''}`,
      digest: digestOf(result),
      targets: {},
      orderInversions: 0,
      purchases: {},
      attempts: 0,
    };
  return {
    ...common,
    outcome: 'drafted',
    digest: digestOf(result.project),
    targets: targetCounts(result.report),
    orderInversions: orderInversions(entry.spec, firstEquipped(result.project)),
    purchases: purchases(result.project),
    attempts: result.attempts,
  };
}
