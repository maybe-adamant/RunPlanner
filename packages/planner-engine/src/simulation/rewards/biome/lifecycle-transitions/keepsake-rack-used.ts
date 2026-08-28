import type { Catalog } from '../../../../catalog-schema';
import {
  createKeepsakeEquipResultAddress,
  createPostbossKeepsakeSelectionAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import type { RouteLoadout } from '../../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion } from '../../../finding-regions';
import {
  applyKeepsakeReplacement,
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  invalidateJeweledPom,
  jeweledPomEffectForKey,
  applyTranscendentEmbryoEquipResult,
  assessTranscendentEmbryoBlessing,
  keepsakeRankForEquip,
  keepsakeSelectionUnavailableReason,
} from '../../../keepsakes';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../../traits';
import type {
  KeepsakeEquipResultCandidateCapability,
  KeepsakeSelectionCandidateCapability,
} from '../../../candidate-artifacts';
import type { RewardBranchState } from '../../branch-primitives';
import {
  applyExperimentalHammerEquipResult,
  applyJeweledPomEquipResult,
  applyOlympianRewardPressureEquip,
  applyMoonBeamEquip,
} from '../../processing';
import { rewardFinding } from '../../findings';
import type { LifecycleFinding } from './types';

export interface KeepsakeRackUsedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly keepsakeSelectionCandidate?: {
    readonly key: string;
    readonly candidate: KeepsakeSelectionCandidateCapability;
  };
  readonly keepsakeEquipResultCandidates: readonly {
    readonly key: string;
    readonly candidate: KeepsakeEquipResultCandidateCapability;
  }[];
  readonly findings: readonly LifecycleFinding[];
}

function detachTranscendentEmbryoBlessing(
  catalog: Catalog,
  branch: RewardBranchState,
  owner: ReturnType<typeof createPostbossKeepsakeSelectionAddress>,
  sequence: number,
): RewardBranchState {
  const source = branch.keepsakes.transcendentEmbryo;
  if (
    source === undefined ||
    source.origin !== 'ordinary' ||
    branch.keepsakes.currentKey !== 'RandomBlessingKeepsake'
  )
    return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  const traitHistory = foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directChaosBlessingRemoval' as const,
      owner,
      acquisitionRole: 'transcendentEmbryoRackReplacement' as const,
      sequence,
      acquisitionPoint: 'keepsakeRackUsed',
      acquisitionIdentity: source.markedBlessingAcquisitionIdentity,
    }),
  ]);
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
  });
}

/** Applies a ranked postboss rack and emits its exact pre-selection/equip frontiers. */
export function applyKeepsakeRackUsedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'keepsakeRackUsed' }>,
  room: CanonicalAuthoredRoom | undefined,
  historyAtRack: ProgressiveRoomHistoryViews['entry'] | undefined,
  routeLoadout: RouteLoadout,
  branches: readonly RewardBranchState[],
  effectiveBiomeNumber: number,
): KeepsakeRackUsedTransition {
  const findings: LifecycleFinding[] = [];
  const keepsakeEquipResultCandidates: {
    readonly key: string;
    readonly candidate: KeepsakeEquipResultCandidateCapability;
  }[] = [];
  if (room?.keepsakeRack === undefined || event.origin.kind !== 'occurrence')
    return Object.freeze({
      branches,
      keepsakeEquipResultCandidates: Object.freeze(keepsakeEquipResultCandidates),
      findings: Object.freeze(findings),
    });

  const rack = room.keepsakeRack;
  const keepsakeKey = rack.keepsakeKey;
  const selection = createPostbossKeepsakeSelectionAddress(event.origin);
  const encounterBlockedKeepsakeKeys = Object.freeze([
    ...new Set(
      historyAtRack?.ledgers.encounterRecords.flatMap(
        (encounter) =>
          catalog.encounterDefinitions.byKey[encounter.encounterKey]?.blocksKeepsakeSelectionKeys ??
          [],
      ) ?? [],
    ),
  ]);
  const keepsakeSelectionCandidate = Object.freeze({
    key: semanticAddressKey(selection),
    candidate: Object.freeze({
      state: branches[0]!.keepsakes,
      encounterBlockedKeepsakeKeys,
    }),
  });
  const chronology = Object.freeze({
    kind: 'history' as const,
    sequence: event.sequence,
    boundary: 'at' as const,
  });
  const invalidReplacement = branches.some(
    (branch) =>
      keepsakeSelectionUnavailableReason(
        catalog,
        branch.keepsakes,
        keepsakeKey,
        encounterBlockedKeepsakeKeys,
      ) !== undefined,
  );
  if (invalidReplacement)
    findings.push(
      Object.freeze({
        finding: rewardFinding('keepsakeUnavailable', selection, {
          key: keepsakeKey,
          reason: 'unavailableAtRack',
        }),
        region: ownerRegion(selection),
        chronology,
      }),
    );

  let rackTransitions = branches.map((branch) => {
    const before = branch.keepsakes;
    const unavailable =
      keepsakeSelectionUnavailableReason(
        catalog,
        before,
        keepsakeKey,
        encounterBlockedKeepsakeKeys,
      ) !== undefined;
    const equippedRank = !unavailable
      ? keepsakeRankForEquip(catalog, keepsakeKey, branch.traitHistory ?? createTraitHistoryState())
      : undefined;
    const after = unavailable
      ? before
      : applyKeepsakeReplacement(
          catalog,
          before,
          keepsakeKey,
          branch.arcanaFear,
          equippedRank,
          effectiveBiomeNumber,
        );
    const replacementSucceeded =
      before.currentKey !== after.currentKey && after.currentKey === keepsakeKey;
    const detachedBranch = replacementSucceeded
      ? detachTranscendentEmbryoBlessing(catalog, branch, selection, event.sequence)
      : branch;
    const transitionedBranch = Object.freeze({ ...detachedBranch, keepsakes: after });
    return Object.freeze({
      branch: replacementSucceeded
        ? applyMoonBeamEquip(
            catalog,
            applyOlympianRewardPressureEquip(catalog, transitionedBranch, keepsakeKey),
            keepsakeKey,
            equippedRank,
            room.gameName === 'H_PostBoss01' || room.gameName === 'P_PostBoss01',
          )
        : transitionedBranch,
      replacementSucceeded,
      ...(equippedRank === undefined ? {} : { equippedRank }),
    });
  });
  rackTransitions = rackTransitions.map((transition) => {
    const branch = transition.branch;
    if (branch.keepsakes.fatedStatus !== 'Unfated' || branch.keepsakes.jeweledPom?.active !== true)
      return transition;
    const prior = branch.traitHistory ?? createTraitHistoryState();
    const traitHistory = foldTraitHistoryEvents(catalog, [
      ...prior.events,
      Object.freeze({
        kind: 'traitRemoval' as const,
        owner: selection,
        acquisitionRole: 'jeweledPomCleanup',
        sequence: event.sequence,
        acquisitionPoint: 'keepsakeFatedInvalidation',
        traitKey: branch.keepsakes.jeweledPom.grantedTraitKey,
        acquisitionIdentity: branch.keepsakes.jeweledPom.acquisitionIdentity,
        match: 'acquisitionIdentity' as const,
      }),
    ]);
    return Object.freeze({
      ...transition,
      branch: Object.freeze({
        ...branch,
        history: attachTraitHistory(branch.history, traitHistory),
        traitHistory,
        keepsakes: invalidateJeweledPom(branch.keepsakes),
      }),
    });
  });
  {
    const successfulReplacementBranches = Object.freeze(
      rackTransitions
        .filter((transition) => transition.replacementSucceeded)
        .map((transition) => transition.branch),
    );
    if (jeweledPomEffectForKey(catalog, keepsakeKey) !== undefined) {
      const result = createKeepsakeEquipResultAddress(selection, 'jeweledPom');
      if (successfulReplacementBranches.length > 0 && rack.equipResults?.jeweledPom === undefined)
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultMissing', result, {
              keepsakeKey,
            }),
            region: ownerRegion(selection.owner),
            chronology,
          }),
        );
      else if (
        successfulReplacementBranches.some(
          (branch) =>
            !assessJeweledPomEquipResult(
              catalog,
              rack.equipResults!.jeweledPom!,
              branch.traitHistory ?? createTraitHistoryState(),
              branch.keepsakes.fatedStatus,
            ).legal,
        )
      )
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultUnavailable', result, {
              keepsakeKey,
            }),
            region: ownerRegion(selection.owner),
            chronology,
          }),
        );
      if (successfulReplacementBranches.length > 0)
        keepsakeEquipResultCandidates.push(
          Object.freeze({
            key: semanticAddressKey(result),
            candidate: Object.freeze({
              frontiers: Object.freeze(
                successfulReplacementBranches.map((branch) =>
                  Object.freeze({
                    before: branch.traitHistory ?? createTraitHistoryState(),
                    fatedStatus: branch.keepsakes.fatedStatus,
                    ...(branch.arcanaFear === undefined ? {} : { arcanaFear: branch.arcanaFear }),
                  }),
                ),
              ),
            }),
          }),
        );
    }
    if (catalog.keepsakes.byKey[keepsakeKey]?.effect?.kind === 'experimentalHammer') {
      const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
      if (
        successfulReplacementBranches.length > 0 &&
        rack.equipResults?.experimentalHammer === undefined
      )
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultMissing', result, {
              keepsakeKey,
            }),
            region: ownerRegion(selection.owner),
            chronology,
          }),
        );
      else if (
        successfulReplacementBranches.some(
          (branch) =>
            !assessExperimentalHammerEquipResult(
              catalog,
              rack.equipResults!.experimentalHammer!,
              branch.traitHistory ?? createTraitHistoryState(),
              routeLoadout,
            ).legal,
        )
      )
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultUnavailable', result, {
              keepsakeKey,
            }),
            region: ownerRegion(selection.owner),
            chronology,
          }),
        );
      if (successfulReplacementBranches.length > 0)
        keepsakeEquipResultCandidates.push(
          Object.freeze({
            key: semanticAddressKey(result),
            candidate: Object.freeze({
              frontiers: Object.freeze(
                successfulReplacementBranches.map((branch) =>
                  Object.freeze({
                    before: branch.traitHistory ?? createTraitHistoryState(),
                    fatedStatus: branch.keepsakes.fatedStatus,
                    arcanaFear: branch.arcanaFear,
                    loadout: routeLoadout,
                  }),
                ),
              ),
            }),
          }),
        );
    }
    if (catalog.keepsakes.byKey[keepsakeKey]?.effect?.kind === 'transcendentEmbryo') {
      const result = createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo');
      const effect = catalog.keepsakes.byKey[keepsakeKey]?.effect;
      const rarity =
        effect?.kind === 'transcendentEmbryo'
          ? effect.blessingRarityByRank[
              keepsakeRankForEquip(
                catalog,
                keepsakeKey,
                successfulReplacementBranches[0]?.traitHistory ?? createTraitHistoryState(),
              )
            ]
          : undefined;
      if (
        successfulReplacementBranches.length > 0 &&
        rack.equipResults?.transcendentEmbryo === undefined
      )
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultMissing', result, {
              keepsakeKey,
            }),
            region: ownerRegion(selection),
            chronology,
          }),
        );
      else if (
        rarity !== undefined &&
        successfulReplacementBranches.some(
          (branch) =>
            !assessTranscendentEmbryoBlessing(
              catalog,
              rack.equipResults!.transcendentEmbryo!,
              branch.traitHistory ?? createTraitHistoryState(),
              rarity,
              routeLoadout,
            ).legal,
        )
      )
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultUnavailable', result, {
              keepsakeKey,
            }),
            region: ownerRegion(selection),
            chronology,
          }),
        );
      if (successfulReplacementBranches.length > 0)
        keepsakeEquipResultCandidates.push(
          Object.freeze({
            key: semanticAddressKey(result),
            candidate: Object.freeze({
              frontiers: Object.freeze(
                successfulReplacementBranches.map((branch) =>
                  Object.freeze({
                    before: branch.traitHistory ?? createTraitHistoryState(),
                    fatedStatus: branch.keepsakes.fatedStatus,
                    arcanaFear: branch.arcanaFear,
                    loadout: routeLoadout,
                    ...(rarity === undefined ? {} : { transcendentEmbryoRarity: rarity }),
                  }),
                ),
              ),
            }),
          }),
        );
    }
    rackTransitions = rackTransitions.map((transition) =>
      !transition.replacementSucceeded
        ? transition
        : Object.freeze({
            ...transition,
            branch: applyJeweledPomEquipResult(
              catalog,
              transition.branch,
              keepsakeKey,
              rack.equipResults,
              createKeepsakeEquipResultAddress(selection, 'jeweledPom'),
              event.sequence,
              transition.equippedRank,
            ),
          }),
    );
    rackTransitions = rackTransitions.map((transition) =>
      !transition.replacementSucceeded
        ? transition
        : Object.freeze({
            ...transition,
            branch:
              rack.equipResults?.transcendentEmbryo === undefined
                ? transition.branch
                : applyTranscendentEmbryoEquipResult(
                    catalog,
                    transition.branch,
                    keepsakeKey,
                    rack.equipResults.transcendentEmbryo,
                    createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo'),
                    event.sequence,
                    'ordinary',
                    transition.equippedRank ?? catalog.keepsakes.byKey[keepsakeKey]?.rank ?? 'Epic',
                    routeLoadout,
                  ),
          }),
    );
    rackTransitions = rackTransitions.map((transition) =>
      !transition.replacementSucceeded
        ? transition
        : Object.freeze({
            ...transition,
            branch: applyExperimentalHammerEquipResult(
              catalog,
              transition.branch,
              keepsakeKey,
              rack.equipResults,
              createKeepsakeEquipResultAddress(selection, 'experimentalHammer'),
              event.sequence,
              routeLoadout,
              transition.equippedRank,
            ),
          }),
    );
  }
  return Object.freeze({
    branches: Object.freeze(rackTransitions.map((transition) => transition.branch)),
    keepsakeSelectionCandidate,
    keepsakeEquipResultCandidates: Object.freeze(keepsakeEquipResultCandidates),
    findings: Object.freeze(findings),
  });
}
