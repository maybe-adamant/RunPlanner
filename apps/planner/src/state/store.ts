import { configureStore, createSelector } from '@reduxjs/toolkit';
import {
  canRedoProjectHistory,
  canUndoProjectHistory,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { useDispatch, useSelector } from 'react-redux';

import { createDraftSessionReducer } from './draftSessionSlice';
import { createEditorSessionReducer } from './editorSessionSlice';
import { createGameSendSessionReducer } from './gameSendSessionSlice';
import { createLibrarySessionReducer } from './librarySessionSlice';
import { createRecordingSessionReducer } from './recordingSessionSlice';
import {
  createProjectWorkspaceReducer,
  type ProjectEvaluationAssembler,
  settlementFaultWarning,
} from './projectWorkspaceSlice';

export interface CreatePlannerStoreOptions {
  readonly catalog: Catalog;
  readonly assembleProjectEvaluation: ProjectEvaluationAssembler;
}

export function createPlannerStore(options: CreatePlannerStoreOptions) {
  return configureStore({
    middleware: (getDefaultMiddleware) => {
      const middleware = getDefaultMiddleware({ immutableCheck: false, serializableCheck: false });
      return import.meta.env.DEV ? middleware.concat(settlementFaultWarning) : middleware;
    },
    reducer: {
      projectWorkspace: createProjectWorkspaceReducer(
        options.catalog,
        options.assembleProjectEvaluation,
      ),
      editorSession: createEditorSessionReducer(options.catalog),
      librarySession: createLibrarySessionReducer(),
      gameSendSession: createGameSendSessionReducer(),
      draftSession: createDraftSessionReducer(),
      recordingSession: createRecordingSessionReducer(),
    },
  });
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;
export type RootState = ReturnType<PlannerStore['getState']>;
export type AppDispatch = PlannerStore['dispatch'];

export const selectProjectHistory = (state: RootState) =>
  state.projectWorkspace.kind === 'openProject' ? state.projectWorkspace.history : undefined;
export const selectPresentProject = (state: RootState) =>
  state.projectWorkspace.kind === 'openProject'
    ? state.projectWorkspace.history.present
    : undefined;
export const selectProjectEvaluation = (state: RootState) =>
  state.projectWorkspace.kind === 'openProject'
    ? state.projectWorkspace.assembly.evaluation
    : undefined;
export const selectLibrarySession = (state: RootState) => state.librarySession;
/** The editor shows only while a plan is open. */
export const selectEditorShown = (state: RootState) =>
  state.librarySession.view.kind === 'editor' && selectPresentProject(state) !== undefined;

const encodings = new WeakMap<object, string>();
function encoded(project: Parameters<typeof encodeProjectDocument>[0]): string {
  let json = encodings.get(project);
  if (json === undefined) {
    json = encodeProjectDocument(project);
    encodings.set(project, json);
  }
  return json;
}

/** Whether the open plan differs from the document it was opened as. */
export const selectRevertAvailable = createSelector(
  selectPresentProject,
  (state: RootState) => state.librarySession.opened,
  (project, opened) =>
    project !== undefined &&
    opened !== null &&
    project !== opened &&
    encoded(project) !== encoded(opened),
);
export const selectCanUndoProject = (state: RootState) =>
  state.projectWorkspace.kind === 'openProject' &&
  canUndoProjectHistory(state.projectWorkspace.history);
export const selectCanRedoProject = (state: RootState) =>
  state.projectWorkspace.kind === 'openProject' &&
  canRedoProjectHistory(state.projectWorkspace.history);

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
