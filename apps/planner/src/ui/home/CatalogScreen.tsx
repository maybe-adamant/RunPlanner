import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CatalogEntry } from '@planner/persistence/catalogFeedHost';
import {
  projectCatalogView,
  type CatalogRow,
  type CatalogSort,
} from '@planner/projections/catalogHome';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import {
  NEEDS_NEWER_PLANNER,
  UNSUPPORTED_OLD_PLAN,
  type CatalogFeedController,
} from '@planner/workspace/catalogFeed';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type { LibrarySlotIndex } from './useLibrarySlotLinks';

function routeTone(routeKey: string): string {
  return routeKey === 'Surface' || routeKey === 'Dream' ? 'surface' : 'underworld';
}

const NO_COPIES: Readonly<Record<string, string>> = Object.freeze({});

/** Which catalog entries were added to the library, read again after each addition. */
function useCatalogCopies(operations: ProjectOperations) {
  const [copies, setCopies] = useState(NO_COPIES);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    operations.catalogCopies().then(
      (read) => {
        if (live) setCopies(read);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [operations, revision]);
  return { copies, refresh: useCallback(() => setRevision((current) => current + 1), []) };
}

function RowAction({
  adding,
  disabled,
  onAdd,
  onOpen,
  row,
}: {
  readonly adding: boolean;
  readonly disabled: boolean;
  readonly onAdd: () => void;
  readonly onOpen: (key: string) => void;
  readonly row: CatalogRow;
}) {
  const { action, entry } = row;
  switch (action.kind) {
    case 'inLibrary':
      return (
        <span className="catalog-in-library">
          In library
          <button
            aria-label={`Open ${entry.title}`}
            className="secondary-action action-compact"
            disabled={disabled}
            onClick={() => onOpen(action.key)}
            type="button"
          >
            Open
          </button>
        </span>
      );
    case 'unsupported':
      return (
        <span className="home-muted catalog-unsupported">
          {action.support === 'tooNew' ? NEEDS_NEWER_PLANNER : UNSUPPORTED_OLD_PLAN}
        </span>
      );
    case 'add':
      return (
        <button
          aria-label={`Add ${entry.title} to library`}
          className="secondary-action action-compact"
          disabled={disabled}
          onClick={onAdd}
          type="button"
        >
          {adding ? 'Adding…' : 'Add to library'}
        </button>
      );
  }
}

/** Template plans from the signed catalog, each added to the library as the player's own copy. */
export function CatalogScreen({
  catalog,
  controller,
  index,
  operations,
  routes,
}: {
  readonly catalog: Catalog;
  readonly controller: CatalogFeedController;
  readonly index: LibrarySlotIndex;
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const { copies, refresh: refreshCopies } = useCatalogCopies(operations);
  const [category, setCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [routeKey, setRouteKey] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<CatalogSort>('name');
  const [adding, setAdding] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Showing the Catalog retries a failed read at once.
  useEffect(() => {
    void controller.sync('screen');
  }, [controller]);

  const add = (entry: CatalogEntry) => {
    setAdding(entry.id);
    setProblem(null);
    void controller
      .addToLibrary(entry)
      .then((result) => {
        if (result.status === 'failure') setProblem(result.message);
      })
      .finally(() => {
        setAdding(null);
        refreshCopies();
        index.refresh();
      });
  };
  const open = (key: string) => {
    setProblem(null);
    void operations.openPlan(key).then((result) => {
      if (result.status === 'failure') setProblem(result.message);
    });
  };

  const shown =
    state.kind === 'ready'
      ? projectCatalogView(
          catalog,
          state,
          { items: index.items, copies },
          { category, filter, routeKey, tag, sort },
        )
      : null;
  return (
    <section aria-labelledby="catalog-title" className="home-page">
      <div className="home-page-heading">
        <h2 id="catalog-title">Plans to start from</h2>
        <p className="home-muted catalog-note">Adding a plan puts your own copy in the Library.</p>
      </div>
      {problem === null ? null : (
        <p className="home-problem" role="alert">
          {problem}
        </p>
      )}

      <div className="home-panel library-panel">
        {state.kind === 'loading' ? (
          <p className="catalog-status">Loading the catalog…</p>
        ) : state.kind === 'disabled' ? (
          <p className="catalog-status">The catalog isn’t available in this build.</p>
        ) : state.kind === 'unavailable' ? (
          <div className="catalog-status">
            <p>
              The catalog couldn’t be loaded.
              {state.problem === null ? null : <span className="home-muted"> {state.problem}</span>}
            </p>
            <button
              className="secondary-action action-compact"
              onClick={() => void controller.sync('screen')}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : shown === null ? null : (
          <>
            <nav aria-label="Categories" className="catalog-tabs">
              {shown.tabs.map((tab) => (
                <button
                  aria-current={tab.category === category ? 'page' : undefined}
                  className="catalog-tab"
                  key={tab.category ?? ''}
                  onClick={() => {
                    // Tags differ by category, so a tag filter does not carry over.
                    setCategory(tab.category);
                    setTag(null);
                  }}
                  type="button"
                >
                  {tab.label}
                  <span className="catalog-tab-count">{tab.count}</span>
                </button>
              ))}
            </nav>
            <div className="library-filters catalog-filters">
              <input
                autoComplete="off"
                aria-label="Search the catalog"
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search title, god, aspect, author"
                type="search"
                value={filter}
              />
              <div aria-label="Route" className="library-chips" role="group">
                {[{ routeKey: null, label: 'Any route' }, ...routes].map((route) => (
                  <button
                    aria-pressed={routeKey === route.routeKey}
                    className="library-chip"
                    key={route.routeKey ?? ''}
                    onClick={() => setRouteKey(route.routeKey)}
                    type="button"
                  >
                    {route.label}
                  </button>
                ))}
              </div>
              <select
                aria-label="Tag"
                className="catalog-select"
                onChange={(event) => setTag(event.target.value === '' ? null : event.target.value)}
                value={tag ?? ''}
              >
                <option value="">Any tag</option>
                {shown.tags.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="catalog-filters-spacer" />
              <label className="library-sort">
                Sort
                <select
                  className="catalog-select"
                  onChange={(event) => setSort(event.target.value as CatalogSort)}
                  value={sort}
                >
                  <option value="name">Name</option>
                  <option value="route">Route</option>
                </select>
              </label>
            </div>
            <table className="library-table catalog-table">
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Route</th>
                  <th scope="col">Tags</th>
                  <th scope="col">Author</th>
                  <th className="library-actions-column" scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.rows.length === 0 ? (
                  <tr>
                    <td className="library-empty" colSpan={5}>
                      {shown.total === 0 ? 'No plans in this category yet.' : 'No plan matches.'}
                    </td>
                  </tr>
                ) : null}
                {shown.rows.map((row) => (
                  <tr key={row.entry.id}>
                    <td>
                      <div className="library-plan-name">{row.entry.title}</div>
                      <div className="catalog-description">{row.entry.description}</div>
                    </td>
                    <td>
                      <div className="library-plan-summary">
                        <span
                          aria-hidden="true"
                          className="route-dot"
                          data-tone={routeTone(row.routeKey)}
                        />
                        {row.route}
                      </div>
                      <div className="catalog-biomes">
                        <span className="library-biome-count">{row.biomes.count}</span>
                        {row.biomes.trail === null ? null : (
                          <span className="home-muted"> · {row.biomes.trail}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <ul aria-label="Tags" className="catalog-tags">
                        {row.entry.tags.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="home-muted catalog-author">{row.entry.author}</td>
                    <td>
                      <div className="library-row-actions">
                        <RowAction
                          adding={adding === row.entry.id}
                          disabled={adding !== null}
                          onAdd={() => add(row.entry)}
                          onOpen={open}
                          row={row}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="library-footer catalog-footer">
              <span>
                Showing {shown.rows.length} of {shown.total}
              </span>
              {state.kind === 'ready' && state.offline ? (
                <span>Offline · the catalog as last downloaded</span>
              ) : null}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
