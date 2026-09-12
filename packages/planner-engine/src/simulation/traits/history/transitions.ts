import type { Catalog, TraitPickupDeclaration, TraitRarity } from '../../../catalog-schema';
import type { SemanticAddress } from '../../../authored-project/addresses';
import type {
  PickupProducerProgressEvent,
  SteadyGrowthProgressEvent,
  TraitHistoryState,
  TraitLevelMutationEvent,
  TraitRarityMutationEvent,
  TraitRemovalEvent,
} from './model';
import { foldTraitHistoryEvents } from './fold';
import { hasEffectiveInRunUpgrade, isLevelBearingTrait, nextRarity } from './upgrades';

/** Data-only result of one Ransom after its outer trait has been equipped. */
export interface RansomAssessment {
  readonly applies: boolean;
  readonly events: readonly (TraitRemovalEvent | TraitLevelMutationEvent)[];
  readonly removedTraitKeys: readonly string[];
  readonly removedCount: number;
  readonly levelBonus: number;
  readonly buffedTraitKeys: readonly string[];
  readonly resultingHistory: TraitHistoryState;
}

export function assessRansom(
  catalog: Catalog,
  before: TraitHistoryState,
  sourceTraitKey: string,
  owner: SemanticAddress,
  acquisitionRole: string,
  sequence: number,
  acquisitionPoint: string,
): RansomAssessment {
  const disposition = catalog.traits.byKey[sourceTraitKey]?.selectedDisposition;
  if (disposition?.kind !== 'ransom')
    return Object.freeze({
      applies: false,
      events: Object.freeze([]),
      removedTraitKeys: Object.freeze([]),
      removedCount: 0,
      levelBonus: 0,
      buffedTraitKeys: Object.freeze([]),
      resultingHistory: before,
    });
  const removedTraitKeys = Object.values(before.equippedTraits)
    .filter((trait) =>
      catalog.traitGivers.byKey[disposition.removeGiverKey]?.traitKeys.includes(trait.traitKey),
    )
    .map((trait) => trait.traitKey);
  const removals: TraitRemovalEvent[] = removedTraitKeys.map((traitKey) =>
    Object.freeze({
      kind: 'traitRemoval' as const,
      owner,
      acquisitionRole,
      sequence,
      acquisitionPoint,
      traitKey,
      match: 'currentTraitKey' as const,
    }),
  );
  const afterRemoval = foldTraitHistoryEvents(catalog, [...before.events, ...removals]);
  const levelBonus = removedTraitKeys.length * disposition.levelsPerRemovedIdentity;
  const buffed = Object.values(afterRemoval.equippedTraits).filter(
    (trait) =>
      catalog.traitGivers.byKey[disposition.buffGiverKey]?.traitKeys.includes(trait.traitKey) &&
      isLevelBearingTrait(catalog, trait.traitKey) &&
      trait.level !== undefined,
  );
  const mutations: TraitLevelMutationEvent[] = buffed.map((trait) =>
    Object.freeze({
      kind: 'levelMutation' as const,
      owner,
      acquisitionRole,
      sequence,
      acquisitionPoint,
      sourceTraitKey,
      targetTraitKey: trait.traitKey,
      oldLevel: trait.level!,
      newLevel: trait.level! + levelBonus,
    }),
  );
  return Object.freeze({
    applies: true,
    events: Object.freeze([...removals, ...mutations]),
    removedTraitKeys: Object.freeze(removedTraitKeys),
    removedCount: removedTraitKeys.length,
    levelBonus,
    buffedTraitKeys: Object.freeze(buffed.map((trait) => trait.traitKey)),
    resultingHistory: foldTraitHistoryEvents(catalog, [
      ...before.events,
      ...removals,
      ...mutations,
    ]),
  });
}
export function advanceChaosClock(
  catalog: Catalog,
  before: TraitHistoryState,
  sequence: number,
  clock: import('../../../catalog-schema').ChaosClockKind,
): TraitHistoryState {
  const owner = before.activeChaosCurses.find((active) => active.clock === clock)?.owner;
  if (owner === undefined) return before;
  return foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'chaosClock' as const,
      sequence,
      clock,
      owner,
      acquisitionRole: 'chaosClock' as const,
    }),
  ]);
}

export interface ReachedSteadyGrowthThreshold {
  readonly traitKey: string;
  readonly acquisitionIdentity: string;
  readonly requiredInterval: number;
  /** Immutable pre-checkpoint frontier; candidates and settlement share it. */
  readonly before: TraitHistoryState;
  readonly eligibleTargetKeys: readonly string[];
}

export interface SteadyGrowthTargetAssessment {
  readonly legal: boolean;
  readonly targetTraitKey: string | null;
  readonly eligibleTargetKeys: readonly string[];
  readonly nextRarity?: TraitRarity;
}

/** Assesses the exact random result from one already-reached threshold frontier. */
export function assessSteadyGrowthTarget(
  catalog: Catalog,
  threshold: ReachedSteadyGrowthThreshold,
  targetTraitKey: string | null | undefined,
): SteadyGrowthTargetAssessment {
  if (threshold.eligibleTargetKeys.length === 0)
    return Object.freeze({
      legal: targetTraitKey === null || targetTraitKey === undefined,
      targetTraitKey: null,
      eligibleTargetKeys: threshold.eligibleTargetKeys,
    });
  if (targetTraitKey === null || targetTraitKey === undefined)
    return Object.freeze({
      legal: false,
      targetTraitKey: null,
      eligibleTargetKeys: threshold.eligibleTargetKeys,
    });
  if (!threshold.eligibleTargetKeys.includes(targetTraitKey))
    return Object.freeze({
      legal: false,
      targetTraitKey,
      eligibleTargetKeys: threshold.eligibleTargetKeys,
    });
  const current = threshold.before.equippedTraits[targetTraitKey];
  const next =
    current?.rarity === undefined ? undefined : nextRarity(catalog, targetTraitKey, current.rarity);
  return Object.freeze({
    legal: next !== undefined,
    targetTraitKey,
    eligibleTargetKeys: threshold.eligibleTargetKeys,
    ...(next === undefined ? {} : { nextRarity: next }),
  });
}

/** Applies the forced result without introducing a second effect scheduler. */
export function settleSteadyGrowthThreshold(
  catalog: Catalog,
  history: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
  threshold: ReachedSteadyGrowthThreshold,
  targetTraitKey: string | null | undefined,
): { readonly history: TraitHistoryState; readonly assessment: SteadyGrowthTargetAssessment } {
  const assessment = assessSteadyGrowthTarget(catalog, threshold, targetTraitKey);
  if (
    !assessment.legal ||
    assessment.targetTraitKey === null ||
    assessment.nextRarity === undefined
  )
    return Object.freeze({ history, assessment });
  const target = history.equippedTraits[assessment.targetTraitKey];
  if (target?.rarity === undefined) return Object.freeze({ history, assessment });
  const event: TraitRarityMutationEvent = Object.freeze({
    kind: 'rarityMutation',
    owner,
    acquisitionRole: 'steadyGrowth',
    sequence,
    acquisitionPoint: 'encounterEndEffectsApplied',
    sourceTraitKey: threshold.traitKey,
    targetTraitKey: assessment.targetTraitKey,
    oldRarity: target.rarity,
    newRarity: assessment.nextRarity,
    ...(assessment.targetTraitKey === threshold.traitKey
      ? { resetSteadyGrowthProgress: true as const }
      : {}),
  });
  return Object.freeze({
    history: foldTraitHistoryEvents(catalog, [...history.events, event]),
    assessment,
  });
}

/** Applies Phial's direct Common-to-Heroic mutation at its fountain action. */
export function settleFountainRarityMutation(
  catalog: Catalog,
  history: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
  targetTraitKey: string,
): { readonly history: TraitHistoryState; readonly legal: boolean } {
  const target = history.equippedTraits[targetTraitKey];
  const next = catalog.traitRarityOrder[3];
  if (target === undefined || target.rarity !== 'Common' || next !== 'Heroic')
    return Object.freeze({ history, legal: false });
  const event: TraitRarityMutationEvent = Object.freeze({
    kind: 'rarityMutation',
    owner,
    acquisitionRole: 'fountainRarity',
    sequence,
    acquisitionPoint: 'fountainUsed',
    targetTraitKey,
    oldRarity: target.rarity,
    newRarity: next,
  });
  return Object.freeze({
    history: foldTraitHistoryEvents(catalog, [...history.events, event]),
    legal: true,
  });
}

/** Folds one already-emitted qualifying encounter-end-effects checkpoint. */
export function advanceSteadyGrowthProgress(
  catalog: Catalog,
  before: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
): {
  readonly history: TraitHistoryState;
  readonly thresholds: readonly ReachedSteadyGrowthThreshold[];
} {
  const events: SteadyGrowthProgressEvent[] = [];
  const thresholds: ReachedSteadyGrowthThreshold[] = [];
  for (const trait of Object.values(before.equippedTraits)) {
    const disposition = catalog.traits.byKey[trait.traitKey]?.selectedDisposition;
    if (
      disposition?.kind !== 'steadyGrowth' ||
      trait.acquisitionIdentity === undefined ||
      trait.rarity === undefined ||
      disposition.intervalsByRarity[trait.rarity as 'Common'] === undefined
    )
      continue;
    const requiredInterval = disposition.intervalsByRarity[trait.rarity as 'Common'];
    const oldProgress = trait.steadyGrowthProgress ?? 0;
    const reached = oldProgress + 1 >= requiredInterval;
    events.push(
      Object.freeze({
        kind: 'steadyGrowthProgress',
        owner,
        acquisitionRole: 'steadyGrowth',
        sequence,
        acquisitionPoint: 'encounterEndEffectsApplied',
        traitKey: trait.traitKey,
        acquisitionIdentity: trait.acquisitionIdentity,
        oldProgress,
        newProgress: reached ? 0 : oldProgress + 1,
        requiredInterval,
      }),
    );
    if (!reached) continue;
    const candidates = Object.values(before.equippedTraits).filter((candidate) => {
      const declaration = catalog.traits.byKey[candidate.traitKey];
      return (
        declaration?.usesBoonRarity === true &&
        candidate.rarity !== undefined &&
        !declaration.blockInRunRarify &&
        nextRarity(catalog, candidate.traitKey, candidate.rarity) !== undefined &&
        hasEffectiveInRunUpgrade(catalog, candidate.traitKey, candidate)
      );
    });
    const eligibleTargetKeys = candidates
      .filter((candidate) => candidates.length === 1 || candidate.traitKey !== trait.traitKey)
      .map((candidate) => candidate.traitKey);
    thresholds.push(
      Object.freeze({
        traitKey: trait.traitKey,
        acquisitionIdentity: trait.acquisitionIdentity,
        requiredInterval,
        before,
        eligibleTargetKeys: Object.freeze(eligibleTargetKeys),
      }),
    );
  }
  return Object.freeze({
    history:
      events.length === 0 ? before : foldTraitHistoryEvents(catalog, [...before.events, ...events]),
    thresholds: Object.freeze(thresholds),
  });
}

export interface ReachedPickupProducerMaturity {
  readonly traitKey: string;
  readonly acquisitionIdentity: string;
  readonly producerLifecycleKey: string;
  readonly pickups: readonly TraitPickupDeclaration[];
}

/** Advances every declaration-clocked pickup producer at one qualifying end-effects checkpoint. */
export function advancePickupProducerProgress(
  catalog: Catalog,
  before: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
  deferMaturity = false,
): {
  readonly history: TraitHistoryState;
  readonly maturities: readonly ReachedPickupProducerMaturity[];
} {
  const events: PickupProducerProgressEvent[] = [];
  const maturities: ReachedPickupProducerMaturity[] = [];
  for (const trait of Object.values(before.equippedTraits)) {
    const disposition = catalog.traits.byKey[trait.traitKey]?.selectedDisposition;
    if (
      disposition?.kind !== 'producePickups' ||
      disposition.clock?.kind !== 'qualifyingEncounterEndEffects' ||
      trait.acquisitionIdentity === undefined
    )
      continue;
    const requiredInterval = disposition.clock.interval;
    const oldProgress = trait.pickupProducerProgress ?? 0;
    const reachedThreshold = oldProgress + 1 >= requiredInterval;
    const matured = reachedThreshold && !deferMaturity;
    events.push(
      Object.freeze({
        kind: 'pickupProducerProgress',
        owner,
        acquisitionRole: 'pickupProducer',
        sequence,
        acquisitionPoint: 'encounterEndEffectsApplied',
        traitKey: trait.traitKey,
        acquisitionIdentity: trait.acquisitionIdentity,
        oldProgress,
        newProgress: matured ? 0 : reachedThreshold ? requiredInterval - 1 : oldProgress + 1,
        requiredInterval,
        matured,
      }),
    );
    if (matured)
      maturities.push(
        Object.freeze({
          traitKey: trait.traitKey,
          acquisitionIdentity: trait.acquisitionIdentity,
          producerLifecycleKey: disposition.producerLifecycleKey,
          pickups: disposition.pickups,
        }),
      );
  }
  return Object.freeze({
    history:
      events.length === 0 ? before : foldTraitHistoryEvents(catalog, [...before.events, ...events]),
    maturities: Object.freeze(maturities),
  });
}
