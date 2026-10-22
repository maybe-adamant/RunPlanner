import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBrowserProjectLibraryAdapter } from '@planner/persistence/browserProjectLibraryAdapter';
import type { OutsideProjectFile } from '@planner/persistence/projectLibrary';
import { createMemoryIndexedDb } from '@planner-test/support/memoryIndexedDb';
import {
  describeProjectLibraryContract,
  libraryPlanJson,
} from '@planner-test/support/projectLibraryContract';

let indexedDb = createMemoryIndexedDb();
let clock = 1_000;
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  indexedDb = createMemoryIndexedDb();
  clock = 1_000;
});

function createAdapter(
  chooseFile: () => Promise<OutsideProjectFile | null> = () => Promise.resolve(null),
) {
  return createBrowserProjectLibraryAdapter({
    chooseFile,
    indexedDB: () => indexedDb,
    now: () => clock,
  });
}

describeProjectLibraryContract('Browser', () => createAdapter());

describe('Browser project library', () => {
  it('stamps each write with the time it was made', async () => {
    const library = createAdapter();
    const created = await library.create(libraryPlanJson('plan-a', 'First'));
    expect(created.modifiedMs).toBe(1_000);
    clock = 5_000;
    expect((await library.write(created.key, libraryPlanJson('plan-a', 'Edited'))).modifiedMs).toBe(
      5_000,
    );
  });

  it('keeps a deleted plan restorable for a week', async () => {
    const library = createAdapter();
    const old = await library.create(libraryPlanJson('plan-a', 'Old'));
    const recent = await library.create(libraryPlanJson('plan-b', 'Recent'));
    await library.delete(old.key);
    clock += 7 * DAY_MS + 1;
    await library.delete(recent.key);

    await expect(library.restore(old.key)).rejects.toThrow(/no longer in the trash/);
    expect((await library.restore(recent.key)).key).toBe(recent.key);
  });

  it('imports through the browser file picker and has no folder or previous file', async () => {
    const file = { fileName: 'plan.runplanner.json', json: '{}' };
    const library = createAdapter(vi.fn(() => Promise.resolve(file)));
    expect(library.supportsReveal).toBe(false);
    await expect(library.chooseImportFile()).resolves.toBe(file);
    await expect(library.previousActiveFile()).resolves.toBeNull();
    await expect(library.reveal()).rejects.toThrow(/not a folder/);
  });
});
