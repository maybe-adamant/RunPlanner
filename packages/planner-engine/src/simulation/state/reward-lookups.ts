import type { SimulationState } from './model';

/** Agreement is on the lookup consumed by generation, not unrelated branch facts. */
export function sharedRewardLookups(
  states: readonly SimulationState[],
): SimulationState['rewardLookups'] {
  const first = states[0];
  if (first === undefined) throw new Error('reward lookup contact has no reached state');
  const key = JSON.stringify(first.rewardLookups);
  if (states.some((state) => JSON.stringify(state.rewardLookups) !== key))
    throw new Error('reward lookup contact has divergent offered-reward history');
  return first.rewardLookups;
}

/**
 * Asserts that every branch a generation or inventory contact settles carries
 * the same offered-reward history. Facts then read each branch's own lookup
 * substate, so a divergent cohort must still fail here rather than silently
 * evaluating one branch against another branch's board.
 */
export function attestSharedRewardLookups(states: readonly SimulationState[]): void {
  sharedRewardLookups(states);
}

const setsByLookups = new WeakMap<object, Readonly<Record<string, ReadonlySet<string>>>>();

/** Pure set projection of one immutable lookup substate, memoized by identity. */
export function rewardLookupSets(
  lookups: SimulationState['rewardLookups'],
): Readonly<Record<string, ReadonlySet<string>>> {
  const existing = setsByLookups.get(lookups);
  if (existing !== undefined) return existing;
  const sets = Object.freeze(
    Object.fromEntries(Object.entries(lookups).map(([key, values]) => [key, new Set(values)])),
  );
  setsByLookups.set(lookups, sets);
  return sets;
}

export function addHubBoardRewardLookup(
  state: SimulationState,
  lookupKey: string,
  rewardTypes: readonly string[],
): SimulationState {
  const previous = state.rewardLookups[lookupKey];
  if (previous === undefined) throw new Error(`unknown Hub reward lookup ${lookupKey}`);
  return Object.freeze({
    ...state,
    rewardLookups: Object.freeze({
      ...state.rewardLookups,
      [lookupKey]: Object.freeze([...new Set([...previous, ...rewardTypes])]),
    }),
  });
}
