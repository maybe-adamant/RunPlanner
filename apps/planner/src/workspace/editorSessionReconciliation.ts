import { semanticAddressKey } from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';

import { semanticFindingKey } from '../projections/evaluationProjection';
import type {
  StructuredWorkspaceProjection,
  StructuredWorkspaceProjectionService,
} from '../projections/structured-workspace';
import {
  editorSessionReconciled,
  type EditorSessionReconciliation,
  type EditorSessionState,
  type FindingSelection,
} from '../state/editorSessionSlice';
import type { PlannerStore } from '../state/store';

export interface EditorSessionReconciliationCoordinator {
  dispose(): void;
}

export interface EditorSessionReconciliationInput {
  readonly findings: readonly SemanticFinding[];
  readonly focusByOwner: StructuredWorkspaceProjection['focusByOwner'];
  readonly session: EditorSessionState;
  readonly availableRunStateOwnerKeys?: ReadonlySet<string>;
}

function hasExactDestination(
  focusByOwner: StructuredWorkspaceProjection['focusByOwner'],
  ownerKey: string,
): boolean {
  const destination = focusByOwner.get(ownerKey);
  return destination !== undefined && semanticAddressKey(destination.ownerAddress) === ownerKey;
}

function selectedFindingStillExists(
  selection: FindingSelection,
  findings: readonly SemanticFinding[],
): boolean {
  const originKey = semanticAddressKey(selection.origin);
  return findings.some(
    (finding) =>
      semanticFindingKey(finding) === selection.key &&
      semanticAddressKey(finding.origin) === originKey,
  );
}

/**
 * Keeps transient navigation truthful to one newly published workspace. It
 * deliberately neither chooses a replacement owner nor changes route/panel
 * state: those remain user navigation decisions.
 */
export function deriveEditorSessionReconciliation(
  input: EditorSessionReconciliationInput,
): EditorSessionReconciliation | null {
  const { focusByOwner, findings, session } = input;
  const selectedFinding = session.selectedFinding;
  const selectedFindingSurvives =
    selectedFinding !== null && selectedFindingStillExists(selectedFinding, findings);
  if (selectedFindingSurvives && selectedFinding !== null) {
    const ownerKey = semanticAddressKey(selectedFinding.origin);
    if (!hasExactDestination(focusByOwner, ownerKey)) {
      throw new Error(
        `Selected finding ${selectedFinding.key} at ${ownerKey} has no exact workspace destination`,
      );
    }
  }
  const focusedSemanticOwner = session.focusedSemanticOwner;
  const clearFocusedSemanticOwner =
    focusedSemanticOwner !== null &&
    !hasExactDestination(focusByOwner, semanticAddressKey(focusedSemanticOwner));
  const clearSelectedFinding = selectedFinding !== null && !selectedFindingSurvives;
  const traitDialogTarget = session.traitDialogTarget ?? null;
  const clearTraitDialogTarget =
    traitDialogTarget !== null &&
    !hasExactDestination(focusByOwner, semanticAddressKey(traitDialogTarget));
  const levelResolutionDialogTarget = session.levelResolutionDialogTarget ?? null;
  const clearLevelResolutionDialogTarget =
    levelResolutionDialogTarget !== null &&
    !hasExactDestination(focusByOwner, semanticAddressKey(levelResolutionDialogTarget));
  const runStateTarget = session.runStateTarget ?? null;
  const clearRunStateTarget =
    runStateTarget !== null &&
    input.availableRunStateOwnerKeys !== undefined &&
    !input.availableRunStateOwnerKeys.has(semanticAddressKey(runStateTarget));

  if (
    !clearFocusedSemanticOwner &&
    !clearSelectedFinding &&
    !clearTraitDialogTarget &&
    !clearLevelResolutionDialogTarget &&
    !clearRunStateTarget
  ) {
    return null;
  }
  return Object.freeze({
    clearFocusedSemanticOwner,
    clearSelectedFinding,
    ...(traitDialogTarget === null ? {} : { clearTraitDialogTarget }),
    ...(levelResolutionDialogTarget === null ? {} : { clearLevelResolutionDialogTarget }),
    ...(runStateTarget === null ? {} : { clearRunStateTarget }),
  });
}

export function createEditorSessionReconciliationCoordinator(options: {
  readonly store: PlannerStore;
  readonly structuredWorkspace: StructuredWorkspaceProjectionService;
}): EditorSessionReconciliationCoordinator {
  const initialWorkspace = options.store.getState().projectWorkspace;
  let observedAssembly =
    initialWorkspace.kind === 'openProject' ? initialWorkspace.assembly : undefined;
  const unsubscribe = options.store.subscribe(() => {
    const state = options.store.getState();
    const assembly =
      state.projectWorkspace.kind === 'openProject' ? state.projectWorkspace.assembly : undefined;
    if (assembly === observedAssembly) return;
    observedAssembly = assembly;

    if (assembly === undefined) return;

    if (
      state.editorSession.focusedSemanticOwner === null &&
      state.editorSession.selectedFinding === null &&
      (state.editorSession.traitDialogTarget ?? null) === null &&
      (state.editorSession.levelResolutionDialogTarget ?? null) === null &&
      (state.editorSession.runStateTarget ?? null) === null
    ) {
      return;
    }

    const workspace = options.structuredWorkspace.project(assembly);
    const availableRunStateOwnerKeys = new Set(
      [...workspace.runStateLaunchers].flatMap(([key, launcher]) =>
        launcher.availability === 'available' ? [key] : [],
      ),
    );
    const reconciliation = deriveEditorSessionReconciliation({
      availableRunStateOwnerKeys,
      findings: assembly.evaluation.findings,
      focusByOwner: workspace.focusByOwner,
      session: state.editorSession,
    });
    if (reconciliation !== null) {
      options.store.dispatch(editorSessionReconciled(reconciliation));
    }
  });

  return Object.freeze({
    dispose(): void {
      unsubscribe();
    },
  });
}
