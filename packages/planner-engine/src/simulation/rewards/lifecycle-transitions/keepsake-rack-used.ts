import type { Catalog } from '../../../catalog-schema';
import {
  createKeepsakeEquipResultAddress,
  createPostbossKeepsakeSelectionAddress,
  semanticAddressKey,
} from '../../../authored-project/addresses';
import type { RouteLoadout } from '../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../history';
import type { CanonicalAuthoredRoom } from '../../materialization';
import { ownerRegion } from '../../finding-regions';
import {
  applyKeepsakeDisposition,
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  invalidateJeweledPom,
  jeweledPomEffectForKey,
  keepsakeRankForEquip,
  keepsakeSelectionUnavailableReason,
} from '../../keepsakes';
import { attachTraitHistory, createTraitHistoryState, foldTraitHistoryEvents } from '../../traits';
import type {
  KeepsakeEquipResultCandidateCapability,
  KeepsakeSelectionCandidateCapability,
} from '../../candidate-artifacts';
import type { RewardBranchState } from '../branch-primitives';
import { applyExperimentalHammerEquipResult, applyJeweledPomEquipResult } from '../processing';
import { rewardFinding } from '../findings';
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

/** Applies a ranked postboss rack and emits its exact pre-selection/equip frontiers. */
export function applyKeepsakeRackUsedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'keepsakeRackUsed' }>,
  room: CanonicalAuthoredRoom | undefined,
  historyAtRack: ProgressiveRoomHistoryViews['entry'] | undefined,
  routeLoadout: RouteLoadout,
  branches: readonly RewardBranchState[],
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
  const disposition = rack.disposition;
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
  const invalidReplacement =
    disposition.kind === 'replace' &&
    branches.some(
      (branch) =>
        keepsakeSelectionUnavailableReason(
          catalog,
          branch.keepsakes,
          disposition.keepsakeKey,
          encounterBlockedKeepsakeKeys,
        ) !== undefined,
    );
  if (invalidReplacement)
    findings.push(
      Object.freeze({
        finding: rewardFinding('keepsakeUnavailable', selection, {
          key: disposition.keepsakeKey,
          reason: 'unavailableAtRack',
        }),
        region: ownerRegion(selection),
        chronology,
      }),
    );

  let rackTransitions = branches.map((branch) => {
    const before = branch.keepsakes;
    const unavailable =
      disposition.kind === 'replace' &&
      keepsakeSelectionUnavailableReason(
        catalog,
        before,
        disposition.keepsakeKey,
        encounterBlockedKeepsakeKeys,
      ) !== undefined;
    const equippedRank =
      disposition.kind === 'replace' && !unavailable
        ? keepsakeRankForEquip(
            catalog,
            disposition.keepsakeKey,
            branch.traitHistory ?? createTraitHistoryState(),
          )
        : undefined;
    const after = unavailable
      ? before
      : applyKeepsakeDisposition(catalog, before, disposition, branch.arcanaFear, equippedRank);
    const replacementSucceeded =
      disposition.kind === 'replace' &&
      before.currentKey !== after.currentKey &&
      after.currentKey === disposition.keepsakeKey;
    return Object.freeze({
      branch: Object.freeze({ ...branch, keepsakes: after }),
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
  if (disposition.kind === 'replace') {
    const successfulReplacementBranches = Object.freeze(
      rackTransitions
        .filter((transition) => transition.replacementSucceeded)
        .map((transition) => transition.branch),
    );
    if (jeweledPomEffectForKey(catalog, disposition.keepsakeKey) !== undefined) {
      const result = createKeepsakeEquipResultAddress(selection, 'jeweledPom');
      if (successfulReplacementBranches.length > 0 && rack.equipResults?.jeweledPom === undefined)
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultMissing', result, {
              keepsakeKey: disposition.keepsakeKey,
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
              keepsakeKey: disposition.keepsakeKey,
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
    if (catalog.keepsakes.byKey[disposition.keepsakeKey]?.effect?.kind === 'experimentalHammer') {
      const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');
      if (
        successfulReplacementBranches.length > 0 &&
        rack.equipResults?.experimentalHammer === undefined
      )
        findings.push(
          Object.freeze({
            finding: rewardFinding('keepsakeEquipResultMissing', result, {
              keepsakeKey: disposition.keepsakeKey,
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
              keepsakeKey: disposition.keepsakeKey,
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
    rackTransitions = rackTransitions.map((transition) =>
      !transition.replacementSucceeded
        ? transition
        : Object.freeze({
            ...transition,
            branch: applyJeweledPomEquipResult(
              catalog,
              transition.branch,
              disposition.keepsakeKey,
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
            branch: applyExperimentalHammerEquipResult(
              catalog,
              transition.branch,
              disposition.keepsakeKey,
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
