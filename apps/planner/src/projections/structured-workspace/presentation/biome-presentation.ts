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
  type WorkspaceRunStateLauncher,
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

/**
 * Run State labels share the final structural-stage authority with the rail.
 * React receives the finished title and never has to rediscover route shape.
 */
function withRunStateTitle(node: WorkspaceHubDecisionNode, title: string): WorkspaceHubDecisionNode;
function withRunStateTitle(
  node: WorkspaceOrdinaryBatchNode,
  title: string,
): WorkspaceOrdinaryBatchNode;
function withRunStateTitle(node: WorkspaceMixedBatchNode, title: string): WorkspaceMixedBatchNode;
function withRunStateTitle(
  node: WorkspaceTakeoverBatchNode,
  title: string,
): WorkspaceTakeoverBatchNode;
function withRunStateTitle(
  node:
    | WorkspaceHubDecisionNode
    | WorkspaceOrdinaryBatchNode
    | WorkspaceMixedBatchNode
    | WorkspaceTakeoverBatchNode,
  title: string,
):
  | WorkspaceHubDecisionNode
  | WorkspaceOrdinaryBatchNode
  | WorkspaceMixedBatchNode
  | WorkspaceTakeoverBatchNode;
function withRunStateTitle(
  node:
    | WorkspaceHubDecisionNode
    | WorkspaceOrdinaryBatchNode
    | WorkspaceMixedBatchNode
    | WorkspaceTakeoverBatchNode,
  title: string,
): typeof node {
  if (node.runState === undefined) return node;
  return Object.freeze({
    ...node,
    runState: Object.freeze({ ...node.runState, title }),
  });
}

function titledNode(node: WorkspaceNode, title: string): WorkspaceNode {
  switch (node.kind) {
    case 'hubDecision':
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return withRunStateTitle(node, title);
    case 'completion':
    case 'occurrenceWorkbench':
      return node;
  }
}

function withoutHandoffRunState(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): WorkspaceNode {
  const copy = { ...node };
  delete copy.runState;
  return Object.freeze(copy);
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
 * The rail describes authored primary-room context even when evaluation has
 * not reached it. Ephyra's incoming reward is one explicit main reward;
 * side-room offers remain local detail and never become an aggregate token.
 */
function mainRailRewardForRoom(
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
    case 'ephyra':
      return Object.freeze({
        label: summarizeRewardOffer(catalog, room.roomLocal.incomingReward.offer),
        offer: room.roomLocal.incomingReward.offer,
      });
    case 'none':
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
  const reward = mainRailRewardForRoom(catalog, target.room);
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
  catalog: Catalog,
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
    const mainReward = mainRailRewardForRoom(catalog, workbench.room);
    visits.push(
      Object.freeze({
        key: `${node.key}:visit:${visit.visitIndex}`,
        label: `Visit ${visit.visitIndex} · ${visit.room.label}`,
        ...(mainReward === undefined ? {} : { mainReward }),
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
 * Completed-Hub Preboss remains a fixed handoff, but once its target room
 * exists the room is the player-facing rail stage. The source command and
 * finding destination remain in the exhaustive semantic node product.
 */
function isHubHandoffRailScaffoldWithRenderedTarget(
  node: WorkspaceNode,
  renderedOccurrenceIds: ReadonlySet<OccurrenceId>,
): boolean {
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
  // A normal decision is itself a rail stop, so its authored target rooms stay
  // inside that decision card. A Hub-owned completed handoff is deliberately
  // different: its decision scaffold is suppressed in favor of the target
  // room's structural rail stage.
  const normalDecisionTargetOccurrenceIds = new Set(
    structuralNodes.flatMap((node) =>
      (node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch') &&
      node.source.kind !== 'hubDecision'
        ? node.targets.map((target) => target.room.occurrenceId)
        : [],
    ),
  );
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
      // Ordinary room offers belong inside their owning decision workbench,
      // including N's normalized PreHub target. Fixed entry and Hub-handoff
      // stages remain standalone rail context.
      if (normalDecisionTargetOccurrenceIds.has(node.room.occurrenceId)) return false;
      return semantic.progressionKind === 'hub' || node.key === entry?.key;
    })
    .filter(
      (node) =>
        semantic.progressionKind !== 'hub' ||
        !isHubHandoffRailScaffoldWithRenderedTarget(node, renderedOccurrenceIds),
    );
  const railFrontier =
    frontier?.kind === 'start' ||
    (frontier?.kind === 'exitDecision' && frontier.owner.source.kind !== 'hubDecision')
      ? frontier
      : undefined;
  let decisionIndex = 0;
  const railEntryForNode = (node: WorkspaceNode): WorkspaceRailEntry => {
    if (node.kind === 'hubDecision') return projectHubRailEntry(catalog, node, structuralNodes);
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
    const mainReward =
      semantic.progressionKind === 'hub' && node.kind === 'occurrenceWorkbench'
        ? mainRailRewardForRoom(catalog, node.room)
        : undefined;
    return Object.freeze({
      kind: 'node' as const,
      key: node.key,
      label: presentation.label,
      ...(mainReward === undefined ? {} : { mainReward }),
      marker: node.kind === 'takeoverBatch' ? decisionRailMarker(node) : railMarkerForNode(node),
      node,
    });
  };
  const unboundRail = Object.freeze([
    ...railNodes.map(railEntryForNode),
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
  ]);
  const titleByNodeKey = new Map<string, string>();
  for (const entry of unboundRail) {
    if (entry.kind === 'node') titleByNodeKey.set(entry.node.key, entry.label);
    else if (entry.kind === 'hubGroup') titleByNodeKey.set(entry.node.key, 'Hub');
  }
  const titledStructuralNodes = Object.freeze(
    semantic.nodes.map((node) =>
      titledNode(node, titleByNodeKey.get(node.key) ?? nodeRailPresentation(node, undefined).label),
    ),
  );
  const handoffRunStateByOccurrence = new Map<OccurrenceId, WorkspaceRunStateLauncher>();
  for (const node of titledStructuralNodes) {
    if (
      (node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch') &&
      node.source.kind === 'hubDecision' &&
      node.runState !== undefined
    ) {
      for (const target of node.targets)
        handoffRunStateByOccurrence.set(target.room.occurrenceId, node.runState);
    }
  }
  const nodes = Object.freeze(
    titledStructuralNodes.map((node) => {
      if (
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.source.kind === 'hubDecision' &&
        node.runState !== undefined
      ) {
        // The completed-Hub decision is shown through its visible Preboss room.
        return withoutHandoffRunState(node);
      }
      if (node.kind !== 'occurrenceWorkbench') return node;
      const runState = handoffRunStateByOccurrence.get(node.room.occurrenceId);
      return runState === undefined ? node : Object.freeze({ ...node, runState });
    }),
  );
  const rail: readonly WorkspaceRailEntry[] = Object.freeze(
    unboundRail.map((entry): WorkspaceRailEntry => {
      if (entry.kind === 'frontier') return entry;
      if (entry.kind === 'hubGroup') {
        const node: WorkspaceHubDecisionNode = withRunStateTitle(entry.node, 'Hub');
        return Object.freeze({ ...entry, node });
      }
      switch (entry.node.kind) {
        case 'ordinaryBatch':
          return Object.freeze({
            kind: 'node' as const,
            key: entry.key,
            label: entry.label,
            marker: entry.marker,
            node: withRunStateTitle(entry.node, entry.label),
            ...(entry.selectedTarget === undefined ? {} : { selectedTarget: entry.selectedTarget }),
          });
        case 'mixedBatch':
          return Object.freeze({
            kind: 'node' as const,
            key: entry.key,
            label: entry.label,
            marker: entry.marker,
            node: withRunStateTitle(entry.node, entry.label),
            ...(entry.selectedTarget === undefined ? {} : { selectedTarget: entry.selectedTarget }),
          });
        case 'takeoverBatch':
          return Object.freeze({
            kind: 'node' as const,
            key: entry.key,
            label: entry.label,
            marker: entry.marker,
            node: withRunStateTitle(entry.node, entry.label),
            ...(entry.mainReward === undefined ? {} : { mainReward: entry.mainReward }),
          });
        case 'completion':
        case 'occurrenceWorkbench':
        case 'hubDecision':
          return entry;
      }
    }),
  );
  const inspectorDefaults = Object.freeze({
    ...(entry === undefined ? {} : { entry }),
    ...(semantic.echoKeepsakeReplay === undefined
      ? {}
      : { echoKeepsakeReplay: semantic.echoKeepsakeReplay }),
    frontier,
    nodes,
    rail,
  });
  const defaultInspector = defaultInspectorDestination(inspectorDefaults);
  const biome = Object.freeze({
    biomeKey: semantic.biomeKey,
    completion: semantic.completion,
    completionOutline: semantic.completionOutline,
    defaultInspectorDestination: defaultInspector,
    ...(entry === undefined ? {} : { entry }),
    ...(semantic.echoKeepsakeReplay === undefined
      ? {}
      : { echoKeepsakeReplay: semantic.echoKeepsakeReplay }),
    fields: semantic.fields,
    frontier,
    label: semantic.label,
    marker: semantic.marker,
    nodes,
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
