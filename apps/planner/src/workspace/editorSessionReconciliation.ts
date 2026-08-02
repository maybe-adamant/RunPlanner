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

  if (!clearFocusedSemanticOwner && !clearSelectedFinding) {
    return null;
  }
  return Object.freeze({
    clearFocusedSemanticOwner,
    clearSelectedFinding,
  });
}

export function createEditorSessionReconciliationCoordinator(options: {
  readonly store: PlannerStore;
  readonly structuredWorkspace: StructuredWorkspaceProjectionService;
}): EditorSessionReconciliationCoordinator {
  let observedAssembly = options.store.getState().projectWorkspace.assembly;
  const unsubscribe = options.store.subscribe(() => {
    const state = options.store.getState();
    const assembly = state.projectWorkspace.assembly;
    if (assembly === observedAssembly) return;
    observedAssembly = assembly;

    if (
      state.editorSession.focusedSemanticOwner === null &&
      state.editorSession.selectedFinding === null
    ) {
      return;
    }

    const workspace = options.structuredWorkspace.project(assembly);
    const reconciliation = deriveEditorSessionReconciliation({
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
