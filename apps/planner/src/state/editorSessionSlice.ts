import { createSlice, type PayloadAction, type Reducer } from '@reduxjs/toolkit';
import type {
  AcquisitionRoleAddress,
  CirceResolutionAddress,
  FigurineArcanaAddress,
  JudgmentArcanaAddress,
  SemanticAddress,
  TraitOfferAddress,
  LevelResolutionAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RunStateOwner } from '@run-planner/engine/simulation';

import { authoredProjectReplaced } from './projectWorkspaceSlice';
import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';

export interface FindingSelection {
  /** Redirected semantic owner used only to focus and scroll its visible marker. */
  readonly focusAddress?: SemanticAddress;
  readonly key: string;
  /** Stable finding owner that remains authoritative for workspace navigation. */
  readonly origin: SemanticAddress;
  /** A projected finding may select Loadout while retaining its structural semantic owner. */
  readonly presentationPanel?: Extract<RoutePanel, { readonly kind: 'overview' }>;
  /** Projection-resolved containing dialog for a fine-grained finding. */
  readonly traitDialogTarget?: TraitOfferAddress | null;
  /** Projection-resolved containing Pom dialog for a fine-grained finding. */
  readonly levelResolutionDialogTarget?: LevelResolutionAddress | null;
}

/** Transient navigation references invalidated by one workspace publication. */
export interface EditorSessionReconciliation {
  readonly clearFocusedSemanticOwner: boolean;
  readonly clearSelectedFinding: boolean;
  readonly clearTraitDialogTarget?: boolean;
  readonly clearLevelResolutionDialogTarget?: boolean;
  readonly clearAnvilDialogTarget?: boolean;
  readonly clearHexActivationDialogTarget?: boolean;
  readonly clearArcanaActivationDialogTarget?: boolean;
  readonly clearCirceDialogTarget?: boolean;
  readonly clearRunStateTarget?: boolean;
}

/** The Boss-seam Arcana draw a Judgment or Crystal Figurine dialog edits. */
export type ArcanaActivationAddress = JudgmentArcanaAddress | FigurineArcanaAddress;

/** A panel selection for the one route in the open project. */
export type RoutePanel =
  | { readonly kind: 'overview' }
  | { readonly kind: 'npcIndex' }
  | { readonly kind: 'traits' }
  | { readonly kind: 'resources' }
  | { readonly kind: 'shrines' }
  | { readonly kind: 'wells' }
  | { readonly kind: 'biome'; readonly biomeKey: string };

export interface RoutePanelSelection {
  readonly routeKey: string;
  readonly panel: RoutePanel;
}

export interface EditorSessionState {
  /** Advances only when an accepted document replaces the workspace, clearing local drafts. */
  readonly workspaceReplacementRevision: number;
  /** Whether the shell is showing the selected route or application settings. */
  readonly activeSection: 'route' | 'settings';
  readonly activePanel: RoutePanel;
  readonly focusedSemanticOwner: SemanticAddress | null;
  readonly selectedFinding: FindingSelection | null;
  /** Exact transient trait dialog target; never part of authored history. */
  readonly traitDialogTarget?: TraitOfferAddress | null;
  /** Exact transient Pom dialog target; never part of authored history. */
  readonly levelResolutionDialogTarget?: LevelResolutionAddress | null;
  /** Exact transient Anvil result dialog target. */
  readonly anvilDialogTarget?: AcquisitionRoleAddress | null;
  /** Exact transient Path of Stars screen dialog target. */
  readonly hexActivationDialogTarget?: AcquisitionRoleAddress | null;
  /** Exact transient Judgment or Crystal Figurine dialog target. */
  readonly arcanaActivationDialogTarget?: ArcanaActivationAddress | null;
  /** The Circe outcome dialog nested in the open trait dialog; it never outlives that dialog. */
  readonly circeDialogTarget?: CirceResolutionAddress | null;
  /** Exact derived checkpoint or generation owner whose read-only Run State sheet is open. */
  readonly runStateTarget?: RunStateOwner | null;
  /** Advances for every explicit semantic navigation, including repeat visits. */
  readonly semanticNavigationRevision: number;
  /** Open dialogs holding an unsaved local draft; history shortcuts wait while any is open. */
  readonly openDraftEditors: number;
}

const routeOverviewPanel: RoutePanel = Object.freeze({ kind: 'overview' });

const emptyState: EditorSessionState = {
  workspaceReplacementRevision: 0,
  activeSection: 'route',
  activePanel: routeOverviewPanel,
  focusedSemanticOwner: null,
  selectedFinding: null,
  semanticNavigationRevision: 0,
  openDraftEditors: 0,
};

function routeKey(origin: SemanticAddress): string | null {
  return origin.kind === 'project' ? null : origin.routeKey;
}

function biomeKey(origin: SemanticAddress): string | null {
  if (origin.kind === 'project' || origin.kind === 'route' || origin.kind === 'startingReward')
    return null;
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

/** Navigation away from the current editing surface closes every dialog. */
function closeDialogs(state: {
  traitDialogTarget?: TraitOfferAddress | null;
  levelResolutionDialogTarget?: LevelResolutionAddress | null;
  anvilDialogTarget?: AcquisitionRoleAddress | null;
  hexActivationDialogTarget?: AcquisitionRoleAddress | null;
  arcanaActivationDialogTarget?: ArcanaActivationAddress | null;
  circeDialogTarget?: CirceResolutionAddress | null;
  runStateTarget?: RunStateOwner | null;
}): void {
  state.traitDialogTarget = null;
  state.levelResolutionDialogTarget = null;
  state.anvilDialogTarget = null;
  state.hexActivationDialogTarget = null;
  state.arcanaActivationDialogTarget = null;
  state.circeDialogTarget = null;
  state.runStateTarget = null;
}

const editorSessionSlice = createSlice({
  name: 'editorSession',
  initialState: emptyState,
  reducers: {
    routeSelected(state, action: PayloadAction<string>) {
      void action;
      // The route key is validated by the reducer wrapper. The open project's
      // route is the only route that can be rendered; this action merely
      // returns the shell to its route section.
      state.activeSection = 'route';
      state.activePanel = routeOverviewPanel;
      state.focusedSemanticOwner = null;
      state.selectedFinding = null;
      closeDialogs(state);
    },
    settingsSelected(state) {
      state.activeSection = 'settings';
      state.focusedSemanticOwner = null;
      state.selectedFinding = null;
      closeDialogs(state);
    },
    routePanelSelected(state, action: PayloadAction<RoutePanelSelection>) {
      state.activeSection = 'route';
      state.activePanel = action.payload.panel;
      state.focusedSemanticOwner = null;
      state.selectedFinding = null;
      closeDialogs(state);
    },
    semanticOwnerFocused(state, action: PayloadAction<SemanticAddress>) {
      state.semanticNavigationRevision += 1;
      state.focusedSemanticOwner = action.payload;
      state.selectedFinding = null;
      closeDialogs(state);
    },
    semanticOwnerNavigated(state, action: PayloadAction<SemanticAddress>) {
      state.focusedSemanticOwner = action.payload;
      state.selectedFinding = null;
      state.semanticNavigationRevision += 1;
      closeDialogs(state);
      state.traitDialogTarget = action.payload.kind === 'traitOffer' ? action.payload : null;
      state.levelResolutionDialogTarget =
        action.payload.kind === 'levelResolution' ? action.payload : null;
      const route = routeKey(action.payload);
      if (route === null) {
        return;
      }
      state.activeSection = 'route';
      state.activePanel = panelForOrigin(action.payload);
    },
    findingSelected(state, action: PayloadAction<FindingSelection>) {
      state.selectedFinding = action.payload;
      const focusAddress = action.payload.focusAddress ?? action.payload.origin;
      state.focusedSemanticOwner = focusAddress;
      state.semanticNavigationRevision += 1;
      closeDialogs(state);
      state.traitDialogTarget =
        action.payload.traitDialogTarget === undefined
          ? action.payload.origin.kind === 'traitOffer'
            ? action.payload.origin
            : null
          : action.payload.traitDialogTarget;
      state.levelResolutionDialogTarget =
        action.payload.levelResolutionDialogTarget === undefined
          ? action.payload.origin.kind === 'levelResolution'
            ? action.payload.origin
            : null
          : action.payload.levelResolutionDialogTarget;
      const route = routeKey(action.payload.origin);
      if (route === null) {
        return;
      }
      state.activeSection = 'route';
      state.activePanel = action.payload.presentationPanel ?? panelForOrigin(action.payload.origin);
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
      if (action.payload.clearAnvilDialogTarget) state.anvilDialogTarget = null;
      if (action.payload.clearHexActivationDialogTarget) state.hexActivationDialogTarget = null;
      if (action.payload.clearArcanaActivationDialogTarget) {
        state.arcanaActivationDialogTarget = null;
      }
      if (action.payload.clearCirceDialogTarget) state.circeDialogTarget = null;
      if (action.payload.clearRunStateTarget) state.runStateTarget = null;
    },
    traitOfferDialogOpened(state, action: PayloadAction<TraitOfferAddress>) {
      state.traitDialogTarget = action.payload;
      state.circeDialogTarget = null;
      state.selectedFinding = null;
      // An explicit launcher visit always starts at the outer offer. Findings
      // retain their exact child owner through `findingSelected` instead.
      state.focusedSemanticOwner = action.payload;
    },
    traitOfferDialogClosed(state) {
      state.traitDialogTarget = null;
      state.circeDialogTarget = null;
    },
    anvilResultDialogOpened(state, action: PayloadAction<AcquisitionRoleAddress>) {
      state.anvilDialogTarget = action.payload;
      state.selectedFinding = null;
    },
    anvilResultDialogClosed(state) {
      state.anvilDialogTarget = null;
    },
    hexActivationDialogOpened(state, action: PayloadAction<AcquisitionRoleAddress>) {
      state.hexActivationDialogTarget = action.payload;
      state.selectedFinding = null;
    },
    hexActivationDialogClosed(state) {
      state.hexActivationDialogTarget = null;
    },
    arcanaActivationDialogOpened(state, action: PayloadAction<ArcanaActivationAddress>) {
      state.arcanaActivationDialogTarget = action.payload;
      state.selectedFinding = null;
    },
    arcanaActivationDialogClosed(state) {
      state.arcanaActivationDialogTarget = null;
    },
    circeResolutionDialogOpened(state, action: PayloadAction<CirceResolutionAddress>) {
      // Circe edits the trait dialog's draft; closing or replacing that dialog closes it.
      state.circeDialogTarget = action.payload;
    },
    circeResolutionDialogClosed(state) {
      state.circeDialogTarget = null;
    },
    levelResolutionDialogOpened(state, action: PayloadAction<LevelResolutionAddress>) {
      state.levelResolutionDialogTarget = action.payload;
      state.selectedFinding = null;
    },
    levelResolutionDialogClosed(state) {
      state.levelResolutionDialogTarget = null;
    },
    runStateOpened(state, action: PayloadAction<RunStateOwner>) {
      state.runStateTarget = action.payload;
    },
    runStateClosed(state) {
      state.runStateTarget = null;
    },
    draftEditorOpened(state) {
      state.openDraftEditors += 1;
    },
    draftEditorClosed(state) {
      state.openDraftEditors = Math.max(0, state.openDraftEditors - 1);
    },
  },
});

export const {
  anvilResultDialogClosed,
  anvilResultDialogOpened,
  arcanaActivationDialogClosed,
  arcanaActivationDialogOpened,
  circeResolutionDialogClosed,
  circeResolutionDialogOpened,
  draftEditorClosed,
  draftEditorOpened,
  editorSessionReconciled,
  hexActivationDialogClosed,
  hexActivationDialogOpened,
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
  if (
    selection.panel.kind === 'biome' &&
    catalog.biomes.byKey[selection.panel.biomeKey] === undefined
  ) {
    throw new Error(`Editor navigation references unknown biome ${selection.panel.biomeKey}`);
  }
}

export function createEditorSessionReducer(catalog: Catalog): Reducer<EditorSessionState> {
  const initialState: EditorSessionState = {
    ...emptyState,
  };

  return (state = initialState, action) => {
    if (
      authoredProjectReplaced.match(action) ||
      newProjectCreated.match(action) ||
      profileLoadSucceeded.match(action)
    ) {
      // A new document owns a new route-local workspace. Preserve the
      // monotonic navigation revision for React focus effects, but do not
      // carry a panel or semantic owner into the replacement route.
      return {
        ...emptyState,
        traitDialogTarget: null,
        levelResolutionDialogTarget: null,
        anvilDialogTarget: null,
        hexActivationDialogTarget: null,
        arcanaActivationDialogTarget: null,
        circeDialogTarget: null,
        runStateTarget: null,
        semanticNavigationRevision: state.semanticNavigationRevision,
        // Mounted draft dialogs unregister themselves when they unmount.
        openDraftEditors: state.openDraftEditors,
        workspaceReplacementRevision: state.workspaceReplacementRevision + 1,
      };
    }
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
