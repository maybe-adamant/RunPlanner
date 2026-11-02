import {
  createIncomingRewardAddress,
  semanticAddressKey,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { StructuredWorkspaceProjectionContractError, type WorkspaceRoomSummary } from '../contract';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import { bindWorkspaceInspectorDestinations } from '../navigation/inspector-destinations';
import { defaultInspectorDestination } from '../navigation/inspector-defaults';
import {
  workspaceDecisionOwnedMarkers,
  type WorkspaceDecisionBatchNode,
} from '../navigation/marker-ownership';
import type { WorkspaceBiomeSemanticAssembly } from '../assembly/biome-semantic-assembly';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardOfferSummary';
import type {
  WorkspaceBiome,
  WorkspaceHubDecisionNode,
  WorkspaceHubRailEntry,
  WorkspaceHubVisitRailEntry,
  WorkspaceDoorContract,
  WorkspaceMixedBatchNode,
  WorkspaceNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceRailEntry,
  WorkspaceRailReward,
  WorkspaceRailSelectedTarget,
  WorkspaceSelectedContinuationNavigation,
  WorkspaceTakeoverBatchNode,
} from '../contracts/structure';
import type { WorkspaceInspectorDestination, WorkspaceMarker } from '../contracts/navigation';
import type { WorkspaceRunStateLauncher } from '../contracts/run-state';

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

function decisionDoorFindingCount(node: WorkspaceDecisionBatchNode): number {
  const markers = new Map<string, WorkspaceMarker>();
  for (const value of workspaceDecisionOwnedMarkers(node)) markers.set(value.focusKey, value);
  return [...markers.values()].reduce((total, marker) => total + marker.findingCount, 0);
}

function withRailFindingCount(marker: WorkspaceMarker, findingCount: number): WorkspaceMarker {
  return findingCount === marker.findingCount ? marker : Object.freeze({ ...marker, findingCount });
}

function isDecisionBatchNode(node: WorkspaceNode): node is WorkspaceDecisionBatchNode {
  return (
    node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
  );
}

/** The room a stop opens: its own room, or the one room its decision selects. */
function railRoomOccurrenceId(node: WorkspaceNode): OccurrenceId | undefined {
  if (node.kind === 'occurrenceWorkbench') return node.room.occurrenceId;
  if (!isDecisionBatchNode(node)) return undefined;
  if (node.selectedContinuation !== undefined)
    return node.selectedContinuation.door.room.occurrenceId;
  const selectedTargets = node.targets.filter((target) => target.selected);
  return selectedTargets.length === 1 ? selectedTargets[0]?.room.occurrenceId : undefined;
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
    case 'takeoverBatch': {
      const selectedAdditionalDoors = [
        ...(node.zagreusContract?.selected === true ? [node.zagreusContract.door] : []),
        ...(node.chaos?.selected === true ? [node.chaos.door] : []),
      ];
      return {
        label:
          selectedAdditionalDoors.length === 1
            ? (selectedAdditionalDoors[0]?.room.label ?? 'Preboss')
            : 'Preboss',
      };
    }
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
  const preview = door?.offerRewardSurface;
  const reward =
    preview?.visibility === 'visible' && preview.rewards.length === 1
      ? preview.rewards[0]
      : undefined;
  return reward === undefined ? undefined : railRewardForDoorReward(reward);
}

/** A door's reward as the room receives it: the final draw where its rerolls changed it. */
function railRewardForDoorReward(
  reward: import('../contracts/structure').WorkspaceDoorReward,
): WorkspaceRailReward | undefined {
  if (reward.rerolledOffer !== undefined)
    return Object.freeze({
      label: reward.rerolledSummary ?? reward.summary,
      offer: reward.rerolledOffer,
    });
  return reward.offer === null
    ? undefined
    : Object.freeze({ label: reward.summary, offer: reward.offer });
}

/** An entry previews its composed acquisition source, not an editable door reward. */
function entryRailReward(
  catalog: Catalog,
  reward: WorkspaceRewardControl | undefined,
): WorkspaceRailReward | undefined {
  return reward?.offer === null || reward?.offer === undefined
    ? undefined
    : Object.freeze({ label: summarizeRewardOffer(catalog, reward.offer), offer: reward.offer });
}

type BatchWithContinuations =
  WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function selectedContinuationDoor(node: BatchWithContinuations): WorkspaceDoorContract | undefined {
  const selectedDoors = [
    ...node.targets.filter((target) => target.selected).map((target) => target.door),
    ...(node.zagreusContract?.selected === true ? [node.zagreusContract.door] : []),
    ...(node.chaos?.selected === true ? [node.chaos.door] : []),
  ];
  return selectedDoors.length === 1 ? selectedDoors[0] : undefined;
}

/** Reward identity resolved on every offer this door presents; visibility is irrelevant. */
// A reward without a control, such as a Clockwork Goal, has nothing left to choose.
function doorRewardsResolved(door: WorkspaceDoorContract): boolean {
  return door.offerRewardSurface.rewards.every(
    (reward) => reward.offer !== null || reward.control === undefined,
  );
}

/** The game opens exits only when every door is complete, so a continuation is
 * advertised only from a batch whose doors all carry a room and a resolved
 * reward identity. A lone authored door with missing siblings stays a plain
 * selection until the batch is finished. */
function batchDoorsReady(node: BatchWithContinuations): boolean {
  return (
    node.missingTargets.length === 0 &&
    node.targets.every(
      (target) => target.physicalState === 'available' && doorRewardsResolved(target.door),
    ) &&
    (node.chaos === undefined || doorRewardsResolved(node.chaos.door)) &&
    (node.zagreusContract === undefined || doorRewardsResolved(node.zagreusContract.door))
  );
}

function selectedContinuationNavigation(
  node: BatchWithContinuations,
): WorkspaceSelectedContinuationNavigation | undefined {
  if (!batchDoorsReady(node)) return undefined;
  const door = selectedContinuationDoor(node);
  return door === undefined ? undefined : Object.freeze({ door, marker: door.room.marker });
}

function withSelectedContinuationNavigation(node: WorkspaceNode): WorkspaceNode {
  if (
    node.kind !== 'ordinaryBatch' &&
    node.kind !== 'mixedBatch' &&
    node.kind !== 'takeoverBatch'
  ) {
    return node;
  }
  if (node.source.kind === 'hubDecision') return node;
  const selectedContinuation = selectedContinuationNavigation(node);
  return Object.freeze({
    ...node,
    ...(selectedContinuation === undefined ? {} : { selectedContinuation }),
  });
}

/**
 * One rail room line for every room reached through a door, whether a
 * decision's selected target or a Hub visit: the room's own icon and label,
 * then the rewards its door offers. A room without a door shows no reward.
 */
function roomRailPresentation(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
  door: WorkspaceDoorContract | undefined,
): WorkspaceRailSelectedTarget {
  const rewards = door?.offerRewardSurface.rewards ?? [];
  const onlyReward =
    door?.offerRewardSurface.visibility === 'visible' && rewards.length === 1
      ? rewards[0]
      : undefined;
  const reward = onlyReward === undefined ? undefined : railRewardForDoorReward(onlyReward);
  const clockworkGoalsRemaining = rewards.find(
    (candidate) => candidate.clockworkGoalsRemaining !== undefined,
  )?.clockworkGoalsRemaining;
  return Object.freeze({
    ...(clockworkGoalsRemaining === undefined ? {} : { clockworkGoalsRemaining }),
    ...(reward === undefined ? {} : { reward }),
    roomRewards: Object.freeze(
      rewards.flatMap((candidate) => {
        const offer = candidate.rerolledOffer ?? candidate.offer;
        return offer === null ? [] : [offer];
      }),
    ),
    roomIcon: room.roomIcon,
    roomLabel: room.label,
    ...(room.roomLocal.kind === 'shop' ? { shop: true as const } : {}),
  });
}

function selectedTargetRailPresentation(
  catalog: Catalog,
  node: BatchWithContinuations,
): WorkspaceRailSelectedTarget | undefined {
  const door = node.selectedContinuation?.door;
  if (door === undefined) return undefined;
  return roomRailPresentation(catalog, door.room, door);
}

function railFocusMarkerForNode(node: WorkspaceNode, marker: WorkspaceMarker): WorkspaceMarker {
  if (node.kind === 'occurrenceWorkbench') return node.room.marker;
  if (!isDecisionBatchNode(node)) return marker;
  if (node.selectedContinuation !== undefined) return node.selectedContinuation.marker;
  const selectedTargets = node.targets.filter((target) => target.selected);
  return selectedTargets.length === 1 && selectedTargets[0] !== undefined
    ? selectedTargets[0].room.marker
    : marker;
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
    const localVisit = workbench.localVisit;
    const sideVisits = Object.freeze(
      localVisit === undefined
        ? []
        : localVisit.visitOrder.flatMap((occurrenceId) => {
            const slot = localVisit.slots.find(
              (candidate) => candidate.occurrenceId === occurrenceId,
            );
            if (slot === undefined) {
              throw new StructuredWorkspaceProjectionContractError(
                `Hub visit ${visit.visitIndex} side occurrence ${occurrenceId} is not a local slot`,
              );
            }
            if (slot.generation !== 'generated' || !slot.entered) return [];
            const sideNode = workbenchesByOccurrenceId.get(slot.occurrenceId);
            if (sideNode === undefined) {
              throw new StructuredWorkspaceProjectionContractError(
                `Hub visit ${visit.visitIndex} side occurrence ${slot.occurrenceId} is not projected`,
              );
            }
            if (sideNode.inspectorPresentation !== 'doorTarget') {
              throw new StructuredWorkspaceProjectionContractError(
                `Hub visit ${visit.visitIndex} side occurrence ${slot.occurrenceId} is not a side workbench`,
              );
            }
            const sideRoomId = slot.label.startsWith('Side Room ')
              ? slot.label.slice('Side Room '.length)
              : slot.label;
            return [
              Object.freeze({
                key: `${node.key}:visit:${visit.visitIndex}:side:${slot.key}`,
                label: `Side ${slot.enteredOrdinal ?? 1} · Room ${sideRoomId}`,
                marker: sideNode.room.marker,
                node: sideNode,
                visitMarker: slot.marker,
              }),
            ];
          }),
    );
    visits.push(
      Object.freeze({
        key: `${node.key}:visit:${visit.visitIndex}`,
        label: `Visit ${visit.visitIndex}`,
        marker: workbench.room.marker,
        node: workbench,
        room: roomRailPresentation(catalog, workbench.room, visit.door),
        sideVisits,
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
  const { entry, frontier } = semantic;
  const structuralNodes = semantic.structuralNodes.map(withSelectedContinuationNavigation);
  // A normal decision is itself a rail stop, so its authored target rooms stay
  // inside that decision card. A Hub-owned completed handoff is deliberately
  // different: its decision scaffold is suppressed in favor of the target
  // room's structural rail stage.
  const decisionContinuationOccurrenceIds = new Set(
    structuralNodes.flatMap((node) =>
      (node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch') &&
      node.source.kind !== 'hubDecision'
        ? [
            ...node.targets.map((target) => target.room.occurrenceId),
            ...(node.zagreusContract === undefined
              ? []
              : [node.zagreusContract.door.room.occurrenceId]),
            ...(node.chaos === undefined ? [] : [node.chaos.door.room.occurrenceId]),
          ]
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
      if (decisionContinuationOccurrenceIds.has(node.room.occurrenceId)) return false;
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
  // A decision that opens its selected room repairs its own doors on its source
  // room's Doors tab, so the stop opening that source room owns their marks.
  const railKeyByRoom = new Map<OccurrenceId, string>();
  for (const node of railNodes) {
    const room = railRoomOccurrenceId(node);
    if (room !== undefined && !railKeyByRoom.has(room))
      railKeyByRoom.set(room, railMarkerForNode(node).focusKey);
  }
  const doorsRailKeyByDecision = new Map<string, string>();
  const hostedDoorFindingCount = new Map<string, number>();
  for (const node of railNodes) {
    if (!isDecisionBatchNode(node) || node.source.kind !== 'occurrence') continue;
    if (railRoomOccurrenceId(node) === undefined) continue;
    const doorsRailKey = railKeyByRoom.get(node.source.occurrenceId);
    if (doorsRailKey === undefined || doorsRailKey === node.marker.focusKey) continue;
    doorsRailKeyByDecision.set(node.key, doorsRailKey);
    hostedDoorFindingCount.set(
      doorsRailKey,
      (hostedDoorFindingCount.get(doorsRailKey) ?? 0) + decisionDoorFindingCount(node),
    );
  }
  const railMarker = (node: WorkspaceNode): WorkspaceMarker => {
    const base = railMarkerForNode(node);
    const ownCount = !isDecisionBatchNode(node)
      ? base.findingCount
      : doorsRailKeyByDecision.has(node.key)
        ? 0
        : decisionDoorFindingCount(node);
    return withRailFindingCount(base, ownCount + (hostedDoorFindingCount.get(base.focusKey) ?? 0));
  };
  const doorsRailKeyFor = (node: WorkspaceNode) => {
    const doorsRailKey = doorsRailKeyByDecision.get(node.key);
    return doorsRailKey === undefined ? {} : { doorsRailKey };
  };
  let decisionIndex = 0;
  const railEntryForNode = (node: WorkspaceNode): WorkspaceRailEntry => {
    if (node.kind === 'hubDecision') return projectHubRailEntry(catalog, node, structuralNodes);
    if (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') {
      decisionIndex += 1;
      const presentation = nodeRailPresentation(node, decisionIndex, node.key === entry?.key);
      const selectedTarget = selectedTargetRailPresentation(catalog, node);
      const marker = railMarker(node);
      return Object.freeze({
        ...doorsRailKeyFor(node),
        focusMarker: railFocusMarkerForNode(node, marker),
        kind: 'node' as const,
        key: node.key,
        label: presentation.label,
        marker,
        node,
        ...(selectedTarget === undefined ? {} : { selectedTarget }),
      });
    }
    const presentation = nodeRailPresentation(node, undefined, node.key === entry?.key);
    const marker = railMarker(node);
    const mainReward =
      node.kind !== 'occurrenceWorkbench'
        ? undefined
        : node.key === entry?.key
          ? entryRailReward(
              catalog,
              semantic.rewardControls.get(
                semanticAddressKey(
                  createIncomingRewardAddress(semantic.biome, node.room.occurrenceId),
                ),
              ),
            )
          : semantic.progressionKind === 'hub'
            ? mainRailRewardForDoor(node.incomingDoor)
            : undefined;
    const selectedTarget =
      node.kind === 'takeoverBatch'
        ? selectedTargetRailPresentation(catalog, node)
        : node.kind === 'occurrenceWorkbench' &&
            mainReward === undefined &&
            node.room.roomLocal.kind === 'shop'
          ? roomRailPresentation(catalog, node.room, undefined)
          : undefined;
    return Object.freeze({
      ...doorsRailKeyFor(node),
      kind: 'node' as const,
      focusMarker: railFocusMarkerForNode(node, marker),
      key: node.key,
      label: presentation.label,
      ...(mainReward === undefined ? {} : { mainReward }),
      marker,
      node,
      ...(selectedTarget === undefined ? {} : { selectedTarget }),
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
      titledNode(
        withSelectedContinuationNavigation(node),
        titleByNodeKey.get(node.key) ?? nodeRailPresentation(node, undefined).label,
      ),
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
            ...(entry.doorsRailKey === undefined ? {} : { doorsRailKey: entry.doorsRailKey }),
            focusMarker: entry.focusMarker,
            kind: 'node' as const,
            key: entry.key,
            label: entry.label,
            marker: entry.marker,
            node: withRunStateTitle(entry.node, entry.label),
            ...(entry.selectedTarget === undefined ? {} : { selectedTarget: entry.selectedTarget }),
          });
        case 'mixedBatch':
          return Object.freeze({
            ...(entry.doorsRailKey === undefined ? {} : { doorsRailKey: entry.doorsRailKey }),
            focusMarker: entry.focusMarker,
            kind: 'node' as const,
            key: entry.key,
            label: entry.label,
            marker: entry.marker,
            node: withRunStateTitle(entry.node, entry.label),
            ...(entry.selectedTarget === undefined ? {} : { selectedTarget: entry.selectedTarget }),
          });
        case 'takeoverBatch':
          return Object.freeze({
            ...(entry.doorsRailKey === undefined ? {} : { doorsRailKey: entry.doorsRailKey }),
            focusMarker: entry.focusMarker,
            kind: 'node' as const,
            key: entry.key,
            label: entry.label,
            marker: entry.marker,
            node: withRunStateTitle(entry.node, entry.label),
            ...(entry.mainReward === undefined ? {} : { mainReward: entry.mainReward }),
            ...(entry.selectedTarget === undefined ? {} : { selectedTarget: entry.selectedTarget }),
          });
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
