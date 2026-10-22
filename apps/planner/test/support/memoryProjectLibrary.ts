import {
  encodeProjectDocument,
  parseProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { createBrowserProjectLibraryAdapter } from '@planner/persistence/browserProjectLibraryAdapter';
import type {
  ChosenImportFile,
  OutsideProjectFile,
  ProjectLibraryAdapter,
} from '@planner/persistence/projectLibrary';
import { createMemoryIndexedDb } from './memoryIndexedDb';

/**
 * A library in memory over the browser adapter, with a scripted file picker, an optional file
 * from before the library, and injectable write failures.
 */
export function createMemoryProjectLibrary(
  options: { readonly previousFile?: OutsideProjectFile; readonly now?: () => number } = {},
) {
  const chosen: (readonly ChosenImportFile[])[] = [];
  let failWrites: Error | null = null;
  let keys = 0;
  const writes: { readonly key: string; readonly json: string }[] = [];
  const indexedDb = createMemoryIndexedDb();
  const stored = createBrowserProjectLibraryAdapter({
    document: undefined as never,
    indexedDB: () => indexedDb,
    mintKey: () => `plan-${(keys += 1)}`,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const adapter: ProjectLibraryAdapter = {
    ...stored,
    write(key, json) {
      if (failWrites !== null) return Promise.reject(failWrites);
      writes.push({ key, json });
      return stored.write(key, json);
    },
    chooseImportFiles: () => Promise.resolve(chosen.shift() ?? []),
    previousActiveFile: () => Promise.resolve(options.previousFile ?? null),
  };
  return {
    adapter,
    /** Every successful write of an open plan, in order. */
    writes,
    /** Queues the file, or files, the next import picks; null or none cancels it. */
    choose: (files: ChosenImportFile | readonly ChosenImportFile[] | null) =>
      void chosen.push(files === null ? [] : 'fileName' in files ? [files] : files),
    /** Makes writes fail with `error` until called with null. */
    failWrites: (error: Error | null) => {
      failWrites = error;
    },
    /** Reads one stored plan, decoded. */
    async plan(catalog: Catalog, key: string): Promise<ProjectDocument> {
      return parseProjectDocument(await stored.read(key), catalog);
    },
    /** Stores `project` as a library plan in a folder and returns its key. */
    async file(project: ProjectDocument, folder = ''): Promise<string> {
      return (await stored.create(encodeProjectDocument(project), folder)).key;
    },
    /** The stored plans, decoded. */
    async plans(catalog: Catalog): Promise<readonly ProjectDocument[]> {
      const { entries } = await stored.list();
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
