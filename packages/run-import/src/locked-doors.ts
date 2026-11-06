import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  lockableExitKeys,
  type ExitDecision,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectCommand,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { nativeRoomActionIndex, roomActionAddress } from './actions';
import type { RunImportContext } from './import';
import { authoredOccurrence } from './occurrences';
import { searchRoom } from './room-search';
import { bracketStoresMatch } from './store-brackets';

const exitNumber = (exitKey: string) => Number(/\d+$/.exec(exitKey)?.[0] ?? 0);

const byExit = (left: string, right: string) => exitNumber(left) - exitNumber(right);

/** Every `size`-door subset of `doors`, keeping their order. */
function subsets(doors: readonly string[], size: number): readonly (readonly string[])[] {
  if (size === 0) return [[]];
  return doors.flatMap((door, index) =>
    subsets(doors.slice(index + 1), size - 1).map((rest) => [door, ...rest]),
  );
}

/**
 * The door sets a recorded fight count may have opened, in tie-break order.
 * The first door the game processes never locks and the saves never name a
 * fought door: a count that fills the lockable doors has one set; a smaller
 * one has each set of its size, those holding the taken door, when it can
 * lock, first, then by lowest doors. Empty when the count exceeds the
 * lockable doors.
 */
function lockedDoorSets(
  offered: readonly string[],
  lockable: ReadonlySet<string>,
  taken: string | undefined,
  fights: number,
): readonly (readonly string[])[] {
  const [, ...later] = [...offered].sort(byExit);
  const candidates = later.filter((exitKey) => lockable.has(exitKey));
  if (fights > candidates.length) return [];
  const holdsTaken = (set: readonly string[]) =>
    taken !== undefined && set.includes(taken) ? 0 : 1;
  return [...subsets(candidates, fights)].sort(
    (left, right) => holdsTaken(left) - holdsTaken(right),
  );
}

/**
 * A recorded lock host's fights. The saves keep how many locked doors were
 * fought open, never which, so the plan locks only the doors it fights (an
 * unfought lock changes nothing) and each press precedes every reroll of the
 * room: the game forbids rerolling a locked door before its fight and any door
 * during it, so a press first is always legal. Where several door sets fit the
 * count, each is authored with the room's rerolls and Artificer replacement
 * and kept when they reproduce the saved stores: one kept set is exact; of
 * several, which leave the same run, the first is taken and noted. A count no
 * set explains stops the plan before the room. A record made before the count
 * was kept reports it unread, once.
 */
export function importLockedDoors(context: RunImportContext): void {
  for (const [roomIndex, room] of context.record.rooms.entries()) {
    if (context.catalog.extraExitLocks.hosts.byKey[room.name] === undefined) continue;
    const used = `lockedDoors:${roomIndex}`;
    if (context.used.has(used)) continue;
    const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
    if (!context.entered(occurrenceId)) continue;
    const fights = room.lockedDoorFights;
    // A room the run ended in took no door, so its fights change nothing the plan reaches.
    if (fights === undefined && room.exit === undefined) {
      context.used.add(used);
      continue;
    }
    if (fights === undefined) {
      context.used.add(used);
      if (context.used.has('lockedDoors:unread')) continue;
      context.used.add('lockedDoors:unread');
      context.note({ area: 'lockedDoors', reason: 'notInRecord' });
      continue;
    }
    if (fights === 0) {
      context.used.add(used);
      continue;
    }
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const exit = exitDecision(context, biomeKey, occurrenceId);
    const taken = exit?.selection.kind === 'normal' ? exit.selection.exitKey : undefined;
    // The room's doors are complete, and the taken one known, once its exit is placed.
    if (exit === undefined || (taken === undefined && room.exit !== undefined)) continue;
    context.used.add(used);
    const record = { roomIndex, visit: 0 };
    const sets = lockedDoorSets(
      exit.normal.targets.map((target) => target.exitKey),
      new Set(lockableExitKeys(context.catalog, room.name)),
      taken,
      fights,
    );
    const fitting = sets.length > 1 ? fittingSets(context, roomIndex, biomeKey, sets) : sets;
    const chosen = fitting[0];
    if (chosen === undefined) {
      context.halt({ area: 'lockedDoors', code: 'lockedDoorFight', record });
      continue;
    }
    importFights(context, biomeKey, occurrenceId, roomIndex, exit, chosen, fitting.slice(1));
  }
}

/**
 * The door sets under which the room's recorded rerolls and Artificer
 * replacement, authored as the walk authors them, change the stores as saved.
 * Without either, nothing the room draws tells the sets apart.
 */
function fittingSets(
  context: RunImportContext,
  roomIndex: number,
  biomeKey: string,
  sets: readonly (readonly string[])[],
): readonly (readonly string[])[] {
  const room = context.record.rooms[roomIndex]!;
  if ((room.rerolls ?? 0) === 0 && (room.conversions?.artificer ?? 0) === 0) return sets;
  const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
  return searchRoom(context, {
    roomIndex,
    candidates: sets,
    author: (set) => (lockAndPress(context, biomeKey, occurrenceId, set) ? set : undefined),
    // Every recorded press placed, and the stores changed as saved.
    fits: () =>
      (authoredOccurrence(
        context.assembly().project,
        biomeKey,
        occurrenceId,
      )?.roomActions.order.filter((action) => action.kind === 'reroll').length ?? 0) >=
        (room.rerolls ?? 0) && bracketStoresMatch(context, roomIndex),
    sweep: true,
  }).fits.map((fit) => fit.choice);
}

/** Locks the given doors and places each press before the room's first reroll. */
function lockAndPress(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  exitKeys: readonly string[],
): boolean {
  const occurrence = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  const press = (exitKey: string) => {
    const reference: RoomActionReference = { kind: 'unlockExit', exitKey };
    const native = nativeRoomActionIndex(context, biomeKey, occurrenceId, reference);
    if (native === undefined) return false;
    if (native.present) return true;
    const order =
      authoredOccurrence(context.assembly().project, biomeKey, occurrenceId)?.roomActions.order ??
      [];
    const reroll = order.findIndex((action) => action.kind === 'reroll');
    return context.apply({
      kind: 'InsertRoomAction',
      action: roomActionAddress(context, biomeKey, occurrenceId, reference),
      reference,
      index: reroll >= 0 ? Math.min(reroll, native.index) : native.index,
    });
  };
  return context.transaction(
    () =>
      exitKeys.every((exitKey) => context.apply(lockCommand(occurrence, exitKey))) &&
      exitKeys.every((exitKey) => press(exitKey)),
  );
}

const lockCommand = (occurrence: OccurrenceAddress, exitKey: string): ProjectCommand => ({
  kind: 'ReplaceLockedExit',
  occurrence,
  exitKey,
  locked: true,
});

function exitDecision(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
): ExitDecision | undefined {
  const topology = context
    .assembly()
    .project.route.biomes.find((plan) => plan.biomeKey === biomeKey)?.topology;
  const decision = topology?.decisions.find(
    (entry) =>
      entry.kind === 'exit' &&
      entry.source.kind === 'occurrence' &&
      entry.source.occurrenceId === occurrenceId,
  );
  return decision?.kind === 'exit' ? decision : undefined;
}

/**
 * Authors the chosen door set. Other sets that fit leave the same run, so the
 * choice is noted with them; a refused set is reported door by door.
 */
function importFights(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  roomIndex: number,
  exit: ExitDecision,
  chosen: readonly string[],
  others: readonly (readonly string[])[],
): void {
  const occurrence = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  const address = createRoomFeatureAddress(occurrence, { kind: 'lockedExits' });
  const placed = lockAndPress(context, biomeKey, occurrenceId, chosen);
  if (placed && others.length === 0) return;
  const record = (exitKey: string) => {
    const door = recordedDoor(context, roomIndex, exit, exitKey);
    return { roomIndex, visit: 0, ...(door === undefined ? {} : { door }) };
  };
  if (placed) {
    // One fight's set is one door; a larger set's notes name its first.
    context.note({
      area: 'lockedDoors',
      reason: 'equivalent',
      address,
      applied: lockCommand(occurrence, chosen[0]!),
      alternatives: others.map((set) => lockCommand(occurrence, set[0]!)),
      record: record(chosen[0]!),
    });
    return;
  }
  for (const exitKey of chosen)
    context.note({
      area: 'lockedDoors',
      reason: 'refused',
      address,
      applied: lockCommand(occurrence, exitKey),
      record: record(exitKey),
    });
}

/** The recorded door id of one of the room's exits, by the occurrence it leads to. */
function recordedDoor(
  context: RunImportContext,
  roomIndex: number,
  exit: ExitDecision,
  exitKey: string,
): number | undefined {
  const target = exit.normal.targets.find((entry) => entry.exitKey === exitKey);
  if (target === undefined) return undefined;
  const room = context.record.rooms[roomIndex]!;
  const taken = exit.selection.kind === 'normal' && exit.selection.exitKey === exitKey;
  const doors = room.doors.filter((door) =>
    taken
      ? door.room === room.exit
      : context.occurrences.offeredOccurrence(roomIndex, door.door) === target.occurrenceId,
  );
  return doors.length === 1 ? doors[0]!.door : undefined;
}
