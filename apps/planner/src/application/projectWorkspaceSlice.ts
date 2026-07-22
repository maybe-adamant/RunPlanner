import { createAction, type Reducer } from '@reduxjs/toolkit';
import {
  applyProjectHistoryCommand,
  createProjectHistory,
  projectCommandAddress,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectCommand,
  type ProjectDocument,
  type ProjectHistory,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type ProjectEvaluation } from '@run-planner/engine/simulation';

import { requireBiomeCapability, type PlannerCapabilities } from './capabilities';
import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';
import { requireProjectAuthorable, requireRoutePrefixAuthorable } from './projectDocuments';

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
  capabilities: PlannerCapabilities,
  initialProject: ProjectDocument,
  evaluateProject: ProjectEvaluator,
): Reducer<ProjectWorkspaceState> {
  const initialState = publishWorkspace(createProjectHistory(initialProject), evaluateProject);

  return (state = initialState, action) => {
    if (authoredProjectCommandDispatched.match(action)) {
      if (action.payload.kind === 'RenameProject') {
        // Project-root commands do not cross a biome capability boundary.
      } else if (action.payload.kind === 'ConfigureRoutePrefix') {
        requireRoutePrefixAuthorable(
          catalog,
          capabilities,
          action.payload.route.routeKey,
          action.payload.configuredBiomeCount,
          `command.${action.payload.kind}`,
        );
      } else {
        const address = projectCommandAddress(action.payload);
        if (address.kind === 'project' || address.kind === 'route') {
          throw new Error('top-level address escaped top-level command validation');
        }
        requireBiomeCapability(
          capabilities,
          address.biomeKey,
          'authorable',
          `command.${action.payload.kind}`,
        );
      }
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
      requireProjectAuthorable(action.payload, capabilities);
      return publishWorkspace(createProjectHistory(action.payload), evaluateProject);
    }
    if (newProjectCreated.match(action)) {
      requireProjectAuthorable(action.payload, capabilities);
      return publishWorkspace(createProjectHistory(action.payload), evaluateProject);
    }
    if (profileLoadSucceeded.match(action)) {
      requireProjectAuthorable(action.payload.project, capabilities);
      return publishWorkspace(createProjectHistory(action.payload.project), evaluateProject);
    }
    return state;
  };
}
