import { useSyncExternalStore } from 'react';

import type {
  ReleaseUpdateController,
  ReleaseUpdateState,
} from '@planner/persistence/releaseUpdates';
import type { UpdateInstallLabel } from '@planner/projections/releaseUpdate';

function useReleaseUpdateState(controller: ReleaseUpdateController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

function noticeContent(
  controller: ReleaseUpdateController,
  state: ReleaseUpdateState,
  installLabel: UpdateInstallLabel,
) {
  switch (state.kind) {
    case 'available':
      return (
        <>
          <span>
            Run Planner {state.version} is available.
            {state.message === undefined ? null : ` ${state.message}`}
          </span>
          <div className="release-update-actions">
            <button
              className="secondary-action action-compact"
              onClick={controller.requestInstall}
              type="button"
            >
              Update
            </button>
            <button
              className="quiet-action action-compact"
              onClick={controller.later}
              type="button"
            >
              Later
            </button>
            <button className="quiet-action action-compact" onClick={controller.skip} type="button">
              Skip this version
            </button>
          </div>
        </>
      );
    case 'confirming':
      return (
        <>
          <span>
            Install Run Planner {state.version}? Run Planner closes, installs the update and
            reopens.
          </span>
          <div className="release-update-actions">
            <button
              className="secondary-action action-compact"
              onClick={() => void controller.confirmInstall()}
              type="button"
            >
              {installLabel}
            </button>
            <button
              className="quiet-action action-compact"
              onClick={controller.cancelInstall}
              type="button"
            >
              Cancel
            </button>
          </div>
        </>
      );
    case 'saving':
      return <span>Saving before installing Run Planner {state.version}…</span>;
    case 'installing':
      return <span>Downloading and installing Run Planner {state.version}…</span>;
    case 'installFailed':
      return (
        <>
          <span>Run Planner {state.version} could not be installed.</span>
          <div className="release-update-actions">
            <button
              className="secondary-action action-compact"
              onClick={() => void controller.confirmInstall()}
              type="button"
            >
              Retry
            </button>
            <button
              className="quiet-action action-compact"
              onClick={controller.later}
              type="button"
            >
              Later
            </button>
          </div>
        </>
      );
    default:
      return null;
  }
}

export function ReleaseUpdateNotice({
  controller,
  installLabel,
}: {
  readonly controller: ReleaseUpdateController;
  readonly installLabel: UpdateInstallLabel;
}) {
  const state = useReleaseUpdateState(controller);
  const content = noticeContent(controller, state, installLabel);
  if (content === null) return null;

  return (
    <aside className="release-update-notice" role="status">
      {content}
    </aside>
  );
}

export function ReleaseUpdateCheck({
  controller,
}: {
  readonly controller: ReleaseUpdateController;
}) {
  const state = useReleaseUpdateState(controller);
  const message =
    state.kind === 'checking'
      ? 'Checking for updates…'
      : state.kind === 'current'
        ? 'You are up to date.'
        : state.kind === 'unavailable'
          ? 'Update check unavailable.'
          : state.kind === 'available' || state.kind === 'confirming'
            ? `Run Planner ${state.version} is available.`
            : state.kind === 'saving' || state.kind === 'installing'
              ? `Installing Run Planner ${state.version}…`
              : state.kind === 'installFailed'
                ? `Run Planner ${state.version} could not be installed.`
                : undefined;
  const busy =
    state.kind === 'checking' ||
    state.kind === 'confirming' ||
    state.kind === 'saving' ||
    state.kind === 'installing';

  return (
    <section className="about-updates" aria-labelledby="about-updates-title">
      <h2 id="about-updates-title">Updates</h2>
      <div>
        <button
          className="secondary-action action-compact"
          disabled={busy}
          onClick={() => void controller.checkManually()}
          type="button"
        >
          Check for updates
        </button>
        {message === undefined ? null : <p role="status">{message}</p>}
      </div>
    </section>
  );
}
