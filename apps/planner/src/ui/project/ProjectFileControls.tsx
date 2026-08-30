import { useState } from 'react';

import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '@planner/workspace/projectOperations';
import { selectProfileSession, selectProfileStatus, useAppSelector } from '@planner/state/store';
import { ActionIcon } from '../controls/ActionIcon';

export function ProjectFileControls({
  operations,
  routes,
  hasProject,
  entryOpen,
  onEntryOpenChange,
}: {
  readonly operations: ProjectOperations;
  readonly routes: readonly RouteEditorNavigation[];
  readonly hasProject: boolean;
  readonly entryOpen: boolean;
  readonly onEntryOpenChange: (open: boolean) => void;
}) {
  const profileSession = useAppSelector(selectProfileSession);
  const profileStatus = useAppSelector(selectProfileStatus);
  const [result, setResult] = useState<ProjectOperationResult | null>(null);
  const [pendingOperation, setPendingOperation] = useState<ProjectOperation | null>(null);
  const runProfileOperation = async (
    operation: ProjectOperation,
    run: () => Promise<ProjectOperationResult>,
  ) => {
    setPendingOperation(operation);
    try {
      const operationResult = await run();
      setResult(operationResult);
      if (operation === 'loadProfile' && operationResult.status === 'success') {
        onEntryOpenChange(false);
      }
    } finally {
      setPendingOperation(null);
    }
  };

  const feedback = (
    <div className="project-profile-feedback">
      {hasProject && (
        <span
          aria-label={`Profile status: ${profileStatus}`}
          className="profile-status"
          data-profile-status={profileStatus.toLowerCase()}
          role="status"
        >
          {profileStatus}
        </span>
      )}
      {profileSession.recoveryError !== null && (
        <p className="project-operation-result" data-status="failure" role="alert">
          {profileSession.recoveryError}
        </p>
      )}
      {profileSession.autosaveError !== null && (
        <p className="project-operation-result" data-status="failure" role="alert">
          {profileSession.autosaveError}
        </p>
      )}
      {result !== null && (
        <p
          className="project-operation-result"
          data-status={result.status}
          role={result.status === 'failure' ? 'alert' : 'status'}
        >
          {result.message}
        </p>
      )}
    </div>
  );

  if (entryOpen || !hasProject) {
    return (
      <section
        className="project-entry-panel"
        aria-busy={pendingOperation !== null}
        aria-labelledby="project-entry-title"
      >
        <header className="project-entry-heading">
          <p className="eyebrow">New project</p>
          <h2 id="project-entry-title">
            {hasProject ? 'Choose a new route' : 'Choose your route'}
          </h2>
          <p>
            Start with one complete run path. You can configure its rooms, rewards, and run state
            after choosing.
          </p>
        </header>
        {feedback}
        <fieldset className="route-chooser route-chooser-entry" aria-label="Choose route">
          <legend className="visually-hidden">Choose route</legend>
          <div className="route-choice-grid">
            {routes.map((route) => (
              <button
                aria-label={route.label}
                className="route-choice-card"
                disabled={pendingOperation !== null}
                key={route.routeKey}
                onClick={() => {
                  setResult(operations.createNew(route.routeKey));
                  onEntryOpenChange(false);
                }}
                type="button"
              >
                <span className="route-choice-name">{route.label}</span>
                <span className="route-choice-biomes">
                  {route.biomePanels.map((biome) => biome.label).join(' → ')}
                </span>
                <span className="route-choice-action">Create project</span>
              </button>
            ))}
          </div>
        </fieldset>
        <footer className="project-entry-footer">
          <span>Already have a run plan?</span>
          <button
            className="secondary-action"
            disabled={pendingOperation !== null}
            onClick={() => void runProfileOperation('loadProfile', () => operations.loadProfile())}
            type="button"
          >
            <ActionIcon name="load" />
            {pendingOperation === 'loadProfile' ? 'Loading…' : 'Load'}
          </button>
          {profileSession.recoveryStatus === 'blocked' && (
            <button
              className="danger-action"
              onClick={() => setResult(operations.discardAutosaveRecovery())}
              type="button"
            >
              <ActionIcon name="discard" />
              Discard
            </button>
          )}
          {hasProject && (
            <button className="quiet-action" onClick={() => onEntryOpenChange(false)} type="button">
              Cancel
            </button>
          )}
        </footer>
      </section>
    );
  }

  return (
    <section
      className="project-file-controls"
      aria-busy={pendingOperation !== null}
      aria-label="Project profile"
    >
      {feedback}
      <div className="project-file-actions">
        <button
          className="danger-action action-compact"
          onClick={() => onEntryOpenChange(true)}
          type="button"
        >
          <ActionIcon name="new" />
          New
        </button>
        <button
          className="secondary-action action-compact"
          disabled={pendingOperation !== null || !hasProject}
          onClick={() => void runProfileOperation('saveProfile', () => operations.saveProfile())}
          type="button"
        >
          <ActionIcon name="save" />
          {pendingOperation === 'saveProfile' ? 'Saving…' : 'Save'}
        </button>
        <button
          className="danger-action action-compact"
          disabled={pendingOperation !== null}
          onClick={() => void runProfileOperation('loadProfile', () => operations.loadProfile())}
          type="button"
        >
          <ActionIcon name="load" />
          {pendingOperation === 'loadProfile' ? 'Loading…' : 'Load'}
        </button>
        {profileSession.recoveryStatus === 'blocked' && (
          <button
            className="danger-action action-compact"
            onClick={() => setResult(operations.discardAutosaveRecovery())}
            type="button"
          >
            <ActionIcon name="discard" />
            Discard
          </button>
        )}
      </div>
    </section>
  );
}
