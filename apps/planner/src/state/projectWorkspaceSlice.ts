import { createAction, type Reducer } from '@reduxjs/toolkit';
import {
  applyProjectHistoryCommand,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectCommand,
  type ProjectDocument,
  type ProjectHistory,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  assertProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';

import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';

export type ProjectEvaluationAssembler = (project: ProjectDocument) => ProjectEvaluationAssembly;

export interface ProjectWorkspaceState {
  readonly assembly: ProjectEvaluationAssembly;
  readonly history: ProjectHistory;
}

export const authoredProjectCommandDispatched = createAction<ProjectCommand>(
  'projectWorkspace/commandDispatched',
);
export const authoredProjectUndoRequested = createAction('projectWorkspace/undoRequested');
export const authoredProjectRedoRequested = createAction('projectWorkspace/redoRequested');
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
    assembly,
    history,
  });
}

export function createProjectWorkspaceReducer(
  catalog: Catalog,
  initialProject: ProjectDocument,
  assembleProjectEvaluation: ProjectEvaluationAssembler,
): Reducer<ProjectWorkspaceState> {
  const initialState = publishWorkspace(
    createProjectHistory(initialProject),
    assembleProjectEvaluation,
  );

  return (state = initialState, action) => {
    if (authoredProjectCommandDispatched.match(action)) {
      const history = applyProjectHistoryCommand(state.history, catalog, action.payload);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    if (authoredProjectUndoRequested.match(action)) {
      const history = undoProjectHistory(state.history);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    if (authoredProjectRedoRequested.match(action)) {
      const history = redoProjectHistory(state.history);
      return history === state.history
        ? state
        : publishWorkspace(history, assembleProjectEvaluation);
    }
    if (authoredProjectReplaced.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload), assembleProjectEvaluation);
    }
    if (newProjectCreated.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload), assembleProjectEvaluation);
    }
    if (profileLoadSucceeded.match(action)) {
      return publishWorkspace(
        createProjectHistory(action.payload.project),
        assembleProjectEvaluation,
      );
    }
    return state;
  };
}
