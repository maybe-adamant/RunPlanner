import { describe, expect, it } from 'vitest';

import { createMemoryRecordHost } from '@planner-test/support/memoryRecordHost';
import {
  createRecentRunsStore,
  decodeRecentRunEntry,
  RECENT_RUNS_LIMIT,
  RecentRunEntryError,
  summarizeRecentRun,
  type RecentRunEntry,
} from '@planner/workspace/run-recording/recentRuns';

function entry(startedAt: number, values: Partial<RecentRunEntry> = {}): RecentRunEntry {
  return {
    entryVersion: 1,
    id: `p1-${startedAt}-${startedAt + 1000}`,
    profile: 1,
    runCount: startedAt + 1000,
    attempt: 1,
    startedAt,
    outcome: 'death',
    route: { biomes: ['F'], dream: false, rooms: 9, endingRoom: 'F_Boss01' },
    project: '{}',
    report: { entries: [] },
    importKind: 'complete',
    ...values,
  };
}

describe('recent runs store', () => {
  it('keeps the newest starts up to the limit, dropping the oldest', async () => {
    const host = createMemoryRecordHost().recentRuns;
    const store = createRecentRunsStore(host);
    expect(RECENT_RUNS_LIMIT).toBe(20);
    // Files without a run identity never count toward the limit.
    host.files.set('notes', 'x');
    // Stored out of start order: the limit follows the start, not the write.
    for (const startedAt of [5, 1, 22, 3, ...Array.from({ length: 18 }, (_, index) => 100 + index)])
      await store.add(entry(startedAt));
    const { entries } = await store.list();
    expect(entries).toHaveLength(20);
    expect(entries.map((run) => run.startedAt).slice(-3)).toEqual([100, 22, 5]);
    expect(entries[0]!.startedAt).toBe(117);
    expect(host.files.has('p1-1-1001') || host.files.has('p1-3-1003')).toBe(false);
    expect(host.files.has('notes')).toBe(true);
  });

  it('does not write a run older than every kept run of a full store', async () => {
    const host = createMemoryRecordHost().recentRuns;
    const store = createRecentRunsStore(host, 2);
    expect(await store.add(entry(5))).toBe('stored');
    expect(await store.add(entry(6))).toBe('stored');
    expect(await store.add(entry(4))).toBe('olderThanKept');
    expect([...host.files.keys()].sort()).toEqual(['p1-5-1005', 'p1-6-1006']);
    // Writing a kept run again is not a new run.
    expect(await store.add(entry(5, { outcome: 'victory' }))).toBe('stored');
  });

  it('honours a smaller limit and deletes on request', async () => {
    const host = createMemoryRecordHost().recentRuns;
    const store = createRecentRunsStore(host, 2);
    for (const startedAt of [1, 2, 3]) await store.add(entry(startedAt));
    expect([...host.files.keys()].sort()).toEqual(['p1-2-1002', 'p1-3-1003']);
    await store.delete('p1-3-1003');
    expect((await store.list()).entries.map((run) => run.id)).toEqual(['p1-2-1002']);
  });

  it('round-trips an entry and lists a document it cannot read as unreadable', async () => {
    const host = createMemoryRecordHost().recentRuns;
    const store = createRecentRunsStore(host);
    // A cut run keeps the outcome its end save showed.
    const gapped = entry(7, { gap: true, outcome: 'death', attempt: 3 });
    await store.add(gapped);
    host.files.set('p1-8-1008', JSON.stringify({ ...entry(8), entryVersion: 2 }));
    expect(await store.list()).toEqual({
      entries: [gapped],
      unreadable: [{ id: 'p1-8-1008', reason: 'recent run entryVersion is malformed' }],
    });
    expect(await store.read(gapped.id)).toEqual(gapped);
    expect(summarizeRecentRun(gapped)).toEqual({
      id: 'p1-7-1007',
      profile: 1,
      runCount: 1007,
      attempt: 3,
      startedAt: 7,
      outcome: 'death',
      route: gapped.route,
      importKind: 'complete',
      reportCount: 0,
      gap: true,
    });
  });

  it('keeps a failure without a plan', () => {
    const failed = entry(9, { failure: 'room 3 has no entry save' });
    const { project: _project, report: _report, importKind: _kind, ...rest } = failed;
    void [_project, _report, _kind];
    expect(decodeRecentRunEntry(JSON.stringify(rest))).toEqual(rest);
    expect(summarizeRecentRun(rest)).toMatchObject({
      reportCount: 0,
      gap: false,
      failure: 'room 3 has no entry save',
    });
  });

  it('rejects a malformed entry', () => {
    expect(() => decodeRecentRunEntry(JSON.stringify({ ...entry(1), outcome: 'won' }))).toThrow(
      RecentRunEntryError,
    );
    expect(() => decodeRecentRunEntry(JSON.stringify({ ...entry(1), id: '../x' }))).toThrow(
      RecentRunEntryError,
    );
  });
});
