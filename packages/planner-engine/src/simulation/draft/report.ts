import type { Catalog } from '../../catalog-schema';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import type { RunStateSnapshot } from '../rewards';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import { traitGiverForAcquisitionRole } from '../../authored-project/traits/state';
import type { DraftSpec } from './spec';

export type DraftTargetKind = 'basketTrait' | 'storyNpc' | 'fieldNpc' | 'rackKeepsake';

export interface DraftTargetResult {
  readonly kind: DraftTargetKind;
  readonly key: string;
  readonly biomeKey?: string;
  readonly met: boolean;
}

export interface DraftExtra {
  /** A god picked up from outside the world, which the native cap admitted. */
  readonly kind: 'outsideGod';
  readonly key: string;
}

export interface DraftReport {
  readonly targets: readonly DraftTargetResult[];
  readonly extras: readonly DraftExtra[];
  readonly met: number;
}

export type DraftSupply = 'hermes' | 'hammer';

/** Every trait a Hermes giver offers. */
export function draftHermesTraitKeys(catalog: Catalog): ReadonlySet<string> {
  return new Set(
    catalog.traitGivers.values
      .filter((giver) => giver.providerKind === 'hermes')
      .flatMap((giver) => giver.traitKeys),
  );
}

/** Rewards whose acquisition role resolves to a Hermes, Daedalus Hammer or Selene giver. */
export function draftProvider(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): DraftSupply | 'spell' | undefined {
  const roles = catalog.rewards.rewardTypes.byKey[offer.rewardType]?.acquisitionRoles.values ?? [];
  for (const role of roles) {
    const giverKey = traitGiverForAcquisitionRole(catalog, offer, role.key);
    const kind =
      giverKey === undefined ? undefined : catalog.traitGivers.byKey[giverKey]?.providerKind;
    if (kind === 'hermes' || kind === 'hammer' || kind === 'spell') return kind;
  }
  return undefined;
}

/** Basket traits of a supply to hold by the end of a biome's half: half of them, rounded up, then all. */
export function draftHalfTarget(biomeIndex: number, biomeCount: number, target: number): number {
  return biomeIndex < Math.ceil(biomeCount / 2) ? Math.ceil(target / 2) : target;
}

/** The latest Run State snapshot the evaluation published. */
export function latestRunState(assembly: ProjectEvaluationAssembly): RunStateSnapshot | undefined {
  let latest: RunStateSnapshot | undefined;
  for (const biome of assembly.evaluation.route.biomes) {
    if (!('rewards' in biome)) continue;
    for (const snapshot of biome.rewards.runStateSnapshots)
      if (latest === undefined || snapshot.historySequence >= latest.historySequence)
        latest = snapshot;
  }
  return latest;
}

/** Gods whose boon the run has picked up by this snapshot. */
export function acquiredGods(
  catalog: Catalog,
  snapshot: RunStateSnapshot | undefined,
): readonly string[] {
  return (snapshot?.godPool.acquiredSourceKeys ?? []).flatMap((source) => {
    const giver = catalog.traitGiverByAcquisitionGameName[source];
    return giver === undefined ? [] : [giver];
  });
}

/** Which targets the evaluated plan meets, read from its history and Run State. */
export function draftReport(
  catalog: Catalog,
  spec: DraftSpec,
  assembly: ProjectEvaluationAssembly,
): DraftReport {
  const snapshot = latestRunState(assembly);
  const equipped = Object.keys(snapshot?.traits.equippedTraits ?? {});
  const gods = new Set(acquiredGods(catalog, snapshot));
  const rooms = new Map<string, Set<string>>();
  const npcs = new Map<string, Set<string>>();
  for (const biome of assembly.evaluation.route.biomes) {
    if (!('history' in biome)) continue;
    const ledgers = biome.history.ledgers;
    for (const appearance of ledgers.roomAppearances)
      if (appearance.origin.biomeKey === biome.biomeKey)
        (
          rooms.get(biome.biomeKey) ?? rooms.set(biome.biomeKey, new Set()).get(biome.biomeKey)!
        ).add(appearance.gameName);
    for (const encounter of ledgers.encounterCompletions) {
      const npc = catalog.encounterDefinitions.byKey[encounter.encounterKey]?.npcPresentationKey;
      if (npc !== undefined && encounter.origin.biomeKey === biome.biomeKey)
        (npcs.get(biome.biomeKey) ?? npcs.set(biome.biomeKey, new Set()).get(biome.biomeKey)!).add(
          npc,
        );
    }
  }
  const configured = assembly.project.route.biomes.map((biome) => biome.biomeKey);
  const targets: DraftTargetResult[] = [];
  for (const traitKey of spec.basketTraitKeys)
    targets.push({ kind: 'basketTrait', key: traitKey, met: equipped.includes(traitKey) });
  for (const [biomeKey, npc] of Object.entries(spec.world.storyNpcByBiome))
    if (configured.includes(biomeKey))
      targets.push({
        kind: 'storyNpc',
        key: npc,
        biomeKey,
        met: [...(rooms.get(biomeKey) ?? [])].some(
          (gameName) => catalog.rooms.byKey[gameName]?.kind === 'Story',
        ),
      });
  for (const [biomeKey, wanted] of Object.entries(spec.world.fieldNpcsByBiome))
    if (configured.includes(biomeKey))
      for (const npc of wanted)
        targets.push({
          kind: 'fieldNpc',
          key: npc,
          biomeKey,
          met: npcs.get(biomeKey)?.has(npc) === true,
        });
  spec.rackKeepsakeKeys.forEach((keepsakeKey, index) => {
    const plan = assembly.project.route.biomes[index];
    if (keepsakeKey === null || plan === undefined || index >= configured.length - 1) return;
    targets.push({
      kind: 'rackKeepsake',
      key: keepsakeKey,
      biomeKey: plan.biomeKey,
      met:
        plan.topology?.occurrences.some((o) => o.keepsakeRack?.keepsakeKey === keepsakeKey) ===
        true,
    });
  });
  const extras: DraftExtra[] = [...gods]
    .filter((god) => !spec.world.godKeys.includes(god))
    .map((key) => ({ kind: 'outsideGod', key }));
  return Object.freeze({
    targets: Object.freeze(targets),
    extras: Object.freeze(extras),
    met: targets.filter((target) => target.met).length,
  });
}
