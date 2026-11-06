import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  lockableExitKeys,
  type ExitDecision,
  type OccurrenceId,
  type ProjectCommand,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { nativeRoomActionIndex, roomActionAddress } from './actions';
import type { RunImportContext } from './import';
import { authoredOccurrence } from './occurrences';

const exitNumber = (exitKey: string) => Number(/\d+$/.exec(exitKey)?.[0] ?? 0);

/** The doors a lock fight may have opened, and which of them the plan fights. */
interface LockedDoors {
  readonly exitKeys: readonly string[];
  /** The record cannot tell which lockable doors were fought; these are a guess. */
  readonly guessed: boolean;
}

/**
 * The doors to lock and fight for a recorded fight count. The first door the
 * game processes never locks, and the saves never name a fought door: a count
 * that fills the lockable doors is exact; a smaller one fights the taken door
 * when it can lock, else the lowest lockable doors. Undefined when the count
 * exceeds the lockable doors.
 */
function lockedDoors(
  offered: readonly string[],
  lockable: ReadonlySet<string>,
  taken: string | undefined,
  fights: number,
): LockedDoors | undefined {
  const [, ...later] = [...offered].sort((left, right) => exitNumber(left) - exitNumber(right));
  const candidates = later.filter((exitKey) => lockable.has(exitKey));
  if (fights > candidates.length) return undefined;
  if (fights === candidates.length) return { exitKeys: candidates, guessed: false };
  const first = taken !== undefined && candidates.includes(taken) ? [taken] : [];
  return {
    exitKeys: [...first, ...candidates.filter((exitKey) => exitKey !== taken)]
      .slice(0, fights)
      .sort((left, right) => exitNumber(left) - exitNumber(right)),
    guessed: true,
  };
}

/**
 * A recorded lock host's fights. The saves keep how many locked doors were
 * fought open, never which, so the plan locks only the doors it fights (an
 * unfought lock changes nothing) and each press precedes every reroll of the
 * room: the game forbids rerolling a locked door before its fight and any door
 * during it, so a press first is always legal. A guessed door is reported; a
 * count no lockable doors explain stops the plan before the room. A record
 * made before the count was kept reports it unread, once.
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
    const doors = lockedDoors(
      exit.normal.targets.map((target) => target.exitKey),
      new Set(lockableExitKeys(context.catalog, room.name)),
      taken,
      fights,
    );
    if (doors === undefined) {
      context.halt({ area: 'lockedDoors', code: 'lockedDoorFight', record });
      continue;
    }
    importFights(context, biomeKey, occurrenceId, roomIndex, exit, doors);
  }
}

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

/** Locks the fought doors and places each press before the room's first reroll. */
function importFights(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  roomIndex: number,
  exit: ExitDecision,
  doors: LockedDoors,
): void {
  const occurrence = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  const address = createRoomFeatureAddress(occurrence, { kind: 'lockedExits' });
  const locks = doors.exitKeys.map((exitKey): ProjectCommand => ({
    kind: 'ReplaceLockedExit',
    occurrence,
    exitKey,
    locked: true,
  }));
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
  const placed = context.transaction(
    () =>
      locks.every((command) => context.apply(command)) &&
      doors.exitKeys.every((exitKey) => press(exitKey)),
  );
  const doorOf = (exitKey: string) => recordedDoor(context, roomIndex, exit, exitKey);
  for (const [index, applied] of locks.entries()) {
    if (placed && !doors.guessed) continue;
    const door = doorOf(doors.exitKeys[index]!);
    context.note({
      area: 'lockedDoors',
      reason: placed ? 'assumption' : 'refused',
      address,
      applied,
      record: { roomIndex, visit: 0, ...(door === undefined ? {} : { door }) },
    });
  }
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
