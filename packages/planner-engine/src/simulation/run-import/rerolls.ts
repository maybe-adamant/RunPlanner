import {
  createBiomeAddress,
  createHubDecisionAddress,
  createHubRerollAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
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
import { entrySnapshot } from './conformance';
import type { RunImportContext } from './import';
import { authoredOccurrence } from './occurrences';
import type { RunImportReportEntry } from './report';
import { bracketStoresMatch, poolSpends, replacedRewards, type Replaced } from './store-brackets';
import { POM_GIVERS, recordedOffer } from './vocabulary';

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
 * Authors a screen's recorded rerolls once its final rows are authored. The
 * record keeps only the final screen, so the earlier screens are guessed and
 * reported; rerolls the engine refuses or no guess supports are reported and
 * left out. A count placed by id order is also an assumption.
 */
export function applyScreenRerolls(
  context: RunImportContext,
  roomIndex: number,
  screen: RerolledScreen,
  address: SemanticAddress,
  command: (count: number) => ProjectCommand | undefined,
): void {
  const rerolls = roomScreenRerolls(context, roomIndex);
  const count = rerolls.counts.get(screen);
  if (count === undefined) return;
  context.used.add(`screenRerolls:${roomIndex}:${screen}`);
  const record = { roomIndex, visit: 0 };
  const applied = command(count);
  if (applied === undefined || !context.applyValid(applied)) {
    context.note({
      area: 'reroll',
      reason: 'refused',
      address,
      ...(applied === undefined ? {} : { applied }),
      record,
    });
    return;
  }
  if (typeof screen === 'number')
    context.note({ area: 'reroll', reason: 'notInRecord', address, applied, record });
  if (rerolls.ambiguous && typeof screen === 'number')
    context.note({ area: 'reroll', reason: 'assumption', address, applied, record });
}

/**
 * Authors a room's recorded Well or Pool rerolls as unpinned rerolls, each
 * appended by `insert`; returns how many were authored. The record keeps no
 * roll content or order, so only their count is known.
 */
export function applyFeatureRerolls(
  context: RunImportContext,
  roomIndex: number,
  screen: 'well' | 'pool',
  address: SemanticAddress,
  insert: () => ProjectCommand,
): number {
  const count = roomScreenRerolls(context, roomIndex).counts.get(screen);
  if (count === undefined) return 0;
  context.used.add(`screenRerolls:${roomIndex}:${screen}`);
  for (let inserted = 0; inserted < count; inserted += 1) {
    const applied = insert();
    if (!context.applyValid(applied)) {
      context.note({
        area: 'reroll',
        reason: 'refused',
        address,
        applied,
        record: { roomIndex, visit: 0 },
      });
      return inserted;
    }
  }
  return count;
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

/** A reward owner one press may redraw, with how to rewrite its draws. */
export interface PressTarget {
  /** What the owner shows as the bracket begins: its first draw, or a Hub slot's reward from earlier stays. */
  readonly firstDraw: () => ResolvedRewardOffer | undefined;
  readonly replaceFirstDraw: (value: ResolvedRewardOffer) => ProjectCommand;
  /** A press on this owner, before its existing presses. */
  readonly press: (reward: ResolvedRewardOffer) => ProjectCommand;
  /** A Hub board slot's physical door, whose recorded offer each Hub visit saves. */
  readonly hubDoor?: number;
  /** Whether a press on this Hub slot is already placed in the bracket's stay. */
  readonly pressedInStay?: () => boolean;
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
export function roomPressTargets(
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
export function bracketDrawsAuthored(
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

/**
 * Board-door presses in one Hub stay, after `stay` room visits returned. A
 * slot's draws chain through every stay: a press here redraws the reward the
 * slot showed as this stay began, so it follows the slot's earlier-stay
 * presses and precedes those already placed in this stay.
 */
function hubPressTargets(
  context: RunImportContext,
  biome: BiomeAddress,
  hub: HubDecision,
  stay: number,
): readonly PressTarget[] {
  const decision = createHubDecisionAddress(biome, hub.hubKey);
  const currentHub = () =>
    context
      .assembly()
      .project.route.biomes.find((entry) => entry.biomeKey === biome.biomeKey)
      ?.topology?.decisions.find(
        (entry): entry is HubDecision => entry.kind === 'hub' && entry.hubKey === hub.hubKey,
      );
  /** The stay's action range and the slot's last press before it. */
  const stayOf = (hubSlotKey: string) => {
    const actions = currentHub()?.actions ?? [];
    const visits = actions.flatMap((action, index) => (action.kind === 'roomVisit' ? [index] : []));
    const start = stay === 0 ? 0 : (visits[stay - 1] ?? actions.length) + 1;
    const end = visits[stay] ?? actions.length;
    const presses = actions.flatMap((action, index) =>
      action.kind === 'reroll' && action.hubSlotKey === hubSlotKey ? [{ action, index }] : [],
    );
    const earlier = presses.filter(({ index }) => index < start).at(-1)?.action;
    const first = presses.find(({ index }) => index >= start && index < end)?.index;
    return { earlier, index: first ?? end, pressed: first !== undefined };
  };
  const layout = context.catalog.biomeLayouts.byKey[biome.biomeKey]?.progression;
  const doorOf = (hubSlotKey: string) =>
    layout?.kind === 'hub'
      ? layout.slots.find((slot) => slot.slotKey === hubSlotKey)?.physicalDoorId
      : undefined;
  // An entered slot's door is closed for the run.
  const entered = new Set(
    (currentHub()?.actions ?? [])
      .flatMap((action) => (action.kind === 'roomVisit' ? [action.hubSlotKey] : []))
      .slice(0, stay),
  );
  return hub.openTargets.flatMap((slot): readonly PressTarget[] => {
    if (entered.has(slot.hubSlotKey)) return [];
    const reward = createIncomingRewardAddress(biome, slot.occurrenceId);
    const target: PressTarget = {
      firstDraw: () => {
        const earlier = stayOf(slot.hubSlotKey).earlier;
        if (earlier?.kind === 'reroll') return earlier.reward;
        const state = occurrenceOf(context, biome.biomeKey, slot.occurrenceId)?.state;
        return state !== undefined && 'reward' in state ? state.reward?.offer : undefined;
      },
      replaceFirstDraw: (value) => {
        const earlier = stayOf(slot.hubSlotKey).earlier;
        return earlier?.kind === 'reroll'
          ? {
              kind: 'ReplaceHubRerollReward',
              reroll: createHubRerollAddress(biome, hub.hubKey, earlier.rerollId),
              reward: value,
            }
          : { kind: 'ReplaceIncomingReward', reward, value };
      },
      press: (value) => ({
        kind: 'InsertHubReroll',
        hub: decision,
        hubSlotKey: slot.hubSlotKey,
        reward: value,
        index: stayOf(slot.hubSlotKey).index,
      }),
      ...(doorOf(slot.hubSlotKey) === undefined ? {} : { hubDoor: doorOf(slot.hubSlotKey)! }),
      pressedInStay: () => stayOf(slot.hubSlotKey).pressed,
    };
    return [target];
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
 * Prepends one replaced reward to an owner's draws in the bracket: it becomes
 * what the owner shows as the bracket begins and a new first press of the
 * bracket redraws the previous one. A Boon's god is not
 * saved, so each god is tried in catalog order.
 */
export function prependReplaced(
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
 * Places one press of a restored Hub stay. Its board was assigned before the
 * bracket, so the stores lose only what the press drew: the slot whose door
 * the previous Hub visit saved with another offer and this visit with one of
 * that type takes it. The slot shows the earlier offer as the stay begins and
 * the press draws the later one.
 */
function placeRestoredHubPress(
  context: RunImportContext,
  targets: readonly PressTarget[],
  visits: { readonly previous: number; readonly current: number },
  drawn: Replaced,
): boolean {
  const offerAt = (roomIndex: number, door: number) =>
    recordedOffer(
      context.catalog,
      context.record.rooms[roomIndex]?.doors.find((candidate) => candidate.door === door)?.reward,
    );
  const same = (left: ResolvedRewardOffer, right: ResolvedRewardOffer) =>
    JSON.stringify(left) === JSON.stringify(right);
  for (const target of targets) {
    if (target.hubDoor === undefined || target.pressedInStay?.() === true) continue;
    const before = offerAt(visits.previous, target.hubDoor);
    const after = offerAt(visits.current, target.hubDoor);
    if (
      before === undefined ||
      after === undefined ||
      same(before, after) ||
      after.rewardType !== drawn.rewardType
    )
      continue;
    const placed = context.transaction(() => {
      const shown = target.firstDraw();
      return (
        shown !== undefined &&
        (same(shown, before) || context.apply(target.replaceFirstDraw(before))) &&
        context.apply(target.press(after))
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
 * first owner in native order that the engine accepts; a restored Hub stay's
 * loss is what its presses drew, placed by the board doors its visits saved.
 * Every assignment that removes the same rewards leaves the same stores, so a
 * placement that reproduces the saved stores is one assumption for the room;
 * otherwise each press is reported.
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
    // A ship room's unpicked wheel offers are solved first; the stores' remaining loss is the presses'.
    if (room.wheels !== undefined && !context.used.has(`wheelSolve:${roomIndex}`)) continue;
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
    // A Hub visit is no occurrence: its board is the decision of the room that first led to it.
    const hubVisits = context.occurrences.visitsOf(sourceId);
    // Each return to the Hub follows one completed room visit.
    const stay = hubVisits.indexOf(roomIndex);
    const firstVisit = hubVisits[0];
    const hub =
      topology?.occurrences.some((entry) => entry.occurrenceId === sourceId) ||
      stay < 0 ||
      firstVisit === undefined ||
      firstVisit === 0
        ? undefined
        : topology?.decisions.find(
            (decision): decision is HubDecision =>
              decision.kind === 'hub' &&
              decision.source.occurrenceId === context.occurrences.occurrenceOf(firstVisit - 1),
          );
    const targets =
      hub === undefined
        ? roomPressTargets(context, biome, sourceId)
        : hubPressTargets(context, biome, hub, stay);
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
    const sourceActions = () =>
      hub === undefined ? (occurrenceOf(context, biomeKey, sourceId)?.roomActions.order ?? []) : [];
    const before = new Set(
      pressAddresses(context, biome, sourceId, hub).map((address) => JSON.stringify(address)),
    );
    const earlier = new Set(
      sourceActions().flatMap((action) => (action.kind === 'reroll' ? [action.rerollId] : [])),
    );
    const placed = context.transaction(() =>
      solution.replaced.every((entry) =>
        hub !== undefined && stay > 0
          ? placeRestoredHubPress(
              context,
              targets,
              { previous: hubVisits[stay - 1]!, current: roomIndex },
              entry,
            )
          : prependReplaced(context, targets, entry),
      ),
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
