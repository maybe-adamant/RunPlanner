import { semanticAddressKey } from '@run-planner/engine/authored-project';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceBiome,
  type WorkspaceInspectorDestination,
  type WorkspaceInspectorSubject,
  type WorkspaceNode,
  type WorkspaceRailEntry,
  type WorkspaceRoomSummary,
} from './contract';

/** Final workspace products needed to bind exact semantic focus for one biome. */
export interface WorkspaceInspectorDestinationBindingInput {
  readonly biome: WorkspaceBiome;
  readonly destinationsByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
}

function sameInspectorSubject(
  left: WorkspaceInspectorSubject | undefined,
  right: WorkspaceInspectorSubject | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.kind !== right.kind) return false;
  return left.kind === 'node'
    ? left.nodeKey ===
        (right as Extract<WorkspaceInspectorSubject, { readonly kind: 'node' }>).nodeKey
    : left.frontierFocusKey ===
        (right as Extract<WorkspaceInspectorSubject, { readonly kind: 'frontier' }>)
          .frontierFocusKey;
}

function subjectForDefault(biome: WorkspaceBiome): WorkspaceInspectorSubject | undefined {
  const destination = biome.defaultInspectorDestination;
  if (destination === null) return undefined;
  return destination.kind === 'node'
    ? Object.freeze({ kind: 'node' as const, nodeKey: destination.nodeKey })
    : Object.freeze({
        frontierFocusKey: destination.frontierFocusKey,
        kind: 'frontier' as const,
      });
}

function hubNode(
  biome: WorkspaceBiome,
): Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> | undefined {
  return biome.nodes.find(
    (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
      node.kind === 'hubDecision',
  );
}

/**
 * Existing assembly already chooses the exact containing node for authored
 * markers. This final presentation stage only handles the non-node frontiers
 * and coarse fallback owners after the complete biome products exist.
 */
function subjectForDestination(
  biome: WorkspaceBiome,
  destination: WorkspaceInspectorDestination,
): WorkspaceInspectorSubject | undefined {
  if (biome.nodes.some((node) => node.key === destination.nodeKey)) {
    return Object.freeze({ kind: 'node' as const, nodeKey: destination.nodeKey });
  }
  const frontier = biome.frontier;
  if (
    (frontier?.kind === 'start' || frontier?.kind === 'exitDecision') &&
    frontier.marker.focusKey === destination.focusKey
  ) {
    if (frontier.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision') {
      const hub = hubNode(biome);
      return hub === undefined
        ? subjectForDefault(biome)
        : Object.freeze({ kind: 'node' as const, nodeKey: hub.key });
    }
    return Object.freeze({
      frontierFocusKey: frontier.marker.focusKey,
      kind: 'frontier' as const,
    });
  }
  return subjectForDefault(biome);
}

function roomOwnedFocusKeys(room: WorkspaceRoomSummary): readonly string[] {
  const keys = [
    room.marker.focusKey,
    ...room.rewardControls.map((control) => control.marker.focusKey),
  ];
  switch (room.roomLocal.kind) {
    case 'none':
    case 'incomingReward':
    case 'fields':
      break;
    case 'ephyra':
      keys.push(
        room.roomLocal.sideRooms.marker.focusKey,
        ...room.roomLocal.sideRooms.slots.map((slot) => slot.marker.focusKey),
      );
      break;
    case 'fixed':
      keys.push(room.roomLocal.marker.focusKey);
      break;
    case 'ship':
      keys.push(
        ...room.roomLocal.wheels.flatMap((wheel) => [
          wheel.marker.focusKey,
          ...wheel.offers.map((offer) => offer.control.marker.focusKey),
        ]),
      );
      break;
    case 'shop':
      keys.push(...room.roomLocal.offers.map((offer) => offer.purchase.marker.focusKey));
      break;
  }
  return Object.freeze(keys);
}

/** Marker ownership used by a top-level rail node, not semantic lookup in React. */
function nodeOwnedFocusKeys(node: WorkspaceNode): readonly string[] {
  switch (node.kind) {
    case 'occurrenceWorkbench':
      return Object.freeze([
        node.marker.focusKey,
        ...(node.railMarker === undefined ? [] : [node.railMarker.focusKey]),
        ...roomOwnedFocusKeys(node.room),
      ]);
    case 'linkedExit':
      return Object.freeze([
        node.marker.focusKey,
        node.target.marker.focusKey,
        ...roomOwnedFocusKeys(node.target.room),
      ]);
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return Object.freeze([
        node.marker.focusKey,
        node.selection.focusKey,
        ...(node.rewardStore === undefined ? [] : [node.rewardStore.focusKey]),
        ...node.targets.flatMap((target) => [
          target.marker.focusKey,
          ...roomOwnedFocusKeys(target.room),
        ]),
        ...node.missingTargets.map((target) => target.marker.focusKey),
      ]);
    case 'hubDecision':
      return Object.freeze([
        node.marker.focusKey,
        node.openSet.focusKey,
        ...node.slots.map((slot) => slot.marker.focusKey),
      ]);
    case 'completion':
      return Object.freeze([node.marker.focusKey]);
  }
}

function registerRailFocusKey(
  railByFocusKey: Map<string, string>,
  focusKey: string,
  selectedRailKey: string,
): void {
  const existing = railByFocusKey.get(focusKey);
  if (existing !== undefined && existing !== selectedRailKey) {
    throw new StructuredWorkspaceProjectionContractError(
      `${focusKey} maps to multiple workspace rail stops.`,
    );
  }
  railByFocusKey.set(focusKey, selectedRailKey);
}

/**
 * The rail is a presentation product, so it owns the exact mapping from a
 * focused semantic marker to its selected rendered marker key. This preserves
 * intentionally unselected hidden sources instead of deriving selection from
 * an inspector node.
 */
function selectedRailKeysByFocusKey(
  rail: readonly WorkspaceRailEntry[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const entry of rail) {
    switch (entry.kind) {
      case 'frontier':
        registerRailFocusKey(result, entry.marker.focusKey, entry.marker.focusKey);
        break;
      case 'node':
        for (const focusKey of nodeOwnedFocusKeys(entry.node)) {
          registerRailFocusKey(result, focusKey, entry.marker.focusKey);
        }
        break;
      case 'hubGroup':
        for (const focusKey of nodeOwnedFocusKeys(entry.node)) {
          registerRailFocusKey(result, focusKey, entry.marker.focusKey);
        }
        for (const visit of entry.visits) {
          for (const focusKey of [
            visit.visitMarker.focusKey,
            visit.node.marker.focusKey,
            ...visit.node.localDetailMarkers.map((marker) => marker.focusKey),
          ]) {
            registerRailFocusKey(result, focusKey, visit.marker.focusKey);
          }
        }
        break;
    }
  }
  return result;
}

function directRailMarkerCount(rail: readonly WorkspaceRailEntry[], focusKey: string): number {
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

/**
 * Decorates biome-local exact focus destinations from final, already-published
 * nodes, rail, frontier, and no-focus default products. No authored topology,
 * source index, catalog, candidate, or UI-session state is consulted here.
 */
export function bindWorkspaceInspectorDestinations(
  input: WorkspaceInspectorDestinationBindingInput,
): ReadonlyMap<string, WorkspaceInspectorDestination> {
  const railByFocusKey = selectedRailKeysByFocusKey(input.biome.rail);
  const result = new Map<string, WorkspaceInspectorDestination>();
  for (const [ownerKey, destination] of input.destinationsByOwner) {
    const inspectorSubject = subjectForDestination(input.biome, destination);
    const selectedRailKey = railByFocusKey.get(destination.focusKey);
    result.set(
      ownerKey,
      Object.freeze({
        ...destination,
        ...(inspectorSubject === undefined ? {} : { inspectorSubject }),
        ...(selectedRailKey === undefined ? {} : { selectedRailKey }),
      }),
    );
  }
  assertWorkspaceInspectorDestinationClosure(input, result);
  return result;
}

/** Structural closure for final exact-focus presentation products. */
export function assertWorkspaceInspectorDestinationClosure(
  input: WorkspaceInspectorDestinationBindingInput,
  destinationsByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
): void {
  const railByFocusKey = selectedRailKeysByFocusKey(input.biome.rail);
  for (const [ownerKey, destination] of destinationsByOwner) {
    if (semanticAddressKey(destination.ownerAddress) !== ownerKey) {
      throw new StructuredWorkspaceProjectionContractError(
        `${ownerKey} inspector destination key does not match its semantic owner.`,
      );
    }
    if (semanticAddressKey(destination.focusAddress) !== destination.focusKey) {
      throw new StructuredWorkspaceProjectionContractError(
        `${ownerKey} inspector destination focus key does not match its focus address.`,
      );
    }
    const expectedSubject = subjectForDestination(input.biome, destination);
    if (!sameInspectorSubject(destination.inspectorSubject, expectedSubject)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${ownerKey} inspector destination does not resolve to its final workspace subject.`,
      );
    }
    const inspectorSubject = destination.inspectorSubject;
    switch (inspectorSubject?.kind) {
      case 'node': {
        const matches = input.biome.nodes.filter((node) => node.key === inspectorSubject.nodeKey);
        if (matches.length !== 1) {
          throw new StructuredWorkspaceProjectionContractError(
            `${ownerKey} inspector node resolves to ${matches.length} workspace nodes.`,
          );
        }
        break;
      }
      case 'frontier': {
        const frontier = input.biome.frontier;
        if (
          (frontier?.kind !== 'start' && frontier?.kind !== 'exitDecision') ||
          frontier.marker.focusKey !== inspectorSubject.frontierFocusKey
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `${ownerKey} inspector frontier does not match the active workspace frontier.`,
          );
        }
        break;
      }
      case undefined:
        break;
    }
    const expectedRailKey = railByFocusKey.get(destination.focusKey);
    if (destination.selectedRailKey !== expectedRailKey) {
      throw new StructuredWorkspaceProjectionContractError(
        `${ownerKey} inspector rail selection disagrees with final workspace presentation.`,
      );
    }
    if (
      destination.selectedRailKey !== undefined &&
      directRailMarkerCount(input.biome.rail, destination.selectedRailKey) === 0
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${ownerKey} inspector rail selection is not rendered by the workspace rail.`,
      );
    }
  }
}
