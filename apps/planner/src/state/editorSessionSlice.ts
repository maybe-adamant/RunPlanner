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

/** One catalog-driven panel selection retained independently for each route. */
export type RoutePanel =
  | { readonly kind: 'overview' }
  | { readonly kind: 'npcIndex' }
  | { readonly kind: 'biome'; readonly biomeKey: string };

export interface RoutePanelSelection {
  readonly routeKey: string;
  readonly panel: RoutePanel;
}

export interface EditorSessionState {
  readonly activeRouteKey: string | null;
  readonly activePanelByRoute: Readonly<Record<string, RoutePanel>>;
  readonly focusedSemanticOwner: SemanticAddress | null;
  readonly selectedFinding: FindingSelection | null;
  /** Advances for every explicit semantic navigation, including repeat visits. */
  readonly semanticNavigationRevision: number;
}

const routeOverviewPanel: RoutePanel = Object.freeze({ kind: 'overview' });

const emptyState: EditorSessionState = {
  activeRouteKey: null,
  activePanelByRoute: {},
  focusedSemanticOwner: null,
  selectedFinding: null,
  semanticNavigationRevision: 0,
};

function routeKey(origin: SemanticAddress): string | null {
  return origin.kind === 'project' ? null : origin.routeKey;
}

function biomeKey(origin: SemanticAddress): string | null {
  return origin.kind === 'project' || origin.kind === 'route' ? null : origin.biomeKey;
}

function panelForOrigin(origin: SemanticAddress): RoutePanel {
  const biome = biomeKey(origin);
  return biome === null ? routeOverviewPanel : Object.freeze({ kind: 'biome', biomeKey: biome });
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
      state.activePanelByRoute[action.payload.routeKey] = action.payload.panel;
      state.focusedSemanticOwner = null;
    },
    semanticOwnerFocused(state, action: PayloadAction<SemanticAddress>) {
      state.focusedSemanticOwner = action.payload;
      state.selectedFinding = null;
    },
    semanticOwnerNavigated(state, action: PayloadAction<SemanticAddress>) {
      state.focusedSemanticOwner = action.payload;
      state.selectedFinding = null;
      state.semanticNavigationRevision += 1;
      const route = routeKey(action.payload);
      if (route === null) {
        return;
      }
      state.activeRouteKey = route;
      state.activePanelByRoute[route] = panelForOrigin(action.payload);
    },
    findingSelected(state, action: PayloadAction<FindingSelection>) {
      state.selectedFinding = action.payload;
      state.focusedSemanticOwner = action.payload.origin;
      state.semanticNavigationRevision += 1;
      const route = routeKey(action.payload.origin);
      if (route === null) {
        return;
      }
      state.activeRouteKey = route;
      state.activePanelByRoute[route] = panelForOrigin(action.payload.origin);
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
  semanticOwnerNavigated,
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
  if (selection.panel.kind === 'biome' && !route.biomeKeys.includes(selection.panel.biomeKey)) {
    throw new Error(
      `Editor navigation references biome ${selection.panel.biomeKey} outside route ${selection.routeKey}`,
    );
  }
}

export function createEditorSessionReducer(catalog: Catalog): Reducer<EditorSessionState> {
  const activePanelByRoute = Object.fromEntries(
    catalog.routes.values.map((route) => [route.key, routeOverviewPanel]),
  );
  const initialState: EditorSessionState = {
    ...emptyState,
    activeRouteKey: catalog.routes.values[0]?.key ?? null,
    activePanelByRoute,
  };

  return (state = initialState, action) => {
    if (routeSelected.match(action)) {
      requireRoute(catalog, action.payload);
    } else if (routePanelSelected.match(action)) {
      requirePanel(catalog, action.payload);
    } else if (semanticOwnerNavigated.match(action)) {
      const route = routeKey(action.payload);
      if (route !== null) {
        requirePanel(catalog, { routeKey: route, panel: panelForOrigin(action.payload) });
      }
    } else if (findingSelected.match(action)) {
      const route = routeKey(action.payload.origin);
      if (route !== null) {
        requirePanel(catalog, { routeKey: route, panel: panelForOrigin(action.payload.origin) });
      }
    }
    return editorSessionSlice.reducer(state, action);
  };
}
