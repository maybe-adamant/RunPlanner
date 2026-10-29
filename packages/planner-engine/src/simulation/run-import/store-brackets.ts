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

/**
 * Whether the plan's stores now change across the bracket exactly as the saved
 * ones do; only `storeKeys` when given.
 */
export function bracketStoresMatch(
  context: RunImportContext,
  roomIndex: number,
  storeKeys?: ReadonlySet<string>,
): boolean {
  const before = storeOffsets(context, roomIndex);
  const after = storeOffsets(context, roomIndex + 1);
  if (before === undefined || after === undefined) return false;
  return [...after].every(([storeKey, offset]) => {
    if (storeKeys !== undefined && !storeKeys.has(storeKey)) return true;
    const previous = before.get(storeKey) ?? {};
    return [...new Set([...Object.keys(offset), ...Object.keys(previous)])].every(
      (name) => (offset[name] ?? 0) === (previous[name] ?? 0),
    );
  });
}

/** One draw of a bracket: its store and reward type. */
export interface Replaced {
  readonly storeKey: string;
  readonly rewardType: string;
}

/** What the stores say a bracket's rerolls replaced. */
export type ReplacedRewardsSolution =
  | { readonly kind: 'solved'; readonly replaced: readonly Replaced[] }
  /** No refill choice gives exactly the expected count; `smallest` is the least loss any explains. */
  | { readonly kind: 'unsolved'; readonly smallest?: number };

interface BracketInput {
  /** Plan less saved store counts at the bracket's first and last entry saves. */
  readonly before: ReadonlyMap<string, Counts>;
  readonly after: ReadonlyMap<string, Counts>;
  /** One complete fill of a store, and its declared reward order. */
  readonly fill: (storeKey: string) => Counts;
  readonly order: (storeKey: string) => readonly string[];
}

/** Every refill choice's draws; `smallest` is absent when a store explains none. */
export interface BracketDraws {
  readonly solutions: readonly (readonly Replaced[])[];
  readonly smallest?: number;
}

/**
 * The draws of a bracket the plan does not know, as multisets: per store, what
 * the game's stores lost beyond the plan's known draws across the bracket,
 * `pre + kF - post` plus the plan's own draws on the unknown owners, for every
 * choice of refill difference k between game and plan that leaves no negative
 * count and makes the total exactly `draws`. Each multiset lists stores in key
 * order and rewards in declaration order.
 */
export function solveBracketDraws(
  input: BracketInput & {
    /** What the plan drew on the owners whose draws are unknown, added back to the loss. */
    readonly planned?: readonly Replaced[];
    readonly draws: number;
  },
): BracketDraws {
  const { before, after, draws } = input;
  const options: {
    readonly storeKey: string;
    readonly replaced: Counts;
    readonly size: number;
  }[][] = [];
  for (const [storeKey, offset] of after) {
    const previous = before.get(storeKey) ?? {};
    const full = input.fill(storeKey);
    const planned: Record<string, number> = {};
    for (const draw of input.planned ?? [])
      if (draw.storeKey === storeKey)
        planned[draw.rewardType] = (planned[draw.rewardType] ?? 0) + 1;
    const names = new Set([
      ...Object.keys(offset),
      ...Object.keys(previous),
      ...Object.keys(full),
      ...Object.keys(planned),
    ]);
    const choices = [];
    for (const refills of [0, 1, -1]) {
      const replaced: Record<string, number> = {};
      let size = 0;
      let valid = true;
      for (const name of names) {
        const count =
          (offset[name] ?? 0) -
          (previous[name] ?? 0) +
          (planned[name] ?? 0) -
          refills * (full[name] ?? 0);
        if (count < 0) valid = false;
        if (count > 0) replaced[name] = count;
        size += Math.max(0, count);
      }
      if (valid) choices.push({ storeKey, replaced, size });
    }
    if (choices.length === 0) return { solutions: [] };
    options.push(choices);
  }
  const smallest = options.reduce(
    (total, choices) => total + Math.min(...choices.map((choice) => choice.size)),
    0,
  );
  const solutions: Replaced[][] = [];
  const search = (index: number, chosen: (typeof options)[number][number][], size: number) => {
    if (size > draws) return;
    if (index === options.length) {
      if (size === draws) solutions.push(drawsOf(chosen, input.order));
      return;
    }
    for (const choice of options[index]!)
      search(index + 1, [...chosen, choice], size + choice.size);
  };
  search(0, [], 0);
  return { solutions, smallest };
}

function drawsOf(
  chosen: readonly { readonly storeKey: string; readonly replaced: Counts }[],
  order: (storeKey: string) => readonly string[],
): Replaced[] {
  const draws: Replaced[] = [];
  for (const choice of [...chosen].sort((left, right) =>
    left.storeKey.localeCompare(right.storeKey),
  )) {
    const declared = order(choice.storeKey);
    for (const rewardType of Object.keys(choice.replaced).sort(
      (left, right) => declared.indexOf(left) - declared.indexOf(right),
    ))
      for (let count = 0; count < choice.replaced[rewardType]!; count += 1)
        draws.push({ storeKey: choice.storeKey, rewardType });
  }
  return draws;
}

/**
 * The rewards a bracket's door, wheel, cage or Hub rerolls replaced: the one
 * multiset of `rerolls` draws its stores explain.
 */
export function solveReplacedRewards(
  input: BracketInput & { readonly rerolls: number },
): ReplacedRewardsSolution {
  const { solutions, smallest } = solveBracketDraws({ ...input, draws: input.rerolls });
  if (solutions.length === 1) return { kind: 'solved', replaced: solutions[0]! };
  return smallest === undefined ? { kind: 'unsolved' } : { kind: 'unsolved', smallest };
}

/** A record room's bracket, or undefined when either entry save has no plan state. */
function bracketInput(context: RunImportContext, roomIndex: number): BracketInput | undefined {
  const before = storeOffsets(context, roomIndex);
  const after = storeOffsets(context, roomIndex + 1);
  if (before === undefined || after === undefined) return undefined;
  const routeKey = context.assembly().project.route.routeKey;
  return {
    before,
    after,
    fill: (storeKey) => fill(context.catalog, routeKey, storeKey),
    order: (storeKey) => [
      ...new Set(
        context.catalog.rewards.stores.byKey[storeKey]?.entries.map((entry) => entry.rewardType),
      ),
    ],
  };
}

export function bracketDraws(
  context: RunImportContext,
  roomIndex: number,
  draws: number,
  planned: readonly Replaced[],
): BracketDraws | undefined {
  const input = bracketInput(context, roomIndex);
  return input === undefined ? undefined : solveBracketDraws({ ...input, planned, draws });
}

export function replacedRewards(
  context: RunImportContext,
  roomIndex: number,
  rerolls: number,
): ReplacedRewardsSolution {
  const input = bracketInput(context, roomIndex);
  return input === undefined ? { kind: 'unsolved' } : solveReplacedRewards({ ...input, rerolls });
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
