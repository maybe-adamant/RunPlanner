import { createAction, type Reducer } from '@reduxjs/toolkit';
import {
  publishProjectHistoryEdit,
  createProjectHistory,
  reidentifyProjectHistory,
  projectCommandAuthoringAddresses,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectCommand,
  type ProjectDocument,
  type ProjectHistory,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  assertProjectEvaluationAssembly,
  authoringReadinessAt,
  settleProjectEdit,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';

import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';

export type ProjectEvaluationAssembler = (project: ProjectDocument) => ProjectEvaluationAssembly;

export interface OpenProjectWorkspaceState {
  readonly kind: 'openProject';
  readonly assembly: ProjectEvaluationAssembly;
  readonly history: ProjectHistory;
}
export interface NoProjectWorkspaceState {
  readonly kind: 'noProject';
  /** Absent at runtime; these optional members make the union ergonomic for callers after narrowing. */
  readonly assembly?: never;
  readonly history?: never;
}
export type ProjectWorkspaceState = OpenProjectWorkspaceState | NoProjectWorkspaceState;

export interface PreparedProjectWorkspace {
  readonly assembly: ProjectEvaluationAssembly;
  readonly project: ProjectDocument;
}

export const authoredProjectCommandDispatched = createAction<ProjectCommand>(
  'projectWorkspace/commandDispatched',
);
export const authoredProjectUndoRequested = createAction('projectWorkspace/undoRequested');
export const authoredProjectRedoRequested = createAction('projectWorkspace/redoRequested');
/** A saved copy's new project identity; replaces every snapshot, adding no history step. */
export const projectIdentityMinted = createAction<string>('projectWorkspace/projectIdentityMinted');

export const authoredProjectReplaced = createAction<ProjectDocument>(
  'projectWorkspace/projectReplaced',
);

function publishWorkspace(
  history: ProjectHistory,
  assembleProjectEvaluation: ProjectEvaluationAssembler,
): ProjectWorkspaceState {
  const assembly = assembleProjectEvaluation(history.present);
  assertProjectEvaluationAssembly(assembly);
  if (assembly.project !== history.present) {
    throw new Error('project evaluation assembly does not match authored workspace identity');
  }
  return Object.freeze({
    kind: 'openProject' as const,
    assembly,
    history,
  });
}

function publishPreparedWorkspace(
  history: ProjectHistory,
  prepared: PreparedProjectWorkspace,
): ProjectWorkspaceState {
  assertProjectEvaluationAssembly(prepared.assembly);
  if (prepared.project !== history.present || prepared.assembly.project !== history.present) {
    throw new Error('prepared project workspace does not match authored workspace identity');
  }
  return Object.freeze({
    kind: 'openProject' as const,
    assembly: prepared.assembly,
    history,
  });
}

export function createProjectWorkspaceReducer(
  catalog: Catalog,
  initialWorkspace: PreparedProjectWorkspace | undefined,
  assembleProjectEvaluation: ProjectEvaluationAssembler,
): Reducer<ProjectWorkspaceState> {
  const initialState: ProjectWorkspaceState =
    initialWorkspace === undefined
      ? Object.freeze({ kind: 'noProject' })
      : publishPreparedWorkspace(createProjectHistory(initialWorkspace.project), initialWorkspace);

  return (state = initialState, action) => {
    if (authoredProjectCommandDispatched.match(action)) {
      if (state.kind === 'noProject') return state;
      if (
        projectCommandAuthoringAddresses(action.payload, state.history.present).some(
          (owner) => authoringReadinessAt(state.assembly, owner) === 'locked',
        )
      ) {
        return state;
      }
      const assembly = settleProjectEdit({
        catalog,
        before: state.assembly,
        command: action.payload,
        evaluate: assembleProjectEvaluation,
      });
      if (assembly.project === state.history.present) return state;
      const history = publishProjectHistoryEdit(state.history, assembly.project);
      return publishPreparedWorkspace(history, { project: assembly.project, assembly });
    }
    if (authoredProjectUndoRequested.match(action)) {
      if (state.kind === 'noProject') return state;
      const history = undoProjectHistory(state.history);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    if (authoredProjectRedoRequested.match(action)) {
      if (state.kind === 'noProject') return state;
      const history = redoProjectHistory(state.history);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    if (projectIdentityMinted.match(action)) {
      if (state.kind === 'noProject') return state;
      return publishWorkspace(
        reidentifyProjectHistory(state.history, action.payload),
        assembleProjectEvaluation,
      );
    }
    if (authoredProjectReplaced.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload), assembleProjectEvaluation);
    }
    if (newProjectCreated.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload), assembleProjectEvaluation);
    }
    if (profileLoadSucceeded.match(action)) {
      return publishPreparedWorkspace(createProjectHistory(action.payload.project), action.payload);
    }
    return state;
  };
}
