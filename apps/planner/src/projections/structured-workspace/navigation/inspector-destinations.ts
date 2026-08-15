import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceBiome,
  type WorkspaceInspectorDestination,
  type WorkspaceInspectorSubject,
  type WorkspaceNode,
  type WorkspaceRailEntry,
  type WorkspaceRoomSummary,
} from '../contract';

/** Final workspace products needed to bind exact semantic focus for one biome. */
export interface WorkspaceInspectorDestinationBindingInput {
  readonly biome: WorkspaceBiome;
  readonly destinationsByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
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
    ...room.encounterPhases.flatMap((phase) => [
      phase.marker.focusKey,
      ...(phase.traitOffer === undefined
        ? []
        : [
            phase.traitOffer.marker.focusKey,
            ...(phase.traitOffer.echoPomTarget === undefined
              ? []
              : [phase.traitOffer.echoPomTarget.marker.focusKey]),
            ...(phase.traitOffer.echoLastRunBoon === undefined
              ? []
              : [phase.traitOffer.echoLastRunBoon.marker.focusKey]),
          ]),
      ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker.focusKey]),
    ]),
    ...room.localDetailMarkers.map((marker) => marker.focusKey),
    ...room.rewardControls.flatMap((control) => [
      control.marker.focusKey,
      ...(control.traitOffers ?? []).flatMap((trait) => [
        trait.marker.focusKey,
        ...(trait.circeResolution === undefined ? [] : [trait.circeResolution.marker.focusKey]),
        ...(trait.echoPomTarget === undefined ? [] : [trait.echoPomTarget.marker.focusKey]),
        ...(trait.echoLastRunBoon === undefined ? [] : [trait.echoLastRunBoon.marker.focusKey]),
      ]),
      ...(control.levelResolutions ?? []).map((resolution) => resolution.marker.focusKey),
    ]),
  ];
  switch (room.roomLocal.kind) {
    case 'none':
    case 'incomingReward':
    case 'fields':
      break;
    case 'ephyra': {
      const sideRooms = room.roomLocal.sideRooms;
      if (sideRooms.kind === 'published') {
        keys.push(
          sideRooms.group.marker.focusKey,
          ...sideRooms.group.slots.flatMap((slot) => [
            slot.marker.focusKey,
            ...slot.encounterPhases.flatMap((phase) => [
              phase.marker.focusKey,
              ...(phase.traitOffer === undefined
                ? []
                : [
                    phase.traitOffer.marker.focusKey,
                    ...(phase.traitOffer.echoPomTarget === undefined
                      ? []
                      : [phase.traitOffer.echoPomTarget.marker.focusKey]),
                    ...(phase.traitOffer.echoLastRunBoon === undefined
                      ? []
                      : [phase.traitOffer.echoLastRunBoon.marker.focusKey]),
                  ]),
              ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker.focusKey]),
            ]),
            ...(slot.generation === 'generated'
              ? [
                  slot.rewardControl.marker.focusKey,
                  ...(slot.rewardControl.traitOffers ?? []).flatMap((trait) => [
                    trait.marker.focusKey,
                    ...(trait.circeResolution === undefined
                      ? []
                      : [trait.circeResolution.marker.focusKey]),
                    ...(trait.echoPomTarget === undefined
                      ? []
                      : [trait.echoPomTarget.marker.focusKey]),
                    ...(trait.echoLastRunBoon === undefined
                      ? []
                      : [trait.echoLastRunBoon.marker.focusKey]),
                  ]),
                  ...(slot.rewardControl.levelResolutions ?? []).map(
                    (resolution) => resolution.marker.focusKey,
                  ),
                ]
              : []),
          ]),
        );
      }
      break;
    }
    case 'fixed':
      keys.push(room.roomLocal.marker.focusKey);
      break;
    case 'ship':
      keys.push(
        ...room.roomLocal.wheels.flatMap((wheel) => [
          wheel.marker.focusKey,
          ...wheel.offers.flatMap((offer) => [
            offer.control.marker.focusKey,
            ...(offer.control.traitOffers ?? []).flatMap((trait) => [
              trait.marker.focusKey,
              ...(trait.circeResolution === undefined
                ? []
                : [trait.circeResolution.marker.focusKey]),
              ...(trait.echoPomTarget === undefined ? [] : [trait.echoPomTarget.marker.focusKey]),
              ...(trait.echoLastRunBoon === undefined
                ? []
                : [trait.echoLastRunBoon.marker.focusKey]),
            ]),
            ...(offer.control.levelResolutions ?? []).map(
              (resolution) => resolution.marker.focusKey,
            ),
          ]),
        ]),
      );
      break;
    case 'shop':
      keys.push(
        ...room.roomLocal.offers.flatMap((offer) => [
          offer.purchase.marker.focusKey,
          offer.rewardControl.marker.focusKey,
          ...(offer.rewardControl.traitOffers ?? []).flatMap((trait) => [
            trait.marker.focusKey,
            ...(trait.circeResolution === undefined ? [] : [trait.circeResolution.marker.focusKey]),
            ...(trait.echoPomTarget === undefined ? [] : [trait.echoPomTarget.marker.focusKey]),
            ...(trait.echoLastRunBoon === undefined ? [] : [trait.echoLastRunBoon.marker.focusKey]),
          ]),
          ...(offer.rewardControl.levelResolutions ?? []).map(
            (resolution) => resolution.marker.focusKey,
          ),
        ]),
      );
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
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return Object.freeze([
        node.marker.focusKey,
        node.selection.focusKey,
        ...(node.hubTakeover === undefined ? [] : [node.hubTakeover.marker.focusKey]),
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
  return result;
}
