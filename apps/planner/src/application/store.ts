import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import { editorSessionReducer } from './editorSessionSlice';

export function createPlannerStore() {
  return configureStore({
    reducer: {
      editorSession: editorSessionReducer,
    },
  });
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;
export type RootState = ReturnType<PlannerStore['getState']>;
export type AppDispatch = PlannerStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
