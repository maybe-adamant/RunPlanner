import type { SimulationState } from './model';

/**
 * The reward types the transition into the reached room offered, on every exit
 * of that batch rather than only the taken one, together with those offered
 * rooms' own local reward identities.
 *
 * This is a transient per-map fact. The game rebuilds it when a room unlocks
 * its exits and drops it when the next map initializes, so an entered room
 * clears the preceding value before its own batch republishes one. It is
 * deliberately not the run-persistent hub lookup: that union never resets and
 * answers a different question.
 */
export function normalizeOfferedRewardTypes(
  rewardTypes: readonly string[],
): SimulationState['offeredRewardTypes'] {
  return Object.freeze([...new Set(rewardTypes)].sort());
}

export function publishOfferedRewardTypes(
  state: SimulationState,
  rewardTypes: readonly string[],
): SimulationState {
  const published = normalizeOfferedRewardTypes(rewardTypes);
  return sameTypes(state.offeredRewardTypes, published)
    ? state
    : Object.freeze({ ...state, offeredRewardTypes: published });
}

/** Room entry drops the preceding transition's offered rewards without exception. */
export function clearOfferedRewardTypes(state: SimulationState): SimulationState {
  return state.offeredRewardTypes.length === 0
    ? state
    : Object.freeze({ ...state, offeredRewardTypes: Object.freeze([]) });
}

function sameTypes(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const setsByTypes = new WeakMap<object, ReadonlySet<string>>();

/** Pure set projection of one immutable offered-reward substate, memoized by identity. */
export function offeredRewardTypeSet(
  offeredRewardTypes: SimulationState['offeredRewardTypes'],
): ReadonlySet<string> {
  const existing = setsByTypes.get(offeredRewardTypes);
  if (existing !== undefined) return existing;
  const set: ReadonlySet<string> = new Set(offeredRewardTypes);
  setsByTypes.set(offeredRewardTypes, set);
  return set;
}
