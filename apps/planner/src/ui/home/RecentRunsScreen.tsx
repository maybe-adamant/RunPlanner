import { Fragment, useEffect, useState } from 'react';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  projectRecentRunsView,
  projectRunGuesses,
  recentRunCopyKey,
  type RecentRunRow,
  type RunGuessGroup,
} from '@planner/projections/recentRunsHome';
import { recordingProblemReported } from '@planner/state/recordingSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type { RecordingController } from '@planner/workspace/run-recording/recordingController';
import type { RecentRunEntry } from '@planner/workspace/run-recording/recentRuns';
import { IconActionButton } from '@planner/ui/controls/IconActionButton';
import { hintProps } from '@planner/ui/controls/hint';
import { HomeContext } from './HomeContext';
import { HomeToast } from './HomeToast';
import { useLibraryCopies } from './useLibraryCopies';
import type { LibrarySlotIndex } from './useLibrarySlotLinks';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The save folder recording uses, read again whenever the watch changes. */
function useSaveFolder(controller: RecordingController, revision: unknown) {
  const [folder, setFolder] = useState<{
    readonly folder: string | null;
    readonly chosen: boolean;
  } | null>(null);
  useEffect(() => {
    let live = true;
    controller.saveFolder().then(
      (read) => {
        if (live) setFolder(read);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [controller, revision]);
  return folder;
}

function GuessList({ groups }: { readonly groups: readonly RunGuessGroup[] }) {
  if (groups.length === 0)
    return <p className="home-muted recent-run-guesses-empty">No guesses.</p>;
  const oneLine = groups.filter((group) => group.lines.length === 0);
  const listed = groups.filter((group) => group.lines.length > 0);
  return (
    <div className="recent-run-guesses">
      {oneLine.length === 0 ? null : (
        <ul aria-label="Assumed" className="recent-run-guess-group recent-run-assumed">
          {oneLine.map((group) => (
            <li key={group.area}>{group.assumed}</li>
          ))}
        </ul>
      )}
      {listed.map((group) => (
        <section aria-label={group.label} className="recent-run-guess-group" key={group.area}>
          <h4>
            {group.label}
            <span className="catalog-tab-count">{group.lines.length}</span>
          </h4>
          <ul>
            {group.assumed === null ? null : (
              <li className="recent-run-guess-assumed">{group.assumed}</li>
            )}
            {group.lines.map((line) => (
              <li key={line.key}>
                {line.order === null ? null : (
                  <span className="recent-run-guess-order">{line.order}</span>
                )}
                {line.room === null ? null : (
                  <span className="recent-run-guess-room">{line.room}</span>
                )}
                <span className="recent-run-guess-text">{line.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RowAction({
  busy,
  onAdd,
  onOpen,
  row,
}: {
  readonly busy: boolean;
  readonly onAdd: () => void;
  readonly onOpen: (key: string) => void;
  readonly row: RecentRunRow;
}) {
  const { action } = row;
  switch (action.kind) {
    case 'inLibrary':
      return (
        <span className="catalog-in-library">
          In library
          <button
            aria-label={`Open ${row.identity}`}
            className="secondary-action action-compact"
            disabled={busy}
            onClick={() => onOpen(action.key)}
            type="button"
          >
            Open
          </button>
        </span>
      );
    case 'add':
      return (
        <button
          aria-label={`Add ${row.identity} to library`}
          className="secondary-action action-compact"
          disabled={busy}
          onClick={onAdd}
          type="button"
        >
          Add to library
        </button>
      );
    case 'none':
      return null;
  }
}

/** Runs recorded from the game, each added to the library as a plan. */
export function RecentRunsScreen({
  catalog,
  controller,
  index,
  operations,
}: {
  readonly catalog: Catalog;
  readonly controller: RecordingController;
  readonly index: LibrarySlotIndex;
  readonly operations: ProjectOperations;
}) {
  const dispatch = useAppDispatch();
  const { status, recentRuns, unreadableRuns, problem } = useAppSelector(
    (state) => state.recordingSession,
  );
  const { copies, refresh: refreshCopies } = useLibraryCopies(operations);
  const folder = useSaveFolder(controller, status);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionProblem, setActionProblem] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{
    readonly entry: RecentRunEntry;
    readonly text: string;
    readonly id: number;
  } | null>(null);
  const [expanded, setExpanded] = useState<{
    readonly id: string;
    readonly groups: readonly RunGuessGroup[] | null;
  } | null>(null);

  const view = projectRecentRunsView(
    catalog,
    recentRuns ?? [],
    { items: index.items, copies },
    index.readAt,
  );
  const recording = status.kind !== 'off' && status.kind !== 'error';
  const shownProblem = actionProblem ?? (status.kind === 'error' ? status.message : problem);

  const act = (id: string, task: () => Promise<void>) => {
    setBusy(id);
    setActionProblem(null);
    void task()
      .catch((error: unknown) => setActionProblem(message(error)))
      .finally(() => setBusy(null));
  };
  const add = (row: RecentRunRow) =>
    act(row.id, async () => {
      const entry = await controller.readRun(row.id);
      if (entry.project === undefined) return;
      const result = await operations.addLibraryCopy(
        { key: recentRunCopyKey(row.id), title: row.planName },
        entry.project,
      );
      if (result.status === 'failure') setActionProblem(result.message);
      refreshCopies();
      index.refresh();
    });
  const open = (key: string) => {
    setActionProblem(null);
    void operations.openPlan(key).then((result) => {
      if (result.status === 'failure') setActionProblem(result.message);
    });
  };
  const toggleGuesses = (row: RecentRunRow) => {
    if (expanded?.id === row.id) {
      setExpanded(null);
      return;
    }
    setExpanded({ id: row.id, groups: null });
    controller.readRun(row.id).then(
      (entry) =>
        setExpanded((current) =>
          current?.id === row.id
            ? { id: row.id, groups: projectRunGuesses(catalog, entry) }
            : current,
        ),
      (error: unknown) => {
        setExpanded(null);
        setActionProblem(message(error));
      },
    );
  };

  return (
    <section aria-label="Recent runs" className="home-page">
      {shownProblem === null ? null : (
        <p className="home-problem recent-runs-problem" role="alert">
          <span>{shownProblem}</span>
          {actionProblem === null && status.kind !== 'error' ? (
            <button
              className="text-action"
              onClick={() => dispatch(recordingProblemReported(null))}
              type="button"
            >
              Dismiss
            </button>
          ) : null}
        </p>
      )}

      <div className="home-panel library-panel">
        <div className="catalog-heading">
          <h3 className="home-panel-title">
            Recent runs
            <HomeContext parts={view.context} />
          </h3>
          <div className="recent-runs-folder">
            <span className="home-muted">Save folder</span>
            <span className="recent-runs-folder-path">
              {folder === null ? '…' : (folder.folder ?? 'Not found')}
            </span>
            <button
              aria-label="Change save folder"
              className="quiet-action action-compact"
              onClick={() => void controller.chooseFolder()}
              type="button"
            >
              Change…
            </button>
            {folder?.chosen === true ? (
              <button
                className="text-action"
                onClick={() => void controller.setFolder(null)}
                type="button"
              >
                Use default
              </button>
            ) : null}
          </div>
        </div>
        <table className="library-table recent-runs-table">
          <thead>
            <tr>
              <th scope="col">Played</th>
              <th scope="col">Run</th>
              <th scope="col">Outcome</th>
              <th scope="col">Guesses</th>
              <th className="recent-runs-actions-column" scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {recentRuns === null ? null : view.rows.length === 0 ? (
              <tr>
                <td className="library-empty" colSpan={5}>
                  {recording
                    ? 'Play a run to see it here.'
                    : 'Turn on Record runs, then play a run.'}
                </td>
              </tr>
            ) : null}
            {view.rows.map((row) => (
              <Fragment key={row.id}>
                <tr data-expanded={expanded?.id === row.id || undefined}>
                  <td>
                    <time dateTime={row.played.iso}>{row.played.text}</time>
                    <div className="home-muted recent-run-count">{row.identity}</div>
                  </td>
                  <td>
                    <div className="library-plan-summary recent-run-route">
                      <span
                        aria-hidden="true"
                        className="route-dot"
                        data-tone={row.surface ? 'surface' : 'underworld'}
                      />
                      {row.route}
                    </div>
                    {row.loadout === null ? null : (
                      <div className="catalog-description">{row.loadout}</div>
                    )}
                  </td>
                  <td>
                    <div>
                      <span
                        className="recent-run-outcome"
                        data-tone={row.outcome.tone ?? undefined}
                      >
                        {row.outcome.text}
                      </span>
                      <span className="home-muted"> · {row.rooms}</span>
                    </div>
                    {row.outcome.room === null ? null : (
                      <div className="catalog-description">{row.outcome.room}</div>
                    )}
                  </td>
                  <td>
                    <div className="recent-run-guess-cell">
                      {row.guesses === 0 ? (
                        <span className="home-muted">—</span>
                      ) : (
                        <button
                          aria-expanded={expanded?.id === row.id}
                          className="text-action"
                          onClick={() => toggleGuesses(row)}
                          type="button"
                        >
                          {row.guesses} {row.guesses === 1 ? 'guess' : 'guesses'}
                        </button>
                      )}
                      {row.marker === null ? null : (
                        <span
                          className="recent-run-marker"
                          data-kind={row.marker.kind}
                          {...hintProps(row.marker.hint ?? undefined)}
                        >
                          {row.marker.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="library-row-actions">
                      <RowAction
                        busy={busy !== null}
                        onAdd={() => add(row)}
                        onOpen={open}
                        row={row}
                      />
                      <IconActionButton
                        disabled={busy !== null}
                        hint="Delete"
                        icon="trash"
                        label={`Delete ${row.identity}`}
                        onClick={() =>
                          act(row.id, async () => {
                            const entry = await controller.deleteRun(row.id);
                            if (expanded?.id === row.id) setExpanded(null);
                            setDeleted({ entry, text: `Deleted ${row.identity}`, id: Date.now() });
                          })
                        }
                        tone="danger"
                      />
                    </div>
                  </td>
                </tr>
                {expanded?.id === row.id ? (
                  <tr className="recent-run-guesses-row">
                    <td colSpan={5}>
                      {expanded.groups === null ? (
                        <p className="home-muted recent-run-guesses-empty">Loading…</p>
                      ) : (
                        <GuessList groups={expanded.groups} />
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        {unreadableRuns.length === 0 ? null : (
          <p className="library-footer">
            {unreadableRuns.length === 1
              ? '1 run can’t be read.'
              : `${unreadableRuns.length} runs can’t be read.`}
          </p>
        )}
      </div>
      {deleted === null ? null : (
        <HomeToast
          action={{
            label: 'Undo',
            run: () => {
              const { entry } = deleted;
              setDeleted(null);
              act(entry.id, () => controller.restoreRun(entry));
            },
          }}
          key={deleted.id}
          onDismiss={() => setDeleted(null)}
          text={deleted.text}
        />
      )}
    </section>
  );
}
