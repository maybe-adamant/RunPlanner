import type { SimulationState } from './model';

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

/** A Hub board reroll overwrites its door's offered reward, so the board's set is rebuilt. */
export function replaceHubBoardRewardLookup(
  state: SimulationState,
  lookupKey: string,
  rewardTypes: readonly string[],
): SimulationState {
  if (state.rewardLookups[lookupKey] === undefined)
    throw new Error(`unknown Hub reward lookup ${lookupKey}`);
  return Object.freeze({
    ...state,
    rewardLookups: Object.freeze({
      ...state.rewardLookups,
      [lookupKey]: Object.freeze([...new Set(rewardTypes)]),
    }),
  });
}
