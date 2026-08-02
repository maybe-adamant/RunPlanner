import { createSlice, type PayloadAction, type Reducer } from '@reduxjs/toolkit';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

export interface FindingSelection {
  readonly key: string;
  readonly origin: SemanticAddress;
}

/** Transient navigation references invalidated by one workspace publication. */
export interface EditorSessionReconciliation {
  readonly clearFocusedSemanticOwner: boolean;
  readonly clearSelectedFinding: boolean;
}

export interface RoutePanelSelection {
  readonly routeKey: string;
  readonly biomeKey: string | null;
}

export interface EditorSessionState {
  readonly activeRouteKey: string | null;
  readonly activeBiomeKeyByRoute: Readonly<Record<string, string | null>>;
  readonly focusedSemanticOwner: SemanticAddress | null;
  readonly selectedFinding: FindingSelection | null;
  readonly findingNavigationRevision: number;
}

const emptyState: EditorSessionState = {
  activeRouteKey: null,
  activeBiomeKeyByRoute: {},
  focusedSemanticOwner: null,
  selectedFinding: null,
  findingNavigationRevision: 0,
};

function routeKey(origin: SemanticAddress): string | null {
  return origin.kind === 'project' ? null : origin.routeKey;
}

function biomeKey(origin: SemanticAddress): string | null {
  return origin.kind === 'project' || origin.kind === 'route' ? null : origin.biomeKey;
}

const editorSessionSlice = createSlice({
  name: 'editorSession',
  initialState: emptyState,
  reducers: {
    routeSelected(state, action: PayloadAction<string>) {
      state.activeRouteKey = action.payload;
      state.focusedSemanticOwner = null;
    },
    settingsSelected(state) {
      state.activeRouteKey = null;
      state.focusedSemanticOwner = null;
    },
    routePanelSelected(state, action: PayloadAction<RoutePanelSelection>) {
      state.activeRouteKey = action.payload.routeKey;
      state.activeBiomeKeyByRoute[action.payload.routeKey] = action.payload.biomeKey;
      state.focusedSemanticOwner = null;
    },
    semanticOwnerFocused(state, action: PayloadAction<SemanticAddress>) {
      state.focusedSemanticOwner = action.payload;
      state.selectedFinding = null;
    },
    findingSelected(state, action: PayloadAction<FindingSelection>) {
      state.selectedFinding = action.payload;
      state.focusedSemanticOwner = action.payload.origin;
      state.findingNavigationRevision += 1;
      const route = routeKey(action.payload.origin);
      if (route === null) {
        return;
      }
      state.activeRouteKey = route;
      state.activeBiomeKeyByRoute[route] = biomeKey(action.payload.origin);
    },
    editorSessionReconciled(state, action: PayloadAction<EditorSessionReconciliation>) {
      if (action.payload.clearFocusedSemanticOwner) {
        state.focusedSemanticOwner = null;
      }
      if (action.payload.clearSelectedFinding) {
        state.selectedFinding = null;
      }
    },
  },
});

export const {
  editorSessionReconciled,
  findingSelected,
  routePanelSelected,
  routeSelected,
  semanticOwnerFocused,
  settingsSelected,
} = editorSessionSlice.actions;

function requireRoute(catalog: Catalog, routeKeyValue: string): void {
  if (catalog.routes.byKey[routeKeyValue] === undefined) {
    throw new Error(`Editor navigation references unknown route ${routeKeyValue}`);
  }
}

function requirePanel(catalog: Catalog, selection: RoutePanelSelection): void {
  const route = catalog.routes.byKey[selection.routeKey];
  if (route === undefined) {
    throw new Error(`Editor navigation references unknown route ${selection.routeKey}`);
  }
  if (selection.biomeKey !== null && !route.biomeKeys.includes(selection.biomeKey)) {
    throw new Error(
      `Editor navigation references biome ${selection.biomeKey} outside route ${selection.routeKey}`,
    );
  }
}

export function createEditorSessionReducer(catalog: Catalog): Reducer<EditorSessionState> {
  const activeBiomeKeyByRoute = Object.fromEntries(
    catalog.routes.values.map((route) => [route.key, null]),
  );
  const initialState: EditorSessionState = {
    ...emptyState,
    activeRouteKey: catalog.routes.values[0]?.key ?? null,
    activeBiomeKeyByRoute,
  };

  return (state = initialState, action) => {
    if (routeSelected.match(action)) {
      requireRoute(catalog, action.payload);
    } else if (routePanelSelected.match(action)) {
      requirePanel(catalog, action.payload);
    } else if (findingSelected.match(action)) {
      const route = routeKey(action.payload.origin);
      if (route !== null) {
        requirePanel(catalog, { routeKey: route, biomeKey: biomeKey(action.payload.origin) });
      }
    }
    return editorSessionSlice.reducer(state, action);
  };
}
