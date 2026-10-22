import { createAction, createReducer, type Reducer } from '@reduxjs/toolkit';
import type { ProjectDocument } from '@run-planner/engine/authored-project';

import { authoredProjectReplaced } from './projectWorkspaceSlice';

export interface LibrarySessionState {
  /** The open plan as it was opened, for Revert to opened. */
  readonly opened: ProjectDocument | null;
  /** The latest failed write of the open plan; cleared by the next successful one. */
  readonly writeError: string | null;
  /** Why the plan open at the last close could not be reopened. */
  readonly openError: string | null;
  /** The file open before the library, offered once for import. */
  readonly previousFileOffer: { readonly fileName: string } | null;
}

export const libraryWriteSucceeded = createAction('library/writeSucceeded');
export const libraryWriteFailed = createAction<{ readonly message: string }>('library/writeFailed');
export const libraryOpenFailed = createAction<{ readonly message: string }>('library/openFailed');
export const previousFileOffered = createAction<{ readonly fileName: string } | null>(
  'library/previousFileOffered',
);

const INITIAL_STATE: LibrarySessionState = Object.freeze({
  opened: null,
  writeError: null,
  openError: null,
  previousFileOffer: null,
});

export function createLibrarySessionReducer(): Reducer<LibrarySessionState> {
  return createReducer(INITIAL_STATE, (builder) => {
    builder
      .addCase(authoredProjectReplaced, (state, action) => ({
        ...state,
        opened: action.payload,
        writeError: null,
        openError: null,
      }))
      .addCase(libraryWriteSucceeded, (state) =>
        state.writeError === null ? state : { ...state, writeError: null },
      )
      .addCase(libraryWriteFailed, (state, action) => ({
        ...state,
        writeError: action.payload.message,
      }))
      .addCase(libraryOpenFailed, (state, action) => ({
        ...state,
        openError: action.payload.message,
      }))
      .addCase(previousFileOffered, (state, action) => ({
        ...state,
        previousFileOffer: action.payload,
      }));
  });
}
