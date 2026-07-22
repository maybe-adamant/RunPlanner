import { configureStore, createSelector } from '@reduxjs/toolkit';
import {
  canRedoProjectHistory,
  canUndoProjectHistory,
  type ProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { useDispatch, useSelector } from 'react-redux';

import type { PlannerCapabilities } from '../composition/capabilities';
import { editorSessionReducer } from './editorSessionSlice';
import { indexFindingsByOwner } from '../projections/evaluationProjection';
import {
  createInitialProfileSessionState,
  createProfileSessionReducer,
  type ProfileSessionState,
} from './profileSessionSlice';
import { requireProjectAuthorable } from '../workspace/projectDocuments';
import { createProjectWorkspaceReducer, type ProjectEvaluator } from './projectWorkspaceSlice';

export interface CreatePlannerStoreOptions {
  readonly catalog: Catalog;
  readonly capabilities: PlannerCapabilities;
  readonly initialProject: ProjectDocument;
  readonly initialProfileSession?: ProfileSessionState;
  readonly evaluateProject: ProjectEvaluator;
}

export function createPlannerStore(options: CreatePlannerStoreOptions) {
  requireProjectAuthorable(options.initialProject, options.capabilities);
  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
    reducer: {
      projectWorkspace: createProjectWorkspaceReducer(
        options.catalog,
        options.capabilities,
        options.initialProject,
        options.evaluateProject,
      ),
      editorSession: editorSessionReducer,
      profileSession: createProfileSessionReducer(
        options.initialProfileSession ?? createInitialProfileSessionState(),
      ),
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
export const selectExplicitProfileBaselineJson = (state: RootState) =>
  state.profileSession.explicitBaselineJson;
export const selectProfileSession = (state: RootState) => state.profileSession;
export type ProfileStatus = 'Clean' | 'Dirty' | 'Recovered' | 'Unsaved';
export const selectProfileStatus = createSelector(
  selectPresentProject,
  selectProfileSession,
  (project, session): ProfileStatus => {
    if (session.recoveryStatus === 'recovered') {
      return 'Recovered';
    }
    if (session.explicitBaselineJson === null) {
      return 'Unsaved';
    }
    return encodeProjectDocument(project) === session.explicitBaselineJson ? 'Clean' : 'Dirty';
  },
);
export const selectProjectFindingsByOwner = createSelector(selectProjectEvaluation, (evaluation) =>
  indexFindingsByOwner(evaluation.findings),
);
export const selectCanUndoProject = (state: RootState) =>
  canUndoProjectHistory(state.projectWorkspace.history);
export const selectCanRedoProject = (state: RootState) =>
  canRedoProjectHistory(state.projectWorkspace.history);

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
