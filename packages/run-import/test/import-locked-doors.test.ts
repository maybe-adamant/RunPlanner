import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import type { RunRecord } from '../src/run-record';
import { fixture } from './support/run-import';

const hosts = (record: RunRecord) =>
  record.rooms.flatMap((room, index) =>
    catalog.extraExitLocks.hosts.byKey[room.name] === undefined ? [] : [index],
  );

/** The record with every lock host's fight count kept, the given ones fought. */
function withFights(record: RunRecord, fought: Readonly<Record<number, number>>): RunRecord {
  const counted = new Set(hosts(record));
  return {
    ...record,
    rooms: record.rooms.map((room, index) =>
      counted.has(index)
        ? { ...room, lockedExits: true, lockedDoorFights: fought[index] ?? 0 }
        : room,
    ),
  };
}

const lockEntries = (imported: RunImport) =>
  imported.report.entries.filter((entry) => entry.area === 'lockedDoors');

describe('run import of Oceanus locked doors', () => {
  let record: RunRecord;
  let unfought: RunImport;
  beforeAll(() => {
    record = fixture('underworld');
    unfought = projectFromRunRecord(catalog, withFights(record, {}));
  });

  it('authors no lock where no locked door was fought open', () => {
    expect(hosts(record).length).toBeGreaterThan(0);
    expect(lockEntries(unfought)).toEqual([]);
    const occurrences = unfought.project.route.biomes.flatMap(
      (plan) => plan.topology?.occurrences ?? [],
    );
    expect(occurrences.filter((occurrence) => occurrence.lockedExits !== undefined)).toEqual([]);
    expect(
      occurrences.filter((occurrence) =>
        occurrence.roomActions.order.some((reference) => reference.kind === 'unlockExit'),
      ),
    ).toEqual([]);
  });

  it('stops before a room that fought a locked door open, whose door the saves never name', () => {
    const fought = hosts(record)[1]!;
    const imported = projectFromRunRecord(catalog, withFights(record, { [fought]: 1 }));
    expect(imported.kind).toBe('stopped');
    if (imported.kind !== 'stopped') return;
    expect(imported.stop).toEqual({
      area: 'lockedDoors',
      code: 'lockedDoorFight',
      record: { roomIndex: fought, visit: 0 },
    });
    expect(lockEntries(imported)).toEqual([
      { area: 'lockedDoors', reason: 'stopped', record: { roomIndex: fought, visit: 0 } },
    ]);
  });

  it('reports once that a record made before the count was kept leaves it unread', () => {
    const imported = projectFromRunRecord(catalog, record);
    expect(lockEntries(imported)).toEqual([{ area: 'lockedDoors', reason: 'notInRecord' }]);
  });
});
