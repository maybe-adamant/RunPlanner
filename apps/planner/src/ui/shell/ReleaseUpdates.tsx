import { useSyncExternalStore } from 'react';

import type { ReleaseUpdateController } from '@planner/persistence/releaseUpdates';

function useReleaseUpdateState(controller: ReleaseUpdateController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

export function ReleaseUpdateNotice({
  controller,
}: {
  readonly controller: ReleaseUpdateController;
}) {
  const state = useReleaseUpdateState(controller);
  if (state.kind !== 'available') return null;

  return (
    <aside className="release-update-notice" role="status">
      <span>Run Planner {state.release.version} is available.</span>
      <div className="release-update-actions">
        <button
          className="secondary-action action-compact"
          onClick={() => void controller.download()}
          type="button"
        >
          Download
        </button>
        <button className="quiet-action action-compact" onClick={controller.later} type="button">
          Later
        </button>
        <button className="quiet-action action-compact" onClick={controller.skip} type="button">
          Skip this version
        </button>
      </div>
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
          : state.kind === 'available'
            ? `Run Planner ${state.release.version} is available.`
            : undefined;

  return (
    <section className="about-updates" aria-labelledby="about-updates-title">
      <h2 id="about-updates-title">Updates</h2>
      <div>
        <button
          className="secondary-action action-compact"
          disabled={state.kind === 'checking'}
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
