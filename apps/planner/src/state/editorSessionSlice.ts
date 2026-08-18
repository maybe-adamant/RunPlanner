import { createSlice, type PayloadAction, type Reducer } from '@reduxjs/toolkit';
import type {
  ExitDecisionAddress,
  HubDecisionAddress,
  SemanticAddress,
  TraitOfferAddress,
  LevelResolutionAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

export interface FindingSelection {
  readonly key: string;
  readonly origin: SemanticAddress;
  /** Projection-resolved containing dialog for a fine-grained finding. */
  readonly traitDialogTarget?: TraitOfferAddress;
}

/** Transient navigation references invalidated by one workspace publication. */
export interface EditorSessionReconciliation {
  readonly clearFocusedSemanticOwner: boolean;
  readonly clearSelectedFinding: boolean;
  readonly clearTraitDialogTarget?: boolean;
  readonly clearLevelResolutionDialogTarget?: boolean;
  readonly clearRunStateTarget?: boolean;
}

/** One catalog-driven panel selection retained independently for each route. */
export type RoutePanel =
  | { readonly kind: 'overview' }
  | { readonly kind: 'npcIndex' }
  | { readonly kind: 'traits' }
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
  /** Exact transient trait dialog target; never part of authored history. */
  readonly traitDialogTarget?: TraitOfferAddress | null;
  /** Exact transient Pom dialog target; never part of authored history. */
  readonly levelResolutionDialogTarget?: LevelResolutionAddress | null;
  /** Exact outer decision whose read-only Run State sheet is open. */
  readonly runStateTarget?: ExitDecisionAddress | HubDecisionAddress | null;
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
  if (origin.kind === 'project' || origin.kind === 'route') return null;
  if (origin.kind === 'keepsakeSelection' && origin.owner === 'routeStart') return null;
  if (
    origin.kind === 'keepsakeEquipResult' &&
    origin.selection.kind === 'keepsakeSelection' &&
    origin.selection.owner === 'routeStart'
  )
    return null;
  return origin.biomeKey;
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
      state.traitDialogTarget = null;
      state.levelResolutionDialogTarget = null;
      state.runStateTarget = null;
    },
    settingsSelected(state) {
      state.activeRouteKey = null;
      state.focusedSemanticOwner = null;
      state.traitDialogTarget = null;
      state.levelResolutionDialogTarget = null;
      state.runStateTarget = null;
    },
    routePanelSelected(state, action: PayloadAction<RoutePanelSelection>) {
      state.activeRouteKey = action.payload.routeKey;
      state.activePanelByRoute[action.payload.routeKey] = action.payload.panel;
      state.focusedSemanticOwner = null;
      state.traitDialogTarget = null;
      state.levelResolutionDialogTarget = null;
      state.runStateTarget = null;
    },
    semanticOwnerFocused(state, action: PayloadAction<SemanticAddress>) {
      state.focusedSemanticOwner = action.payload;
      state.selectedFinding = null;
      state.traitDialogTarget = null;
      state.levelResolutionDialogTarget = null;
      state.runStateTarget = null;
    },
    semanticOwnerNavigated(state, action: PayloadAction<SemanticAddress>) {
      state.focusedSemanticOwner = action.payload;
      state.selectedFinding = null;
      state.semanticNavigationRevision += 1;
      state.traitDialogTarget = action.payload.kind === 'traitOffer' ? action.payload : null;
      state.levelResolutionDialogTarget =
        action.payload.kind === 'levelResolution' ? action.payload : null;
      state.runStateTarget = null;
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
      state.traitDialogTarget =
        action.payload.traitDialogTarget ??
        (action.payload.origin.kind === 'traitOffer' ? action.payload.origin : null);
      state.levelResolutionDialogTarget =
        action.payload.origin.kind === 'levelResolution' ? action.payload.origin : null;
      state.runStateTarget = null;
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
      if (action.payload.clearTraitDialogTarget) {
        state.traitDialogTarget = null;
      }
      if (action.payload.clearLevelResolutionDialogTarget) {
        state.levelResolutionDialogTarget = null;
      }
      if (action.payload.clearRunStateTarget) state.runStateTarget = null;
    },
    traitOfferDialogOpened(state, action: PayloadAction<TraitOfferAddress>) {
      state.traitDialogTarget = action.payload;
      // An explicit launcher visit always starts at the outer offer. Findings
      // retain their exact child owner through `findingSelected` instead.
      state.focusedSemanticOwner = action.payload;
    },
    traitOfferDialogClosed(state) {
      state.traitDialogTarget = null;
    },
    levelResolutionDialogOpened(state, action: PayloadAction<LevelResolutionAddress>) {
      state.levelResolutionDialogTarget = action.payload;
    },
    levelResolutionDialogClosed(state) {
      state.levelResolutionDialogTarget = null;
    },
    runStateOpened(state, action: PayloadAction<ExitDecisionAddress | HubDecisionAddress>) {
      state.runStateTarget = action.payload;
    },
    runStateClosed(state) {
      state.runStateTarget = null;
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
  traitOfferDialogClosed,
  traitOfferDialogOpened,
  levelResolutionDialogClosed,
  levelResolutionDialogOpened,
  runStateClosed,
  runStateOpened,
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
