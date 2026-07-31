import { semanticAddressKey } from '@run-planner/engine/authored-project';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceAuthoringFrontier,
  type WorkspaceDefaultInspectorDestination,
  type WorkspaceNode,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceRailEntry,
} from './contract';

/** The completed products needed to select a no-focus inspector subject. */
export interface WorkspaceInspectorDefaultsInput {
  readonly entry?: WorkspaceOccurrenceWorkbenchNode;
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly nodes: readonly WorkspaceNode[];
  readonly rail: readonly WorkspaceRailEntry[];
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

function selectedRailKeyForNode(
  rail: readonly WorkspaceRailEntry[],
  nodeKey: string,
): string | undefined {
  for (const entry of rail) {
    switch (entry.kind) {
      case 'frontier':
        break;
      case 'node':
        if (entry.node.key === nodeKey) return entry.marker.focusKey;
        break;
      case 'hubGroup': {
        if (entry.node.key === nodeKey) return entry.marker.focusKey;
        const visit = entry.visits.find((candidate) => candidate.node.key === nodeKey);
        if (visit !== undefined) return visit.marker.focusKey;
        break;
      }
    }
  }
  return undefined;
}

function nodeDestination(
  input: WorkspaceInspectorDefaultsInput,
  node: WorkspaceNode,
): WorkspaceDefaultInspectorDestination {
  const selectedRailKey = selectedRailKeyForNode(input.rail, node.key);
  return Object.freeze({
    kind: 'node' as const,
    nodeKey: node.key,
    ...(selectedRailKey === undefined ? {} : { selectedRailKey }),
  });
}

function frontierDestination(
  frontier: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'start' | 'exitDecision' }>,
): WorkspaceDefaultInspectorDestination {
  return Object.freeze({
    frontierFocusKey: frontier.marker.focusKey,
    kind: 'frontier' as const,
    selectedRailKey: frontier.marker.focusKey,
  });
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
): WorkspaceDefaultInspectorDestination | null {
  const { frontier, nodes } = input;
  if (frontier?.kind === 'start' || frontier?.kind === 'exitDecision') {
    if (frontier.kind === 'exitDecision') {
      const matchingDecision = nodes.find(
        (node): node is WorkspaceDecisionNode =>
          isDecisionNode(node) &&
          node.source.kind !== 'hubDecision' &&
          semanticAddressKey(node.owner) === semanticAddressKey(frontier.owner),
      );
      if (matchingDecision !== undefined) return nodeDestination(input, matchingDecision);
      if (frontier.owner.source.kind === 'hubDecision') {
        const hub = hubNode(input);
        if (hub !== undefined) return nodeDestination(input, hub);
      }
    }
    return frontierDestination(frontier);
  }
  if (
    frontier?.kind === 'hubDecision' ||
    frontier?.kind === 'hubVisit' ||
    frontier?.kind === 'hubOpenSet'
  ) {
    const hub = hubNode(input);
    if (hub !== undefined) return nodeDestination(input, hub);
  }
  const incomplete = incompleteDecision(input);
  if (incomplete !== undefined) return nodeDestination(input, incomplete);
  const activeDetails = nodes
    .filter(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.detailsActive,
    )
    .at(-1);
  if (activeDetails !== undefined) {
    if (activeDetails.sourceDecisionRemoval !== undefined) {
      return nodeDestination(input, activeDetails);
    }
    const containingDecision = nodes.find(
      (node): node is WorkspaceDecisionNode =>
        isDecisionNode(node) &&
        node.targets.some((target) => target.room.occurrenceId === activeDetails.room.occurrenceId),
    );
    if (containingDecision !== undefined) return nodeDestination(input, containingDecision);
    const containingHub = nodes.find(
      (node) =>
        node.kind === 'hubDecision' &&
        node.slots.some((slot) => slot.room?.occurrenceId === activeDetails.room.occurrenceId),
    );
    if (containingHub !== undefined) return nodeDestination(input, containingHub);
    return nodeDestination(input, activeDetails);
  }
  if (input.entry !== undefined) return nodeDestination(input, input.entry);
  const first = nodes[0];
  return first === undefined ? null : nodeDestination(input, first);
}

function railMarkerCount(rail: readonly WorkspaceRailEntry[], focusKey: string): number {
  let count = 0;
  for (const entry of rail) {
    switch (entry.kind) {
      case 'frontier':
      case 'node':
        if (entry.marker.focusKey === focusKey) count += 1;
        break;
      case 'hubGroup':
        if (entry.marker.focusKey === focusKey) count += 1;
        count += entry.visits.filter((visit) => visit.marker.focusKey === focusKey).length;
        break;
    }
  }
  return count;
}

/** Structural closure for the returned default; policy is covered by the fixture matrix. */
export function assertWorkspaceDefaultInspectorDestinationClosure(
  input: WorkspaceInspectorDefaultsInput,
  destination: WorkspaceDefaultInspectorDestination | null,
): void {
  if (destination === null) {
    if (input.frontier !== null || input.entry !== undefined || input.nodes.length > 0) {
      throw new StructuredWorkspaceProjectionContractError(
        'Workspace default inspector is null despite a renderable subject.',
      );
    }
    return;
  }
  switch (destination.kind) {
    case 'frontier': {
      const frontier = input.frontier;
      if (
        (frontier?.kind !== 'start' && frontier?.kind !== 'exitDecision') ||
        frontier.marker.focusKey !== destination.frontierFocusKey ||
        destination.selectedRailKey !== frontier.marker.focusKey
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          'Workspace default frontier does not match the active authoring frontier.',
        );
      }
      if (railMarkerCount(input.rail, destination.selectedRailKey) === 0) {
        throw new StructuredWorkspaceProjectionContractError(
          'Workspace default frontier has no selected rail marker.',
        );
      }
      return;
    }
    case 'node': {
      const matches = input.nodes.filter((node) => node.key === destination.nodeKey);
      if (matches.length !== 1) {
        throw new StructuredWorkspaceProjectionContractError(
          `${destination.nodeKey} default inspector node resolves to ${matches.length} nodes.`,
        );
      }
      const expectedRailKey = selectedRailKeyForNode(input.rail, destination.nodeKey);
      if (destination.selectedRailKey !== expectedRailKey) {
        throw new StructuredWorkspaceProjectionContractError(
          `${destination.nodeKey} default inspector rail selection disagrees with workspace rail.`,
        );
      }
      if (
        destination.selectedRailKey !== undefined &&
        railMarkerCount(input.rail, destination.selectedRailKey) === 0
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${destination.nodeKey} default inspector rail selection is not rendered.`,
        );
      }
      return;
    }
  }
}
