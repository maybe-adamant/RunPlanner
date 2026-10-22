import { invoke as tauriInvoke } from '@tauri-apps/api/core';

/** One of the catalog's fixed categories, in the order the index lists them. */
export interface CatalogCategory {
  readonly id: string;
  readonly label: string;
}

/** One template plan's metadata, as the host verified and validated it. */
export interface CatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly author: string;
  readonly routeKey: string;
  readonly biomeCount: number;
  /** The authored project schema pair the plan file is saved in. */
  readonly planSchemaVersion: number;
  readonly planSchemaRevision: number;
  readonly planUrl: string;
  readonly planSha256: string;
}

export interface CatalogFeedSnapshot {
  readonly categories: readonly CatalogCategory[];
  readonly entries: readonly CatalogEntry[];
  /**
   * Where the verified index came from; `cache` is the last verified index, kept offline, and
   * `disabled` means no catalog key is installed, so there is no catalog.
   */
  readonly source: 'none' | 'network' | 'cache' | 'disabled';
  /** Why the last fetch failed, when it did. */
  readonly problem: string | null;
}

/** The host's signed plan catalog. */
export interface CatalogFeedHost {
  /**
   * Fetches the index unless it was read recently, or at once after a failed fetch when
   * `retryFailed`; offline, the last verified index stands.
   */
  readonly refresh: (retryFailed: boolean) => Promise<CatalogFeedSnapshot>;
  /** A verified entry's plan file as text, checked against its signed hash. */
  readonly downloadPlan: (entryId: string) => Promise<string>;
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTauriCatalogFeedHost(invoke: Invoke = tauriInvoke): CatalogFeedHost {
  return Object.freeze({
    refresh: (retryFailed: boolean) =>
      invoke<CatalogFeedSnapshot>('catalog_feed_refresh', { retryFailed }),
    downloadPlan: (entryId: string) => invoke<string>('catalog_plan_download', { entryId }),
  });
}
