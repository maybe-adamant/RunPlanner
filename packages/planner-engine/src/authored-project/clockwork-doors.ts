import type { BiomeLayout, Catalog, RoomDeclaration } from '../catalog-schema';
import type { BiomeTopology, ExitDecision, OccurrenceId } from './model';
import {
  additionalExitsForDecision,
  batchTakesOverNormalDoors,
  exitDecisionForSource,
  orderedTargets,
  selectedExitContinuation,
} from './topology/query';

/**
 * A reward a room's door forces in place of a counted choice: a Clockwork
 * Goal (`ForcedFirstReward`, `ForcedRewards`), which spawns no pickup and
 * draws from no store.
 */
export type ForcedRewardType = 'ClockworkGoal';

/** The Clockwork counters a batch's doors are derived from. */
export interface ClockworkState {
  readonly goalsRemaining: number;
  readonly nonGoalRewardsAcquired: number;
  readonly maxNonGoalRewards: number;
}

/**
 * A Clockwork door's derived reward: the forced Goal, or a reward that counts
 * toward the next forced Goal. A Story door has neither.
 */
export type ClockworkDoorReward = 'goal' | 'counted';

/** One Clockwork batch: the state it opens with and each door's reward by exit key. */
export interface ClockworkBatchDoors {
  readonly state: ClockworkState;
  readonly rewards: ReadonlyMap<string, ClockworkDoorReward>;
}

/** Every Clockwork batch on the selected spine, by its source occurrence, and each target's reward. */
export interface ClockworkDoors {
  readonly batches: ReadonlyMap<OccurrenceId, ClockworkBatchDoors>;
  readonly rewardsByOccurrence: ReadonlyMap<OccurrenceId, ClockworkDoorReward>;
}

/**
 * A Clockwork door's derived reward, in door order: the Preboss and the first
 * combat door the leaving room offers get the Goal, as does every combat door
 * once the non-goal rewards reach their cap; any other reward but a Story
 * counts toward that cap.
 */
function clockworkDoorReward(
  room: RoomDeclaration,
  state: ClockworkState,
  goalAlreadyOffered: boolean,
): ClockworkDoorReward | undefined {
  if (room.kind === 'Preboss') return 'goal';
  if (room.kind === 'Story') return undefined;
  if (room.kind !== 'Combat') return 'counted';
  return (state.goalsRemaining > 0 && !goalAlreadyOffered) ||
    state.nonGoalRewardsAcquired >= state.maxNonGoalRewards
    ? 'goal'
    : 'counted';
}

function advanceClockworkState(
  state: ClockworkState,
  reward: ClockworkDoorReward | undefined,
): ClockworkState {
  if (reward === undefined) return state;
  return reward === 'goal'
    ? Object.freeze({ ...state, goalsRemaining: Math.max(0, state.goalsRemaining - 1) })
    : Object.freeze({ ...state, nonGoalRewardsAcquired: state.nonGoalRewardsAcquired + 1 });
}

function clockworkBatchDoors(
  catalog: Catalog,
  topology: BiomeTopology,
  decision: ExitDecision,
  state: ClockworkState,
): ClockworkBatchDoors {
  const rewards = new Map<string, ClockworkDoorReward>();
  let goalAlreadyOffered = false;
  for (const target of orderedTargets(decision.normal.targets)) {
    const gameName = topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === target.occurrenceId,
    )?.gameName;
    const room = gameName === undefined ? undefined : catalog.rooms.byKey[gameName];
    if (room === undefined) continue;
    const reward = clockworkDoorReward(room, state, goalAlreadyOffered);
    if (reward === 'goal') goalAlreadyOffered = true;
    if (reward !== undefined) rewards.set(target.exitKey, reward);
  }
  return Object.freeze({ state, rewards });
}

/**
 * The Clockwork doors of a biome's selected spine, walked from its start the
 * way the run takes it: each batch opens with the counters its predecessors
 * left, and only the selected door's reward advances them. A takeover batch
 * derives no Clockwork reward. Absent outside a Clockwork biome, or while the
 * biome's non-goal reward cap is unauthored.
 */
export function clockworkDoors(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  biomeState: Readonly<Record<string, unknown>>,
): ClockworkDoors | undefined {
  if (layout.progression.kind !== 'generated') return undefined;
  const policy = layout.progression.batchPolicy;
  if (policy.kind !== 'clockwork') return undefined;
  const maxNonGoalRewards = biomeState['maxNonGoalRewards'];
  if (typeof maxNonGoalRewards !== 'number' || !Number.isInteger(maxNonGoalRewards))
    return undefined;
  let state: ClockworkState = Object.freeze({
    goalsRemaining: policy.initialGoalCount,
    nonGoalRewardsAcquired: 0,
    maxNonGoalRewards,
  });
  const batches = new Map<OccurrenceId, ClockworkBatchDoors>();
  const rewardsByOccurrence = new Map<OccurrenceId, ClockworkDoorReward>();
  let current = topology.startOccurrenceId;
  const traversed = new Set<OccurrenceId>();
  while (!traversed.has(current)) {
    traversed.add(current);
    const decision = exitDecisionForSource(topology, { kind: 'occurrence', occurrenceId: current });
    if (decision === undefined) {
      const link = topology.fixedRoomLinks.find((entry) => entry.sourceOccurrenceId === current);
      if (link === undefined) break;
      current = link.targetOccurrenceId;
      continue;
    }
    const doors = batchTakesOverNormalDoors(catalog, topology, decision)
      ? undefined
      : clockworkBatchDoors(catalog, topology, decision, state);
    if (doors !== undefined) {
      batches.set(current, doors);
      for (const target of decision.normal.targets) {
        const reward = doors.rewards.get(target.exitKey);
        if (reward !== undefined) rewardsByOccurrence.set(target.occurrenceId, reward);
      }
    }
    const continuation = selectedExitContinuation(
      decision,
      additionalExitsForDecision(topology, decision),
    );
    if (continuation === undefined) break;
    if (continuation.kind === 'normal') {
      if (doors !== undefined)
        state = advanceClockworkState(state, doors.rewards.get(continuation.target.exitKey));
      current = continuation.target.occurrenceId;
    } else {
      current = continuation.exit.occurrenceId;
    }
  }
  return Object.freeze({ batches, rewardsByOccurrence });
}

/** The reward a room's door forces, derived from its biome's Clockwork doors. */
export function forcedDoorReward(
  doors: ClockworkDoors | undefined,
  occurrenceId: OccurrenceId,
): ForcedRewardType | undefined {
  return doors?.rewardsByOccurrence.get(occurrenceId) === 'goal' ? 'ClockworkGoal' : undefined;
}
