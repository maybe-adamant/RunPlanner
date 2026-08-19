import { useState } from 'react';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '@planner/workspace/projectOperations';
import { selectProfileSession, selectProfileStatus, useAppSelector } from '@planner/state/store';

export function ProjectFileControls({ operations }: { readonly operations: ProjectOperations }) {
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
      setResult(await run());
    } finally {
      setPendingOperation(null);
    }
  };

  return (
    <section
      className="project-file-controls"
      aria-busy={pendingOperation !== null}
      aria-label="Project profile"
    >
      <div className="project-profile-feedback">
        <span
          aria-label={`Profile status: ${profileStatus}`}
          className="profile-status"
          data-profile-status={profileStatus.toLowerCase()}
          role="status"
        >
          {profileStatus}
        </span>
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
      <div className="project-file-actions">
        <button
          className="danger-action action-compact"
          onClick={() => setResult(operations.createNew())}
          type="button"
        >
          New
        </button>
        <button
          className="secondary-action action-compact"
          disabled={pendingOperation !== null}
          onClick={() => void runProfileOperation('saveProfile', () => operations.saveProfile())}
          type="button"
        >
          {pendingOperation === 'saveProfile' ? 'Saving…' : 'Save Profile'}
        </button>
        <button
          className="danger-action action-compact"
          disabled={pendingOperation !== null}
          onClick={() => void runProfileOperation('loadProfile', () => operations.loadProfile())}
          type="button"
        >
          {pendingOperation === 'loadProfile' ? 'Loading…' : 'Load Profile'}
        </button>
        {profileSession.recoveryStatus === 'blocked' && (
          <button
            className="danger-action action-compact"
            onClick={() => setResult(operations.discardAutosaveRecovery())}
            type="button"
          >
            Discard Autosave
          </button>
        )}
      </div>
    </section>
  );
}
