import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PlannerSection = 'underworld' | 'surface' | 'settings';

interface EditorSessionState {
  readonly activeSection: PlannerSection;
}

const initialState: EditorSessionState = {
  activeSection: 'underworld',
};

const editorSessionSlice = createSlice({
  name: 'editorSession',
  initialState,
  reducers: {
    sectionSelected(state, action: PayloadAction<PlannerSection>) {
      state.activeSection = action.payload;
    },
  },
});

export const { sectionSelected } = editorSessionSlice.actions;
export const editorSessionReducer = editorSessionSlice.reducer;
