import {
  applyTraitOfferTransition,
  invalidatedTraitOffers,
  spawnDueHermesDeliveries,
} from '../offer-lifecycle/spawned-trait-offers';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import type { Catalog } from '../../../../catalog-schema';
import { projectRoomEncounterRecords } from '../../../history/facts';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '../../../../authored-project/addresses';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion } from '../../../finding-regions';
import {
  advanceChaosClock,
  advancePickupProducerProgress,
  advanceRoomsPerUpgradeProgress,
  foldTraitHistoryEvents,
  settleSteadyGrowthThreshold,
  type ReachedSteadyGrowthThreshold,
  type ReachedPickupProducerMaturity,
} from '../../../traits';
import { advanceStygianWellClock } from '../../../commerce/stygian-well';
import { advanceKeepsakeEncounterValues } from '../../../keepsakes/state';
import {
  advanceExperimentalHammers,
  assessTranscendentEmbryoTransformation,
  advanceTranscendentEmbryoProgress,
  replaceTranscendentEmbryoBlessing,
  transcendentEmbryoBlessingKeys,
  type ReachedTranscendentEmbryoThreshold,
} from '../../../keepsakes/trait-effects';
import {
  createUnresolvedAcquisitionRewardState,
  type AuthoredTranscendentEmbryoOutcome,
} from '../../../../authored-project/traits/state';
import { clockedTraitGeneratedPickupEntryKey } from '../../../../authored-project/acquisition/pickup-producers';
import type {
  GeneratedPickupPlacement,
  DerivedAcquisitionEntryFrontier,
} from '../../acquisition/contracts';
import { mapReached, type RewardBranchState } from '../../branch-primitives';
import { advanceReachedBranch } from '../../branch-lifecycle';
import { rewardFinding } from '../../findings';
import type { ReachedTraitChildCheckpoint } from '../../trait-settlement/coordinator';
import type { LifecycleFinding } from './types';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  type PlannerTimelineFacts,
  type PlannerTimelineNode,
} from '../../../timeline-facts';
import { dueHermesShrineDeliveryFrontier } from './hermes-shrine-delivery';
import type { AutomaticOutcomeLanding } from '../../model';

export interface EncounterEndEffectsTransition {
  readonly generatedPickupPlacements: readonly GeneratedPickupPlacement[];
  readonly branch: RewardBranchState | undefined;
  readonly derivedAcquisitionEntryFrontiers: readonly DerivedAcquisitionEntryFrontier[];
  /** A due Shrine delivery has no exact ranked/retained host action yet. */
  readonly hermesShrineDeliveryPlacementRequired: boolean;
  readonly steadyGrowthThresholds: readonly {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly landing: AutomaticOutcomeLanding;
    readonly threshold: ReachedSteadyGrowthThreshold;
  }[];
  readonly transcendentEmbryoThresholds: readonly {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly landing: AutomaticOutcomeLanding;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
  }[];
  readonly traitChildSettlements: readonly ReachedTraitChildCheckpoint[];
  /** Automatic outcomes are retained only when this transition reached them. */
  readonly timelineFacts: PlannerTimelineFacts;
  readonly findings: readonly LifecycleFinding[];
}

function advanceExperimentalHammerForEndEffects(
  catalog: Catalog,
  branch: RewardBranchState,
  owner: SemanticAddress,
  sequence: number,
): RewardBranchState {
  const advanced = advanceExperimentalHammers(branch.state.keepsakes);
  if (advanced.state === branch.state.keepsakes) return branch;
  if (advanced.expired.length === 0)
    return Object.freeze({
      ...branch,
      state: Object.freeze({ ...branch.state, keepsakes: advanced.state }),
    });
  const prior = branch.state.traitHistory;
  const traitHistory = foldTraitHistoryEvents(catalog, [
    ...prior.events,
    ...advanced.expired.map((expired) =>
      Object.freeze({
        kind: 'traitRemoval' as const,
        owner,
        acquisitionRole: 'experimentalHammerExpiry',
        sequence,
        acquisitionPoint: 'encounterEndEffectsApplied',
        traitKey: expired.traitKey,
        acquisitionIdentity: expired.acquisitionIdentity,
        match: 'acquisitionIdentity' as const,
      }),
    ),
  ]);
  return Object.freeze({
    ...branch,
    state: replaceSimulationTraitHistory(
      Object.freeze({ ...branch.state, keepsakes: advanced.state }),
      traitHistory,
    ),
  });
}

function advanceChaosClockAt(
  catalog: Catalog,
  branch: RewardBranchState,
  sequence: number,
): RewardBranchState {
  const before = branch.state.traitHistory;
  const traitHistory = advanceChaosClock(catalog, before, sequence, 'encounters');
  return traitHistory === before
    ? branch
    : Object.freeze({
        ...branch,
        state: replaceSimulationTraitHistory(branch.state, traitHistory),
      });
}

function advancePickupProducersAt(
  catalog: Catalog,
  branch: RewardBranchState,
  owner: Extract<SemanticAddress, { readonly kind: 'occurrence' }>,
  sequence: number,
  deferMaturity: boolean,
): {
  readonly branch: RewardBranchState;
  readonly maturities: readonly ReachedPickupProducerMaturity[];
} {
  const before = branch.state.traitHistory;
  const advanced = advancePickupProducerProgress(catalog, before, owner, sequence, deferMaturity);
  return Object.freeze({
    branch:
      advanced.history === before
        ? branch
        : Object.freeze({
            ...branch,
            state: replaceSimulationTraitHistory(branch.state, advanced.history),
          }),
    maturities: advanced.maturities,
  });
}

interface SteadyGrowthLanding {
  readonly address: SteadyGrowthOutcomeAddress;
  readonly landing: AutomaticOutcomeLanding;
  readonly threshold: ReachedSteadyGrowthThreshold;
}

/** The state an automatic outcome blocked at, with the threshold it could not settle. */
interface BlockedSteadyGrowth {
  readonly address: SteadyGrowthOutcomeAddress;
  readonly branch: RewardBranchState;
  readonly threshold: ReachedSteadyGrowthThreshold;
}

function advanceSteadyGrowthAt(
  catalog: Catalog,
  branch: RewardBranchState,
  landing: AutomaticOutcomeLanding,
  sequence: number,
): {
  /** The settled state, or none when an outcome blocked. */
  readonly branch: RewardBranchState | undefined;
  readonly blocked?: BlockedSteadyGrowth;
  readonly thresholds: readonly SteadyGrowthLanding[];
} {
  const owner = landing.owner;
  const thresholds: SteadyGrowthLanding[] = [];
  const before = branch.state.traitHistory;
  const advanced = advanceRoomsPerUpgradeProgress(catalog, before, owner, sequence);
  let traitHistory = advanced.history;
  for (const threshold of advanced.thresholds) {
    const address = createSteadyGrowthOutcomeAddress(threshold.source, threshold.cycle);
    thresholds.push(Object.freeze({ address, landing, threshold }));
    const settled = settleSteadyGrowthThreshold(
      catalog,
      traitHistory,
      owner,
      sequence,
      threshold,
      threshold.targetTraitKey,
    );
    if (!settled.assessment.legal)
      return Object.freeze({
        branch: undefined,
        blocked: Object.freeze({
          address,
          branch: Object.freeze({
            ...branch,
            state: replaceSimulationTraitHistory(branch.state, traitHistory),
          }),
          threshold,
        }),
        thresholds: Object.freeze(thresholds),
      });
    traitHistory = settled.history;
  }
  const settled =
    traitHistory === before
      ? branch
      : Object.freeze({
          ...branch,
          state: replaceSimulationTraitHistory(branch.state, traitHistory),
        });
  // Each reached interval runs `AddRarityToTraits`, which clears live loot
  // options whether or not a trait was promotable.
  const invalidation =
    advanced.thresholds.length === 0
      ? undefined
      : invalidatedTraitOffers(owner, 'steadyGrowthInterval');
  return Object.freeze({
    branch: invalidation === undefined ? settled : applyTraitOfferTransition(settled, invalidation),
    thresholds: Object.freeze(thresholds),
  });
}

function pickupMaturityKey(maturity: ReachedPickupProducerMaturity): string {
  return `${maturity.traitKey}:${maturity.acquisitionIdentity}:${maturity.producerLifecycleKey}`;
}

interface TranscendentEmbryoLanding {
  readonly address: TranscendentEmbryoOutcomeAddress;
  readonly landing: AutomaticOutcomeLanding;
  readonly threshold: ReachedTranscendentEmbryoThreshold;
}

interface BlockedTranscendentEmbryo {
  readonly address: TranscendentEmbryoOutcomeAddress;
  readonly branch: RewardBranchState;
  readonly threshold: ReachedTranscendentEmbryoThreshold;
  readonly targetOutcome: AuthoredTranscendentEmbryoOutcome | undefined;
}

function advanceTranscendentEmbryoAt(
  catalog: Catalog,
  branch: RewardBranchState,
  landing: AutomaticOutcomeLanding,
  sequence: number,
  routeKey: string,
  aspectKey: string,
): {
  /** The settled state, or none when the transformation blocked. */
  readonly branch: RewardBranchState | undefined;
  readonly blocked?: BlockedTranscendentEmbryo;
  readonly threshold?: TranscendentEmbryoLanding;
} {
  const owner = landing.owner;
  const source = branch.state.keepsakes.transcendentEmbryo;
  if (source === undefined) return Object.freeze({ branch });
  const progressed = advanceTranscendentEmbryoProgress(branch.state.keepsakes);
  const progressedBranch = Object.freeze({
    ...branch,
    state: Object.freeze({ ...branch.state, keepsakes: progressed.state }),
  });
  if (!progressed.reached) return Object.freeze({ branch: progressedBranch });
  const before = branch.state.traitHistory;
  const cycle = source.cycles + 1;
  const address = createTranscendentEmbryoOutcomeAddress(source.source, cycle);
  const targetOutcome = source.transformations[String(cycle)];
  const threshold = Object.freeze({
    source,
    cycle,
    before,
    eligibleBlessingKeys: transcendentEmbryoBlessingKeys(
      catalog,
      before,
      source.rarity,
      Object.freeze({
        routeKey,
        aspectKey,
        removedBlessingAcquisitionIdentity: source.markedBlessingAcquisitionIdentity,
      }),
    ),
  });
  const landed = Object.freeze({ address, landing, threshold });
  const assessment = assessTranscendentEmbryoTransformation(catalog, threshold, targetOutcome);
  if (!assessment.legal)
    return Object.freeze({
      branch: undefined,
      blocked: Object.freeze({ address, branch: progressedBranch, threshold, targetOutcome }),
      threshold: landed,
    });
  // The interval clears live loot options with or without a blessing to transform.
  const invalidation = invalidatedTraitOffers(owner, 'transcendentEmbryoInterval');
  const invalidate = (settled: RewardBranchState) =>
    invalidation === undefined ? settled : applyTraitOfferTransition(settled, invalidation);
  if (assessment.blessingKey === null)
    return Object.freeze({ branch: invalidate(progressedBranch), threshold: landed });
  const acquisitionIdentity = `${semanticAddressKey(address)}:${sequence}`;
  const traitHistory = foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directChaosBlessingRemoval' as const,
      owner: address,
      acquisitionRole: 'transcendentEmbryoTransformation' as const,
      sequence,
      acquisitionPoint: 'encounterEndEffectsApplied',
      acquisitionIdentity: source.markedBlessingAcquisitionIdentity,
    }),
    Object.freeze({
      kind: 'directChaosBlessing' as const,
      owner: address,
      acquisitionRole: 'transcendentEmbryoTransformation' as const,
      sequence,
      acquisitionPoint: 'encounterEndEffectsApplied',
      acquisitionIdentity,
      blessingKey: assessment.value!.blessingKey,
      rarity: source.rarity,
      blessingValues: assessment.value!.blessingValues,
    }),
  ]);
  return Object.freeze({
    branch: invalidate(
      Object.freeze({
        ...branch,
        state: replaceSimulationTraitHistory(
          Object.freeze({
            ...branch.state,
            keepsakes: replaceTranscendentEmbryoBlessing(
              progressed.state,
              assessment.value!,
              acquisitionIdentity,
            ),
          }),
          traitHistory,
        ),
      }),
    ),
    threshold: landed,
  });
}

/** Applies the exact post-encounter effects and returns all resulting frontiers. */
export function applyEncounterEndEffectsTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'encounterEndEffectsApplied' }>,
  room: CanonicalAuthoredRoom | undefined,
  received: RewardBranchState | undefined,
): EncounterEndEffectsTransition {
  const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
  let next = received;
  if (
    declaration?.advancesExperimentalHammerUses === true &&
    declaration.ignoreEncounterUses !== true &&
    !(room?.lifecycleProfileKey === 'FieldsCombatRoom' && event.phaseKey === 'Passive')
  )
    next = mapReached(next, (branch) =>
      advanceExperimentalHammerForEndEffects(catalog, branch, event.origin, event.sequence),
    );
  if (declaration?.ignoreEncounterUses !== true)
    next = mapReached(next, (branch) => advanceChaosClockAt(catalog, branch, event.sequence));
  next = mapReached(next, (branch) =>
    Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        stygianWell:
          declaration?.ignoreEncounterUses === true
            ? branch.state.stygianWell
            : advanceStygianWellClock(branch.state.stygianWell, 'encounters'),
      }),
    }),
  );
  const pickupOwner = event.origin.kind === 'occurrence' ? event.origin : undefined;
  const pickupAdvance =
    pickupOwner === undefined || declaration?.skipRoomsPerUpgrade === true || next === undefined
      ? undefined
      : advancePickupProducersAt(
          catalog,
          next,
          pickupOwner,
          event.sequence,
          declaration?.skipTimedDropResources === true ||
            (event.origin.routeKey === 'Dream' &&
              declaration?.skipTimedDropResourcesInDream === true),
        );
  if (pickupAdvance !== undefined) {
    next = pickupAdvance.branch;
  }
  const deliveryPlacementFindings: LifecycleFinding[] = [];
  const generatedPickupPlacements: GeneratedPickupPlacement[] = [];
  const recordedPhase =
    next === undefined
      ? undefined
      : projectRoomEncounterRecords(next.state.reached.historyView, event.origin).find(
          (phase) => phase.slotKey === event.phaseKey,
        );
  const encounterPhase =
    recordedPhase === undefined
      ? undefined
      : catalog.encounterDefinitions.byKey[recordedPhase.encounterKey];
  if (
    event.origin.kind === 'occurrence' &&
    declaration?.advancesHermesShrineDeliveryUses === true &&
    declaration.ignoreEncounterUses !== true &&
    encounterPhase?.advancesHermesShrineDeliveryUses === true
  ) {
    const deliveryHost = event.origin;
    next = mapReached(next, (branch) => {
      const pending = branch.state.pendingHermesShrineDeliveries;
      const deliveries = Object.fromEntries(
        Object.entries(pending).map(([key, delivery]) => {
          if (delivery.due !== undefined) return [key, delivery] as const;
          const remainingUses = delivery.remainingUses - 1;
          return [
            key,
            Object.freeze({
              ...delivery,
              remainingUses: Math.max(0, remainingUses),
              ...(remainingUses <= 0
                ? {
                    due: Object.freeze({
                      host: deliveryHost,
                      encounterPhaseKey: event.phaseKey,
                      cause: 'countdown' as const,
                      historySequence: event.sequence,
                    }),
                  }
                : {}),
            }),
          ] as const;
        }),
      );
      // A delivery falling due spawns with the encounter's expiring traits,
      // before the chamber-count effects below.
      return spawnDueHermesDeliveries(
        catalog,
        room,
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            pendingHermesShrineDeliveries: Object.freeze(deliveries),
          }),
        }),
        event.sequence,
      );
    });
  }
  const steadyOwner: OccurrenceAddress | undefined =
    event.origin.kind === 'occurrence' ? event.origin : undefined;
  const landing: AutomaticOutcomeLanding | undefined =
    steadyOwner === undefined
      ? undefined
      : Object.freeze({ owner: steadyOwner, phaseKey: event.phaseKey });
  // Fang decay and Bell growth share the RoomsPerUpgrade gate, before the chamber pass.
  if (steadyOwner !== undefined && declaration?.skipRoomsPerUpgrade !== true)
    next = mapReached(next, (branch) => {
      const keepsakes = advanceKeepsakeEncounterValues(catalog, branch.state.keepsakes);
      return keepsakes === branch.state.keepsakes
        ? branch
        : Object.freeze({ ...branch, state: Object.freeze({ ...branch.state, keepsakes }) });
    });
  const steadyAdvance =
    landing === undefined || declaration?.skipRoomsPerUpgrade === true || next === undefined
      ? undefined
      : advanceSteadyGrowthAt(catalog, next, landing, event.sequence);
  const embryoAdvance =
    steadyAdvance?.branch === undefined
      ? undefined
      : advanceTranscendentEmbryoAt(
          catalog,
          steadyAdvance.branch,
          landing!,
          event.sequence,
          event.origin.routeKey,
          '',
        );
  // Every automatic end effect settles before any generated pickup or delivery
  // frontier is published; a blocked outcome publishes neither.
  const final =
    embryoAdvance !== undefined
      ? embryoAdvance.branch
      : steadyAdvance !== undefined
        ? steadyAdvance.branch
        : next;
  const derivedAcquisitionEntryFrontiers: DerivedAcquisitionEntryFrontier[] = [];
  if (pickupAdvance !== undefined && pickupOwner !== undefined && final !== undefined) {
    const maturitiesByKey = new Map<string, ReachedPickupProducerMaturity>();
    for (const maturity of pickupAdvance.maturities)
      maturitiesByKey.set(pickupMaturityKey(maturity), maturity);
    const site = createAcquisitionSiteAddress(pickupOwner, 'roomExit');
    for (const maturity of maturitiesByKey.values()) {
      for (const pickup of maturity.pickups) {
        const fixedReward = createUnresolvedAcquisitionRewardState(
          catalog,
          { rewardType: pickup.rewardType },
          { kind: 'producerLifecycle', key: maturity.producerLifecycleKey },
          site.routeKey,
        );
        derivedAcquisitionEntryFrontiers.push(
          Object.freeze({
            address: createAcquisitionEntryAddress(
              site,
              clockedTraitGeneratedPickupEntryKey(maturity.acquisitionIdentity, pickup.key),
            ),
            kind: 'clockedTraitPickup',
            historySequence: event.sequence,
            rewardTypes: Object.freeze([pickup.rewardType]),
            fixedReward,
            producerLifecycleKey: maturity.producerLifecycleKey,
            traitKey: maturity.traitKey,
            encounterPhaseKey: event.phaseKey,
            participation: 'optional',
            beforeEntry: final,
          }),
        );
      }
    }
  }
  if (
    event.origin.kind === 'occurrence' &&
    declaration?.advancesHermesShrineDeliveryUses === true &&
    declaration.ignoreEncounterUses !== true &&
    encounterPhase?.advancesHermesShrineDeliveryUses === true
  ) {
    const due = dueHermesShrineDeliveryFrontier(
      catalog,
      room,
      event.origin,
      final,
      event.sequence,
      event.phaseKey,
    );
    deliveryPlacementFindings.push(...due.findings);
    generatedPickupPlacements.push(...due.generatedPickupPlacements);
    derivedAcquisitionEntryFrontiers.push(...due.frontiers);
  }
  const timelineNodes: PlannerTimelineNode[] = [
    ...(steadyAdvance?.thresholds ?? []).map(({ address }) =>
      Object.freeze({ owner: address, included: true }),
    ),
    ...(embryoAdvance?.threshold === undefined
      ? []
      : [Object.freeze({ owner: embryoAdvance.threshold.address, included: true })]),
  ];
  const timelineFacts: PlannerTimelineFacts =
    timelineNodes.length === 0
      ? EMPTY_PLANNER_TIMELINE_FACTS
      : Object.freeze({ nodes: Object.freeze(timelineNodes), dependencies: Object.freeze([]) });
  const findings: LifecycleFinding[] = [...deliveryPlacementFindings];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const steadyBlocked = steadyAdvance?.blocked;
  for (const blocked of steadyBlocked === undefined ? [] : [steadyBlocked]) {
    traitChildSettlements.push(Object.freeze({ address: blocked.address, branch: blocked.branch }));
    findings.push(
      Object.freeze({
        finding: rewardFinding(
          blocked.threshold.targetTraitKey === undefined
            ? 'steadyGrowthOutcomeMissing'
            : 'steadyGrowthOutcomeUnavailable',
          blocked.address,
          Object.freeze({
            sourceTraitKey: blocked.threshold.traitKey,
            requiredInterval: blocked.threshold.requiredInterval,
            eligibleTargetKeys: blocked.threshold.eligibleTargetKeys,
            ...(blocked.threshold.targetTraitKey === undefined
              ? {}
              : { targetTraitKey: blocked.threshold.targetTraitKey }),
          }),
        ),
        region: ownerRegion(blocked.address),
        chronology: Object.freeze({
          kind: 'history',
          sequence: event.sequence,
          boundary: 'at',
          occurrence: landing!.owner,
        }),
      }),
    );
  }
  const embryoBlocked = embryoAdvance?.blocked;
  for (const blocked of embryoBlocked === undefined ? [] : [embryoBlocked]) {
    traitChildSettlements.push(Object.freeze({ address: blocked.address, branch: blocked.branch }));
    findings.push(
      Object.freeze({
        finding: rewardFinding(
          blocked.targetOutcome === undefined
            ? 'transcendentEmbryoOutcomeMissing'
            : 'transcendentEmbryoOutcomeUnavailable',
          blocked.address,
          Object.freeze({
            sourceBlessingKey: blocked.threshold.source.markedBlessingKey,
            transformationRarity: blocked.threshold.source.rarity,
            eligibleBlessingKeys: blocked.threshold.eligibleBlessingKeys,
            ...(blocked.targetOutcome === undefined
              ? {}
              : { targetBlessingKey: blocked.targetOutcome.blessingKey }),
          }),
        ),
        region: ownerRegion(blocked.address),
        chronology: Object.freeze({
          kind: 'history',
          sequence: event.sequence,
          boundary: 'at',
          occurrence: landing!.owner,
        }),
      }),
    );
  }
  return Object.freeze({
    branch: advanceReachedBranch(final, event.sequence),
    generatedPickupPlacements: Object.freeze(generatedPickupPlacements),
    derivedAcquisitionEntryFrontiers: Object.freeze(derivedAcquisitionEntryFrontiers),
    hermesShrineDeliveryPlacementRequired: deliveryPlacementFindings.length > 0,
    steadyGrowthThresholds: steadyAdvance?.thresholds ?? Object.freeze([]),
    transcendentEmbryoThresholds:
      embryoAdvance?.threshold === undefined
        ? Object.freeze([])
        : Object.freeze([embryoAdvance.threshold]),
    traitChildSettlements: Object.freeze(traitChildSettlements),
    timelineFacts,
    findings: Object.freeze(findings),
  });
}
