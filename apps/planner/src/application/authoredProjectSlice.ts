import { createAction, type Reducer } from '@reduxjs/toolkit';
import {
  applyProjectHistoryCommand,
  createProjectHistory,
  projectCommandAddress,
  redoProjectHistory,
  undoProjectHistory,
  type Catalog,
  type ProjectCommand,
  type ProjectDocument,
  type ProjectHistory,
} from '@run-planner/core';

import { requireBiomeCapability, type PlannerCapabilities } from './capabilities';

export const authoredProjectCommandDispatched = createAction<ProjectCommand>(
  'authoredProject/commandDispatched',
);
export const authoredProjectUndoRequested = createAction('authoredProject/undoRequested');
export const authoredProjectRedoRequested = createAction('authoredProject/redoRequested');

export function createAuthoredProjectReducer(
  catalog: Catalog,
  capabilities: PlannerCapabilities,
  initialProject: ProjectDocument,
): Reducer<ProjectHistory> {
  const initialHistory = createProjectHistory(initialProject);

  return (state = initialHistory, action) => {
    if (authoredProjectCommandDispatched.match(action)) {
      requireBiomeCapability(
        capabilities,
        projectCommandAddress(action.payload).biomeStepKey,
        'authorable',
        `command.${action.payload.kind}`,
      );
      return applyProjectHistoryCommand(state, catalog, action.payload);
    }
    if (authoredProjectUndoRequested.match(action)) {
      return undoProjectHistory(state);
    }
    if (authoredProjectRedoRequested.match(action)) {
      return redoProjectHistory(state);
    }
    return state;
  };
}
