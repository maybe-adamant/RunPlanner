import { semanticAddressKey, type OccurrenceId } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceBiome,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubRailEntry,
  type WorkspaceHubVisitRailEntry,
  type WorkspaceDoorContract,
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
import type { WorkspaceBiomeSemanticAssembly } from '../assembly/biome-semantic-assembly';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';

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
 * The rail consumes the exact predecessor-owned door handoff. It never
 * reconstructs a reward identity from room-local state.
 */
function mainRailRewardForDoor(
  door: WorkspaceDoorContract | undefined,
): WorkspaceRailReward | undefined {
  const preview = door?.rewardPreview;
  const reward =
    preview?.kind === 'visible' && preview.rewards.length === 1 ? preview.rewards[0] : undefined;
  return reward?.offer === null || reward?.offer === undefined
    ? undefined
    : Object.freeze({ label: reward.summary, offer: reward.offer });
}

/** The authored biome entry has no predecessor door, so its own opening reward is explicit here. */
function entryRailReward(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
): WorkspaceRailReward | undefined {
  if (room.roomLocal.kind === 'fixed') {
    return room.roomLocal.offer === null
      ? undefined
      : Object.freeze({ label: room.roomLocal.summary, offer: room.roomLocal.offer });
  }
  if (room.roomLocal.kind !== 'incomingReward' || room.roomLocal.control.offer === null) {
    return undefined;
  }
  return Object.freeze({
    label: summarizeRewardOffer(catalog, room.roomLocal.control.offer),
    offer: room.roomLocal.control.offer,
  });
}

function selectedTargetRailPresentation(
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
  const visible = target.door.rewardPreview;
  const onlyReward =
    visible.kind === 'visible' && visible.rewards.length === 1 ? visible.rewards[0] : undefined;
  const reward =
    onlyReward?.offer === null || onlyReward?.offer === undefined
      ? undefined
      : Object.freeze({ label: onlyReward.summary, offer: onlyReward.offer });
  return Object.freeze({
    ...(reward === undefined ? {} : { reward }),
    roomLabel: target.door.room.label,
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
    const mainReward = mainRailRewardForDoor(visit.door);
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
    if (node.kind === 'hubDecision') return projectHubRailEntry(node, structuralNodes);
    if (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') {
      decisionIndex += 1;
      const presentation = nodeRailPresentation(node, decisionIndex, node.key === entry?.key);
      const selectedTarget = selectedTargetRailPresentation(node);
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
        ? node.key === entry?.key
          ? entryRailReward(catalog, node.room)
          : mainRailRewardForDoor(node.incomingDoor)
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
  const occurrenceNodeById = new Map(
    nodes.flatMap((node) =>
      node.kind === 'occurrenceWorkbench' ? [[node.room.occurrenceId, node] as const] : [],
    ),
  );
  const outgoingDecisionBySource = new Map<OccurrenceId, WorkspaceNode>();
  const outgoingDecisionByOwner = new Map<string, WorkspaceNode>();
  for (const node of nodes) {
    if (
      (node.kind !== 'ordinaryBatch' &&
        node.kind !== 'mixedBatch' &&
        node.kind !== 'takeoverBatch') ||
      node.source.kind !== 'occurrence'
    ) {
      continue;
    }
    if (outgoingDecisionBySource.has(node.source.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${node.source.occurrenceId} owns multiple outgoing workspace decisions`,
      );
    }
    if (!occurrenceNodeById.has(node.source.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${node.source.occurrenceId} has an outgoing decision without an occurrence workbench`,
      );
    }
    outgoingDecisionBySource.set(node.source.occurrenceId, node);
    outgoingDecisionByOwner.set(semanticAddressKey(node.owner), node);
  }
  const occurrenceStages = Object.freeze(
    [...occurrenceNodeById.entries()].map(([occurrenceId, occurrence]) => {
      const semanticOutgoing = semantic.occurrenceOutgoing.get(occurrenceId);
      if (semanticOutgoing === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${occurrenceId} has no occurrence-local outgoing product`,
        );
      }
      const outgoing =
        semanticOutgoing.kind === 'authoredDecision'
          ? outgoingDecisionByOwner.get(semanticOutgoing.decisionNodeKey)
          : undefined;
      if (semanticOutgoing.kind === 'authoredDecision' && outgoing === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticOutgoing.decisionNodeKey} has no outgoing workspace decision node`,
        );
      }
      return Object.freeze({
        outgoing:
          outgoing === undefined
            ? semanticOutgoing
            : Object.freeze({ kind: 'authoredDecision' as const, decisionNodeKey: outgoing.key }),
        sourceOccurrenceNodeKey: occurrence.key,
      });
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
    occurrenceStages,
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
    occurrenceStages,
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
