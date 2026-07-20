import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PlannerSection = 'underworld' | 'surface' | 'settings';
export type UnderworldPanel = 'route' | 'F';

interface EditorSessionState {
  readonly activeSection: PlannerSection;
  readonly activeUnderworldPanel: UnderworldPanel;
}

const initialState: EditorSessionState = {
  activeSection: 'underworld',
  activeUnderworldPanel: 'route',
};

const editorSessionSlice = createSlice({
  name: 'editorSession',
  initialState,
  reducers: {
    sectionSelected(state, action: PayloadAction<PlannerSection>) {
      state.activeSection = action.payload;
    },
    underworldPanelSelected(state, action: PayloadAction<UnderworldPanel>) {
      state.activeUnderworldPanel = action.payload;
    },
  },
});

export const { sectionSelected, underworldPanelSelected } = editorSessionSlice.actions;
export const editorSessionReducer = editorSessionSlice.reducer;
