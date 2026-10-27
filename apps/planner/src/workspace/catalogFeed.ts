import type {
  CatalogCategory,
  CatalogEntry,
  CatalogFeedHost,
} from '../persistence/catalogFeedHost';
import { catalogPlanSupport } from '../projections/catalogHome';
import type { ProjectOperationResult } from './projectOperations';

/** The catalog as the Catalog screen shows it. */
export type CatalogFeedState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'ready';
      readonly categories: readonly CatalogCategory[];
      readonly entries: readonly CatalogEntry[];
      /** The last verified index kept from an earlier start, since this fetch failed. */
      readonly offline: boolean;
    }
  /** No index has been verified and none is cached; `problem` says why the fetch failed. */
  | { readonly kind: 'unavailable'; readonly problem: string | null }
  /** No catalog key is installed in this build. */
  | { readonly kind: 'disabled' };

/** Start-up reads wait out the host's interval; showing the Catalog retries a failed fetch. */
export type CatalogSyncTrigger = 'background' | 'screen';

export interface CatalogFeedController {
  sync(trigger?: CatalogSyncTrigger): Promise<void>;
  /** Downloads the entry's verified plan and adds a copy of it to the library. */
  addToLibrary(entry: CatalogEntry): Promise<ProjectOperationResult>;
  getSnapshot(): CatalogFeedState;
  subscribe(listener: () => void): () => void;
}

export const NEEDS_NEWER_PLANNER = 'Needs a newer planner';
export const UNSUPPORTED_OLD_PLAN = 'Too old for this planner';

const LOADING: CatalogFeedState = Object.freeze({ kind: 'loading' });

export function createCatalogFeedController(options: {
  readonly host: CatalogFeedHost;
  readonly addCatalogPlan: (
    entry: { readonly id: string; readonly title: string },
    json: string,
  ) => Promise<ProjectOperationResult>;
}): CatalogFeedController {
  let state: CatalogFeedState = LOADING;
  let inFlight: { readonly run: Promise<void>; readonly retryFailed: boolean } | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CatalogFeedState) => {
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  const run = async (retryFailed: boolean): Promise<void> => {
    try {
      const snapshot = await options.host.refresh(retryFailed);
      if (snapshot.source === 'disabled') {
        publish({ kind: 'disabled' });
      } else if (snapshot.source === 'none') {
        publish({ kind: 'unavailable', problem: snapshot.problem });
      } else {
        publish({
          kind: 'ready',
          categories: snapshot.categories,
          entries: snapshot.entries,
          offline: snapshot.source === 'cache',
        });
      }
    } catch (error) {
      if (state.kind !== 'ready') {
        publish({
          kind: 'unavailable',
          problem: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };
  // One read at a time; a retry after a background read starts once it settles.
  const sync = (retryFailed: boolean): Promise<void> => {
    if (inFlight !== null && (inFlight.retryFailed || !retryFailed)) return inFlight.run;
    const after = inFlight?.run ?? Promise.resolve();
    const next = after
      .then(() => run(retryFailed))
      .finally(() => {
        if (inFlight?.run === next) inFlight = null;
      });
    inFlight = { run: next, retryFailed };
    return next;
  };
  return Object.freeze({
    sync: (trigger: CatalogSyncTrigger = 'background') => sync(trigger === 'screen'),
    async addToLibrary(entry: CatalogEntry): Promise<ProjectOperationResult> {
      const support = catalogPlanSupport(entry);
      if (support !== 'supported') {
        return {
          operation: 'addCopy',
          status: 'failure',
          message: support === 'tooNew' ? NEEDS_NEWER_PLANNER : UNSUPPORTED_OLD_PLAN,
        };
      }
      try {
        return await options.addCatalogPlan(entry, await options.host.downloadPlan(entry.id));
      } catch (error) {
        return {
          operation: 'addCopy',
          status: 'failure',
          message: `Add to library failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
