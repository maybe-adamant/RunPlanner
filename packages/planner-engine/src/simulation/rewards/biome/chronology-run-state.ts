import {
  createBiomeAddress,
  createHubDecisionAddress,
  semanticAddressKey,
  type HubRoomAddress,
  type TargetAddress,
} from '../../../authored-project/addresses';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import type { HistoryStateView } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../materialization';
import { reachSimulationHistory } from '../../state/transitions';
import type { RewardBranchState } from '../branch-primitives';
import { createBiomeRewardFacts, visibleStoreOptionNames } from '../facts';
import { createRunState, type RunStateSnapshot } from '../run-state';
import { BiomeRewardSimulationContractError } from './biome-contract';
import type { ChronologyAccumulator, ChronologyEmission } from './chronology-accumulator';
import type {
  ChronologyWalkContext,
  ChronologyWalkState,
  RunStateCheckpointRequest,
} from './chronology-walk';

/** The Run State snapshot builder for one owner, source room and reached view. */
function runStateAt(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  owner: RunStateSnapshot['owner'],
  source: CanonicalAuthoredRoom | CanonicalHubRoom,
  view: HistoryStateView,
) {
  const { catalog, routePosition } = context;
  const declaration = routeRoomDeclaration(
    catalog.rooms.byKey[source.gameName],
    source.origin.routeKey,
  );
  if (declaration === undefined) {
    throw new BiomeRewardSimulationContractError(
      `${source.gameName} has no declaration for run-state snapshot`,
    );
  }
  const currentShopNames = visibleStoreOptionNames(
    source,
    state.hermesShrineAssessments.get(semanticAddressKey(source.origin))?.assessments,
  );
  // One token represents this exact rewardFacts closure: current/source room,
  // declaration, immutable view, shop names and peer context. Branch-varying
  // facts have separate cache identities, and the reached route position
  // travels inside each snapshot. This token cannot alias a later checkpoint
  // even when it retains the same history.
  const factsContextToken = Object.freeze({});
  const snapshotFor = (checkpointBranches: readonly RewardBranchState[]) =>
    createRunState({
      catalog,
      layout: context.prepared.layout,
      owner,
      states: checkpointBranches.map((branch) =>
        reachSimulationHistory(branch.state, routePosition, view),
      ),
      derivationCache: context.runStateDerivationCache,
      factsContextToken,
      rewardFacts: (factState) =>
        createBiomeRewardFacts({
          catalog,
          state: factState,
          source,
          currentRoom: source,
          sourceDeclaration: declaration,
          view,
          currentRoomShopOptionNames: currentShopNames,
          peerParentOrigin: source.origin,
          peerCreationSource: 'generatedTarget',
          hubBoardLookups: 'consulted',
        }),
    });
  return snapshotFor;
}

/**
 * Captures one owner's Run State once, then attaches the same checkpoint to
 * every trait child of that occurrence still lacking it.
 */
export function captureRunState(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  accumulator: ChronologyAccumulator,
  checkpoint: RunStateCheckpointRequest,
): void {
  const { owner, room: source, view } = checkpoint;
  const ownerKey = semanticAddressKey(owner);
  if (accumulator.hasRunStateSnapshot(ownerKey) || state.branches.length === 0) return;
  const snapshotFor = runStateAt(context, state, owner, source, view);
  const snapshot = snapshotFor(checkpoint.branches ?? state.branches);
  if (snapshot !== undefined)
    accumulator.mergeEmissions([{ kind: 'runStateSnapshot', ownerKey, snapshot }]);
  // Trait-child candidate checkpoints retain only generation snapshots. Room
  // lifecycle diagnostics are occurrence-local and never become a later
  // candidate-generation authority.
  if (owner.kind === 'roomRunStateCheckpoint') return;
  for (const child of accumulator.traitChildCheckpointsAwaiting(source.origin, ownerKey)) {
    const childSnapshot = snapshotFor(child.branches);
    if (childSnapshot !== undefined)
      accumulator.mergeEmissions([
        {
          kind: 'traitChildRunStateSnapshot',
          childKey: child.key,
          ownerKey,
          snapshot: childSnapshot,
        },
      ]);
  }
}

/** The reached states retained for a target slot at its history checkpoint. */
export function targetSlotHistory(
  context: ChronologyWalkContext,
  origin: TargetAddress,
  historySequence: number,
  checkpointBranches: readonly RewardBranchState[],
): readonly ChronologyEmission[] {
  if (checkpointBranches.length === 0) {
    return [];
  }
  const view = context.history.viewsBySequence[historySequence];
  if (view === undefined) {
    throw new BiomeRewardSimulationContractError(
      `No history view for target checkpoint ${historySequence}`,
    );
  }
  return [
    {
      kind: 'targetHistory',
      checkpoint: Object.freeze({
        origin,
        historySequence,
        states: Object.freeze(
          checkpointBranches.map((branch) =>
            reachSimulationHistory(branch.state, context.routePosition, view),
          ),
        ),
      }),
    },
  ];
}

/** A Hub interval ends at its departure: Hub exit or a visit's return, then any fountain use. */
export function hubDepartureEmissions(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  origin: HubRoomAddress,
  sequence: number,
  replace: boolean,
): readonly ChronologyEmission[] {
  const room = context.rooms.get(semanticAddressKey(origin));
  const view = context.history.viewsBySequence[sequence];
  if (room?.kind !== 'hub' || view === undefined || state.branches.length === 0) return [];
  const hub = createHubDecisionAddress(
    createBiomeAddress(origin.routeKey, origin.biomeKey),
    origin.hubKey,
  );
  const departure = runStateAt(context, state, hub, room, view)(state.branches);
  if (departure === undefined) return [];
  return [{ kind: 'hubDeparture', hub, hubGameName: room.gameName, departure, replace }];
}
