import { vi } from 'vitest';

import type {
  CatalogEntry,
  CatalogFeedHost,
  CatalogFeedSnapshot,
} from '@planner/persistence/catalogFeedHost';

export const CATEGORIES = [
  { id: 'full-run', label: 'Full runs' },
  { id: 'speedrun', label: 'Speedrun' },
  { id: 'practice', label: 'Practice' },
] as const;

/** A verified catalog entry; fields override the defaults. */
export function catalogEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  const id = overrides.id ?? 'sub-2m-underworld';
  return {
    id,
    title: 'Sub 2m Underworld',
    description: 'Persephone Skull on Apollo and Hera.',
    category: 'speedrun',
    tags: ['skull', 'apollo', 'hera'],
    author: 'Hippo',
    routeKey: 'Underworld',
    biomeCount: 4,
    planSchemaVersion: 96,
    planSchemaRevision: 0,
    planUrl: `https://github.com/maybe-adamant/RunPlanner-Catalog/releases/download/catalog/${id}.runplanner.json`,
    planSha256: 'a'.repeat(64),
    ...overrides,
  };
}

export function catalogSnapshot(
  entries: readonly CatalogEntry[],
  overrides: Partial<CatalogFeedSnapshot> = {},
): CatalogFeedSnapshot {
  return { categories: CATEGORIES, entries, source: 'network', problem: null, ...overrides };
}

/** A catalog host answering each refresh with `snapshot` and each download from `plans`. */
export function createFakeCatalogFeedHost(
  snapshot: CatalogFeedSnapshot,
  plans: Readonly<Record<string, string>> = {},
) {
  let current = snapshot;
  const host = {
    refresh: vi.fn<CatalogFeedHost['refresh']>(() => Promise.resolve(current)),
    downloadPlan: vi.fn<CatalogFeedHost['downloadPlan']>((entryId) =>
      plans[entryId] === undefined
        ? Promise.reject(new Error('The downloaded plan does not match the catalog.'))
        : Promise.resolve(plans[entryId]),
    ),
  } satisfies CatalogFeedHost;
  return {
    host,
    answer: (next: CatalogFeedSnapshot) => {
      current = next;
    },
  };
}
