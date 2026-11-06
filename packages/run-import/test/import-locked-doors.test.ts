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

/** Each note as `reason occurrence exit door`, with the other doors that fit after `or`. */
const notes = (imported: RunImport) =>
  lockEntries(imported).map((entry) =>
    entry.address?.kind === 'roomFeature' && entry.applied?.kind === 'ReplaceLockedExit'
      ? [
          entry.reason,
          entry.address.occurrenceId,
          entry.applied.exitKey,
          entry.record?.door,
          ...(entry.alternatives ?? []).flatMap((command) =>
            command.kind === 'ReplaceLockedExit' ? ['or', command.exitKey] : [],
          ),
        ].join(' ')
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

  it("fights a two-door room's second door and notes a three-door room's one fight", () => {
    const imported = projectFromRunRecord(catalog, withFights(record, { 16: 1, 19: 1, 21: 1 }));
    expect(imported.kind).toBe('complete');
    // Only Exit 2 of a two-door room can lock: exact, so unreported.
    expect(locks(imported.project, 'G-r21')).toEqual({
      lockedExits: ['exit2'],
      order: ['unlock exit2'],
    });
    // No reroll tells Exit 2 from Exit 3. Left by Exit 1, which never locks: Exit 2 is taken.
    expect(locks(imported.project, 'G-r16')).toEqual({
      lockedExits: ['exit2'],
      order: ['unlock exit2'],
    });
    // Left by a door that can lock: that door is taken.
    expect(locks(imported.project, 'G-r19')).toEqual({
      lockedExits: ['exit3'],
      order: ['unlock exit3'],
    });
    expect(notes(imported)).toEqual([
      'equivalent G-r16 exit2 568653 or exit3',
      'equivalent G-r19 exit3 737226 or exit2',
    ]);
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

  // G_Combat08 of the probe recording: a reroll of the fought door after its fight.
  it('rerolls a fought door after its press', () => {
    const imported = projectFromRunRecord(
      catalog,
      withFights(withReroll(record, 16, 'MetaProgress', { MetaCurrencyBigDrop: -1 }), { 16: 2 }),
    );
    expect(imported.kind).toBe('complete');
    expect(locks(imported.project, 'G-r16')).toEqual({
      lockedExits: ['exit2', 'exit3'],
      order: ['unlock exit2', 'unlock exit3', 'reroll exit3'],
    });
    expect(lockEntries(imported)).toEqual([]);
  });

  it("searches one fight's door with the room's reroll, which fits either door", () => {
    const imported = projectFromRunRecord(
      catalog,
      withFights(withReroll(record, 20, 'RunProgress', { MaxHealthDrop: -1 }), { 20: 1 }),
    );
    expect(imported.kind).toBe('complete');
    expect(locks(imported.project, 'G-r20')).toEqual({
      lockedExits: ['exit2'],
      order: ['unlock exit2', 'reroll exit1'],
    });
    expect(notes(imported)).toEqual(['equivalent G-r20 exit2 609583 or exit3']);
  });

  // The press precedes every reroll, so a reroll of a candidate door never rules it out.
  it('keeps a door whose reroll the record shows as a candidate for the fight', () => {
    const imported = projectFromRunRecord(
      catalog,
      withFights(withReroll(record, 16, 'MetaProgress', { MetaCurrencyBigDrop: -1 }), { 16: 1 }),
    );
    expect(imported.kind).toBe('complete');
    expect(locks(imported.project, 'G-r16')).toEqual({
      lockedExits: ['exit2'],
      order: ['unlock exit2', 'reroll exit3'],
    });
    expect(notes(imported)).toEqual(['equivalent G-r16 exit2 568653 or exit3']);
  });

  it('stops before a room whose reroll no fought door reproduces', () => {
    const imported = projectFromRunRecord(
      catalog,
      withFights(withReroll(record, 16, 'MetaProgress', { MetaCurrencyDrop: -1 }), { 16: 1 }),
    );
    expect(imported.kind).toBe('stopped');
    if (imported.kind !== 'stopped') return;
    expect(imported.stop).toEqual({
      area: 'lockedDoors',
      code: 'lockedDoorFight',
      record: { roomIndex: 16, visit: 0 },
    });
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
