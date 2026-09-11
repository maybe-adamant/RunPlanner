import type { Catalog } from '../../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  semanticAddressKey,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '../../../../authored-project/addresses';
import {
  defaultHermesShrineDeliveryReward,
  hermesShrineDeliveryEntryKey,
} from '../../../../authored-project/hermes-shrine-delivery';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion } from '../../../finding-regions';
import {
  attachTraitHistory,
  advanceChaosClock,
  advancePickupProducerProgress,
  advanceSteadyGrowthProgress,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  settleSteadyGrowthThreshold,
  type ReachedSteadyGrowthThreshold,
  type ReachedPickupProducerMaturity,
} from '../../../traits';
import { advanceStygianWellEncounterUses } from '../../../stygian-well';
import {
  advanceExperimentalHammers,
  assessTranscendentEmbryoTransformation,
  advanceTranscendentEmbryoProgress,
  replaceTranscendentEmbryoBlessing,
  transcendentEmbryoBlessingKeys,
  type ReachedTranscendentEmbryoThreshold,
} from '../../../keepsakes';
import {
  createUnresolvedAcquisitionRewardState,
  type AuthoredTranscendentEmbryoOutcome,
} from '../../../../authored-project/traits';
import { clockedTraitGeneratedPickupEntryKey } from '../../../../authored-project/pickup-producers';
import type { DerivedAcquisitionEntryFrontier } from '../../acquisition-settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';
import { rewardFinding } from '../../findings';
import type { ReachedTraitChildCheckpoint } from '../../trait-settlement';
import type { LifecycleFinding } from './types';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  type PlannerTimelineFacts,
  type PlannerTimelineNode,
} from '../../../timeline-facts';

export interface EncounterEndEffectsTransition {
  readonly branches: readonly RewardBranchState[];
  readonly derivedAcquisitionEntryFrontiers: readonly DerivedAcquisitionEntryFrontier[];
  /** A due Shrine delivery has no exact ranked/retained host action yet. */
  readonly hermesShrineDeliveryPlacementRequired: boolean;
  readonly steadyGrowthThresholds: readonly {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly threshold: ReachedSteadyGrowthThreshold;
  }[];
  readonly transcendentEmbryoThresholds: readonly {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
  }[];
  readonly traitChildSettlements: readonly ReachedTraitChildCheckpoint[];
  /** Automatic outcomes are retained only when this transition reached them. */
  readonly timelineFacts: PlannerTimelineFacts;
  readonly findings: readonly LifecycleFinding[];
}

function advanceExperimentalHammerForEndEffects(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  owner: SemanticAddress,
  sequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(
    branches.map((branch) => {
      const advanced = advanceExperimentalHammers(branch.keepsakes);
      if (advanced.state === branch.keepsakes) return branch;
      if (advanced.expired.length === 0)
        return Object.freeze({ ...branch, keepsakes: advanced.state });
      const prior = branch.traitHistory ?? createTraitHistoryState();
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
        history: attachTraitHistory(branch.history, traitHistory),
        traitHistory,
        keepsakes: advanced.state,
      });
    }),
  );
}

function advanceChaosClockAt(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  sequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(
    branches.map((branch) => {
      const before = branch.traitHistory ?? createTraitHistoryState();
      const traitHistory = advanceChaosClock(catalog, before, sequence, 'encounters');
      return traitHistory === before
        ? branch
        : Object.freeze({
            ...branch,
            traitHistory,
            history: attachTraitHistory(branch.history, traitHistory),
          });
    }),
  );
}

function advancePickupProducersAt(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  owner: Extract<SemanticAddress, { readonly kind: 'occurrence' }>,
  sequence: number,
  deferMaturity: boolean,
): {
  readonly branches: readonly RewardBranchState[];
  readonly maturities: readonly ReachedPickupProducerMaturity[];
} {
  const next: RewardBranchState[] = [];
  const maturities: ReachedPickupProducerMaturity[] = [];
  for (const branch of branches) {
    const before = branch.traitHistory ?? createTraitHistoryState();
    const advanced = advancePickupProducerProgress(catalog, before, owner, sequence, deferMaturity);
    const updated =
      advanced.history === before
        ? branch
        : Object.freeze({
            ...branch,
            traitHistory: advanced.history,
            history: attachTraitHistory(branch.history, advanced.history),
          });
    next.push(updated);
    for (const maturity of advanced.maturities) maturities.push(maturity);
  }
  return Object.freeze({ branches: Object.freeze(next), maturities: Object.freeze(maturities) });
}

function advanceSteadyGrowthAt(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  owner: SteadyGrowthOutcomeAddress['owner'],
  phaseKey: string,
  targetTraitKey: string | undefined,
  sequence: number,
): {
  readonly branches: readonly RewardBranchState[];
  readonly blocked: readonly {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly branch: RewardBranchState;
    readonly threshold: ReachedSteadyGrowthThreshold;
    readonly targetTraitKey: string | undefined;
  }[];
  readonly thresholds: readonly {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly threshold: ReachedSteadyGrowthThreshold;
  }[];
} {
  const next: RewardBranchState[] = [];
  const blocked: {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly branch: RewardBranchState;
    readonly threshold: ReachedSteadyGrowthThreshold;
    readonly targetTraitKey: string | undefined;
  }[] = [];
  const thresholds: {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly threshold: ReachedSteadyGrowthThreshold;
  }[] = [];
  for (const branch of branches) {
    const before = branch.traitHistory ?? createTraitHistoryState();
    const advanced = advanceSteadyGrowthProgress(catalog, before, owner, sequence);
    let traitHistory = advanced.history;
    let blockedAtThreshold = false;
    for (const threshold of advanced.thresholds) {
      const address = createSteadyGrowthOutcomeAddress(owner, phaseKey);
      thresholds.push(Object.freeze({ address, threshold }));
      const settled = settleSteadyGrowthThreshold(
        catalog,
        traitHistory,
        owner,
        sequence,
        threshold,
        targetTraitKey,
      );
      if (!settled.assessment.legal) {
        blocked.push(
          Object.freeze({
            address,
            branch: Object.freeze({
              ...branch,
              traitHistory,
              history: attachTraitHistory(branch.history, traitHistory),
            }),
            threshold,
            targetTraitKey,
          }),
        );
        blockedAtThreshold = true;
        break;
      }
      traitHistory = settled.history;
    }
    if (!blockedAtThreshold)
      next.push(
        traitHistory === before
          ? branch
          : Object.freeze({
              ...branch,
              traitHistory,
              history: attachTraitHistory(branch.history, traitHistory),
            }),
      );
  }
  return Object.freeze({
    branches: Object.freeze(next),
    blocked: Object.freeze(blocked),
    thresholds: Object.freeze(thresholds),
  });
}

function pickupMaturityKey(maturity: ReachedPickupProducerMaturity): string {
  return `${maturity.traitKey}:${maturity.acquisitionIdentity}:${maturity.producerLifecycleKey}`;
}

/**
 * A maturity is eligible for a frontier only when its own final branch still
 * carries the progress event that reached it. This keeps automatic effects
 * branch-local: a branch removed by Steady Growth or Embryo cannot leak its
 * generated pickup into a surviving branch.
 */
function branchReachedPickupMaturity(
  branch: RewardBranchState,
  maturity: ReachedPickupProducerMaturity,
  sequence: number,
): boolean {
  return (
    branch.traitHistory?.events.some(
      (historyEvent) =>
        historyEvent.kind === 'pickupProducerProgress' &&
        historyEvent.sequence === sequence &&
        historyEvent.traitKey === maturity.traitKey &&
        historyEvent.acquisitionIdentity === maturity.acquisitionIdentity &&
        historyEvent.matured,
    ) ?? false
  );
}

function advanceTranscendentEmbryoAt(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  owner: TranscendentEmbryoOutcomeAddress['owner'],
  phaseKey: string,
  targetOutcome: AuthoredTranscendentEmbryoOutcome | null | undefined,
  sequence: number,
  routeKey: string,
  aspectKey: string,
): {
  readonly branches: readonly RewardBranchState[];
  readonly blocked: readonly {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly branch: RewardBranchState;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
    readonly targetOutcome: AuthoredTranscendentEmbryoOutcome | null | undefined;
  }[];
  readonly thresholds: readonly {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
  }[];
} {
  const next: RewardBranchState[] = [];
  const blocked: {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly branch: RewardBranchState;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
    readonly targetOutcome: AuthoredTranscendentEmbryoOutcome | null | undefined;
  }[] = [];
  const thresholds: {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
  }[] = [];
  const address = createTranscendentEmbryoOutcomeAddress(owner, phaseKey);
  for (const branch of branches) {
    const source = branch.keepsakes.transcendentEmbryo;
    if (source === undefined) {
      next.push(branch);
      continue;
    }
    const progressed = advanceTranscendentEmbryoProgress(branch.keepsakes);
    if (!progressed.reached) {
      next.push(Object.freeze({ ...branch, keepsakes: progressed.state }));
      continue;
    }
    const before = branch.traitHistory ?? createTraitHistoryState();
    const threshold = Object.freeze({
      source,
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
    thresholds.push(Object.freeze({ address, threshold }));
    const assessment = assessTranscendentEmbryoTransformation(catalog, threshold, targetOutcome);
    if (!assessment.legal) {
      blocked.push(
        Object.freeze({
          address,
          branch: Object.freeze({ ...branch, keepsakes: progressed.state }),
          threshold,
          targetOutcome,
        }),
      );
      continue;
    }
    if (assessment.blessingKey === null) {
      next.push(Object.freeze({ ...branch, keepsakes: progressed.state }));
      continue;
    }
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
    next.push(
      Object.freeze({
        ...branch,
        keepsakes: replaceTranscendentEmbryoBlessing(
          progressed.state,
          assessment.value!,
          acquisitionIdentity,
        ),
        history: attachTraitHistory(branch.history, traitHistory),
        traitHistory,
      }),
    );
  }
  return Object.freeze({
    branches: Object.freeze(next),
    blocked: Object.freeze(blocked),
    thresholds: Object.freeze(thresholds),
  });
}

/** Applies the exact post-encounter effects and returns all resulting frontiers. */
export function applyEncounterEndEffectsTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'encounterEndEffectsApplied' }>,
  room: CanonicalAuthoredRoom | undefined,
  enteredBiomeCount: number,
  fullRunBiomeCount: number,
  branches: readonly RewardBranchState[],
): EncounterEndEffectsTransition {
  const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
  let next = branches;
  if (
    declaration?.advancesExperimentalHammerUses === true &&
    declaration.ignoreEncounterUses !== true &&
    !(room?.lifecycleProfileKey === 'FieldsCombatRoom' && event.phaseKey === 'Passive')
  )
    next = advanceExperimentalHammerForEndEffects(catalog, next, event.origin, event.sequence);
  if (declaration?.ignoreEncounterUses !== true)
    next = advanceChaosClockAt(catalog, next, event.sequence);
  next = Object.freeze(
    next.map((branch) =>
      Object.freeze({
        ...branch,
        stygianWell:
          declaration?.ignoreEncounterUses === true
            ? branch.stygianWell
            : advanceStygianWellEncounterUses(branch.stygianWell),
      }),
    ),
  );
  const pickupOwner = event.origin.kind === 'occurrence' ? event.origin : undefined;
  const pickupAdvance =
    pickupOwner === undefined || declaration?.skipRoomsPerUpgrade === true
      ? undefined
      : advancePickupProducersAt(
          catalog,
          next,
          pickupOwner,
          event.sequence,
          declaration?.skipTimedDropResources === true,
        );
  if (pickupAdvance !== undefined) {
    next = pickupAdvance.branches;
  }
  const deliveryPlacementFindings: LifecycleFinding[] = [];
  const encounterPhase = room?.encounterPhases?.find((phase) => phase.slotKey === event.phaseKey);
  if (
    event.origin.kind === 'occurrence' &&
    declaration?.advancesHermesShrineDeliveryUses === true &&
    declaration.ignoreEncounterUses !== true &&
    encounterPhase?.advancesHermesShrineDeliveryUses === true
  ) {
    const deliveryHost = event.origin;
    next = Object.freeze(
      next.map((branch) => {
        const pending = branch.pendingHermesShrineDeliveries;
        const deliveries = Object.fromEntries(
          Object.entries(pending).map(([key, delivery]) => {
            if (delivery.dueAt !== undefined) return [key, delivery] as const;
            const forceComplete =
              enteredBiomeCount === fullRunBiomeCount && declaration?.kind === 'Preboss';
            const remainingUses = forceComplete ? 0 : delivery.remainingUses - 1;
            return [
              key,
              Object.freeze({
                ...delivery,
                remainingUses: Math.max(0, remainingUses),
                ...(remainingUses <= 0 ? { dueAt: deliveryHost, dueSequence: event.sequence } : {}),
              }),
            ] as const;
          }),
        );
        return Object.freeze({
          ...branch,
          pendingHermesShrineDeliveries: Object.freeze(deliveries),
        });
      }),
    );
  }
  const steadyOwner: SteadyGrowthOutcomeAddress['owner'] | undefined =
    event.origin.kind === 'occurrence' ? event.origin : undefined;
  const steadyGrowthTarget =
    room?.kind === 'authored'
      ? room.encounters.steadyGrowthTargetByPhase?.[event.phaseKey]
      : undefined;
  const steadyAdvance =
    steadyOwner === undefined || declaration?.skipRoomsPerUpgrade === true
      ? undefined
      : advanceSteadyGrowthAt(
          catalog,
          next,
          steadyOwner,
          event.phaseKey,
          steadyGrowthTarget,
          event.sequence,
        );
  const embryoTarget =
    room?.kind === 'authored'
      ? room.encounters.transcendentEmbryoBlessingByPhase?.[event.phaseKey]
      : undefined;
  const embryoAdvance =
    steadyAdvance === undefined
      ? undefined
      : advanceTranscendentEmbryoAt(
          catalog,
          steadyAdvance.branches,
          steadyOwner!,
          event.phaseKey,
          embryoTarget,
          event.sequence,
          event.origin.routeKey,
          '',
        );
  // All automatic end-effects branches must settle before any generated
  // pickup or delivery frontier is published. The matching below uses the
  // progress event retained by each final branch, so a filtered branch cannot
  // leak its maturity into another branch.
  const finalBranches = embryoAdvance?.branches ?? steadyAdvance?.branches ?? next;
  const derivedAcquisitionEntryFrontiers: DerivedAcquisitionEntryFrontier[] = [];
  if (pickupAdvance !== undefined && pickupOwner !== undefined) {
    const maturitiesByKey = new Map<string, ReachedPickupProducerMaturity>();
    for (const maturity of pickupAdvance.maturities)
      maturitiesByKey.set(pickupMaturityKey(maturity), maturity);
    const site = createAcquisitionSiteAddress(pickupOwner, 'roomExit');
    for (const branch of finalBranches) {
      for (const maturity of maturitiesByKey.values()) {
        if (!branchReachedPickupMaturity(branch, maturity, event.sequence)) continue;
        for (const pickup of maturity.pickups) {
          const fixedReward = createUnresolvedAcquisitionRewardState(
            catalog,
            { rewardType: pickup.rewardType },
            { kind: 'producerLifecycle', key: maturity.producerLifecycleKey },
          );
          derivedAcquisitionEntryFrontiers.push(
            Object.freeze({
              address: createAcquisitionEntryAddress(
                site,
                clockedTraitGeneratedPickupEntryKey(maturity.acquisitionIdentity, pickup.key),
              ),
              kind: 'clockedTraitPickup',
              branchCohortSize: finalBranches.length,
              rewardTypes: Object.freeze([pickup.rewardType]),
              fixedReward,
              producerLifecycleKey: maturity.producerLifecycleKey,
              encounterPhaseKey: event.phaseKey,
              participation: 'optional',
              branchesBeforeEntry: Object.freeze([branch]),
            }),
          );
        }
      }
    }
  }
  if (
    event.origin.kind === 'occurrence' &&
    declaration?.advancesHermesShrineDeliveryUses === true &&
    declaration.ignoreEncounterUses !== true &&
    encounterPhase?.advancesHermesShrineDeliveryUses === true
  ) {
    const deliveryHost = event.origin;
    const site = createAcquisitionSiteAddress(deliveryHost, 'hermesShrineDelivery');
    for (const branch of finalBranches) {
      for (const delivery of Object.values(branch.pendingHermesShrineDeliveries)) {
        if (
          delivery.dueAt === undefined ||
          semanticAddressKey(delivery.dueAt) !== semanticAddressKey(deliveryHost)
        )
          continue;
        const entryKey = hermesShrineDeliveryEntryKey(
          delivery.sourceOrigin,
          delivery.generationKey,
        );
        const retained =
          room?.kind === 'authored'
            ? room.acquisitionSites?.hermesShrineDelivery?.entries[entryKey]
            : undefined;
        const fixedReward = defaultHermesShrineDeliveryReward(catalog, delivery.rewardType);
        const hasExactDeliveryAction =
          room?.kind === 'authored' &&
          room.roomActionRoster?.rows.some(
            (row) =>
              row.reference.kind === 'interactAcquisitionEntry' &&
              row.reference.siteKey === 'hermesShrineDelivery' &&
              row.reference.entryKey === entryKey &&
              row.reference.encounterPhaseKey === event.phaseKey,
          );
        if (retained === undefined || !hasExactDeliveryAction)
          deliveryPlacementFindings.push(
            Object.freeze({
              finding: rewardFinding(
                'hermesShrineDeliveryPlacementRequired',
                createAcquisitionEntryAddress(site, entryKey),
                { sourceKey: delivery.sourceKey, encounterPhaseKey: event.phaseKey },
              ),
              region: ownerRegion(createAcquisitionEntryAddress(site, entryKey)),
              chronology: Object.freeze({
                kind: 'history' as const,
                sequence: event.sequence,
                boundary: 'at' as const,
              }),
            }),
          );
        derivedAcquisitionEntryFrontiers.push(
          Object.freeze({
            address: createAcquisitionEntryAddress(site, entryKey),
            kind: 'hermesShrineDelivery',
            branchCohortSize: finalBranches.length,
            rewardTypes: Object.freeze([delivery.rewardType]),
            encounterPhaseKey: event.phaseKey,
            ...(fixedReward === null ? {} : { fixedReward }),
            retainedSourceMismatch:
              retained !== undefined &&
              retained !== null &&
              retained.offer.rewardType !== delivery.rewardType,
            branchesBeforeEntry: Object.freeze([branch]),
          }),
        );
      }
    }
  }
  const timelineNodes: PlannerTimelineNode[] = [
    ...(steadyAdvance?.thresholds ?? []).map(({ address }) =>
      Object.freeze({ owner: address, included: true }),
    ),
    ...(embryoAdvance?.thresholds ?? []).map(({ address }) =>
      Object.freeze({ owner: address, included: true }),
    ),
  ];
  const timelineFacts: PlannerTimelineFacts =
    timelineNodes.length === 0
      ? EMPTY_PLANNER_TIMELINE_FACTS
      : Object.freeze({ nodes: Object.freeze(timelineNodes), dependencies: Object.freeze([]) });
  const findings: LifecycleFinding[] = [...deliveryPlacementFindings];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  for (const blocked of steadyAdvance?.blocked ?? []) {
    traitChildSettlements.push(Object.freeze({ address: blocked.address, branch: blocked.branch }));
    findings.push(
      Object.freeze({
        finding: rewardFinding(
          blocked.targetTraitKey === undefined
            ? 'steadyGrowthOutcomeMissing'
            : 'steadyGrowthOutcomeUnavailable',
          blocked.address,
          Object.freeze({
            sourceTraitKey: blocked.threshold.traitKey,
            requiredInterval: blocked.threshold.requiredInterval,
            eligibleTargetKeys: blocked.threshold.eligibleTargetKeys,
            ...(blocked.targetTraitKey === undefined
              ? {}
              : { targetTraitKey: blocked.targetTraitKey }),
          }),
        ),
        region: ownerRegion(blocked.address),
        chronology: Object.freeze({ kind: 'history', sequence: event.sequence, boundary: 'at' }),
      }),
    );
  }
  for (const blocked of embryoAdvance?.blocked ?? []) {
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
              : {
                  targetBlessingKey:
                    blocked.targetOutcome === null ? null : blocked.targetOutcome.blessingKey,
                }),
          }),
        ),
        region: ownerRegion(blocked.address),
        chronology: Object.freeze({ kind: 'history', sequence: event.sequence, boundary: 'at' }),
      }),
    );
  }
  return Object.freeze({
    branches: advanceRewardBranches(finalBranches, event.sequence),
    derivedAcquisitionEntryFrontiers: Object.freeze(derivedAcquisitionEntryFrontiers),
    hermesShrineDeliveryPlacementRequired: deliveryPlacementFindings.length > 0,
    steadyGrowthThresholds: steadyAdvance?.thresholds ?? Object.freeze([]),
    transcendentEmbryoThresholds: embryoAdvance?.thresholds ?? Object.freeze([]),
    traitChildSettlements: Object.freeze(traitChildSettlements),
    timelineFacts,
    findings: Object.freeze(findings),
  });
}
