import type { RunImportContext } from './import';

/**
 * A recorded lock host's fights. The saves keep the room's lock flag and how
 * many locked doors were fought open, never which doors locked, so a room with
 * no fight authors no lock (the door it leaves through was open, and a lock
 * never pressed changes nothing) and a fight stops the plan before the room. A
 * record made before the count was kept reports it unread, once.
 */
export function importLockedDoors(context: RunImportContext): void {
  for (const [roomIndex, room] of context.record.rooms.entries()) {
    if (context.catalog.extraExitLocks.hosts.byKey[room.name] === undefined) continue;
    const used = `lockedDoors:${roomIndex}`;
    if (context.used.has(used)) continue;
    if (!context.entered(context.occurrences.occurrenceOf(roomIndex))) continue;
    context.used.add(used);
    if (room.lockedDoorFights === undefined) {
      if (context.used.has('lockedDoors:unread')) continue;
      context.used.add('lockedDoors:unread');
      context.note({ area: 'lockedDoors', reason: 'notInRecord' });
      continue;
    }
    if (room.lockedDoorFights > 0)
      context.halt({
        area: 'lockedDoors',
        code: 'lockedDoorFight',
        record: { roomIndex, visit: 0 },
      });
  }
}
