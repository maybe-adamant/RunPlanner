import { useState, type FormEvent } from 'react';
import { createProjectAddress } from '@run-planner/core';

import type {
  ProjectOperation,
  ProjectOperationResult,
  ProjectOperations,
} from '../application/projectOperations';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { selectPresentProject, useAppDispatch, useAppSelector } from '../application/store';
import { SemanticOwnerMarker } from './EvaluationFeedback';

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
      </div>
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
