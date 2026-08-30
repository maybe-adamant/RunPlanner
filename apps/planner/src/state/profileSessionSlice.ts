import { createAction, createReducer, type Reducer } from '@reduxjs/toolkit';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';

export interface ProfileSessionState {
  readonly explicitBaselineJson: string | null;
  readonly fileName: string | null;
  readonly recoveryStatus: 'none' | 'recovered' | 'blocked';
  readonly recoveryError: string | null;
  readonly autosaveError: string | null;
}

export const newProjectCreated = createAction<ProjectDocument>('profile/newProjectCreated');
export const profileLoadSucceeded = createAction<{
  readonly assembly: ProjectEvaluationAssembly;
  readonly project: ProjectDocument;
  readonly baselineJson: string;
  readonly fileName: string;
}>('profile/loadSucceeded');
export const profileSaveSucceeded = createAction<{
  readonly baselineJson: string;
  readonly fileName: string;
}>('profile/saveSucceeded');
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
    fileName: null,
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
        fileName: null,
        recoveryStatus: state.recoveryStatus === 'blocked' ? 'blocked' : 'none',
      }))
      .addCase(profileLoadSucceeded, (state, action) => ({
        ...state,
        explicitBaselineJson: action.payload.baselineJson,
        fileName: action.payload.fileName,
        recoveryStatus: 'none',
        recoveryError: null,
      }))
      .addCase(profileSaveSucceeded, (state, action) => ({
        ...state,
        explicitBaselineJson: action.payload.baselineJson,
        fileName: action.payload.fileName,
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
