import { semanticAddressKey, type OccurrenceId } from '@run-planner/engine/authored-project';

import type {
  StructuredWorkspaceProjection,
  WorkspaceInteractionCatalog,
  WorkspaceInspectorDestination,
  WorkspaceMarker,
  WorkspaceNode,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';

export interface ObservedWorkspaceRoomPackage {
  readonly nodeKey: string;
  readonly room: WorkspaceRoomSummary;
}

export interface ObservedWorkspaceProducts {
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly markerNodeKeys: ReadonlyMap<string, ReadonlySet<string>>;
  readonly markersByOwner: ReadonlyMap<string, WorkspaceMarker>;
  readonly nodes: readonly WorkspaceNode[];
  readonly nodesByKey: ReadonlyMap<string, WorkspaceNode>;
  readonly roomPackagesByOccurrence: ReadonlyMap<
    OccurrenceId,
    readonly ObservedWorkspaceRoomPackage[]
  >;
}

function unreachable(value: never): never {
  throw new Error(`unknown public workspace product ${JSON.stringify(value)}`);
}

function appendMarker(markers: WorkspaceMarker[], marker: WorkspaceMarker | undefined): void {
  if (marker !== undefined) markers.push(marker);
}

function roomMarkers(room: WorkspaceRoomSummary): readonly WorkspaceMarker[] {
  const markers: WorkspaceMarker[] = [];
  appendMarker(markers, room.marker);
  for (const phase of room.encounterPhases) appendMarker(markers, phase.marker);
  for (const control of room.rewardControls) appendMarker(markers, control.marker);
  appendMarker(markers, room.zagreusSpawn?.marker);
  const local = room.roomLocal;
  switch (local.kind) {
    case 'fixed':
      appendMarker(markers, local.marker);
      if (local.control !== undefined) appendMarker(markers, local.control.marker);
      break;
    case 'incomingReward':
      appendMarker(markers, local.control.marker);
      break;
    case 'ephyra':
      appendMarker(markers, local.incomingReward.marker);
      if (local.sideRooms.kind === 'published') {
        appendMarker(markers, local.sideRooms.group.marker);
        for (const slot of local.sideRooms.group.slots) {
          appendMarker(markers, slot.marker);
          for (const phase of slot.encounterPhases) appendMarker(markers, phase.marker);
          if (slot.generation === 'generated') appendMarker(markers, slot.rewardControl.marker);
        }
      }
      break;
    case 'fields':
      for (const cage of local.cages) appendMarker(markers, cage.control.marker);
      break;
    case 'ship':
      for (const wheel of local.wheels) {
        appendMarker(markers, wheel.marker);
        for (const offer of wheel.offers) appendMarker(markers, offer.control.marker);
      }
      break;
    case 'shop':
      for (const offer of local.offers) {
        appendMarker(markers, offer.purchase.marker);
        appendMarker(markers, offer.rewardControl.marker);
      }
      break;
    case 'none':
      break;
    default:
      unreachable(local);
  }
  return markers;
}

/** Hub nodes publish only the declaration-defined main reward for a room. */
function hubMainRewardMarker(room: WorkspaceRoomSummary): WorkspaceMarker | undefined {
  const local = room.roomLocal;
  switch (local.kind) {
    case 'fixed':
      return local.marker;
    case 'incomingReward':
      return local.control.marker;
    case 'ephyra':
      return local.incomingReward.marker;
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return undefined;
    default:
      return unreachable(local);
  }
}

function markersForNode(node: WorkspaceNode): readonly WorkspaceMarker[] {
  const markers: WorkspaceMarker[] = [];
  appendMarker(markers, node.marker);
  switch (node.kind) {
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      appendMarker(markers, node.selection);
      appendMarker(markers, node.hubTakeover?.marker);
      appendMarker(markers, node.zagreusContract?.marker);
      if (node.rewardStore !== undefined) appendMarker(markers, node.rewardStore);
      if (node.fieldsCageOutcome !== undefined) appendMarker(markers, node.fieldsCageOutcome);
      for (const target of node.targets) {
        appendMarker(markers, target.marker);
        markers.push(...roomMarkers(target.room));
      }
      if (node.zagreusContract !== undefined) {
        markers.push(...roomMarkers(node.zagreusContract.contractRoom));
      }
      for (const target of node.missingTargets) appendMarker(markers, target.marker);
      break;
    case 'hubDecision':
      appendMarker(markers, node.openSet);
      for (const slot of node.slots) {
        appendMarker(markers, slot.marker);
        if (slot.room !== undefined) {
          const rewardMarker = hubMainRewardMarker(slot.room);
          if (rewardMarker !== undefined) markers.push(rewardMarker);
        }
      }
      for (const visit of node.visits) appendMarker(markers, visit.marker);
      break;
    case 'occurrenceWorkbench':
      if (node.railMarker !== undefined) appendMarker(markers, node.railMarker);
      for (const marker of node.localDetailMarkers) appendMarker(markers, marker);
      markers.push(...roomMarkers(node.room));
      break;
    case 'completion':
      break;
    default:
      unreachable(node);
  }
  return markers;
}

function roomPackagesForNode(node: WorkspaceNode): readonly ObservedWorkspaceRoomPackage[] {
  const packageFor = (room: WorkspaceRoomSummary): readonly ObservedWorkspaceRoomPackage[] =>
    Object.freeze([Object.freeze({ nodeKey: node.key, room })]);
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return packageFor(node.room);
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return Object.freeze([
        ...node.targets.flatMap((target) => packageFor(target.room)),
        ...(node.zagreusContract === undefined
          ? []
          : packageFor(node.zagreusContract.contractRoom)),
      ]);
    case 'hubDecision':
      return Object.freeze(
        node.slots.flatMap((slot) => (slot.room === undefined ? [] : packageFor(slot.room))),
      );
    case 'completion':
      return Object.freeze([]);
    default:
      return unreachable(node);
  }
}

/**
 * Observe final workspace products through their public contract. This is one
 * typed traversal shared by topology, leaf, destination, and marker closure;
 * it derives no expectations and imports no workspace producer.
 */
export function observeWorkspaceProducts(input: {
  readonly focusByOwner: StructuredWorkspaceProjection['focusByOwner'];
  readonly interactions: StructuredWorkspaceProjection['interactions'];
  readonly nodes: readonly WorkspaceNode[];
}): ObservedWorkspaceProducts {
  const markersByOwner = new Map<string, WorkspaceMarker>();
  const markerNodeKeys = new Map<string, Set<string>>();
  const nodesByKey = new Map<string, WorkspaceNode>();
  const roomPackagesByOccurrence = new Map<OccurrenceId, ObservedWorkspaceRoomPackage[]>();

  for (const node of input.nodes) {
    if (nodesByKey.has(node.key)) throw new Error(`${node.key} has multiple workspace nodes`);
    nodesByKey.set(node.key, node);
    for (const marker of markersForNode(node)) {
      const markerKey = semanticAddressKey(marker.address);
      const prior = markersByOwner.get(markerKey);
      if (prior !== undefined && prior.focusKey !== marker.focusKey) {
        throw new Error(`${markerKey} has conflicting workspace markers`);
      }
      markersByOwner.set(markerKey, marker);
      const containingNodes = markerNodeKeys.get(markerKey) ?? new Set<string>();
      containingNodes.add(node.key);
      markerNodeKeys.set(markerKey, containingNodes);
    }
    for (const roomPackage of roomPackagesForNode(node)) {
      const packages = roomPackagesByOccurrence.get(roomPackage.room.occurrenceId);
      if (packages === undefined) {
        roomPackagesByOccurrence.set(roomPackage.room.occurrenceId, [roomPackage]);
      } else {
        packages.push(roomPackage);
      }
    }
  }

  return Object.freeze({
    focusByOwner: input.focusByOwner,
    interactions: input.interactions,
    markerNodeKeys: new Map(
      [...markerNodeKeys].map(([key, nodeKeys]) => [key, new Set(nodeKeys)] as const),
    ),
    markersByOwner: new Map(markersByOwner),
    nodes: input.nodes,
    nodesByKey: new Map(nodesByKey),
    roomPackagesByOccurrence: new Map(
      [...roomPackagesByOccurrence].map(
        ([occurrenceId, packages]) => [occurrenceId, Object.freeze([...packages])] as const,
      ),
    ),
  });
}
