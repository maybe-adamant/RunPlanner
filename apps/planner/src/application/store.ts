import { configureStore, createSelector } from '@reduxjs/toolkit';
import {
  canRedoProjectHistory,
  canUndoProjectHistory,
  type Catalog,
  type ProjectDocument,
} from '@run-planner/core';
import { useDispatch, useSelector } from 'react-redux';

import type { PlannerCapabilities } from './capabilities';
import { editorSessionReducer } from './editorSessionSlice';
import { indexFindingsByOwner } from './evaluationProjection';
import { requireProjectAuthorable } from './projectDocuments';
import { createProjectWorkspaceReducer, type ProjectEvaluator } from './projectWorkspaceSlice';

export interface CreatePlannerStoreOptions {
  readonly catalog: Catalog;
  readonly capabilities: PlannerCapabilities;
  readonly initialProject: ProjectDocument;
  readonly evaluateProject: ProjectEvaluator;
}

export function createPlannerStore(options: CreatePlannerStoreOptions) {
  requireProjectAuthorable(options.initialProject, options.capabilities);
  return configureStore({
    reducer: {
      projectWorkspace: createProjectWorkspaceReducer(
        options.catalog,
        options.capabilities,
        options.initialProject,
        options.evaluateProject,
      ),
      editorSession: editorSessionReducer,
    },
  });
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;
export type RootState = ReturnType<PlannerStore['getState']>;
export type AppDispatch = PlannerStore['dispatch'];

export const selectProjectWorkspace = (state: RootState) => state.projectWorkspace;
export const selectProjectHistory = (state: RootState) => state.projectWorkspace.history;
export const selectPresentProject = (state: RootState) => state.projectWorkspace.history.present;
export const selectProjectEvaluation = (state: RootState) => state.projectWorkspace.evaluation;
export const selectProjectFindingsByOwner = createSelector(selectProjectEvaluation, (evaluation) =>
  indexFindingsByOwner(evaluation.findings),
);
export const selectCanUndoProject = (state: RootState) =>
  canUndoProjectHistory(state.projectWorkspace.history);
export const selectCanRedoProject = (state: RootState) =>
  canRedoProjectHistory(state.projectWorkspace.history);

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
