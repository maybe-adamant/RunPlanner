import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { projectFromRunRecord, type RunImport } from '../src/import';
import type { RunRecord } from '../src/run-record';
import { fixture, oceanus1010, occurrence, withReroll } from './support/run-import';

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

/** Each guessed door as `occurrence exit door`. */
const guesses = (imported: RunImport) =>
  lockEntries(imported).map((entry) =>
    entry.reason === 'assumption' &&
    entry.address?.kind === 'roomFeature' &&
    entry.applied?.kind === 'ReplaceLockedExit'
      ? `${entry.address.occurrenceId} ${entry.applied.exitKey} ${entry.record?.door}`
      : entry.reason,
  );

/** An occurrence's locked doors and its presses and rerolls, in room order. */
function locks(project: ProjectDocument, occurrenceId: string) {
  const authored = occurrence(project, occurrenceId);
  return {
    lockedExits: authored.lockedExits,
    order: authored.roomActions.order.flatMap((action) =>
      action.kind === 'unlockExit'
        ? [`unlock ${action.exitKey}`]
        : action.kind === 'reroll' && action.target.kind === 'door'
          ? [`reroll ${action.target.exitKey}`]
          : [],
    ),
  };
}

/*
 * Erebus and Oceanus of run 1010. Its lock hosts' doors in native order, the
 * taken one marked: G_Combat05 (r16) *exit1*, exit2, exit3; G_Combat17 (r19)
 * exit1, exit2, *exit3*; G_Combat15 (r20) exit1, *exit2*, exit3; G_Combat11
 * (r21) *exit1*, exit2.
 */
describe('run import of Oceanus locked doors', () => {
  let record: RunRecord;
  beforeAll(() => {
    record = oceanus1010();
  });

  it('authors no lock where no locked door was fought open', () => {
    const unfought = projectFromRunRecord(catalog, withFights(record, {}));
    expect(hosts(record)).toEqual([15, 16, 19, 20, 21]);
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

  it("fights a two-door room's second door and guesses a three-door room's one fight", () => {
    const imported = projectFromRunRecord(catalog, withFights(record, { 16: 1, 19: 1, 21: 1 }));
    expect(imported.kind).toBe('complete');
    // Only Exit 2 of a two-door room can lock: exact, so unreported.
    expect(locks(imported.project, 'G-r21')).toEqual({
      lockedExits: ['exit2'],
      order: ['unlock exit2'],
    });
    // Left by Exit 1, which never locks: the fight is given to Exit 2.
    expect(locks(imported.project, 'G-r16')).toEqual({
      lockedExits: ['exit2'],
      order: ['unlock exit2'],
    });
    // Left by a door that can lock: the fight opened it.
    expect(locks(imported.project, 'G-r19')).toEqual({
      lockedExits: ['exit3'],
      order: ['unlock exit3'],
    });
    expect(guesses(imported)).toEqual(['G-r16 exit2 568653', 'G-r19 exit3 737226']);
  });

  it("fights both of a three-door room's lockable doors for two fights, before its reroll", () => {
    const imported = projectFromRunRecord(
      catalog,
      withFights(withReroll(record, 20, 'RunProgress', { MaxHealthDrop: -1 }), { 20: 2 }),
    );
    expect(imported.kind).toBe('complete');
    expect(locks(imported.project, 'G-r20')).toEqual({
      lockedExits: ['exit2', 'exit3'],
      order: ['unlock exit2', 'unlock exit3', 'reroll exit1'],
    });
    expect(lockEntries(imported)).toEqual([]);
  });

  // G_Combat08 of the probe recording: one fight and rerolls on both sides of it.
  it("presses a guessed door before the room's rerolls, which may follow it", () => {
    const imported = projectFromRunRecord(
      catalog,
      withFights(withReroll(record, 20, 'RunProgress', { MaxHealthDrop: -1 }), { 20: 1 }),
    );
    expect(imported.kind).toBe('complete');
    expect(locks(imported.project, 'G-r20')).toEqual({
      lockedExits: ['exit2'],
      order: ['unlock exit2', 'reroll exit1'],
    });
    expect(guesses(imported)).toEqual(['G-r20 exit2 609583']);
  });

  it('stops before a room whose fights outnumber its lockable doors', () => {
    const imported = projectFromRunRecord(catalog, withFights(record, { 21: 2 }));
    expect(imported.kind).toBe('stopped');
    if (imported.kind !== 'stopped') return;
    expect(imported.stop).toEqual({
      area: 'lockedDoors',
      code: 'lockedDoorFight',
      record: { roomIndex: 21, visit: 0 },
    });
    expect(lockEntries(imported)).toEqual([
      { area: 'lockedDoors', reason: 'stopped', record: { roomIndex: 21, visit: 0 } },
    ]);
  });

  it('reports once that a record made before the count was kept leaves it unread', () => {
    const imported = projectFromRunRecord(catalog, fixture('underworld'));
    expect(lockEntries(imported)).toEqual([{ area: 'lockedDoors', reason: 'notInRecord' }]);
  });
});
