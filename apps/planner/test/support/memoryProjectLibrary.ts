import {
  encodeProjectDocument,
  parseProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { createBrowserProjectLibraryAdapter } from '@planner/persistence/browserProjectLibraryAdapter';
import type {
  OutsideProjectFile,
  ProjectLibraryAdapter,
} from '@planner/persistence/projectLibrary';
import { createMemoryIndexedDb } from './memoryIndexedDb';

/**
 * A library in memory over the browser adapter, with a scripted file picker, an optional file
 * from before the library, and injectable write failures.
 */
export function createMemoryProjectLibrary(
  options: { readonly previousFile?: OutsideProjectFile } = {},
) {
  const chosen: (OutsideProjectFile | null)[] = [];
  let failWrites: Error | null = null;
  let keys = 0;
  const writes: { readonly key: string; readonly json: string }[] = [];
  const indexedDb = createMemoryIndexedDb();
  const stored = createBrowserProjectLibraryAdapter({
    document: undefined as never,
    indexedDB: () => indexedDb,
    mintKey: () => `plan-${(keys += 1)}`,
  });
  const adapter: ProjectLibraryAdapter = {
    ...stored,
    write(key, json) {
      if (failWrites !== null) return Promise.reject(failWrites);
      writes.push({ key, json });
      return stored.write(key, json);
    },
    chooseImportFile: () => Promise.resolve(chosen.length > 0 ? (chosen.shift() ?? null) : null),
    previousActiveFile: () => Promise.resolve(options.previousFile ?? null),
  };
  return {
    adapter,
    /** Every successful write of an open plan, in order. */
    writes,
    /** Queues the file the next import picks; null cancels it. */
    choose: (file: OutsideProjectFile | null) => void chosen.push(file),
    /** Makes writes fail with `error` until called with null. */
    failWrites: (error: Error | null) => {
      failWrites = error;
    },
    /** Stores `project` as a library plan and returns its key. */
    async file(project: ProjectDocument): Promise<string> {
      return (await stored.create(encodeProjectDocument(project))).key;
    },
    /** The stored plans, decoded. */
    async plans(catalog: Catalog): Promise<readonly ProjectDocument[]> {
      const entries = await stored.list();
      return Promise.all(
        entries.map(async (entry) => parseProjectDocument(await stored.read(entry.key), catalog)),
      );
    },
  };
}

/** Holds the debounced library write until the test runs it. */
export function createManualSaveScheduler() {
  let pending: { cancelled: boolean; task: () => void } | null = null;
  return {
    scheduler: {
      schedule: (_delayMs: number, task: () => void) => {
        if (pending !== null) pending.cancelled = true;
        const next = { cancelled: false, task };
        pending = next;
        return () => {
          next.cancelled = true;
        };
      },
    },
    hasPending: () => pending !== null && !pending.cancelled,
    /** Runs the pending write's start; the write itself completes asynchronously. */
    run() {
      if (pending === null || pending.cancelled) throw new Error('No library write is pending');
      const next = pending;
      pending = null;
      next.task();
    },
  };
}
