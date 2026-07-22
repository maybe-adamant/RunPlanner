import { createAction, createReducer, type Reducer } from '@reduxjs/toolkit';
import type { ProjectDocument } from '@run-planner/engine/authored-project';

export interface ProfileSessionState {
  readonly explicitBaselineJson: string | null;
  readonly recoveryStatus: 'none' | 'recovered' | 'blocked';
  readonly recoveryError: string | null;
  readonly autosaveError: string | null;
}

export const newProjectCreated = createAction<ProjectDocument>('profile/newProjectCreated');
export const profileLoadSucceeded = createAction<{
  readonly project: ProjectDocument;
  readonly baselineJson: string;
}>('profile/loadSucceeded');
export const profileSaveSucceeded = createAction<{ readonly baselineJson: string }>(
  'profile/saveSucceeded',
);
export const autosaveWriteSucceeded = createAction('profile/autosaveWriteSucceeded');
export const autosaveWriteFailed = createAction<{ readonly message: string }>(
  'profile/autosaveWriteFailed',
);
export const recoveryDiscarded = createAction('profile/recoveryDiscarded');

export function createInitialProfileSessionState(
  overrides: Partial<ProfileSessionState> = {},
): ProfileSessionState {
  return Object.freeze({
    explicitBaselineJson: null,
    recoveryStatus: 'none',
    recoveryError: null,
    autosaveError: null,
    ...overrides,
  });
}

export function createProfileSessionReducer(
  initialState: ProfileSessionState = createInitialProfileSessionState(),
): Reducer<ProfileSessionState> {
  return createReducer(initialState, (builder) => {
    builder
      .addCase(newProjectCreated, (state) => ({
        ...state,
        explicitBaselineJson: null,
        recoveryStatus: state.recoveryStatus === 'blocked' ? 'blocked' : 'none',
      }))
      .addCase(profileLoadSucceeded, (state, action) => ({
        ...state,
        explicitBaselineJson: action.payload.baselineJson,
        recoveryStatus: 'none',
        recoveryError: null,
      }))
      .addCase(profileSaveSucceeded, (state, action) => ({
        ...state,
        explicitBaselineJson: action.payload.baselineJson,
        recoveryStatus: state.recoveryStatus === 'recovered' ? 'none' : state.recoveryStatus,
      }))
      .addCase(autosaveWriteSucceeded, (state) => ({ ...state, autosaveError: null }))
      .addCase(autosaveWriteFailed, (state, action) => ({
        ...state,
        autosaveError: action.payload.message,
      }))
      .addCase(recoveryDiscarded, (state) => ({
        ...state,
        recoveryStatus: 'none',
        recoveryError: null,
      }));
  });
}
