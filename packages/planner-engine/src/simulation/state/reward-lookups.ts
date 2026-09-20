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

export function rewardLookupSets(
  lookups: SimulationState['rewardLookups'],
): Readonly<Record<string, ReadonlySet<string>>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(lookups).map(([key, values]) => [key, new Set(values)])),
  );
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
