import { createSlice, type PayloadAction, type Reducer } from '@reduxjs/toolkit';
import type { DraftRefusal, DraftReport } from '@run-planner/engine/simulation';

import { authoredProjectReplaced } from './projectWorkspaceSlice';
import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';

/** The last draft run; a drafted result has already been applied to the project. */
export type DraftRunState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly seed: number; readonly startedAt: number }
  | {
      readonly kind: 'drafted';
      readonly seed: number;
      readonly report: DraftReport;
      readonly attempts: number;
    }
  | { readonly kind: 'failed'; readonly biomeKey: string; readonly reasons: readonly string[] }
  | { readonly kind: 'refused'; readonly refusals: readonly DraftRefusal[] }
  /** The project changed while drafting, so the result was not applied. */
  | { readonly kind: 'superseded' }
  /** The search stopped without a result, or its result could not be applied. */
  | { readonly kind: 'error'; readonly message: string };

/** Run state only; the draft spec and its seed live in the project. */
export interface DraftSessionState {
  readonly run: DraftRunState;
}

const initialState: DraftSessionState = { run: { kind: 'idle' } };

const draftSessionSlice = createSlice({
  name: 'draftSession',
  initialState,
  reducers: {
    draftRunStarted(_state, action: PayloadAction<{ seed: number; startedAt: number }>) {
      return { run: { kind: 'running', ...action.payload } };
    },
    draftRunSettled(_state, action: PayloadAction<Exclude<DraftRunState, { kind: 'running' }>>) {
      return { run: action.payload };
    },
    /** Cancelling, or an outcome the project has since moved past. */
    draftRunCleared() {
      return initialState;
    },
  },
});

export const { draftRunStarted, draftRunSettled, draftRunCleared } = draftSessionSlice.actions;

/** A different project starts idle. */
export function createDraftSessionReducer(): Reducer<DraftSessionState> {
  return (state = initialState, action) => {
    if (
      authoredProjectReplaced.match(action) ||
      newProjectCreated.match(action) ||
      profileLoadSucceeded.match(action)
    )
      return initialState;
    return draftSessionSlice.reducer(state, action);
  };
}
