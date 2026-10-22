import { encodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

import type { ProjectLibraryAdapter } from '../persistence/projectLibrary';
import { libraryWriteFailed, libraryWriteSucceeded } from '../state/librarySessionSlice';
import { selectPresentProject, type PlannerStore } from '../state/store';

export interface SaveScheduler {
  schedule(delayMs: number, task: () => void): () => void;
}

/**
 * Writes every authored edit of the open plan to its library item. Edits are debounced and
 * coalesced; one write runs at a time and always writes the newest snapshot, so the last edit
 * wins. A failed write is reported and retried with the next edit or flush.
 */
export interface LibrarySaver {
  /** The open item's key, which a rename may change; null with no plan open. */
  openKey(): string | null;
  /**
   * Makes `key` the open item: the previous item's edits are written first, then `publish`
   * replaces the project without that replacement counting as an edit. Rejects, publishing
   * nothing, when the previous item cannot be written. An item stored in an older schema has
   * its original preserved before its first write.
   */
  open(
    key: string,
    publish: () => void,
    options?: { readonly preserveOriginal?: boolean },
  ): Promise<void>;
  /** Writes pending edits now; rejects with the write failure. */
  flush(): Promise<void>;
  dispose(): void;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createLibrarySaver(options: {
  readonly adapter: ProjectLibraryAdapter;
  readonly store: PlannerStore;
  readonly scheduler: SaveScheduler;
  readonly delayMs: number;
  /** A write moved the open item to another key. */
  readonly onRefiled: (key: string, project: ProjectDocument) => void;
}): LibrarySaver {
  const { adapter, store } = options;
  const present = () => selectPresentProject(store.getState());
  let key: string | null = null;
  /** The open item whose original must be kept before it is first overwritten. */
  let preserveBeforeWrite: string | null = null;
  let written: ProjectDocument | undefined;
  let observed = present();
  let publishing = false;
  let cancelPending: (() => void) | null = null;
  let running: Promise<void> | null = null;
  let failure: unknown = null;

  const cancel = () => {
    cancelPending?.();
    cancelPending = null;
  };
  const writePending = async (): Promise<void> => {
    failure = null;
    for (;;) {
      const target = key;
      const snapshot = present();
      if (target === null || snapshot === undefined || snapshot === written) return;
      try {
        if (preserveBeforeWrite === target) {
          await adapter.preserveOriginal(target);
          preserveBeforeWrite = null;
        }
        const entry = await adapter.write(target, encodeProjectDocument(snapshot));
        written = snapshot;
        if (store.getState().librarySession.writeError !== null) {
          store.dispatch(libraryWriteSucceeded());
        }
        if (key === target && entry.key !== target) {
          key = entry.key;
          options.onRefiled(entry.key, snapshot);
        }
      } catch (error) {
        failure = error;
        store.dispatch(
          libraryWriteFailed({ message: `Could not save the plan: ${errorDetail(error)}` }),
        );
        return;
      }
    }
  };
  // One write loop at a time; a later caller runs another once the running one ends.
  const drain = (): Promise<void> => {
    if (running !== null) return running.then(drain);
    const started = writePending().finally(() => {
      if (running === started) running = null;
    });
    running = started;
    return started;
  };
  const flush = async (): Promise<void> => {
    cancel();
    await drain();
    if (failure !== null) throw failure instanceof Error ? failure : new Error(String(failure));
  };

  const unsubscribe = store.subscribe(() => {
    const project = present();
    if (project === observed) return;
    observed = project;
    if (publishing || key === null || project === undefined) return;
    cancel();
    cancelPending = options.scheduler.schedule(options.delayMs, () => {
      cancelPending = null;
      void drain();
    });
  });

  return Object.freeze({
    openKey: () => key,
    async open(
      nextKey: string,
      publish: () => void,
      openOptions: { readonly preserveOriginal?: boolean } = {},
    ): Promise<void> {
      await flush();
      publishing = true;
      try {
        publish();
      } finally {
        publishing = false;
      }
      key = nextKey;
      preserveBeforeWrite = openOptions.preserveOriginal === true ? nextKey : null;
      written = present();
      observed = written;
    },
    flush,
    dispose(): void {
      unsubscribe();
      cancel();
    },
  });
}
