import { configureStore } from '@reduxjs/toolkit';
import type { Catalog, ProjectDocument } from '@run-planner/core';
import { useDispatch, useSelector } from 'react-redux';

import { createAuthoredProjectReducer } from './authoredProjectSlice';
import { editorSessionReducer } from './editorSessionSlice';

export interface CreatePlannerStoreOptions {
  readonly catalog: Catalog;
  readonly initialProject: ProjectDocument;
}

export function createPlannerStore(options: CreatePlannerStoreOptions) {
  return configureStore({
    reducer: {
      authoredProject: createAuthoredProjectReducer(options.catalog, options.initialProject),
      editorSession: editorSessionReducer,
    },
  });
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;
export type RootState = ReturnType<PlannerStore['getState']>;
export type AppDispatch = PlannerStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
