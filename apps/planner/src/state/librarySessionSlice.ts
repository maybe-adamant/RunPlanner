import { createAction, createReducer, type Reducer } from '@reduxjs/toolkit';
import type { ProjectDocument } from '@run-planner/engine/authored-project';

import { authoredProjectClosed, authoredProjectReplaced } from './projectWorkspaceSlice';

export type HomeTab = 'library' | 'catalog' | 'game' | 'settings';

/** Which screen the app shows: a Home tab, or the open plan's editor. */
export type AppView =
  { readonly kind: 'home'; readonly tab: HomeTab } | { readonly kind: 'editor' };

export interface LibrarySessionState {
  readonly view: AppView;
  /** The Library folder shown, a `/`-separated path; `""` is the top level. */
  readonly libraryFolder: string;
  /** The open plan as it was opened, for Revert to opened. */
  readonly opened: ProjectDocument | null;
  /** The latest failed write of the open plan; cleared by the next successful one. */
  readonly writeError: string | null;
  /** The file open before the library, offered once for import. */
  readonly previousFileOffer: { readonly fileName: string } | null;
}

export const viewChanged = createAction<AppView>('library/viewChanged');
export const libraryFolderChanged = createAction<string>('library/folderChanged');
export const libraryWriteSucceeded = createAction('library/writeSucceeded');
export const libraryWriteFailed = createAction<{ readonly message: string }>('library/writeFailed');
export const previousFileOffered = createAction<{ readonly fileName: string } | null>(
  'library/previousFileOffered',
);

const HOME_LIBRARY: AppView = Object.freeze({ kind: 'home', tab: 'library' });
const EDITOR: AppView = Object.freeze({ kind: 'editor' });

const INITIAL_STATE: LibrarySessionState = Object.freeze({
  view: HOME_LIBRARY,
  libraryFolder: '',
  opened: null,
  writeError: null,
  previousFileOffer: null,
});

export function createLibrarySessionReducer(): Reducer<LibrarySessionState> {
  return createReducer(INITIAL_STATE, (builder) => {
    builder
      // Opening a plan shows its editor.
      .addCase(authoredProjectReplaced, (state, action) => ({
        ...state,
        view: EDITOR,
        opened: action.payload,
        writeError: null,
      }))
      .addCase(authoredProjectClosed, (state) => ({
        ...state,
        view: state.view.kind === 'editor' ? HOME_LIBRARY : state.view,
        opened: null,
        writeError: null,
      }))
      .addCase(viewChanged, (state, action) => ({ ...state, view: action.payload }))
      .addCase(libraryFolderChanged, (state, action) => ({
        ...state,
        libraryFolder: action.payload,
      }))
      .addCase(libraryWriteSucceeded, (state) =>
        state.writeError === null ? state : { ...state, writeError: null },
      )
      .addCase(libraryWriteFailed, (state, action) => ({
        ...state,
        writeError: action.payload.message,
      }))
      .addCase(previousFileOffered, (state, action) => ({
        ...state,
        previousFileOffer: action.payload,
      }));
  });
}
