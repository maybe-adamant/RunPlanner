import { useState } from 'react';
import { createPortal } from 'react-dom';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { GameStatusController } from '@planner/persistence/gameModuleHost';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import {
  ALL_PLANS,
  describeDeletedPlan,
  describeImportSummary,
  projectLibraryChips,
  projectLibraryView,
  sameChip,
  type LibraryChip,
  type LibraryRow,
  type LibrarySort,
  type PlanSlotLink,
} from '@planner/projections/libraryHome';
import {
  libraryFolderChanged,
  navigationNoticeShown,
  viewChanged,
} from '@planner/state/librarySessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import {
  parentFolder,
  type DeletedFolder,
  type DeletedPlan,
} from '@planner/workspace/projectLibrary';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import { NewPlanDialog } from '../project/NewPlanDialog';
import { IconActionButton } from '../controls/IconActionButton';
import { HomeContext } from './HomeContext';
import { HomeToast } from './HomeToast';
import { FolderNameDialog, MoveToDialog } from './LibraryDialogs';
import { LibrarySendCell } from './LibrarySendCell';
import type { LibrarySlotIndex } from './useLibrarySlotLinks';

/**
 * Offers once to import what the planner kept before plans lived in the library: the file it
 * had open, or the unsaved project it autosaved.
 */
function StartupImportOffer({
  id,
  title,
  description,
  accept,
  decline,
}: {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly accept: () => Promise<{ readonly status: string; readonly message: string }>;
  readonly decline: () => Promise<void>;
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
    <section aria-labelledby={id} className="home-panel library-offer">
      <div>
        <h3 id={id}>{title}</h3>
        {description === undefined ? null : <p>{description}</p>}
        {message === null ? null : <p role="alert">{message}</p>}
      </div>
      <div className="library-offer-actions">
        <button
          className="primary-action action-compact"
          disabled={pending}
          onClick={() =>
            void settle(async () => {
              const result = await accept();
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
              await decline();
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
  actionsSlot,
  catalog,
  catalogShown,
  gameStatus,
  index,
  operations,
  routes,
}: {
  /** Where the Library's New folder, Import… and New plan show, on Home's tab row. */
  readonly actionsSlot: HTMLElement | null;
  readonly catalog: Catalog;
  /** Whether the Catalog tab exists, so the page links to it. */
  readonly catalogShown: boolean;
  /** Absent outside the desktop application, where plans cannot be sent. */
  readonly gameStatus: GameStatusController | undefined;
  readonly index: LibrarySlotIndex;
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
}) {
  const dispatch = useAppDispatch();
  const previousFile = useAppSelector((state) => state.librarySession.previousFileOffer);
  const recoveredPlan = useAppSelector((state) => state.librarySession.recoveredPlanOffer);
  const shownFolder = useAppSelector((state) => state.librarySession.libraryFolder);
  const navigationNotice = useAppSelector((state) => state.librarySession.navigationNotice);
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
  const deleted = (target: Deleted, slots: readonly PlanSlotLink[] = []) =>
    notify({
      text:
        target.kind === 'folder'
          ? `Deleted folder “${target.name}”`
          : describeDeletedPlan(target.name, slots),
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
      if (result.deleted !== null) {
        deleted(
          { kind: 'plan', name: row.name, plan: result.deleted },
          row.kind === 'ready' ? row.slots : [],
        );
      }
      return result;
    });
  const removeFolder = (path: string, name: string) =>
    report(async () => {
      const result = await operations.deleteFolder(path);
      if (result.deleted === null) return result;
      deleted({ kind: 'folder', name, folder: result.deleted });
      // Files that could not be kept for undo are named where problems show.
      return result.deleted.unkept.length === 0 ? result : { ...result, status: 'failure' };
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
    <section aria-label="Library" className="home-page">
      {actionsSlot === null
        ? null
        : createPortal(
            <>
              <button
                className="quiet-action action-compact"
                disabled={pending}
                onClick={() => setFolderDialog({ kind: 'new' })}
                type="button"
              >
                New folder
              </button>
              <button
                className="secondary-action action-compact"
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
            </>,
            actionsSlot,
          )}

      {previousFile === null ? null : (
        <StartupImportOffer
          accept={() => operations.acceptPreviousFile()}
          decline={() => operations.declinePreviousFile()}
          description="The file you had open."
          id="previous-file-title"
          title={`Import ${previousFile.fileName}?`}
        />
      )}
      {recoveredPlan ? (
        <StartupImportOffer
          accept={() => operations.acceptRecoveredPlan()}
          decline={() => operations.declineRecoveredPlan()}
          id="recovered-plan-title"
          title="Recovered unsaved plan"
        />
      ) : null}
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
          <HomeContext parts={view?.context ?? []} />
          <span className="library-toolbar-spacer" />
          {catalogShown && (
            <button
              className="quiet-action action-compact"
              onClick={() => dispatch(viewChanged({ kind: 'home', tab: 'catalog' }))}
              type="button"
            >
              Browse catalog
            </button>
          )}
          {operations.libraryRevealable && (
            <button
              className="quiet-action action-compact"
              disabled={pending}
              onClick={() => report(() => operations.revealLibrary())}
              type="button"
            >
              Open folder
            </button>
          )}
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
            autoComplete="off"
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
              <th className="library-in-game-column" scope="col">
                In game
              </th>
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
                      ? 'No plans yet.'
                      : 'This folder is empty.'}
                </td>
              </tr>
            ) : null}
            {view?.folders.map((row) => (
              <tr data-kind="folder" key={`folder:${row.path}`}>
                <td colSpan={4}>
                  <div className="library-folder-line">
                    <button
                      className="library-folder-name"
                      onClick={() => openFolder(row.path)}
                      type="button"
                    >
                      <FolderIcon />
                      {row.name}
                    </button>
                    <span className="home-muted library-folder-count">
                      · {row.planCount} {row.planCount === 1 ? 'plan' : 'plans'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="library-row-actions">
                    <IconActionButton
                      disabled={pending}
                      hint="Rename"
                      icon="rename"
                      label={`Rename folder ${row.name}`}
                      onClick={() =>
                        setFolderDialog({ kind: 'rename', path: row.path, name: row.name })
                      }
                    />
                    <IconActionButton
                      disabled={pending}
                      hint="Delete"
                      icon="trash"
                      label={`Delete folder ${row.name}`}
                      onClick={() => removeFolder(row.path, row.name)}
                      tone="danger"
                    />
                    <IconActionButton
                      disabled={pending}
                      hint="Open"
                      icon="chevronRight"
                      label={`Open folder ${row.name}`}
                      onClick={() => openFolder(row.path)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {view?.rows.map((row) => (
              <tr data-kind={row.kind} key={row.key}>
                <td>
                  {row.kind === 'ready' ? (
                    <button
                      className="library-plan-name"
                      disabled={pending}
                      onClick={() => report(() => operations.openPlan(row.key))}
                      type="button"
                    >
                      {row.name}
                    </button>
                  ) : (
                    <div className="library-plan-name">{row.name}</div>
                  )}
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
                <td className="library-in-game-cell">
                  {gameStatus !== undefined && row.kind === 'ready' ? (
                    <LibrarySendCell
                      gameStatus={gameStatus}
                      index={index}
                      onOpen={() => report(() => operations.openPlan(row.key))}
                      operations={operations}
                      row={row}
                    />
                  ) : (
                    <span className="home-muted">—</span>
                  )}
                </td>
                <td className="home-muted">
                  <time dateTime={row.edited.iso}>{row.edited.text}</time>
                </td>
                <td>
                  <div className="library-row-actions">
                    <IconActionButton
                      disabled={pending || row.kind !== 'ready'}
                      hint="Duplicate"
                      icon="duplicate"
                      label={`Duplicate ${row.name}`}
                      onClick={() => report(() => operations.duplicate(row.key))}
                    />
                    <IconActionButton
                      disabled={pending}
                      hint="Move to…"
                      icon="move"
                      label={`Move ${row.name}`}
                      onClick={() => setMoving(row)}
                    />
                    <IconActionButton
                      disabled={pending}
                      hint="Delete"
                      icon="trash"
                      label={`Delete ${row.name}`}
                      onClick={() => removePlan(row)}
                      tone="danger"
                    />
                    <IconActionButton
                      disabled={pending || row.kind !== 'ready'}
                      hint="Open"
                      icon="openInEditor"
                      label={`Open ${row.name}`}
                      onClick={() => report(() => operations.openPlan(row.key))}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {navigationNotice === null ? null : (
        <HomeToast
          key={navigationNotice}
          onDismiss={() => dispatch(navigationNoticeShown(null))}
          text={navigationNotice}
        />
      )}
      {notice === null || navigationNotice !== null ? null : (
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
