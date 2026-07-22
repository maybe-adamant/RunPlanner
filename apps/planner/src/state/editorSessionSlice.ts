import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SemanticAddress } from '@run-planner/engine/authored-project';

export type PlannerSection = 'underworld' | 'surface' | 'settings';
export type UnderworldPanel = 'route' | 'F' | 'G' | 'H' | 'I';
export type SurfacePanel = 'route' | 'N' | 'O' | 'P' | 'Q';

export interface FindingSelection {
  readonly key: string;
  readonly origin: SemanticAddress;
}

interface EditorSessionState {
  readonly activeSection: PlannerSection;
  readonly activeUnderworldPanel: UnderworldPanel;
  readonly activeSurfacePanel: SurfacePanel;
  readonly selectedFinding: FindingSelection | null;
  readonly findingNavigationRevision: number;
}

const initialState: EditorSessionState = {
  activeSection: 'underworld',
  activeUnderworldPanel: 'route',
  activeSurfacePanel: 'route',
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
    surfacePanelSelected(state, action: PayloadAction<SurfacePanel>) {
      state.activeSurfacePanel = action.payload;
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
            action.payload.origin.biomeKey === 'H' ||
            action.payload.origin.biomeKey === 'I')
            ? action.payload.origin.biomeKey
            : 'route';
        return;
      }
      if (route === 'Surface') {
        state.activeSection = 'surface';
        state.activeSurfacePanel =
          action.payload.origin.kind !== 'project' &&
          action.payload.origin.kind !== 'route' &&
          (action.payload.origin.biomeKey === 'N' ||
            action.payload.origin.biomeKey === 'O' ||
            action.payload.origin.biomeKey === 'P' ||
            action.payload.origin.biomeKey === 'Q')
            ? action.payload.origin.biomeKey
            : 'route';
        return;
      }
      throw new Error(`Finding references unknown route ${route}`);
    },
  },
});

export const { findingSelected, sectionSelected, surfacePanelSelected, underworldPanelSelected } =
  editorSessionSlice.actions;
export const editorSessionReducer = editorSessionSlice.reducer;
