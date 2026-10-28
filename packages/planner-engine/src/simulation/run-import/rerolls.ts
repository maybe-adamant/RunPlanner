import {
  createBiomeAddress,
  createHubDecisionAddress,
  createHubRerollAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  roomActionKey,
  screenRerollSupported,
  type BiomeAddress,
  type HubDecision,
  type OccurrenceId,
  type ProjectCommand,
  type RerollTarget,
  type RoomOccurrence,
  type SemanticAddress,
} from '../../authored-project';
import { FIELDS_CAGE_GROUP_KEY } from '../../authored-project/rerolls';
import type { Catalog } from '../../catalog-schema';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../reward-kernel';
import type { RunRecord, RunRecordTraitScreen } from '../../run-record/model';
import { entrySnapshot, recordedEntryStates, storeCounts } from './conformance';
import type { RunImportContext } from './import';
import { authoredOccurrence } from './occurrences';
import type { RunImportReportEntry } from './report';
import { POM_GIVERS } from './vocabulary';

/** `SpentRerolls` ids of the store screens the plan holds counts for. */
const WELL_SCREEN = 'WellShop';
const POOL_SCREEN = 'SellTraits';

/** A rerolled screen: a record trait screen by its position, or the room's Well or Pool. */
export type RerolledScreen = number | 'well' | 'pool';

interface RoomScreenRerolls {
  readonly counts: ReadonlyMap<RerolledScreen, number>;
  /** More than one of the room's screens could have taken a loot screen's rerolls. */
  readonly ambiguous: boolean;
  /** Reroll ids naming no screen the plan can reroll. */
  readonly unsupported: number;
}

/** Whether a record trait screen's giver shows the native reroll button. */
function rerollableScreen(catalog: Catalog, screen: RunRecordTraitScreen): boolean {
  if (POM_GIVERS.has(screen.giver))
    return screenRerollSupported(catalog, { kind: 'levelChoice', rewardType: screen.giver });
  const giverKey = catalog.traitGiverByAcquisitionGameName[screen.giver];
  return giverKey !== undefined && screenRerollSupported(catalog, { kind: 'traitOffer', giverKey });
}

/**
 * Each screen's reroll count in one record room. A loot screen's id is its
 * object id, which no screen record keeps: one rerolled loot screen among one
 * rerollable screen is exact, otherwise the ids in ascending order take the
 * rerollable screens in record order.
 */
function roomScreenRerolls(
  context: { readonly catalog: Catalog; readonly record: RunRecord },
  roomIndex: number,
): RoomScreenRerolls {
  const room = context.record.rooms[roomIndex]!;
  const counts = new Map<RerolledScreen, number>();
  let unsupported = 0;
  const loot: { readonly id: number; readonly count: number }[] = [];
  for (const [id, count] of Object.entries(room.spentRerolls ?? {})) {
    if (id === WELL_SCREEN) counts.set('well', count);
    else if (id === POOL_SCREEN) counts.set('pool', count);
    else if (/^\d+$/.test(id)) loot.push({ id: Number(id), count });
    else unsupported += 1;
  }
  const screens = room.traitScreens.flatMap((screen, position) =>
    rerollableScreen(context.catalog, screen) ? [position] : [],
  );
  loot.sort((left, right) => left.id - right.id);
  for (const [index, { count }] of loot.entries()) {
    const position = screens[index];
    if (position === undefined) unsupported += 1;
    else counts.set(position, count);
  }
  const sameCounts = new Set(loot.map((entry) => entry.count)).size <= 1;
  return {
    counts,
    ambiguous: loot.length > 0 && !(loot.length === screens.length && sameCounts),
    unsupported,
  };
}

/**
 * Authors a screen's recorded reroll count once its final rows are authored.
 * A count the engine refuses is reported; a count placed by id order is an assumption.
 */
export function applyScreenRerolls(
  context: RunImportContext,
  roomIndex: number,
  screen: RerolledScreen,
  address: SemanticAddress,
  command: (count: number) => ProjectCommand,
): void {
  const rerolls = roomScreenRerolls(context, roomIndex);
  const count = rerolls.counts.get(screen);
  if (count === undefined) return;
  context.used.add(`screenRerolls:${roomIndex}:${screen}`);
  const record = { roomIndex, visit: 0 };
  const applied = command(count);
  if (!context.applyValid(applied)) {
    context.note({ area: 'reroll', reason: 'refused', address, applied, record });
    return;
  }
  if (rerolls.ambiguous && typeof screen === 'number')
    context.note({ area: 'reroll', reason: 'assumption', address, applied, record });
}

/** Screen rerolls on screens the plan cannot reroll, such as the World Shop. */
export function unsupportedScreenRerolls(
  catalog: Catalog,
  record: RunRecord,
): readonly RunImportReportEntry[] {
  return record.rooms.flatMap((_room, roomIndex) =>
    Array.from(
      { length: roomScreenRerolls({ catalog, record }, roomIndex).unsupported },
      (): RunImportReportEntry => ({
        area: 'reroll',
        reason: 'unsupportedArea',
        record: { roomIndex, visit: 0 },
      }),
    ),
  );
}

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
function bracketStoresMatch(context: RunImportContext, roomIndex: number): boolean {
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

function replacedRewards(
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
function poolSpends(context: RunImportContext, roomIndex: number): number | undefined {
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

/** A reward owner one press may redraw, with how to rewrite its draws. */
interface PressTarget {
  /** The owner's current first draw. */
  readonly firstDraw: () => ResolvedRewardOffer | undefined;
  readonly replaceFirstDraw: (value: ResolvedRewardOffer) => ProjectCommand;
  /** A press on this owner, before its existing presses. */
  readonly press: (reward: ResolvedRewardOffer) => ProjectCommand;
}

function occurrenceOf(context: RunImportContext, biomeKey: string, occurrenceId: string) {
  return authoredOccurrence(context.assembly().project, biomeKey, occurrenceId);
}

/** A ship's wheels the record rolled, in setup order. */
function rolledWheels(context: RunImportContext, occurrence: RoomOccurrence) {
  if (occurrence.state.kind !== 'shipCombat') return [];
  const rolled = context.occurrences
    .visitsOf(occurrence.occurrenceId)
    .reduce((count, index) => Math.max(count, context.record.rooms[index]!.wheels?.length ?? 0), 0);
  return Object.entries(occurrence.state.wheels).slice(0, rolled);
}

/** Door and cage presses go after the doors unlock; a wheel's precede its use. */
function roomPressTargets(
  context: RunImportContext,
  biome: BiomeAddress,
  sourceId: OccurrenceId,
): readonly PressTarget[] {
  const project = context.assembly().project;
  const topology = project.route.biomes.find(
    (entry) => entry.biomeKey === biome.biomeKey,
  )?.topology;
  const source = topology?.occurrences.find((entry) => entry.occurrenceId === sourceId);
  if (topology === undefined || topology === null || source === undefined) return [];
  const address = createOccurrenceAddress(biome, sourceId);
  const current = () => occurrenceOf(context, biome.biomeKey, sourceId)!;
  const sameTarget = (left: RerollTarget, right: RerollTarget) =>
    JSON.stringify(left) === JSON.stringify(right);
  const roomPress =
    (target: RerollTarget, fallbackIndex: (occurrence: RoomOccurrence) => number) =>
    (reward: ResolvedRewardOffer): ProjectCommand => {
      const order = current().roomActions.order;
      const first = order.findIndex(
        (action) => action.kind === 'reroll' && sameTarget(action.target, target),
      );
      return {
        kind: 'InsertReroll',
        occurrence: address,
        target,
        reward,
        index: first >= 0 ? first : fallbackIndex(current()),
      };
    };
  const targets: PressTarget[] = [];
  const exit = topology.decisions.find(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === sourceId,
  );
  const doors = exit?.kind === 'exit' ? exit.normal.targets : [];
  const atEnd = (occurrence: RoomOccurrence) => occurrence.roomActions.order.length;
  for (const door of doors) {
    const reward = createIncomingRewardAddress(biome, door.occurrenceId);
    const destination = () => occurrenceOf(context, biome.biomeKey, door.occurrenceId);
    const state = destination()?.state;
    if (state !== undefined && 'reward' in state)
      targets.push({
        firstDraw: () => {
          const now = destination()?.state;
          return now !== undefined && 'reward' in now ? now.reward?.offer : undefined;
        },
        replaceFirstDraw: (value) => ({ kind: 'ReplaceIncomingReward', reward, value }),
        press: roomPress(
          { kind: 'door', exitKey: door.exitKey, occurrenceId: door.occurrenceId },
          atEnd,
        ),
      });
    if (state?.kind === 'fieldsCombat')
      for (const slotKey of Object.keys(state.cages)) {
        const cage = createLocalRewardAddress(
          biome,
          door.occurrenceId,
          FIELDS_CAGE_GROUP_KEY,
          slotKey,
        );
        targets.push({
          firstDraw: () => {
            const now = destination()?.state;
            return now?.kind === 'fieldsCombat' ? now.cages[slotKey]?.offer : undefined;
          },
          replaceFirstDraw: (value) => ({ kind: 'ReplaceLocalReward', reward: cage, value }),
          press: roomPress(
            { kind: 'cage', exitKey: door.exitKey, occurrenceId: door.occurrenceId, slotKey },
            atEnd,
          ),
        });
      }
  }
  // A picked wheel offer's pickup is already settled, so only an unpicked offer is redrawn.
  for (const [wheelKey, wheel] of rolledWheels(context, source))
    for (const [index, offerKey] of Object.keys(wheel.offers).entries()) {
      if (index + 1 === wheel.pickedOfferIndex || index >= wheel.offerCount) continue;
      const offer = createRewardWheelOfferAddress(biome, sourceId, wheelKey, offerKey);
      const beforeUse = (occurrence: RoomOccurrence) => {
        const use = occurrence.roomActions.order.findIndex(
          (action) => action.kind === 'chooseRewardWheel' && action.wheelKey === wheelKey,
        );
        return use >= 0 ? use : occurrence.roomActions.order.length;
      };
      targets.push({
        firstDraw: () => {
          const now = current().state;
          return now.kind === 'shipCombat'
            ? (now.wheels[wheelKey]?.offers[offerKey]?.offer ?? undefined)
            : undefined;
        },
        replaceFirstDraw: (value) => ({ kind: 'ReplaceRewardWheelOffer', offer, value }),
        press: roomPress({ kind: 'wheelOffer', wheelKey, offerKey }, beforeUse),
      });
    }
  return targets;
}

/** Whether every owner the bracket drew holds its first draw: doors, cages and both wheel offers. */
function bracketDrawsAuthored(
  context: RunImportContext,
  biomeKey: string,
  sourceId: OccurrenceId,
  targets: readonly PressTarget[],
): boolean {
  const source = occurrenceOf(context, biomeKey, sourceId);
  return (
    targets.every((target) => target.firstDraw() !== undefined) &&
    (source === undefined ||
      rolledWheels(context, source).every(([, wheel]) =>
        Object.values(wheel.offers)
          .slice(0, wheel.offerCount)
          .every((offer) => offer !== null),
      ))
  );
}

/** Board-door presses precede the Hub's first room visit. */
function hubPressTargets(
  context: RunImportContext,
  biome: BiomeAddress,
  hub: HubDecision,
): readonly PressTarget[] {
  const decision = createHubDecisionAddress(biome, hub.hubKey);
  const currentHub = () =>
    context
      .assembly()
      .project.route.biomes.find((entry) => entry.biomeKey === biome.biomeKey)
      ?.topology?.decisions.find(
        (entry): entry is HubDecision => entry.kind === 'hub' && entry.hubKey === hub.hubKey,
      );
  return hub.openTargets.map((slot): PressTarget => {
    const reward = createIncomingRewardAddress(biome, slot.occurrenceId);
    return {
      firstDraw: () => {
        const state = occurrenceOf(context, biome.biomeKey, slot.occurrenceId)?.state;
        return state !== undefined && 'reward' in state ? state.reward?.offer : undefined;
      },
      replaceFirstDraw: (value) => ({ kind: 'ReplaceIncomingReward', reward, value }),
      press: (value) => {
        const actions = currentHub()?.actions ?? [];
        const first = actions.findIndex(
          (action) => action.kind === 'reroll' && action.hubSlotKey === slot.hubSlotKey,
        );
        const visit = actions.findIndex((action) => action.kind === 'roomVisit');
        return {
          kind: 'InsertHubReroll',
          hub: decision,
          hubSlotKey: slot.hubSlotKey,
          reward: value,
          index: first >= 0 ? first : visit >= 0 ? visit : actions.length,
        };
      },
    };
  });
}

/** The press addresses a source's rerolls hold: its room presses or its Hub's. */
function pressAddresses(
  context: RunImportContext,
  biome: BiomeAddress,
  sourceId: OccurrenceId,
  hub: HubDecision | undefined,
): readonly SemanticAddress[] {
  const project = context.assembly().project;
  if (hub !== undefined) {
    const current = project.route.biomes
      .find((entry) => entry.biomeKey === biome.biomeKey)
      ?.topology?.decisions.find(
        (entry): entry is HubDecision => entry.kind === 'hub' && entry.hubKey === hub.hubKey,
      );
    return (current?.actions ?? []).flatMap((action) =>
      action.kind === 'reroll' ? [createHubRerollAddress(biome, hub.hubKey, action.rerollId)] : [],
    );
  }
  return (occurrenceOf(context, biome.biomeKey, sourceId)?.roomActions.order ?? []).flatMap(
    (action) =>
      action.kind === 'reroll'
        ? [createRoomActionAddress(biome, sourceId, roomActionKey(action))]
        : [],
  );
}

/**
 * Prepends one replaced reward to an owner's draws: it becomes the first draw
 * and a new first press redraws the previous first draw. A Boon's god is not
 * saved, so each god is tried in catalog order.
 */
function prependReplaced(
  context: RunImportContext,
  targets: readonly PressTarget[],
  replaced: Replaced,
): boolean {
  const values = locallyValidRewardOffers(context.catalog.rewards, replaced.rewardType);
  for (const target of targets)
    for (const value of values) {
      const placed = context.transaction(() => {
        const previous = target.firstDraw();
        return (
          previous !== undefined &&
          context.apply(target.press(previous)) &&
          context.apply(target.replaceFirstDraw(value))
        );
      });
      if (placed) return true;
    }
  return false;
}

/**
 * Door, ship-wheel, Fields cage and Hub board rerolls of each record room
 * whose bracket the plan has passed. Which owner was pressed, in which order,
 * and what each press replaced are not saved; the stores' loss gives the
 * replaced rewards. Each is prepended, in store and declaration order, to the
 * first owner in native order that the engine accepts. Every assignment that
 * removes the same rewards leaves the same stores, so a placement that
 * reproduces the saved stores is one assumption for the room; otherwise each
 * press is reported.
 */
export function importRerolls(context: RunImportContext): void {
  for (const [roomIndex, room] of context.record.rooms.entries()) {
    const used = `rerolls:${roomIndex}`;
    if (context.used.has(used)) continue;
    // The bracket closes at the next entry save, once the plan has entered its room.
    if (
      roomIndex + 1 >= context.record.rooms.length ||
      !context.entered(context.occurrences.occurrenceOf(roomIndex + 1)) ||
      entrySnapshot(context.assembly(), context.occurrences, roomIndex + 1) === undefined
    )
      continue;
    const recorded = room.rerolls ?? 0;
    // The pool counts the room's spends through any grant; the recorder's count is a floor.
    const rerolls = poolSpends(context, roomIndex) ?? recorded;
    if (rerolls <= 0 && recorded === 0) {
      context.used.add(used);
      continue;
    }
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
    const sourceId = context.occurrences.occurrenceOf(roomIndex);
    const topology = context
      .assembly()
      .project.route.biomes.find((entry) => entry.biomeKey === biomeKey)?.topology;
    // A Hub visit is no occurrence: its board is the decision of the room that led to it.
    const hub = topology?.occurrences.some((entry) => entry.occurrenceId === sourceId)
      ? undefined
      : topology?.decisions.find(
          (decision): decision is HubDecision =>
            decision.kind === 'hub' &&
            roomIndex > 0 &&
            decision.source.occurrenceId === context.occurrences.occurrenceOf(roomIndex - 1),
        );
    const targets =
      hub === undefined
        ? roomPressTargets(context, biome, sourceId)
        : hubPressTargets(context, biome, hub);
    // The bracket's draws, a Fields door's cages included, are authored before its stores compare.
    if (!bracketDrawsAuthored(context, biomeKey, sourceId, targets)) continue;
    context.used.add(used);
    const record = { roomIndex, visit: 0 };
    const unsupported = (count: number) => {
      for (let index = 0; index < count; index += 1)
        context.note({ area: 'reroll', reason: 'unsupportedArea', record });
    };
    // The recorder saw a spend the plan's pool does not miss.
    if (rerolls <= 0) {
      context.note({
        area: 'reroll',
        reason: 'mismatch',
        record,
        mismatch: { field: 'rerolls', expected: String(recorded), actual: String(rerolls) },
      });
      unsupported(recorded);
      continue;
    }
    const solution = replacedRewards(context, roomIndex, rerolls);
    if (solution.kind === 'unsolved') {
      // The stores lose another count of rewards than the pool spent.
      if (solution.smallest !== undefined)
        context.note({
          area: 'reroll',
          reason: 'mismatch',
          record,
          mismatch: {
            field: 'rerolls',
            expected: String(rerolls),
            actual: String(solution.smallest),
          },
        });
      unsupported(Math.max(rerolls, recorded));
      continue;
    }
    // A restored Hub never offers its board for rerolls again.
    if (hub !== undefined && context.occurrences.visitsOf(sourceId)[0] !== roomIndex) {
      unsupported(rerolls);
      continue;
    }
    const sourceActions = () =>
      hub === undefined ? (occurrenceOf(context, biomeKey, sourceId)?.roomActions.order ?? []) : [];
    const before = new Set(
      pressAddresses(context, biome, sourceId, hub).map((address) => JSON.stringify(address)),
    );
    const earlier = new Set(
      sourceActions().flatMap((action) => (action.kind === 'reroll' ? [action.rerollId] : [])),
    );
    const placed = context.transaction(() =>
      solution.replaced.every((entry) => prependReplaced(context, targets, entry)),
    );
    if (!placed) {
      unsupported(rerolls);
      continue;
    }
    if (!bracketStoresMatch(context, roomIndex)) {
      for (const address of pressAddresses(context, biome, sourceId, hub))
        if (!before.has(JSON.stringify(address)))
          context.note({ area: 'reroll', reason: 'notInRecord', address, record });
      continue;
    }
    // A wheel press may as well have redrawn the picked offer, which this plan cannot hold yet.
    const wheels = new Set(
      sourceActions().flatMap((action) =>
        action.kind === 'reroll' &&
        !earlier.has(action.rerollId) &&
        action.target.kind === 'wheelOffer'
          ? [action.target.wheelKey]
          : [],
      ),
    );
    for (const wheelKey of wheels)
      context.note({
        area: 'wheel',
        reason: 'assumption',
        address: createRewardWheelAddress(biome, sourceId, wheelKey),
        record,
      });
    const otherPresses =
      hub !== undefined ||
      sourceActions().some(
        (action) =>
          action.kind === 'reroll' &&
          !earlier.has(action.rerollId) &&
          action.target.kind !== 'wheelOffer',
      );
    if (otherPresses)
      context.note({
        area: 'reroll',
        reason: 'assumption',
        address:
          hub === undefined
            ? createOccurrenceAddress(biome, sourceId)
            : createHubDecisionAddress(biome, hub.hubKey),
        record,
      });
  }
}

/** Well and Pool rerolls of rooms whose plan holds no such screen to carry them. */
export function unplacedStoreScreenRerolls(
  context: RunImportContext,
): readonly RunImportReportEntry[] {
  return context.record.rooms.flatMap((_room, roomIndex) =>
    (['well', 'pool'] as const).flatMap((screen): RunImportReportEntry[] =>
      roomScreenRerolls(context, roomIndex).counts.has(screen) &&
      !context.used.has(`screenRerolls:${roomIndex}:${screen}`)
        ? [{ area: 'reroll', reason: 'unsupportedArea', record: { roomIndex, visit: 0 } }]
        : [],
    ),
  );
}

/**
 * Door rerolls of rooms whose bracket the walk never closed, such as the last
 * room or one past a stop; the plan holds none of them.
 */
export function unreachedRerolls(context: RunImportContext): readonly RunImportReportEntry[] {
  return context.record.rooms.flatMap((room, roomIndex) =>
    context.used.has(`rerolls:${roomIndex}`)
      ? []
      : Array.from({ length: room.rerolls ?? 0 }, (): RunImportReportEntry => ({
          area: 'reroll',
          reason: 'unsupportedArea',
          record: { roomIndex, visit: 0 },
        })),
  );
}
