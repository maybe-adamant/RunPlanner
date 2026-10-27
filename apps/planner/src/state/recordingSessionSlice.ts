import { createSlice, type PayloadAction, type Reducer } from '@reduxjs/toolkit';

import type {
  RecentRunSummary,
  UnreadableRecentRun,
} from '@planner/workspace/run-recording/recentRuns';

/** What the save watch is doing; `runOpen` lists the profiles whose run is being recorded. */
export type RecordingStatus =
  | { readonly kind: 'off' }
  | { readonly kind: 'watching'; readonly folder: string }
  | {
      readonly kind: 'runOpen';
      readonly folder: string;
      readonly runs: readonly { readonly profile: number; readonly rooms: number }[];
    }
  | { readonly kind: 'importing'; readonly folder: string }
  | { readonly kind: 'error'; readonly message: string };

export interface RecordingSessionState {
  readonly status: RecordingStatus;
  /** Newest start first; null until the store has been read. */
  readonly recentRuns: readonly RecentRunSummary[] | null;
  /** Stored runs this planner cannot read; they stay on disk. */
  readonly unreadableRuns: readonly UnreadableRecentRun[];
  /** The last save that could not be read or run that could not be stored, while recording goes on. */
  readonly problem: string | null;
}

const initialState: RecordingSessionState = {
  status: { kind: 'off' },
  recentRuns: null,
  unreadableRuns: [],
  problem: null,
};

const recordingSessionSlice = createSlice({
  name: 'recordingSession',
  initialState,
  reducers: {
    recordingStatusChanged(state, action: PayloadAction<RecordingStatus>) {
      return { ...state, status: action.payload };
    },
    recentRunsLoaded(
      state,
      action: PayloadAction<{
        readonly runs: readonly RecentRunSummary[];
        readonly unreadable: readonly UnreadableRecentRun[];
      }>,
    ) {
      return {
        ...state,
        recentRuns: action.payload.runs,
        unreadableRuns: action.payload.unreadable,
      };
    },
    recordingProblemReported(state, action: PayloadAction<string | null>) {
      return { ...state, problem: action.payload };
    },
  },
});

export const { recordingStatusChanged, recentRunsLoaded, recordingProblemReported } =
  recordingSessionSlice.actions;

export function createRecordingSessionReducer(): Reducer<RecordingSessionState> {
  return recordingSessionSlice.reducer;
}
