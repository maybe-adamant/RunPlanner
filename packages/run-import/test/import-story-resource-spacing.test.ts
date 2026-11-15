import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import { enteredRooms, fixture, mismatchLines } from './support/run-import';

describe('run import of an Underworld victory with a Pickaxe beside an Exorcism in F_Story01', () => {
  const record = fixture('underworld-1020');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('completes with every room accepted and nothing refused', () => {
    expect(record.rooms[4]!.name).toBe('F_Combat19');
    expect(record.rooms[5]!.name).toBe('F_Story01');
    expect(imported.kind).toBe('complete');
    expect(enteredRooms(imported.project)).toEqual(record.rooms.map((room) => room.name));
    expect(mismatchLines(imported.report)).toEqual([]);
    expect(
      imported.report.entries.filter(
        (entry) => entry.reason === 'refused' || entry.reason === 'stopped',
      ),
    ).toEqual([]);
    const rooms = imported.report.rooms!;
    const last = record.rooms.length - 1;
    expect(rooms.slice(0, last).map((room) => [room.roomIndex, room.verdict])).toEqual(
      record.rooms.slice(0, last).map((_, roomIndex) => [roomIndex, 'accepted']),
    );
    expect(rooms[last]).toMatchObject({ verdict: 'unchecked', reason: 'lastRoom' });
  });

  it('places the Story room Pickaxe the room after the Exorcism', () => {
    expect(imported.project.route.resourcePlacements).toMatchObject({
      Exorcism: { biomeKey: 'F', occurrenceId: 'F-r4' },
      Pickaxe: { biomeKey: 'F', occurrenceId: 'F-r5' },
    });
  });
});
