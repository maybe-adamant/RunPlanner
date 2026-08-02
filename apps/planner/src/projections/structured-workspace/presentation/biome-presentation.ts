import type { OccurrenceId } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

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
  type WorkspaceRailReward,
  type WorkspaceRailSelectedTarget,
  type WorkspaceRoomSummary,
  type WorkspaceTakeoverBatchNode,
} from '../contract';
import { bindWorkspaceInspectorDestinations } from '../navigation/inspector-destinations';
import { defaultInspectorDestination } from '../navigation/inspector-defaults';
import { workspaceDecisionOwnedMarkers } from '../navigation/marker-ownership';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';
import type { WorkspaceBiomeSemanticAssembly } from '../assembly/biome-semantic-assembly';

/** Final biome products derived from completed semantics and immutable catalog display metadata. */
export interface WorkspaceBiomePresentation {
  readonly biome: WorkspaceBiome;
  readonly focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
}

function railMarkerForNode(node: WorkspaceNode): WorkspaceMarker {
  return node.kind === 'occurrenceWorkbench' ? (node.railMarker ?? node.marker) : node.marker;
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
): { readonly label: string } {
  switch (node.kind) {
    case 'occurrenceWorkbench': {
      const entryLabel = isEntry && node.room.kind === 'Opening' ? 'Opening' : node.room.label;
      return { label: entryLabel };
    }
    case 'linkedExit':
      return { label: node.target.room.label };
    case 'ordinaryBatch':
    case 'mixedBatch':
      return { label: `Decision ${decisionIndex ?? 1}` };
    case 'takeoverBatch':
      return { label: 'Preboss' };
    case 'completion':
      return { label: node.label };
    case 'hubDecision':
      return { label: 'Hub' };
  }
}

/**
 * The rail describes an authored target even when evaluation has not reached
 * it. Only direct one-reward room surfaces opt into the compact reward token;
 * other room-local products retain their selected-room context without an
 * ambiguous rail summary.
 */
function railRewardForRoom(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
): WorkspaceRailReward | undefined {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return Object.freeze({
        label: room.roomLocal.summary,
        offer: room.roomLocal.offer,
      });
    case 'incomingReward':
      if (room.roomLocal.clockworkReward === 'goal') return undefined;
      return Object.freeze({
        label: summarizeRewardOffer(catalog, room.roomLocal.control.offer),
        offer: room.roomLocal.control.offer,
      });
    case 'none':
    case 'ephyra':
    case 'fields':
    case 'ship':
    case 'shop':
      return undefined;
  }
}

function selectedTargetRailPresentation(
  catalog: Catalog,
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode,
): WorkspaceRailSelectedTarget | undefined {
  const selectedTargets = node.targets.filter((target) => target.selected);
  if (selectedTargets.length !== 1) return undefined;
  const [target] = selectedTargets;
  if (target === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${node.key} has no selected target after cardinality check`,
    );
  }
  const reward = railRewardForRoom(catalog, target.room);
  return Object.freeze({
    ...(reward === undefined ? {} : { reward }),
    roomLabel: target.room.label,
  });
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
 * destination products. It uses the immutable catalog only for resolved reward
 * display labels; it never reads source indexes or bound interactions.
 */
export function presentWorkspaceBiome(
  catalog: Catalog,
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
    if (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') {
      decisionIndex += 1;
      const presentation = nodeRailPresentation(node, decisionIndex, node.key === entry?.key);
      const selectedTarget = selectedTargetRailPresentation(catalog, node);
      return Object.freeze({
        kind: 'node' as const,
        key: node.key,
        label: presentation.label,
        marker: decisionRailMarker(node),
        node,
        ...(selectedTarget === undefined ? {} : { selectedTarget }),
      });
    }
    const presentation = nodeRailPresentation(node, undefined, node.key === entry?.key);
    return Object.freeze({
      kind: 'node' as const,
      key: node.key,
      label: presentation.label,
      marker: node.kind === 'takeoverBatch' ? decisionRailMarker(node) : railMarkerForNode(node),
      node,
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
    owner: semantic.biome,
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
