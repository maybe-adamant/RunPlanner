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
import { type ProjectEvaluation } from '@run-planner/engine/simulation';

import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';

export type ProjectEvaluator = (project: ProjectDocument) => ProjectEvaluation;

export interface ProjectWorkspaceState {
  readonly history: ProjectHistory;
  readonly evaluation: ProjectEvaluation;
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
  evaluateProject: ProjectEvaluator,
): ProjectWorkspaceState {
  return Object.freeze({
    history,
    evaluation: evaluateProject(history.present),
  });
}

export function createProjectWorkspaceReducer(
  catalog: Catalog,
  initialProject: ProjectDocument,
  evaluateProject: ProjectEvaluator,
): Reducer<ProjectWorkspaceState> {
  const initialState = publishWorkspace(createProjectHistory(initialProject), evaluateProject);

  return (state = initialState, action) => {
    if (authoredProjectCommandDispatched.match(action)) {
      const history = applyProjectHistoryCommand(state.history, catalog, action.payload);
      return history === state.history ? state : publishWorkspace(history, evaluateProject);
    }
    if (authoredProjectUndoRequested.match(action)) {
      const history = undoProjectHistory(state.history);
      return history === state.history ? state : publishWorkspace(history, evaluateProject);
    }
    if (authoredProjectRedoRequested.match(action)) {
      const history = redoProjectHistory(state.history);
      return history === state.history ? state : publishWorkspace(history, evaluateProject);
    }
    if (authoredProjectReplaced.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload), evaluateProject);
    }
    if (newProjectCreated.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload), evaluateProject);
    }
    if (profileLoadSucceeded.match(action)) {
      return publishWorkspace(createProjectHistory(action.payload.project), evaluateProject);
    }
    return state;
  };
}
