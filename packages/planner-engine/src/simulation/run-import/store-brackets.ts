import type { Catalog } from '../../catalog-schema';
import { entrySnapshot, recordedEntryStates, storeCounts } from './conformance';
import type { RunImportContext } from './import';

/*
 * The store arithmetic of one record room's save-to-save window: what the
 * game's stores lost across it beyond the plan's draws, shared by the room's
 * rerolls and ship-wheel offers.
 */

export type Counts = Readonly<Record<string, number>>;

/** The plan's store contents less the saved ones at a record room's entry save, by store. */
function storeOffsets(
  context: RunImportContext,
  roomIndex: number,
): ReadonlyMap<string, Counts> | undefined {
  const saved = recordedEntryStates(context.record)[roomIndex];
  const snapshot = entrySnapshot(context.assembly(), context.occurrences, roomIndex);
  if (saved === undefined || snapshot === undefined) return undefined;
  const offsets = new Map<string, Counts>();
  const routeKey = context.assembly().project.route.routeKey;
  for (const [store, { counts, offRoute }] of storeCounts(context.catalog, routeKey, snapshot)) {
    // Every Chaos gate offered draws Secrets' TrialUpgrade, which refills itself and nothing reads.
    if (store === 'Secrets') continue;
    const recorded = saved.rewardStores.get(store);
    if (recorded === undefined) continue;
    const offset: Record<string, number> = {};
    for (const name of new Set([...Object.keys(counts), ...Object.keys(recorded)]))
      if (!offRoute.has(name)) offset[name] = (counts[name] ?? 0) - (recorded[name] ?? 0);
    offsets.set(store, offset);
  }
  return offsets;
}

/** One complete on-route fill of a store, by reward type, as the compared counts keep it. */
function fill(catalog: Catalog, routeKey: string, storeKey: string): Counts {
  const declaration = catalog.rewards.stores.byKey[storeKey];
  const counts: Record<string, number> = {};
  if (declaration === undefined) return counts;
  const offRoute = new Set(
    declaration.entries
      .filter((entry) => entry.routeKeys !== undefined && !entry.routeKeys.includes(routeKey))
      .map((entry) => entry.rewardType),
  );
  for (const entry of declaration.entries)
    if (!offRoute.has(entry.rewardType))
      counts[entry.rewardType] = (counts[entry.rewardType] ?? 0) + 1;
  return counts;
}

/** Whether the plan's stores now change across the bracket exactly as the saved ones do. */
export function bracketStoresMatch(context: RunImportContext, roomIndex: number): boolean {
  const before = storeOffsets(context, roomIndex);
  const after = storeOffsets(context, roomIndex + 1);
  if (before === undefined || after === undefined) return false;
  return [...after].every(([storeKey, offset]) => {
    const previous = before.get(storeKey) ?? {};
    return [...new Set([...Object.keys(offset), ...Object.keys(previous)])].every(
      (name) => (offset[name] ?? 0) === (previous[name] ?? 0),
    );
  });
}

/** One replaced reward a press drew past: its store and type. */
export interface Replaced {
  readonly storeKey: string;
  readonly rewardType: string;
}

/** What the stores say a bracket's rerolls replaced. */
export type ReplacedRewardsSolution =
  | { readonly kind: 'solved'; readonly replaced: readonly Replaced[] }
  /** No refill choice gives exactly the expected count; `smallest` is the least loss any explains. */
  | { readonly kind: 'unsolved'; readonly smallest?: number };

/**
 * The rewards a bracket's door, wheel, cage or Hub rerolls replaced, as a
 * multiset: per store, what the game's stores lost beyond the plan's draws
 * across the bracket, `pre + kF - post`, where the refill difference k between
 * game and plan is the one choice that leaves no negative count and makes the
 * total exactly the expected reroll count. Stores in key order, rewards in
 * declaration order.
 */
export function solveReplacedRewards(input: {
  /** Plan less saved store counts at the bracket's first and last entry saves. */
  readonly before: ReadonlyMap<string, Counts>;
  readonly after: ReadonlyMap<string, Counts>;
  /** One complete fill of a store, and its declared reward order. */
  readonly fill: (storeKey: string) => Counts;
  readonly order: (storeKey: string) => readonly string[];
  readonly rerolls: number;
}): ReplacedRewardsSolution {
  const { before, after, rerolls } = input;
  const options: {
    readonly storeKey: string;
    readonly replaced: Counts;
    readonly size: number;
  }[][] = [];
  for (const [storeKey, offset] of after) {
    const previous = before.get(storeKey) ?? {};
    const full = input.fill(storeKey);
    const names = new Set([...Object.keys(offset), ...Object.keys(previous), ...Object.keys(full)]);
    const choices = [];
    for (const refills of [0, 1, -1]) {
      const replaced: Record<string, number> = {};
      let size = 0;
      let valid = true;
      for (const name of names) {
        const count = (offset[name] ?? 0) - (previous[name] ?? 0) - refills * (full[name] ?? 0);
        if (count < 0) valid = false;
        if (count > 0) replaced[name] = count;
        size += Math.max(0, count);
      }
      if (valid) choices.push({ storeKey, replaced, size });
    }
    if (choices.length === 0) return { kind: 'unsolved' };
    options.push(choices);
  }
  const smallest = options.reduce(
    (total, choices) => total + Math.min(...choices.map((choice) => choice.size)),
    0,
  );
  const solutions: (typeof options)[number][number][][] = [];
  const search = (index: number, chosen: (typeof options)[number][number][], size: number) => {
    if (size > rerolls || solutions.length > 1) return;
    if (index === options.length) {
      if (size === rerolls) solutions.push(chosen);
      return;
    }
    for (const choice of options[index]!)
      search(index + 1, [...chosen, choice], size + choice.size);
  };
  search(0, [], 0);
  if (solutions.length !== 1) return { kind: 'unsolved', smallest };
  const replaced: Replaced[] = [];
  for (const choice of [...solutions[0]!].sort((left, right) =>
    left.storeKey.localeCompare(right.storeKey),
  )) {
    const order = input.order(choice.storeKey);
    for (const rewardType of Object.keys(choice.replaced).sort(
      (left, right) => order.indexOf(left) - order.indexOf(right),
    ))
      for (let count = 0; count < choice.replaced[rewardType]!; count += 1)
        replaced.push({ storeKey: choice.storeKey, rewardType });
  }
  return { kind: 'solved', replaced };
}

export function replacedRewards(
  context: RunImportContext,
  roomIndex: number,
  rerolls: number,
): ReplacedRewardsSolution {
  const before = storeOffsets(context, roomIndex);
  const after = storeOffsets(context, roomIndex + 1);
  if (before === undefined || after === undefined) return { kind: 'unsolved' };
  const routeKey = context.assembly().project.route.routeKey;
  return solveReplacedRewards({
    before,
    after,
    fill: (storeKey) => fill(context.catalog, routeKey, storeKey),
    order: (storeKey) => [
      ...new Set(
        context.catalog.rewards.stores.byKey[storeKey]?.entries.map((entry) => entry.rewardType),
      ),
    ],
    rerolls,
  });
}

/**
 * The rerolls the plan has yet to spend across a bracket: how much further its
 * pool now runs ahead of the saved `NumRerolls`. The plan models every grant,
 * so a gain inside the bracket hides no spend here. Undefined when either entry
 * save has no plan state to compare; an empty saved pool is absent.
 */
export function poolSpends(context: RunImportContext, roomIndex: number): number | undefined {
  const saved = recordedEntryStates(context.record);
  const offset = (index: number) => {
    const snapshot = entrySnapshot(context.assembly(), context.occurrences, index);
    const state = saved[index];
    return snapshot === undefined || state === undefined
      ? undefined
      : snapshot.rerolls.remaining - state.numRerolls;
  };
  const before = offset(roomIndex);
  const after = offset(roomIndex + 1);
  return before === undefined || after === undefined ? undefined : after - before;
}
