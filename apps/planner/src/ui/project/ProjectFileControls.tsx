import { useState, type FormEvent } from 'react';
import { createProjectAddress } from '@run-planner/engine/authored-project';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '../../workspace/projectOperations';
import { authoredProjectCommandDispatched } from '../../state/projectWorkspaceSlice';
import {
  selectPresentProject,
  selectProfileSession,
  selectProfileStatus,
  useAppDispatch,
  useAppSelector,
} from '../../state/store';
import { SemanticOwnerMarker } from '../feedback/EvaluationFeedback';

const projectAddress = createProjectAddress();

function ProjectNameControl({ projectName }: { readonly projectName: string }) {
  const dispatch = useAppDispatch();
  const [nameDraft, setNameDraft] = useState(projectName);
  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = nameDraft.trim();
    if (name.length === 0 || name === projectName) {
      return;
    }
    dispatch(authoredProjectCommandDispatched({ kind: 'RenameProject', name }));
  };

  return (
    <form className="project-name-control" onSubmit={submitName}>
      <label htmlFor="project-name">Project name</label>
      <SemanticOwnerMarker address={projectAddress} />
      <input
        id="project-name"
        onChange={(event) => setNameDraft(event.target.value)}
        type="text"
        value={nameDraft}
      />
      <button
        disabled={nameDraft.trim().length === 0 || nameDraft.trim() === projectName}
        type="submit"
      >
        Rename
      </button>
    </form>
  );
}

export function ProjectFileControls({ operations }: { readonly operations: ProjectOperations }) {
  const project = useAppSelector(selectPresentProject);
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
      <ProjectNameControl key={project.name} projectName={project.name} />
      <span
        aria-label={`Profile status: ${profileStatus}`}
        className="profile-status"
        data-profile-status={profileStatus.toLowerCase()}
        role="status"
      >
        {profileStatus}
      </span>
      <div className="project-file-actions">
        <button onClick={() => setResult(operations.createNew())} type="button">
          New
        </button>
        <button
          disabled={pendingOperation !== null}
          onClick={() => void runProfileOperation('saveProfile', () => operations.saveProfile())}
          type="button"
        >
          {pendingOperation === 'saveProfile' ? 'Saving…' : 'Save Profile'}
        </button>
        <button
          disabled={pendingOperation !== null}
          onClick={() => void runProfileOperation('loadProfile', () => operations.loadProfile())}
          type="button"
        >
          {pendingOperation === 'loadProfile' ? 'Loading…' : 'Load Profile'}
        </button>
        {profileSession.recoveryStatus === 'blocked' && (
          <button onClick={() => setResult(operations.discardAutosaveRecovery())} type="button">
            Discard Autosave
          </button>
        )}
      </div>
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
    </section>
  );
}
