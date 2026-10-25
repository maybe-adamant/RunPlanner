import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { expect } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { traitGiverForAcquisitionRole } from '../../src/authored-project/traits/state';
import { authoredShopOffer } from '../../src/authored-project/shop';
import type { ProjectDocument } from '../../src/authored-project';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import { draftProject, simulateProjectAssembly, type DraftSpec } from '../../src/simulation';
import type { DraftReport } from '../../src/simulation/draft/report';
import { draftGrantsGodBoon } from '../../src/simulation/draft/steering';
import { draftProvider } from '../../src/simulation/draft/schedule';
import { draftSourceQueues, draftTraitKind } from '../../src/simulation/draft/basket';
import type { ResolvedRewardOffer } from '../../src/reward-kernel';
import type { TraitRequirementExpression } from '../../src/catalog-schema';
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
  /** Pairs of one source's met basket traits acquired against basket order. */
  readonly orderInversions: number;
  /** Inverted pairs whose earlier trait waits on run state (element or rarity count), which the draft passes over. */
  readonly elementDeferred: number;
  /** Rooms entered in its biome when each held basket trait was first equipped. */
  readonly landingDepths: Readonly<Record<string, number>>;
  /** Taken rooms whose reward is a Shop, Preboss Shops included. */
  readonly shops: number;
  /** God boon rooms over the taken rooms of each planned biome. */
  readonly godRooms: GodRoomPacing;
  /** God traits first held in each biome, by biome key. */
  readonly godTraitsByBiome: Readonly<Record<string, number>>;
  /** Basket traits taken from a bought boon. */
  readonly boughtBasketTraits: readonly string[];
  /** Resource points placed, each granting one element. */
  readonly essences: number;
  /** Placed points whose element a waiting element-gated basket trait needed then. */
  readonly essencesIntended: number;
  /** Element-gated basket traits: all, met, and met after a point of a needed element. */
  readonly elementGated: {
    readonly total: number;
    readonly met: number;
    readonly withEssence: number;
  };
  readonly purchases: Readonly<Record<string, number>>;
  readonly attempts: number;
  readonly ms: number;
}

/** Taken rooms whose reward grants a god boon (Mystery and Devotion included), per planned biome. */
export interface GodRoomPacing {
  readonly biomes: number;
  readonly rooms: number;
  /** Rooms between consecutive god boon rooms within a biome. */
  readonly gaps: readonly number[];
  /** God boon rooms among the first third of their biome's taken rooms. */
  readonly early: number;
}

export const TARGET_KINDS = [
  'god',
  'duo',
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
  const trait = catalog.traits.byKey[traitKey];
  return trait !== undefined && draftTraitKind(trait) === 'duo' ? 'duo' : 'god';
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

/** Each god trait the run ends with, counted in the biome of the snapshot that first holds it. */
function godTraitsByBiome(project: ProjectDocument): Record<string, number> {
  const assembly = simulateProjectAssembly(catalog, project);
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  const snapshots = assembly.evaluation.route.biomes
    .flatMap((biome) => ('rewards' in biome ? biome.rewards.runStateSnapshots : []))
    .sort((a, b) => a.historySequence - b.historySequence);
  for (const snapshot of snapshots)
    for (const traitKey of Object.keys(snapshot.traits.equippedTraits)) {
      if (seen.has(traitKey)) continue;
      seen.add(traitKey);
      if (
        catalog.traitGivers.values.some(
          (giver) => giver.providerKind === 'olympian' && giver.traitKeys.includes(traitKey),
        )
      )
        counts[snapshot.biomeKey] = (counts[snapshot.biomeKey] ?? 0) + 1;
    }
  return counts;
}

/** Each held basket trait's landing depth: rooms entered in its biome up to its first holding snapshot. */
function landingDepths(spec: DraftSpec, project: ProjectDocument): Record<string, number> {
  const assembly = simulateProjectAssembly(catalog, project);
  const snapshots = assembly.evaluation.route.biomes
    .flatMap((biome) => ('rewards' in biome ? biome.rewards.runStateSnapshots : []))
    .sort((a, b) => a.historySequence - b.historySequence);
  const depths: Record<string, number> = {};
  const entered = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (snapshot.checkpoint === 'roomEntered')
      entered.set(snapshot.biomeKey, (entered.get(snapshot.biomeKey) ?? 0) + 1);
    for (const traitKey of Object.keys(snapshot.traits.equippedTraits))
      if (spec.basketTraitKeys.includes(traitKey) && !(traitKey in depths))
        depths[traitKey] = entered.get(snapshot.biomeKey) ?? 0;
  }
  return depths;
}

function shopsTaken(project: ProjectDocument): number {
  return simulateProjectAssembly(catalog, project).evaluation.route.biomes.reduce(
    (count, biome) =>
      count +
      ('history' in biome
        ? biome.history.ledgers.roomAppearances.filter(
            (entry) =>
              entry.origin.biomeKey === biome.biomeKey &&
              catalog.rooms.byKey[entry.gameName]?.incomingReward.kind === 'shop',
          ).length
        : 0),
    0,
  );
}

function godRoomPacing(project: ProjectDocument): GodRoomPacing {
  const assembly = simulateProjectAssembly(catalog, project);
  let biomes = 0;
  let rooms = 0;
  let early = 0;
  const gaps: number[] = [];
  for (const biome of assembly.evaluation.route.biomes) {
    if (!('history' in biome)) continue;
    const plan = project.route.biomes.find((b) => b.biomeKey === biome.biomeKey);
    const taken = biome.history.ledgers.roomAppearances.filter(
      (entry) => entry.origin.kind === 'occurrence' && entry.origin.biomeKey === biome.biomeKey,
    );
    if (plan === undefined || taken.length === 0) continue;
    biomes += 1;
    const indexes = taken.flatMap((entry, index) => {
      const id = entry.origin.kind === 'occurrence' ? entry.origin.occurrenceId : '';
      const occurrence = plan.topology?.occurrences.find((o) => o.occurrenceId === id);
      const reward =
        occurrence !== undefined && 'reward' in occurrence.state ? occurrence.state.reward : null;
      return reward !== null && reward !== undefined && draftGrantsGodBoon(catalog, reward.offer)
        ? [index]
        : [];
    });
    rooms += indexes.length;
    early += indexes.filter((index) => index < taken.length / 3).length;
    indexes.slice(1).forEach((index, i) => gaps.push(index - indexes[i]!));
  }
  return { biomes, rooms, gaps, early };
}

function elementGated(traitKey: string): boolean {
  const trait = catalog.traits.byKey[traitKey];
  const visit = (requirement: TraitRequirementExpression): boolean =>
    requirement.kind === 'all'
      ? requirement.requirements.some(visit)
      : requirement.kind === 'elementCount' ||
        requirement.kind === 'highestBaseElementCount' ||
        requirement.kind === 'godBoonRarityCount';
  return (
    trait !== undefined &&
    [...trait.eligibilityRequirements, ...trait.linkedBoonRequirements].some(visit)
  );
}

function orderInversions(
  spec: DraftSpec,
  first: ReadonlyMap<string, number>,
): { readonly inversions: number; readonly elementDeferred: number } {
  let inversions = 0;
  let elementDeferred = 0;
  // One god's, Hermes' or a Hammer giver's traits, against basket order.
  for (const { traitKeys } of draftSourceQueues(catalog, spec)) {
    const own = traitKeys.filter((key) => first.has(key));
    for (const [index, earlier] of own.entries())
      for (const later of own.slice(index + 1))
        if (first.get(later)! < first.get(earlier)!)
          if (elementGated(earlier)) elementDeferred += 1;
          else inversions += 1;
  }
  return { inversions, elementDeferred };
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
/** Basket traits selected from a bought boon's offer. */
function boughtBasketTraits(spec: DraftSpec, project: ProjectDocument): string[] {
  const bought: string[] = [];
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      for (const action of occurrence.roomActions?.order ?? []) {
        if (action.kind !== 'interactShopOffer') continue;
        const reward = authoredShopOffer(occurrence, action.offerKey)?.reward;
        for (const offer of Object.values(reward?.traitOffersByAcquisitionRole ?? {})) {
          if (offer?.kind !== 'traits') continue;
          const index = ['option1', 'option2', 'option3'].indexOf(offer.selectedOptionKey);
          const traitKey = offer.options[index]?.traitKey;
          if (traitKey !== undefined && spec.basketTraitKeys.includes(traitKey))
            bought.push(traitKey);
        }
      }
  return bought;
}

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

/** Elements a trait's element thresholds read; a highest-count threshold reads any. */
function gatedElements(traitKey: string): readonly string[] {
  const trait = catalog.traits.byKey[traitKey];
  const elements: string[] = [];
  const visit = (requirement: TraitRequirementExpression): void => {
    if (requirement.kind === 'all') requirement.requirements.forEach(visit);
    else if (requirement.kind === 'elementCount') elements.push(requirement.element);
    else if (requirement.kind === 'highestBaseElementCount')
      elements.push('Fire', 'Air', 'Earth', 'Water');
  };
  [...(trait?.eligibilityRequirements ?? []), ...(trait?.linkedBoonRequirements ?? [])].forEach(
    visit,
  );
  return elements;
}

function essenceUse(
  spec: DraftSpec,
  project: ProjectDocument,
): Pick<DraftCorpusRun, 'essences' | 'essencesIntended' | 'elementGated'> {
  const assembly = simulateProjectAssembly(catalog, project);
  const snapshots = assembly.evaluation.route.biomes
    .flatMap((biome) => ('rewards' in biome ? biome.rewards.runStateSnapshots : []))
    .sort((a, b) => a.historySequence - b.historySequence);
  const gated = spec.basketTraitKeys.filter((key) => gatedElements(key).length > 0);
  const placements = Object.entries(project.route.resourcePlacements).flatMap(
    ([family, placement]) => {
      if (placement === null) return [];
      const occurrence = project.route.biomes
        .find((biome) => biome.biomeKey === placement.biomeKey)
        ?.topology?.occurrences.find((o) => o.occurrenceId === placement.occurrenceId);
      const element =
        catalog.rooms.byKey[occurrence?.gameName ?? '']?.resourcePointSupport.rules[
          family as 'Pickaxe'
        ].element;
      const snapshot = snapshots.find(
        (candidate) =>
          candidate.biomeKey === placement.biomeKey &&
          JSON.stringify(candidate.owner).includes(`"${placement.occurrenceId}"`),
      );
      return element === undefined || snapshot === undefined ? [] : [{ element, snapshot }];
    },
  );
  const firstHeld = (traitKey: string) =>
    snapshots.find((snapshot) => traitKey in snapshot.traits.equippedTraits)?.historySequence;
  const intended = placements.filter(({ element, snapshot }) =>
    gated.some(
      (key) => !(key in snapshot.traits.equippedTraits) && gatedElements(key).includes(element),
    ),
  ).length;
  const met = gated.filter((key) => firstHeld(key) !== undefined);
  return {
    essences: placements.length,
    essencesIntended: intended,
    elementGated: {
      total: gated.length,
      met: met.length,
      withEssence: met.filter((key) =>
        placements.some(
          ({ element, snapshot }) =>
            gatedElements(key).includes(element) && snapshot.historySequence <= firstHeld(key)!,
        ),
      ).length,
    },
  };
}

function digestOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** The drafted project's published plan survives the wire: decoding its encoding restores it. */
function expectExecutionRoundTrip(project: ProjectDocument): void {
  const plan = compileExecutionPlan({
    product: assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, project),
      catalog,
    }),
  });
  expect(
    decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan))),
    'execution plan round trip',
  ).toEqual(plan);
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
      elementDeferred: 0,
      essences: 0,
      essencesIntended: 0,
      boughtBasketTraits: [],
      landingDepths: {},
      godRooms: { biomes: 0, rooms: 0, gaps: [], early: 0 },
      shops: 0,
      godTraitsByBiome: {},
      elementGated: { total: 0, met: 0, withEssence: 0 },
      purchases: {},
      attempts: 0,
    };
  expectExecutionRoundTrip(result.project);
  return {
    ...common,
    outcome: 'drafted',
    digest: digestOf(result.project),
    targets: targetCounts(result.report),
    ...(({ inversions, elementDeferred }) => ({ orderInversions: inversions, elementDeferred }))(
      orderInversions(entry.spec, firstEquipped(result.project)),
    ),
    ...essenceUse(entry.spec, result.project),
    purchases: purchases(result.project),
    boughtBasketTraits: boughtBasketTraits(entry.spec, result.project),
    landingDepths: landingDepths(entry.spec, result.project),
    godRooms: godRoomPacing(result.project),
    shops: shopsTaken(result.project),
    godTraitsByBiome: godTraitsByBiome(result.project),
    attempts: result.attempts,
  };
}
