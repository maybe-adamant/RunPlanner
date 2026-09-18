import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { AssessmentIssue, SemanticFinding } from '@run-planner/engine/simulation';
import type { WorkspaceInspectorDestination } from '@planner/projections/structured-workspace';
import type { EditorSessionState, FindingSelection } from '@planner/state/editorSessionSlice';
import { describe, expect, it } from 'vitest';

import { deriveEditorSessionReconciliation } from '@planner/workspace/editorSessionReconciliation';

const owner = createBiomeAddress('Underworld', 'F');
const otherOwner = createBiomeAddress('Surface', 'N');

function finding(origin: SemanticAddress): SemanticFinding {
  return Object.freeze({
    code: 'biomeTopologyMissing',
    evidence: Object.freeze({}),
    origin,
    phase: 'completeness',
    severity: 'error',
  });
}

function issue(owner: SemanticAddress, reason = finding(owner)): AssessmentIssue {
  return Object.freeze({
    kind: 'incomplete',
    owner,
    regionKey: `region:${semanticAddressKey(owner)}`,
    reasons: Object.freeze([reason]),
  });
}

function destination(ownerAddress: SemanticAddress): WorkspaceInspectorDestination {
  const focusKey = semanticAddressKey(ownerAddress);
  return Object.freeze({
    focusAddress: ownerAddress,
    focusKey,
    nodeKey: focusKey,
    ownerAddress,
    region: 'structure',
  });
}

function destinations(
  ...owners: readonly SemanticAddress[]
): ReadonlyMap<string, WorkspaceInspectorDestination> {
  return new Map(owners.map((address) => [semanticAddressKey(address), destination(address)]));
}

function session(options: {
  readonly focusedSemanticOwner?: SemanticAddress | null;
  readonly levelResolutionDialogTarget?: EditorSessionState['levelResolutionDialogTarget'];
  readonly selectedFinding?: FindingSelection | null;
  readonly runStateTarget?: EditorSessionState['runStateTarget'];
}): EditorSessionState {
  return {
    activeSection: 'route',
    activePanel: { kind: 'biome', biomeKey: 'F' },
    semanticNavigationRevision: 1,
    focusedSemanticOwner: options.focusedSemanticOwner ?? null,
    selectedFinding: options.selectedFinding ?? null,
    ...(options.levelResolutionDialogTarget === undefined
      ? {}
      : { levelResolutionDialogTarget: options.levelResolutionDialogTarget }),
    ...(options.runStateTarget === undefined ? {} : { runStateTarget: options.runStateTarget }),
  };
}

describe('editor-session reconciliation', () => {
  it('clears a Pom dialog target when its exact reached owner disappears', () => {
    const target = createLevelResolutionAddress(
      createIncomingRewardAddress(owner, createOccurrenceId('stale-pom')),
      'selected',
    );
    expect(
      deriveEditorSessionReconciliation({
        issue: undefined,
        focusByOwner: destinations(),
        session: session({ levelResolutionDialogTarget: target }),
      }),
    ).toEqual({
      clearFocusedSemanticOwner: false,
      clearLevelResolutionDialogTarget: true,
      clearSelectedFinding: false,
    });
  });

  it('clears a stale Run State target when its exact published launcher disappears', () => {
    const target = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(owner, createOccurrenceId('stale-run-state')),
      { kind: 'roomEntered' },
    );
    expect(
      deriveEditorSessionReconciliation({
        availableRunStateOwnerKeys: new Set(),
        issue: undefined,
        focusByOwner: destinations(),
        session: session({ runStateTarget: target }),
      }),
    ).toEqual({
      clearFocusedSemanticOwner: false,
      clearRunStateTarget: true,
      clearSelectedFinding: false,
    });
  });
  it('retains independently live focus and finding references', () => {
    const selected = finding(owner);
    const selectedIssue = issue(owner, selected);

    expect(
      deriveEditorSessionReconciliation({
        issue: selectedIssue,
        focusByOwner: destinations(owner),
        session: session({
          focusedSemanticOwner: owner,
          selectedFinding: { key: selectedIssue.regionKey, origin: owner },
        }),
      }),
    ).toBeNull();
  });

  it('clears a deleted finding while retaining its still-routable focus', () => {
    expect(
      deriveEditorSessionReconciliation({
        issue: undefined,
        focusByOwner: destinations(owner),
        session: session({
          focusedSemanticOwner: owner,
          selectedFinding: { key: 'removed-finding', origin: owner },
        }),
      }),
    ).toEqual({ clearFocusedSemanticOwner: false, clearSelectedFinding: true });
  });

  it('clears a replaced issue selection without moving independently live focus', () => {
    const previousIssue = issue(owner);
    const nextIssue = issue(otherOwner);

    expect(
      deriveEditorSessionReconciliation({
        issue: nextIssue,
        focusByOwner: destinations(owner, otherOwner),
        session: session({
          focusedSemanticOwner: owner,
          selectedFinding: { key: previousIssue.regionKey, origin: owner },
        }),
      }),
    ).toEqual({ clearFocusedSemanticOwner: false, clearSelectedFinding: true });
  });

  it('clears a removed focus independently from a surviving selected finding', () => {
    const selected = finding(owner);
    const selectedIssue = issue(owner, selected);

    expect(
      deriveEditorSessionReconciliation({
        issue: selectedIssue,
        focusByOwner: destinations(owner),
        session: session({
          focusedSemanticOwner: otherOwner,
          selectedFinding: { key: selectedIssue.regionKey, origin: owner },
        }),
      }),
    ).toEqual({ clearFocusedSemanticOwner: true, clearSelectedFinding: false });
  });

  it('clears both references after their selected owner disappears', () => {
    expect(
      deriveEditorSessionReconciliation({
        issue: undefined,
        focusByOwner: destinations(),
        session: session({
          focusedSemanticOwner: owner,
          selectedFinding: { key: 'region:removed', origin: owner },
        }),
      }),
    ).toEqual({ clearFocusedSemanticOwner: true, clearSelectedFinding: true });
  });

  it('rejects a live selected finding without its exact workspace destination', () => {
    const selected = finding(owner);
    const selectedIssue = issue(owner, selected);
    const misrouted = new Map([[semanticAddressKey(owner), destination(otherOwner)]]);

    expect(() =>
      deriveEditorSessionReconciliation({
        issue: selectedIssue,
        focusByOwner: misrouted,
        session: session({ selectedFinding: { key: selectedIssue.regionKey, origin: owner } }),
      }),
    ).toThrow(/has no exact workspace destination/);
  });
});
