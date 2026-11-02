import { semanticAddressKey } from '@run-planner/engine/authored-project';

import type { WorkspaceAuthoringFrontier } from '../contracts/structure';
import type { WorkspaceNode, WorkspaceOccurrenceWorkbenchNode } from '../contracts/structure';
import type { WorkspaceInspectorSubject } from '../contracts/navigation';

/** The completed products needed to select a no-focus inspector subject. */
export interface WorkspaceInspectorDefaultsInput {
  readonly entry?: WorkspaceOccurrenceWorkbenchNode;
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly nodes: readonly WorkspaceNode[];
}

type WorkspaceDecisionNode = Extract<
  WorkspaceNode,
  { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
>;

function isDecisionNode(node: WorkspaceNode): node is WorkspaceDecisionNode {
  return (
    node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
  );
}

function nodeSubject(node: WorkspaceNode): WorkspaceInspectorSubject {
  return Object.freeze({ kind: 'node' as const, nodeKey: node.key });
}

function frontierSubject(
  frontier: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'start' | 'exitDecision' }>,
): WorkspaceInspectorSubject {
  return Object.freeze({ frontierFocusKey: frontier.marker.focusKey, kind: 'frontier' as const });
}

function hubNode(input: WorkspaceInspectorDefaultsInput): WorkspaceNode | undefined {
  return input.nodes.find((node) => node.kind === 'hubDecision');
}

function incompleteDecision(
  input: WorkspaceInspectorDefaultsInput,
): WorkspaceDecisionNode | undefined {
  return input.nodes
    .filter(
      (node): node is WorkspaceDecisionNode =>
        isDecisionNode(node) &&
        node.source.kind !== 'hubDecision' &&
        (node.topologyState === 'partial' ||
          node.missingTargets.length > 0 ||
          (node.targets.length > 0 && !node.targets.some((target) => target.selected))),
    )
    .at(-1);
}

/**
 * Preserve the former default-inspector priority as one projection-owned
 * presentation product. It reads only final workspace products, never raw
 * authored topology, catalog, evaluation, candidate, or UI-session state.
 */
export function defaultInspectorDestination(
  input: WorkspaceInspectorDefaultsInput,
): WorkspaceInspectorSubject | null {
  const { frontier, nodes } = input;
  if (frontier?.kind === 'start' || frontier?.kind === 'exitDecision') {
    if (frontier.kind === 'exitDecision') {
      const matchingDecision = nodes.find(
        (node): node is WorkspaceDecisionNode =>
          isDecisionNode(node) &&
          node.source.kind !== 'hubDecision' &&
          semanticAddressKey(node.owner) === semanticAddressKey(frontier.owner),
      );
      if (matchingDecision !== undefined) return nodeSubject(matchingDecision);
      if (frontier.owner.source.kind === 'hubDecision') {
        const hub = hubNode(input);
        if (hub !== undefined) return nodeSubject(hub);
      }
    }
    return frontierSubject(frontier);
  }
  if (frontier?.kind === 'hubVisit' || frontier?.kind === 'hubOpenSet') {
    const hub = hubNode(input);
    if (hub !== undefined) return nodeSubject(hub);
  }
  const incomplete = incompleteDecision(input);
  if (incomplete !== undefined) return nodeSubject(incomplete);
  const activeDetails = nodes
    .filter(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.detailsActive,
    )
    .at(-1);
  if (activeDetails !== undefined) {
    if (activeDetails.completedHubExitStage === true) {
      return nodeSubject(activeDetails);
    }
    const containingDecision = nodes.find(
      (node): node is WorkspaceDecisionNode =>
        isDecisionNode(node) &&
        node.targets.some((target) => target.room.occurrenceId === activeDetails.room.occurrenceId),
    );
    if (containingDecision !== undefined) return nodeSubject(containingDecision);
    const containingHub = nodes.find(
      (node) =>
        node.kind === 'hubDecision' &&
        node.slots.some((slot) => slot.room?.occurrenceId === activeDetails.room.occurrenceId),
    );
    if (containingHub !== undefined) return nodeSubject(containingHub);
    return nodeSubject(activeDetails);
  }
  if (input.entry !== undefined) return nodeSubject(input.entry);
  const first = nodes[0];
  return first === undefined ? null : nodeSubject(first);
}
