import { configureStore } from '@reduxjs/toolkit';
import type { Catalog, ProjectDocument } from '@run-planner/core';
import { useDispatch, useSelector } from 'react-redux';

import { createAuthoredProjectReducer } from './authoredProjectSlice';
import type { PlannerCapabilities } from './capabilities';
import { editorSessionReducer } from './editorSessionSlice';
import { requireProjectAuthorable } from './projectDocuments';

export interface CreatePlannerStoreOptions {
  readonly catalog: Catalog;
  readonly capabilities: PlannerCapabilities;
  readonly initialProject: ProjectDocument;
}

export function createPlannerStore(options: CreatePlannerStoreOptions) {
  requireProjectAuthorable(options.initialProject, options.capabilities);
  return configureStore({
    reducer: {
      authoredProject: createAuthoredProjectReducer(
        options.catalog,
        options.capabilities,
        options.initialProject,
      ),
      editorSession: editorSessionReducer,
    },
  });
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;
export type RootState = ReturnType<PlannerStore['getState']>;
export type AppDispatch = PlannerStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
