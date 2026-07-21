import { createAction, createReducer } from '@reduxjs/toolkit';
import type { ProjectDocument } from '@run-planner/core';

export interface ProfileSessionState {
  readonly explicitBaselineJson: string | null;
}

export const newProjectCreated = createAction<ProjectDocument>('profile/newProjectCreated');
export const profileLoadSucceeded = createAction<{
  readonly project: ProjectDocument;
  readonly baselineJson: string;
}>('profile/loadSucceeded');
export const profileSaveSucceeded = createAction<{ readonly baselineJson: string }>(
  'profile/saveSucceeded',
);

const initialState: ProfileSessionState = Object.freeze({ explicitBaselineJson: null });

export const profileSessionReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(newProjectCreated, () => initialState)
    .addCase(profileLoadSucceeded, (_state, action) => ({
      explicitBaselineJson: action.payload.baselineJson,
    }))
    .addCase(profileSaveSucceeded, (_state, action) => ({
      explicitBaselineJson: action.payload.baselineJson,
    }));
});
