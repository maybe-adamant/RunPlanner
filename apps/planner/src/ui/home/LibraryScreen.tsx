import { useState } from 'react';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import {
  ALL_PLANS,
  describeImportSummary,
  projectLibraryChips,
  projectLibraryView,
  sameChip,
  type LibraryChip,
  type LibraryRow,
  type LibrarySort,
  type PlanSlotLink,
} from '@planner/projections/libraryHome';
import { libraryFolderChanged, viewChanged } from '@planner/state/librarySessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import {
  parentFolder,
  type DeletedFolder,
  type DeletedPlan,
} from '@planner/workspace/projectLibrary';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import { NewPlanDialog } from '../project/NewPlanDialog';
import { HomeToast } from './HomeToast';
import { FolderNameDialog, MoveToDialog } from './LibraryDialogs';
import type { LibrarySlotIndex } from './useLibrarySlotLinks';

function SlotLinks({ slots }: { readonly slots: readonly PlanSlotLink[] }) {
  if (slots.length === 0) return <span className="home-muted">—</span>;
  return (
    <ul className="library-in-game">
      {slots.map((link) => (
        <li key={link.slot}>
          Slot {link.slot}
          {link.marker === null ? null : (
            <>
              {' · '}
              <span className="slot-marker" data-marker={link.marker}>
                {link.marker}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Offers once to import the file the planner kept open before plans lived in the library. */
function PreviousFileOffer({
  fileName,
  operations,
}: {
  readonly fileName: string;
  readonly operations: ProjectOperations;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const settle = async (task: () => Promise<string | null>) => {
    setPending(true);
    setMessage(null);
    try {
      setMessage(await task());
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-labelledby="previous-file-title" className="home-panel library-offer">
      <div>
        <h3 id="previous-file-title">Import {fileName}?</h3>
        <p>This was the file you had open. Plans now live in your library and save as you edit.</p>
        {message === null ? null : <p role="alert">{message}</p>}
      </div>
      <div className="library-offer-actions">
        <button
          className="primary-action action-compact"
          disabled={pending}
          onClick={() =>
            void settle(async () => {
              const result = await operations.acceptPreviousFile();
              return result.status === 'failure' ? result.message : null;
            })
          }
          type="button"
        >
          Import
        </button>
        <button
          className="quiet-action action-compact"
          disabled={pending}
          onClick={() =>
            void settle(async () => {
              await operations.declinePreviousFile();
              return null;
            })
          }
          type="button"
        >
          Not now
        </button>
      </div>
    </section>
  );
}

function routeTone(routeKey: string | null): string {
  return routeKey === 'Surface' || routeKey === 'Dream' ? 'surface' : 'underworld';
}

type Deleted =
  | { readonly kind: 'plan'; readonly name: string; readonly plan: DeletedPlan }
  | { readonly kind: 'folder'; readonly name: string; readonly folder: DeletedFolder };

/** The floating notice of a deletion, which can be undone, or of an import. */
interface Notice {
  readonly id: number;
  readonly text: string;
  readonly lasting: boolean;
  readonly undo: Deleted | null;
}

type FolderDialog =
  | { readonly kind: 'new' }
  | { readonly kind: 'rename'; readonly path: string; readonly name: string };

function FolderIcon() {
  return (
    <svg aria-hidden="true" className="library-folder-icon" viewBox="0 0 16 16">
      <path d="M1.5 4.5v8h13v-7h-6.5l-1.5-1.5h-5z" />
    </svg>
  );
}

export function LibraryScreen({
  catalog,
  catalogShown,
  index,
  operations,
  routes,
}: {
  readonly catalog: Catalog;
  /** Whether the Catalog tab exists, so the page links to it. */
  readonly catalogShown: boolean;
  readonly index: LibrarySlotIndex;
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
}) {
  const dispatch = useAppDispatch();
  const previousFile = useAppSelector((state) => state.librarySession.previousFileOffer);
  const shownFolder = useAppSelector((state) => state.librarySession.libraryFolder);
  const [filter, setFilter] = useState('');
  const [chip, setChip] = useState<LibraryChip>(ALL_PLANS);
  // Each folder keeps the sort chosen while it was shown.
  const [sorts, setSorts] = useState<ReadonlyMap<string, LibrarySort>>(new Map());
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<FolderDialog | null>(null);
  const [moving, setMoving] = useState<LibraryRow | null>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = (next: Omit<Notice, 'id'>) =>
    setNotice((previous) => ({ id: (previous?.id ?? 0) + 1, ...next }));
  const deleted = (target: Deleted) =>
    notify({
      text: `Deleted ${target.kind === 'folder' ? 'folder ' : ''}“${target.name}”`,
      lasting: false,
      undo: target,
    });

  // A folder renamed or deleted elsewhere shows its nearest remaining parent.
  let folder = shownFolder;
  while (folder !== '' && index.items !== null && !index.folders.includes(folder)) {
    folder = parentFolder(folder);
  }
  const sort = sorts.get(folder) ?? 'edited';
  const openFolder = (path: string) => {
    setFilter('');
    setChip(ALL_PLANS);
    dispatch(libraryFolderChanged(path));
  };

  const run = async (
    task: () => Promise<{ readonly status: string; readonly message: string }>,
  ): Promise<string | null> => {
    setPending(true);
    setProblem(null);
    try {
      const result = await task();
      return result.status === 'failure' ? result.message : null;
    } finally {
      setPending(false);
      index.refresh();
    }
  };
  const report = (task: () => Promise<{ readonly status: string; readonly message: string }>) =>
    void run(task).then(setProblem);
  const removePlan = (row: LibraryRow) =>
    report(async () => {
      const result = await operations.deletePlan(row.key);
      if (result.deleted !== null) deleted({ kind: 'plan', name: row.name, plan: result.deleted });
      return result;
    });
  const removeFolder = (path: string, name: string) =>
    report(async () => {
      const result = await operations.deleteFolder(path);
      if (result.deleted !== null) deleted({ kind: 'folder', name, folder: result.deleted });
      return result;
    });
  const importPlans = () =>
    report(async () => {
      const result = await operations.importPlans(folder);
      const summary = describeImportSummary(result.imported, result.failed);
      if (summary !== null) notify({ ...summary, undo: null });
      return result;
    });
  const undoDelete = (target: Deleted) => {
    setNotice(null);
    report(() =>
      target.kind === 'plan'
        ? operations.undoDelete(target.plan)
        : operations.undoDeleteFolder(target.folder),
    );
  };

  const items = index.items;
  const view =
    items === null
      ? null
      : projectLibraryView(catalog, { items, folders: index.folders }, index.links, index.readAt, {
          folder,
          filter,
          chip,
          sort,
        });
  const count = items?.length ?? 0;
  const empty = view !== null && view.rows.length === 0 && view.folders.length === 0;

  return (
    <section aria-labelledby="library-title" className="home-page">
      <div className="home-page-heading">
        <h2 id="library-title">Your plans</h2>
        <div className="home-page-actions">
          {catalogShown && (
            <button
              className="quiet-action"
              onClick={() => dispatch(viewChanged({ kind: 'home', tab: 'catalog' }))}
              type="button"
            >
              Browse catalog
            </button>
          )}
          {operations.libraryRevealable && (
            <button
              className="quiet-action"
              disabled={pending}
              onClick={() => report(() => operations.revealLibrary())}
              type="button"
            >
              Open folder
            </button>
          )}
          <button
            className="quiet-action"
            disabled={pending}
            onClick={() => setFolderDialog({ kind: 'new' })}
            type="button"
          >
            New folder
          </button>
          <button
            className="secondary-action"
            disabled={pending}
            onClick={importPlans}
            type="button"
          >
            Import…
          </button>
          <button
            className="primary-action"
            disabled={pending}
            onClick={() => setNewPlanOpen(true)}
            type="button"
          >
            New plan
          </button>
        </div>
      </div>

      {previousFile === null ? null : (
        <PreviousFileOffer fileName={previousFile.fileName} operations={operations} />
      )}
      {problem === null && index.error === null ? null : (
        <p className="home-problem" role="alert">
          {problem ?? index.error}
        </p>
      )}

      <div className="home-panel library-panel">
        <div className="library-toolbar">
          <nav aria-label="Folder" className="library-breadcrumb">
            {view?.searching === true ? (
              <span aria-current="page" className="library-breadcrumb-current">
                Whole library
              </span>
            ) : (
              (view?.breadcrumb ?? [{ path: '', name: 'Library' }]).map((crumb, position, all) => (
                <span key={crumb.path}>
                  {position === 0 ? null : (
                    <span aria-hidden="true" className="library-breadcrumb-separator">
                      ›
                    </span>
                  )}
                  {position === all.length - 1 ? (
                    <span aria-current="page" className="library-breadcrumb-current">
                      {crumb.name}
                    </span>
                  ) : (
                    <button
                      className="text-action"
                      onClick={() => openFolder(crumb.path)}
                      type="button"
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              ))
            )}
          </nav>
          <label className="library-sort">
            Sort
            <select
              onChange={(event) =>
                setSorts((current) =>
                  new Map(current).set(folder, event.target.value as LibrarySort),
                )
              }
              value={sort}
            >
              <option value="edited">Last edited</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        <div className="library-filters">
          <input
            aria-label="Search plans by name"
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search all plans"
            type="search"
            value={filter}
          />
          <div aria-label="Show" className="library-chips" role="group">
            {projectLibraryChips(routes).map((entry) => (
              <button
                aria-pressed={sameChip(chip, entry.chip)}
                className="library-chip"
                key={entry.id}
                onClick={() => setChip(entry.chip)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <table className="library-table">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col">Biomes planned</th>
              <th scope="col">In game</th>
              <th scope="col">Edited</th>
              <th className="library-actions-column" scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td className="library-empty" colSpan={5}>
                  {view?.searching === true
                    ? 'No plan matches.'
                    : count === 0
                      ? 'No plans yet. Start one with New plan, or import a plan file.'
                      : 'This folder is empty.'}
                </td>
              </tr>
            ) : null}
            {view?.folders.map((row) => (
              <tr data-kind="folder" key={`folder:${row.path}`}>
                <td colSpan={4}>
                  <button
                    className="library-folder-name"
                    onClick={() => openFolder(row.path)}
                    type="button"
                  >
                    <FolderIcon />
                    {row.name}
                  </button>
                  <span className="home-muted library-folder-count">
                    {' '}
                    · {row.planCount} {row.planCount === 1 ? 'plan' : 'plans'}
                  </span>
                </td>
                <td>
                  <div className="library-row-actions">
                    <button
                      aria-label={`Rename folder ${row.name}`}
                      className="text-action"
                      disabled={pending}
                      onClick={() =>
                        setFolderDialog({ kind: 'rename', path: row.path, name: row.name })
                      }
                      type="button"
                    >
                      Rename
                    </button>
                    <button
                      aria-label={`Delete folder ${row.name}`}
                      className="text-action"
                      data-tone="danger"
                      disabled={pending}
                      onClick={() => removeFolder(row.path, row.name)}
                      type="button"
                    >
                      Delete
                    </button>
                    <button
                      aria-label={`Open folder ${row.name}`}
                      className="secondary-action action-compact"
                      disabled={pending}
                      onClick={() => openFolder(row.path)}
                      type="button"
                    >
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {view?.rows.map((row) => (
              <tr data-kind={row.kind} key={row.key}>
                <td>
                  <div className="library-plan-name">{row.name}</div>
                  {row.kind === 'ready' ? (
                    <div className="library-plan-summary">
                      <span
                        aria-hidden="true"
                        className="route-dot"
                        data-tone={routeTone(row.routeKey)}
                      />
                      {row.summary}
                    </div>
                  ) : (
                    <div className="library-plan-problem">{row.reason}</div>
                  )}
                  {row.location === null ? null : (
                    <button
                      className="text-action library-plan-location"
                      onClick={() => openFolder(row.folder)}
                      type="button"
                    >
                      in {row.location}
                    </button>
                  )}
                </td>
                <td>
                  {row.kind !== 'ready' || row.biomes === null ? (
                    <span className="home-muted">—</span>
                  ) : (
                    <>
                      <span className="library-biome-count">{row.biomes.count}</span>
                      {row.biomes.trail === null ? null : (
                        <span className="home-muted"> · {row.biomes.trail}</span>
                      )}
                    </>
                  )}
                </td>
                <td>
                  {row.kind === 'ready' ? (
                    <SlotLinks slots={row.slots} />
                  ) : (
                    <span className="home-muted">—</span>
                  )}
                </td>
                <td className="home-muted">
                  <time dateTime={row.edited.iso}>{row.edited.text}</time>
                </td>
                <td>
                  <div className="library-row-actions">
                    <button
                      aria-label={`Duplicate ${row.name}`}
                      className="text-action"
                      disabled={pending || row.kind !== 'ready'}
                      onClick={() => report(() => operations.duplicate(row.key))}
                      type="button"
                    >
                      Duplicate
                    </button>
                    <button
                      aria-label={`Move ${row.name}`}
                      className="text-action"
                      disabled={pending}
                      onClick={() => setMoving(row)}
                      type="button"
                    >
                      Move to…
                    </button>
                    <button
                      aria-label={`Delete ${row.name}`}
                      className="text-action"
                      data-tone="danger"
                      disabled={pending}
                      onClick={() => removePlan(row)}
                      type="button"
                    >
                      Delete
                    </button>
                    <button
                      aria-label={`Open ${row.name}`}
                      className="secondary-action action-compact"
                      disabled={pending || row.kind !== 'ready'}
                      onClick={() => report(() => operations.openPlan(row.key))}
                      type="button"
                    >
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items === null ? null : (
          <p className="library-footer">
            {count} {count === 1 ? 'plan' : 'plans'} in the library
          </p>
        )}
      </div>

      {notice === null ? null : (
        <HomeToast
          {...(notice.undo === null
            ? {}
            : {
                action: {
                  label: 'Undo',
                  run: () => {
                    if (notice.undo !== null) undoDelete(notice.undo);
                  },
                },
              })}
          key={notice.id}
          lasting={notice.lasting}
          onDismiss={() => setNotice(null)}
          text={notice.text}
        />
      )}
      {newPlanOpen && (
        <NewPlanDialog
          catalog={catalog}
          folder={folder}
          onClose={() => setNewPlanOpen(false)}
          operations={operations}
          routes={routes}
        />
      )}
      {folderDialog === null ? null : (
        <FolderNameDialog
          initial={folderDialog.kind === 'rename' ? folderDialog.name : ''}
          onApply={async (name) => {
            const outcome = await run(() =>
              folderDialog.kind === 'new'
                ? operations.createFolder(folder, name)
                : operations.renameFolder(folderDialog.path, name),
            );
            if (outcome === null) setFolderDialog(null);
            return outcome;
          }}
          onCancel={() => setFolderDialog(null)}
          title={folderDialog.kind === 'new' ? 'New folder' : 'Rename folder'}
        />
      )}
      {moving === null ? null : (
        <MoveToDialog
          current={moving.folder}
          folders={index.folders}
          name={moving.name}
          onCancel={() => setMoving(null)}
          onMove={async (target) => {
            const outcome = await run(() => operations.movePlan(moving.key, target));
            if (outcome === null) setMoving(null);
            return outcome;
          }}
        />
      )}
    </section>
  );
}
