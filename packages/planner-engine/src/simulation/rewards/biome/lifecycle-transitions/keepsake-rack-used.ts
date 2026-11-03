import { replaceSimulationTraitHistory } from '../../../state/transitions';
import { creditItemArmor } from '../../../../reward-kernel/history';
import type { Catalog, KeepsakeRank } from '../../../../catalog-schema';
import {
  createKeepsakeEquipResultAddress,
  createPostbossKeepsakeSelectionAddress,
  semanticAddressKey,
  type KeepsakeSelectionAddress,
} from '../../../../authored-project/addresses';
import type { RouteLoadout } from '../../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion } from '../../../finding-regions';
import {
  applyKeepsakeReplacement,
  keepsakeEquipResultKind,
  keepsakeRankForEquip,
  keepsakeSelectionUnavailableReason,
  silkenSashArmorTransferredOnReplacement,
} from '../../../keepsakes/state';
import {
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  invalidateJeweledPom,
  assessTranscendentEmbryoBlessing,
} from '../../../keepsakes/trait-effects';
import { applyTranscendentEmbryoEquipResult } from '../../../keepsakes/branch-transitions';
import { foldTraitHistoryEvents } from '../../../traits';
import type {
  KeepsakeDraftEquipResult,
  KeepsakeEquipResultCandidateCapability,
  KeepsakeSelectionCandidateCapability,
} from '../../../keepsakes/candidate-artifacts';
import type { RewardBranchState } from '../../branch-primitives';
import {
  applyExperimentalHammerEquipResult,
  applyJeweledPomEquipResult,
  applyOlympianRewardPressureEquip,
  applyMoonBeamEquip,
} from '../../../keepsakes/branch-transitions';
import { rewardFinding } from '../../findings';
import type { LifecycleFinding } from './types';
import type { PlannerTimelineFacts } from '../../../timeline-facts';

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
  readonly timelineFacts: PlannerTimelineFacts;
}

interface RackEquip {
  readonly branch: RewardBranchState;
  readonly replacementSucceeded: boolean;
  readonly equippedRank?: KeepsakeRank;
}

/**
 * Equips a keepsake at the rack on each pre-rack branch: the replacement, its equip effects
 * and the Fated Pom cleanup, before any equip result applies.
 */
function equipAtRack(
  catalog: Catalog,
  keepsakeKey: string,
  selection: KeepsakeSelectionAddress,
  sequence: number,
  roomGameName: string,
  branches: readonly RewardBranchState[],
  encounterBlockedKeepsakeKeys: readonly string[],
  effectiveBiomeNumber: number,
): readonly RackEquip[] {
  return branches.map((branch): RackEquip => {
    const before = branch.state.keepsakes;
    const unavailable =
      keepsakeSelectionUnavailableReason(
        catalog,
        before,
        keepsakeKey,
        encounterBlockedKeepsakeKeys,
      ) !== undefined;
    const equippedRank = !unavailable
      ? keepsakeRankForEquip(catalog, keepsakeKey, branch.state.traitHistory)
      : undefined;
    const after = unavailable
      ? before
      : applyKeepsakeReplacement(
          catalog,
          before,
          keepsakeKey,
          branch.state.arcanaFear,
          equippedRank,
          effectiveBiomeNumber,
          before.currentKey === null
            ? undefined
            : keepsakeRankForEquip(catalog, before.currentKey, branch.state.traitHistory),
        );
    const replacementSucceeded =
      before.currentKey !== after.currentKey && after.currentKey === keepsakeKey;
    // Unequipping the Sash moves its armor into MinorArmorBoon.
    const transitionedBranch = Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        keepsakes: after,
        rewardHistory: creditItemArmor(
          branch.state.rewardHistory,
          silkenSashArmorTransferredOnReplacement(before, after),
        ),
      }),
    });
    const equipped = replacementSucceeded
      ? applyMoonBeamEquip(
          catalog,
          applyOlympianRewardPressureEquip(catalog, transitionedBranch, keepsakeKey),
          keepsakeKey,
          equippedRank,
          roomGameName === 'H_PostBoss01' || roomGameName === 'P_PostBoss01',
        )
      : transitionedBranch;
    return Object.freeze({
      branch: fatedJeweledPomCleanup(catalog, equipped, selection, sequence),
      replacementSucceeded,
      ...(equippedRank === undefined ? {} : { equippedRank }),
    });
  });
}

/** An Unfated rack removes the trait an active Jeweled Pom granted. */
function fatedJeweledPomCleanup(
  catalog: Catalog,
  branch: RewardBranchState,
  selection: KeepsakeSelectionAddress,
  sequence: number,
): RewardBranchState {
  if (
    branch.state.keepsakes.fatedStatus !== 'Unfated' ||
    branch.state.keepsakes.jeweledPom?.active !== true
  )
    return branch;
  const prior = branch.state.traitHistory;
  const traitHistory = foldTraitHistoryEvents(catalog, [
    ...prior.events,
    Object.freeze({
      kind: 'traitRemoval' as const,
      owner: selection,
      acquisitionRole: 'jeweledPomCleanup',
      sequence,
      acquisitionPoint: 'keepsakeFatedInvalidation',
      traitKey: branch.state.keepsakes.jeweledPom.grantedTraitKey,
      acquisitionIdentity: branch.state.keepsakes.jeweledPom.acquisitionIdentity,
      match: 'acquisitionIdentity' as const,
    }),
  ]);
  return Object.freeze({
    ...branch,
    state: replaceSimulationTraitHistory(
      Object.freeze({
        ...branch.state,
        keepsakes: invalidateJeweledPom(branch.state.keepsakes),
      }),
      traitHistory,
    ),
  });
}

/** The equip result a rack keepsake opens, assessed on the state that equipped it. */
function rackEquipResult(
  catalog: Catalog,
  keepsakeKey: string,
  selection: KeepsakeSelectionAddress,
  equipped: readonly RackEquip[],
): KeepsakeDraftEquipResult | undefined {
  const resultKind = keepsakeEquipResultKind(catalog, keepsakeKey);
  const successful = equipped.find((transition) => transition.replacementSucceeded)?.branch;
  if (resultKind === undefined || successful === undefined) return undefined;
  const effect = catalog.keepsakes.byKey[keepsakeKey]?.effect;
  const rarity =
    effect?.kind === 'transcendentEmbryo'
      ? effect.blessingRarityByRank[
          keepsakeRankForEquip(catalog, keepsakeKey, successful.state.traitHistory)
        ]
      : undefined;
  const capability: KeepsakeEquipResultCandidateCapability = Object.freeze({
    state: successful.state,
    ...(rarity === undefined ? {} : { transcendentEmbryoRarity: rarity }),
  });
  return Object.freeze({
    result: createKeepsakeEquipResultAddress(selection, resultKind),
    capability,
  });
}

/**
 * The equip result any keepsake drafted at this rack would open, judged from these pre-rack
 * branches exactly as the rack judges its authored keepsake.
 */
export function rackKeepsakeEquipResultFor(
  catalog: Catalog,
  selection: KeepsakeSelectionAddress,
  sequence: number,
  roomGameName: string,
  branches: readonly RewardBranchState[],
  encounterBlockedKeepsakeKeys: readonly string[],
  effectiveBiomeNumber: number,
): KeepsakeSelectionCandidateCapability['equipResultFor'] {
  return (keepsakeKey) =>
    rackEquipResult(
      catalog,
      keepsakeKey,
      selection,
      equipAtRack(
        catalog,
        keepsakeKey,
        selection,
        sequence,
        roomGameName,
        branches,
        encounterBlockedKeepsakeKeys,
        effectiveBiomeNumber,
      ),
    );
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
  const noTimelineFacts: PlannerTimelineFacts = Object.freeze({
    nodes: Object.freeze([]),
    dependencies: Object.freeze([]),
  });
  const keepsakeEquipResultCandidates: {
    readonly key: string;
    readonly candidate: KeepsakeEquipResultCandidateCapability;
  }[] = [];
  if (room?.keepsakeRack === undefined || event.origin.kind !== 'occurrence')
    return Object.freeze({
      branches,
      keepsakeEquipResultCandidates: Object.freeze(keepsakeEquipResultCandidates),
      findings: Object.freeze(findings),
      timelineFacts: noTimelineFacts,
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
      state: branches[0]!.state.keepsakes,
      encounterBlockedKeepsakeKeys,
      equipResultFor: rackKeepsakeEquipResultFor(
        catalog,
        selection,
        event.sequence,
        room.gameName,
        branches,
        encounterBlockedKeepsakeKeys,
        effectiveBiomeNumber,
      ),
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
        branch.state.keepsakes,
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

  let rackTransitions = equipAtRack(
    catalog,
    keepsakeKey,
    selection,
    event.sequence,
    room.gameName,
    branches,
    encounterBlockedKeepsakeKeys,
    effectiveBiomeNumber,
  );
  const replacementEquipsPhial =
    catalog.keepsakes.byKey[keepsakeKey]?.effect?.kind === 'fountainRarity';
  const phialSensitiveReplacement = rackTransitions.some(
    (transition, index) =>
      transition.replacementSucceeded &&
      (replacementEquipsPhial ||
        branches[index]?.state.keepsakes.phial?.status === 'pending' ||
        (room.fountainRarityResult !== undefined &&
          catalog.keepsakes.byKey[branches[index]?.state.keepsakes.currentKey ?? '']?.effect
            ?.kind === 'fountainRarity')),
  );
  const rackRow = room.roomActionRoster?.rows.find(
    (row) => !row.stale && row.rank !== null && row.reference.kind === 'interactKeepsakeRack',
  );
  const fountainRow = room.roomActionRoster?.rows.find(
    (row) => !row.stale && row.rank !== null && row.reference.kind === 'useFountain',
  );
  const timelineFacts: PlannerTimelineFacts = Object.freeze({
    nodes: Object.freeze([]),
    dependencies:
      !phialSensitiveReplacement || rackRow === undefined || fountainRow === undefined
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze(
              rackRow.rank! < fountainRow.rank!
                ? { owner: fountainRow.owner, afterOwner: rackRow.owner }
                : { owner: rackRow.owner, afterOwner: fountainRow.owner },
            ),
          ]),
  });
  const equipResult = rackEquipResult(catalog, keepsakeKey, selection, rackTransitions);
  if (equipResult !== undefined) {
    const { result, capability } = equipResult;
    // An Embryo result's finding belongs to the selection; the others to its Postboss owner.
    const region =
      result.resultKind === 'transcendentEmbryo'
        ? ownerRegion(selection)
        : ownerRegion(selection.owner);
    const authored = rack.equipResults;
    const legalAt = (frontier: KeepsakeEquipResultCandidateCapability) =>
      result.resultKind === 'jeweledPom'
        ? assessJeweledPomEquipResult(
            catalog,
            authored!.jeweledPom!,
            frontier.state,
            frontier.state.keepsakes.fatedStatus,
          ).legal
        : result.resultKind === 'experimentalHammer'
          ? assessExperimentalHammerEquipResult(
              catalog,
              authored!.experimentalHammer!,
              frontier.state,
            ).legal
          : assessTranscendentEmbryoBlessing(
              catalog,
              authored!.transcendentEmbryo!,
              frontier.state.traitHistory,
              frontier.transcendentEmbryoRarity!,
              { ...routeLoadout, routeKey: event.origin.routeKey },
            ).legal;
    if (authored?.[result.resultKind] === undefined)
      findings.push(
        Object.freeze({
          finding: rewardFinding('keepsakeEquipResultMissing', result, { keepsakeKey }),
          region,
          chronology,
        }),
      );
    else if (!legalAt(capability))
      findings.push(
        Object.freeze({
          finding: rewardFinding('keepsakeEquipResultUnavailable', result, { keepsakeKey }),
          region,
          chronology,
        }),
      );
    keepsakeEquipResultCandidates.push(
      Object.freeze({ key: semanticAddressKey(result), candidate: capability }),
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
                  rack.equipResults.transcendentEmbryoTransformations,
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
            transition.equippedRank,
          ),
        }),
  );
  return Object.freeze({
    branches: Object.freeze(rackTransitions.map((transition) => transition.branch)),
    keepsakeSelectionCandidate,
    keepsakeEquipResultCandidates: Object.freeze(keepsakeEquipResultCandidates),
    findings: Object.freeze(findings),
    timelineFacts,
  });
}
