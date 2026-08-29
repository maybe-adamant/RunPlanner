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
  advanceSteadyGrowthProgress,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  settleSteadyGrowthThreshold,
  type ReachedSteadyGrowthThreshold,
} from '../../../traits';
import { advanceStygianWellEncounterUses } from '../../../stygian-well';
import {
  advanceExperimentalHammers,
  assessTranscendentEmbryoTransformation,
  advanceTranscendentEmbryoProgress,
  replaceTranscendentEmbryoBlessing,
  transcendentEmbryoBlessingKeys,
  transcendentEmbryoBlessingValues,
  type ReachedTranscendentEmbryoThreshold,
} from '../../../keepsakes';
import type { DerivedAcquisitionEntryFrontier } from '../../acquisition-settlement';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../processing';
import { rewardFinding } from '../../findings';
import type { ReachedTraitChildCheckpoint } from '../../trait-settlement';
import type { LifecycleFinding } from './types';

export interface EncounterEndEffectsTransition {
  readonly branches: readonly RewardBranchState[];
  readonly derivedAcquisitionEntryFrontiers: readonly DerivedAcquisitionEntryFrontier[];
  readonly steadyGrowthThresholds: readonly {
    readonly address: SteadyGrowthOutcomeAddress;
    readonly threshold: ReachedSteadyGrowthThreshold;
  }[];
  readonly transcendentEmbryoThresholds: readonly {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
  }[];
  readonly traitChildSettlements: readonly ReachedTraitChildCheckpoint[];
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

function advanceTranscendentEmbryoAt(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  owner: TranscendentEmbryoOutcomeAddress['owner'],
  phaseKey: string,
  targetBlessingKey: string | null | undefined,
  sequence: number,
  routeKey: string,
  aspectKey: string,
): {
  readonly branches: readonly RewardBranchState[];
  readonly blocked: readonly {
    readonly address: TranscendentEmbryoOutcomeAddress;
    readonly branch: RewardBranchState;
    readonly threshold: ReachedTranscendentEmbryoThreshold;
    readonly targetBlessingKey: string | null | undefined;
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
    readonly targetBlessingKey: string | null | undefined;
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
    const assessment = assessTranscendentEmbryoTransformation(
      catalog,
      threshold,
      targetBlessingKey,
    );
    if (!assessment.legal) {
      blocked.push(
        Object.freeze({
          address,
          branch: Object.freeze({ ...branch, keepsakes: progressed.state }),
          threshold,
          targetBlessingKey,
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
        blessingKey: assessment.blessingKey,
        rarity: source.rarity,
        blessingValues: transcendentEmbryoBlessingValues(
          catalog,
          assessment.blessingKey,
          source.rarity,
        ),
      }),
    ]);
    next.push(
      Object.freeze({
        ...branch,
        keepsakes: replaceTranscendentEmbryoBlessing(
          progressed.state,
          assessment.blessingKey,
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
    !(room?.lifecycleProfileKey === 'FieldsCombatRoom' && event.phaseKey === 'Passive')
  )
    next = advanceExperimentalHammerForEndEffects(catalog, next, event.origin, event.sequence);
  next = advanceChaosClockAt(catalog, next, event.sequence);
  next = Object.freeze(
    next.map((branch) =>
      Object.freeze({
        ...branch,
        stygianWell: advanceStygianWellEncounterUses(branch.stygianWell),
      }),
    ),
  );
  const derivedAcquisitionEntryFrontiers: DerivedAcquisitionEntryFrontier[] = [];
  if (event.origin.kind === 'occurrence') {
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
    for (const branch of next) {
      for (const delivery of Object.values(branch.pendingHermesShrineDeliveries)) {
        if (
          delivery.dueAt === undefined ||
          semanticAddressKey(delivery.dueAt) !== semanticAddressKey(deliveryHost)
        )
          continue;
        const site = createAcquisitionSiteAddress(deliveryHost, 'hermesShrineDelivery');
        const entryKey = hermesShrineDeliveryEntryKey(
          delivery.sourceOrigin,
          delivery.generationKey,
        );
        const retained =
          room?.kind === 'authored'
            ? room.acquisitionSites?.hermesShrineDelivery?.entries[entryKey]
            : undefined;
        const fixedReward = defaultHermesShrineDeliveryReward(catalog, delivery.rewardType);
        derivedAcquisitionEntryFrontiers.push(
          Object.freeze({
            address: createAcquisitionEntryAddress(site, entryKey),
            kind: 'hermesShrineDelivery',
            branchCohortSize: next.length,
            rewardTypes: Object.freeze([delivery.rewardType]),
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
  if (steadyAdvance === undefined)
    return Object.freeze({
      branches: advanceRewardBranches(next, event.sequence),
      derivedAcquisitionEntryFrontiers: Object.freeze(derivedAcquisitionEntryFrontiers),
      steadyGrowthThresholds: Object.freeze([]),
      transcendentEmbryoThresholds: Object.freeze([]),
      traitChildSettlements: Object.freeze([]),
      findings: Object.freeze([]),
    });
  const embryoTarget =
    room?.kind === 'authored'
      ? room.encounters.transcendentEmbryoBlessingByPhase?.[event.phaseKey]
      : undefined;
  const embryoAdvance = advanceTranscendentEmbryoAt(
    catalog,
    steadyAdvance.branches,
    steadyOwner!,
    event.phaseKey,
    embryoTarget,
    event.sequence,
    event.origin.routeKey,
    '',
  );
  const findings: LifecycleFinding[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  for (const blocked of steadyAdvance.blocked) {
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
        region: ownerRegion(event.origin),
        chronology: Object.freeze({ kind: 'history', sequence: event.sequence, boundary: 'at' }),
      }),
    );
  }
  for (const blocked of embryoAdvance.blocked) {
    traitChildSettlements.push(Object.freeze({ address: blocked.address, branch: blocked.branch }));
    findings.push(
      Object.freeze({
        finding: rewardFinding(
          blocked.targetBlessingKey === undefined
            ? 'transcendentEmbryoOutcomeMissing'
            : 'transcendentEmbryoOutcomeUnavailable',
          blocked.address,
          Object.freeze({
            sourceBlessingKey: blocked.threshold.source.markedBlessingKey,
            transformationRarity: blocked.threshold.source.rarity,
            eligibleBlessingKeys: blocked.threshold.eligibleBlessingKeys,
            ...(blocked.targetBlessingKey === undefined
              ? {}
              : { targetBlessingKey: blocked.targetBlessingKey }),
          }),
        ),
        region: ownerRegion(event.origin),
        chronology: Object.freeze({ kind: 'history', sequence: event.sequence, boundary: 'at' }),
      }),
    );
  }
  return Object.freeze({
    branches: advanceRewardBranches(embryoAdvance.branches, event.sequence),
    derivedAcquisitionEntryFrontiers: Object.freeze(derivedAcquisitionEntryFrontiers),
    steadyGrowthThresholds: steadyAdvance.thresholds,
    transcendentEmbryoThresholds: embryoAdvance.thresholds,
    traitChildSettlements: Object.freeze(traitChildSettlements),
    findings: Object.freeze(findings),
  });
}
