import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { CatalogCategory, CatalogEntry } from '@planner/persistence/catalogFeedHost';
import { LOADABLE_PROJECT_SCHEMAS } from '@planner/persistence/projectDocumentLoader';
import { ownEntry } from '@planner/projections/gameSlotSummary';
import { plannedBiomeTrail } from '@planner/projections/libraryHome';
import type { LibraryItem } from '@planner/workspace/projectLibrary';

/** Whether this planner can open an entry's plan, by the schema it is saved in. */
export type CatalogPlanSupport = 'supported' | 'tooNew' | 'tooOld';

export function catalogPlanSupport(entry: {
  readonly planSchemaVersion: number;
  readonly planSchemaRevision: number;
}): CatalogPlanSupport {
  const { oldest, newest, newestRevision } = LOADABLE_PROJECT_SCHEMAS;
  if (
    entry.planSchemaVersion > newest ||
    (entry.planSchemaVersion === newest && entry.planSchemaRevision > newestRevision)
  ) {
    return 'tooNew';
  }
  return entry.planSchemaVersion < oldest ? 'tooOld' : 'supported';
}

export type CatalogSort = 'name' | 'route';

export interface CatalogViewQuery {
  /** A category id, or null for every category. */
  readonly category: string | null;
  readonly filter: string;
  /** A route key, or null for any route. */
  readonly routeKey: string | null;
  readonly tag: string | null;
  readonly sort: CatalogSort;
}

export interface CatalogTab {
  /** A category id, or null for All. */
  readonly category: string | null;
  readonly label: string;
  readonly count: number;
}

/** What a row offers: adding the entry, opening the copy already added, or why it cannot. */
export type CatalogRowAction =
  | { readonly kind: 'add' }
  | { readonly kind: 'inLibrary'; readonly key: string }
  | { readonly kind: 'unsupported'; readonly support: 'tooNew' | 'tooOld' };

export interface CatalogRow {
  readonly entry: CatalogEntry;
  readonly routeKey: string;
  /** The route as the route chooser names it. */
  readonly route: string;
  /** Such as { count: "4 biomes", trail: "to Tartarus" }. */
  readonly biomes: { readonly count: string; readonly trail: string | null };
  readonly action: CatalogRowAction;
}

export interface CatalogView {
  /** All first, then each category with entries in the index's order, with its entry count. */
  readonly tabs: readonly CatalogTab[];
  /** The tags of the shown category's entries, for the tag filter. */
  readonly tags: readonly string[];
  readonly rows: readonly CatalogRow[];
  /** Entries in the shown category before search and filters. */
  readonly total: number;
}

function matches(entry: CatalogEntry, needle: string): boolean {
  return [entry.title, entry.description, entry.author, ...entry.tags].some((text) =>
    text.toLocaleLowerCase().includes(needle),
  );
}

/**
 * The Catalog screen: category tabs, then the shown category's entries searched by text,
 * filtered by route and tag, and sorted. An entry is in the library while the copy it was added
 * as is still there, matched by the identity recorded when it was added.
 */
export function projectCatalogView(
  catalog: Catalog,
  feed: {
    readonly categories: readonly CatalogCategory[];
    readonly entries: readonly CatalogEntry[];
  },
  library: {
    readonly items: readonly LibraryItem[] | null;
    readonly copies: Readonly<Record<string, string>>;
  },
  query: CatalogViewQuery,
): CatalogView {
  const tabs: CatalogTab[] = [
    { category: null, label: 'All', count: feed.entries.length },
    // A category without entries has no tab.
    ...feed.categories.flatMap((category) => {
      const count = feed.entries.filter((entry) => entry.category === category.id).length;
      return count === 0 ? [] : [{ category: category.id, label: category.label, count }];
    }),
  ];
  const inCategory = feed.entries.filter(
    (entry) => query.category === null || entry.category === query.category,
  );
  const tags = [...new Set(inCategory.flatMap((entry) => entry.tags))].sort();
  const keyByProjectId = new Map(
    (library.items ?? []).flatMap((item) =>
      item.kind === 'ready' ? [[item.projectId, item.key] as const] : [],
    ),
  );
  const needle = query.filter.trim().toLocaleLowerCase();
  const rows = inCategory
    .filter(
      (entry) =>
        (needle.length === 0 || matches(entry, needle)) &&
        (query.routeKey === null || entry.routeKey === query.routeKey) &&
        (query.tag === null || entry.tags.includes(query.tag)),
    )
    .map((entry): CatalogRow => {
      const support = catalogPlanSupport(entry);
      const copy = Object.hasOwn(library.copies, entry.id)
        ? keyByProjectId.get(library.copies[entry.id]!)
        : undefined;
      return {
        entry,
        routeKey: entry.routeKey,
        route: ownEntry(catalog.routes.byKey, entry.routeKey)?.label ?? entry.routeKey,
        biomes: {
          count: `${entry.biomeCount} ${entry.biomeCount === 1 ? 'biome' : 'biomes'}`,
          trail: plannedBiomeTrail(catalog, entry.routeKey, entry.biomeCount),
        },
        action:
          copy !== undefined
            ? { kind: 'inLibrary', key: copy }
            : support === 'supported'
              ? { kind: 'add' }
              : { kind: 'unsupported', support },
      };
    });
  rows.sort((left, right) =>
    query.sort === 'route'
      ? left.route.localeCompare(right.route) || left.entry.title.localeCompare(right.entry.title)
      : left.entry.title.localeCompare(right.entry.title),
  );
  return Object.freeze({ tabs, tags, rows, total: inCategory.length });
}
