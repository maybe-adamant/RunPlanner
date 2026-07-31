import type { OccurrenceId } from '@run-planner/engine/authored-project';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceBiome,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubRailEntry,
  type WorkspaceHubVisitRailEntry,
  type WorkspaceInspectorDestination,
  type WorkspaceMarker,
  type WorkspaceMixedBatchNode,
  type WorkspaceNode,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceRailEntry,
  type WorkspaceTakeoverBatchNode,
} from './contract';
import { bindWorkspaceInspectorDestinations } from './inspector-destinations';
import { defaultInspectorDestination } from './inspector-defaults';
import { workspaceDecisionOwnedMarkers } from './marker-ownership';
import type { WorkspaceBiomeSemanticAssembly } from './biome-semantic-assembly';

/** Final biome products derived only from one completed semantic assembly. */
export interface WorkspaceBiomePresentation {
  readonly biome: WorkspaceBiome;
  readonly focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
}

function railMarkerForNode(node: WorkspaceNode): WorkspaceMarker {
  return node.kind === 'occurrenceWorkbench' ? (node.railMarker ?? node.marker) : node.marker;
}

function pickedTargetSummary(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): string | undefined {
  const picked = node.targets.find((target) => target.selected);
  if (picked === undefined) return undefined;
  return picked.room.rewardSummary === undefined
    ? picked.room.label
    : `${picked.room.label} · ${picked.room.rewardSummary}`;
}

function decisionRailMarker(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): WorkspaceMarker {
  const markers = new Map<string, WorkspaceMarker>();
  for (const value of workspaceDecisionOwnedMarkers(node)) markers.set(value.focusKey, value);
  const findingCount = [...markers.values()].reduce(
    (total, marker) => total + marker.findingCount,
    0,
  );
  return findingCount === node.marker.findingCount
    ? node.marker
    : Object.freeze({ ...node.marker, findingCount });
}

function nodeRailPresentation(
  node: WorkspaceNode,
  decisionIndex: number | undefined,
  isEntry = false,
): { readonly label: string; readonly summary?: string } {
  switch (node.kind) {
    case 'occurrenceWorkbench': {
      const entryLabel = isEntry && node.room.kind === 'Opening' ? 'Opening' : node.room.label;
      const rewardSummary =
        entryLabel === node.room.label
          ? node.room.rewardSummary
          : node.room.rewardSummary === undefined
            ? node.room.label
            : `${node.room.label} · ${node.room.rewardSummary}`;
      return {
        label: entryLabel,
        ...(rewardSummary === undefined ? {} : { summary: rewardSummary }),
      };
    }
    case 'linkedExit':
      return {
        label: node.target.room.label,
        ...(node.target.room.rewardSummary === undefined
          ? {}
          : { summary: node.target.room.rewardSummary }),
      };
    case 'ordinaryBatch':
    case 'mixedBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: `Decision ${decisionIndex ?? 1}`,
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'takeoverBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: 'Preboss',
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'completion':
      return { label: node.label };
    case 'hubDecision':
      return { label: 'Hub' };
  }
}

/**
 * The rail needs the visit's room-local workbench identity, while the Hub
 * board retains its distinct visit-order owner. Publishing both avoids making
 * React join visits to occurrences or infer which Hub rooms are shown.
 */
function projectHubRailEntry(
  node: WorkspaceHubDecisionNode,
  structuralNodes: readonly WorkspaceNode[],
): WorkspaceHubRailEntry {
  const workbenchesByOccurrenceId = new Map(
    structuralNodes
      .filter(
        (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
          candidate.kind === 'occurrenceWorkbench',
      )
      .map((workbench) => [workbench.room.occurrenceId, workbench] as const),
  );
  const visits: WorkspaceHubVisitRailEntry[] = [];
  for (const visit of node.visits) {
    if (visit.authoring !== 'authored') continue;
    if (visit.room === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} has no authored room workbench`,
      );
    }
    const workbench = workbenchesByOccurrenceId.get(visit.room.occurrenceId);
    if (workbench === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} room ${visit.room.occurrenceId} is not projected`,
      );
    }
    if (workbench.inspectorPresentation !== 'hubRoomLocal') {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} must use a room-local workbench presentation`,
      );
    }
    visits.push(
      Object.freeze({
        key: `${node.key}:visit:${visit.visitIndex}`,
        label: `Visit ${visit.visitIndex} · ${visit.room.label}`,
        marker: workbench.room.marker,
        node: workbench,
        visitIndex: visit.visitIndex,
        visitMarker: visit.marker,
      }),
    );
  }
  return Object.freeze({
    kind: 'hubGroup' as const,
    key: node.key,
    marker: node.marker,
    node,
    visits: Object.freeze(visits),
  });
}

/**
 * A fixed N transition remains inspectable, but once its target room exists
 * the room is the player-facing rail stage. The source command and finding
 * destination remain in the exhaustive semantic node product.
 */
function isHubRailScaffoldWithRenderedTarget(
  node: WorkspaceNode,
  renderedOccurrenceIds: ReadonlySet<OccurrenceId>,
): boolean {
  if (node.kind === 'linkedExit') {
    return renderedOccurrenceIds.has(node.target.room.occurrenceId);
  }
  if (
    node.kind !== 'ordinaryBatch' &&
    node.kind !== 'mixedBatch' &&
    node.kind !== 'takeoverBatch'
  ) {
    return false;
  }
  return (
    node.owner.source.kind === 'hubDecision' &&
    node.targets.some((target) => renderedOccurrenceIds.has(target.room.occurrenceId))
  );
}

/**
 * Transforms complete biome semantics into rail, default-inspector, and exact
 * destination products. It neither reads source indexes nor bound interactions.
 */
export function presentWorkspaceBiome(
  semantic: WorkspaceBiomeSemanticAssembly,
): WorkspaceBiomePresentation {
  const { entry, frontier, structuralNodes } = semantic;
  const renderedOccurrenceIds = new Set(
    structuralNodes
      .filter(
        (node): node is WorkspaceOccurrenceWorkbenchNode => node.kind === 'occurrenceWorkbench',
      )
      .map((node) => node.room.occurrenceId),
  );
  const railNodes = structuralNodes
    .filter((node) => {
      if (node.kind !== 'occurrenceWorkbench') return true;
      if (node.railVisibility === 'inspectorOnly') return false;
      // Ordinary room offers belong inside their owning decision workbench.
      // N's fixed Opening, PreHub, and Preboss occurrences remain structural
      // stages, while an ordinary biome keeps only its authored entry.
      return semantic.progressionKind === 'hub' || node.key === entry?.key;
    })
    .filter(
      (node) =>
        semantic.progressionKind !== 'hub' ||
        !isHubRailScaffoldWithRenderedTarget(node, renderedOccurrenceIds),
    );
  // The N board is declaration-owned outline structure until the fixed
  // Opening -> PreHub path has reached it. Keep that read-only preview after
  // the active entry frontier; otherwise it would claim a position in the
  // rail before the action that makes it reachable. Persisted Hub decisions
  // and retained authored structure stay in their topology order.
  const hubOutlines = railNodes.filter(
    (node): node is WorkspaceHubDecisionNode =>
      node.kind === 'hubDecision' && node.authoring === 'outline',
  );
  const reachableRailNodes = railNodes.filter(
    (node) => !(node.kind === 'hubDecision' && node.authoring === 'outline'),
  );
  const railFrontier =
    frontier?.kind === 'start' ||
    (frontier?.kind === 'exitDecision' && frontier.owner.source.kind !== 'hubDecision')
      ? frontier
      : undefined;
  let decisionIndex = 0;
  const railEntryForNode = (node: WorkspaceNode): WorkspaceRailEntry => {
    if (node.kind === 'hubDecision') return projectHubRailEntry(node, structuralNodes);
    if (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') decisionIndex += 1;
    const presentation = nodeRailPresentation(
      node,
      node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' ? decisionIndex : undefined,
      node.key === entry?.key,
    );
    return Object.freeze({
      kind: 'node' as const,
      key: node.key,
      label: presentation.label,
      marker:
        node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
          ? decisionRailMarker(node)
          : railMarkerForNode(node),
      node,
      ...(presentation.summary === undefined ? {} : { summary: presentation.summary }),
    });
  };
  const rail = Object.freeze([
    ...reachableRailNodes.map(railEntryForNode),
    ...(railFrontier === undefined
      ? []
      : [
          Object.freeze({
            kind: 'frontier' as const,
            frontier: railFrontier,
            key: `frontier:${railFrontier.marker.focusKey}`,
            marker: railFrontier.marker,
          }),
        ]),
    ...hubOutlines.map(railEntryForNode),
  ]);
  const inspectorDefaults = Object.freeze({
    ...(entry === undefined ? {} : { entry }),
    frontier,
    nodes: semantic.nodes,
    rail,
  });
  const defaultInspector = defaultInspectorDestination(inspectorDefaults);
  const biome = Object.freeze({
    biomeKey: semantic.biomeKey,
    completion: semantic.completion,
    completionOutline: semantic.completionOutline,
    defaultInspectorDestination: defaultInspector,
    ...(entry === undefined ? {} : { entry }),
    fields: semantic.fields,
    frontier,
    label: semantic.label,
    marker: semantic.marker,
    nodes: semantic.nodes,
    rail,
    source: semantic.source,
    status: semantic.status,
  });
  return Object.freeze({
    biome,
    focusDestinations: bindWorkspaceInspectorDestinations({
      biome,
      destinationsByOwner: semantic.preliminaryFocusDestinations,
    }),
  });
}
