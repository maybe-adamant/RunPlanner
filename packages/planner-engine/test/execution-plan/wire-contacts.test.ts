import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import type { RoomEventGraph } from '../../src/authored-project/room-actions/event-graph';
import { wireWindow } from '../../src/execution-plan/assembly/lifecycle';
import type { ExecutionLifecycleWindow } from '../../src/execution-plan/model';
import type { RoomActionRow } from '../../src/simulation/room-actions/model';
import {
  assertLifecycleSnapshot,
  byRoomVariant,
  compactActionKey,
  corpusAssemblies,
  corpusRooms,
  roomLabel,
  setUnique,
  type RoomWitness,
} from '../support/lifecycle-snapshots';

const snapshotPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'support',
  'wire-contacts.snapshot.json',
);

function contactText(window: ExecutionLifecycleWindow): string {
  switch (window.kind) {
    case 'standard':
      return `standard ${window.phase}`;
    case 'bossDefeated':
    case 'encounterEnd':
      return `${window.kind} ${window.phaseKey}`;
    case 'shipPreCombat':
    case 'shipPostCombat':
      return `${window.kind} ${window.wheelKey}`;
    case 'postOutgoing':
      return 'postOutgoing';
  }
}

/** The execution contact a row publishes, or the refusal it raises. */
function rowContact(row: RoomActionRow, graph: RoomEventGraph): string {
  return contactText(wireWindow(row.bounds, graph));
}

describe('published lifecycle contacts', () => {
  it('match the checked-in snapshot for every placed row of every entered corpus room', async () => {
    const witnesses: RoomWitness<{ readonly rows: Record<string, string> }>[] = [];
    for (const { entry, assembly } of corpusAssemblies()) {
      for (const room of corpusRooms(assembly)) {
        if (!room.entered) continue;
        const rows: Record<string, string> = {};
        for (const row of room.roomActionRoster.rows)
          if (!row.stale && row.rank !== null)
            setUnique(
              rows,
              `#${row.rank} ${compactActionKey(row.key)}`,
              rowContact(row, room.roomActionRoster.eventGraph),
            );
        if (Object.keys(rows).length > 0)
          witnesses.push({
            entry: entry.name,
            room: roomLabel(room.origin, room.gameName),
            content: { rows },
          });
      }
    }
    await assertLifecycleSnapshot(snapshotPath, byRoomVariant(witnesses));
  });
});
