import { createAction, type Reducer } from '@reduxjs/toolkit';
import {
  applyProjectHistoryCommand,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  type Catalog,
  type ProjectCommand,
  type ProjectDocument,
  type ProjectHistory,
} from '@run-planner/core';

export const authoredProjectCommandDispatched = createAction<ProjectCommand>(
  'authoredProject/commandDispatched',
);
export const authoredProjectUndoRequested = createAction('authoredProject/undoRequested');
export const authoredProjectRedoRequested = createAction('authoredProject/redoRequested');

export function createAuthoredProjectReducer(
  catalog: Catalog,
  initialProject: ProjectDocument,
): Reducer<ProjectHistory> {
  const initialHistory = createProjectHistory(initialProject);

  return (state = initialHistory, action) => {
    if (authoredProjectCommandDispatched.match(action)) {
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
