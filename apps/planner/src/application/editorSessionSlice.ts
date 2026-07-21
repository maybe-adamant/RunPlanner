import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SemanticAddress } from '@run-planner/core';

export type PlannerSection = 'underworld' | 'surface' | 'settings';
export type UnderworldPanel = 'route' | 'F' | 'G' | 'H';

export interface FindingSelection {
  readonly key: string;
  readonly origin: SemanticAddress;
}

interface EditorSessionState {
  readonly activeSection: PlannerSection;
  readonly activeUnderworldPanel: UnderworldPanel;
  readonly selectedFinding: FindingSelection | null;
  readonly findingNavigationRevision: number;
}

const initialState: EditorSessionState = {
  activeSection: 'underworld',
  activeUnderworldPanel: 'route',
  selectedFinding: null,
  findingNavigationRevision: 0,
};

function routeKey(origin: SemanticAddress): string | null {
  if (origin.kind === 'project') {
    return null;
  }
  return origin.routeKey;
}

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
    findingSelected(state, action: PayloadAction<FindingSelection>) {
      state.selectedFinding = action.payload;
      state.findingNavigationRevision += 1;
      const route = routeKey(action.payload.origin);
      if (route === null) {
        return;
      }
      if (route === 'Underworld') {
        state.activeSection = 'underworld';
        state.activeUnderworldPanel =
          action.payload.origin.kind !== 'project' &&
          action.payload.origin.kind !== 'route' &&
          (action.payload.origin.biomeKey === 'F' ||
            action.payload.origin.biomeKey === 'G' ||
            action.payload.origin.biomeKey === 'H')
            ? action.payload.origin.biomeKey
            : 'route';
        return;
      }
      if (route === 'Surface') {
        state.activeSection = 'surface';
        return;
      }
      throw new Error(`Finding references unknown route ${route}`);
    },
  },
});

export const { findingSelected, sectionSelected, underworldPanelSelected } =
  editorSessionSlice.actions;
export const editorSessionReducer = editorSessionSlice.reducer;
