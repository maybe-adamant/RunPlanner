import type {
  WorkspaceMarker,
  WorkspaceMixedBatchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceRoomLocal,
  WorkspaceRoomSummary,
  WorkspaceTakeoverBatchNode,
} from '../contract';

/** Batch-owned markers share the decision package that contains their targets. */
export type WorkspaceDecisionBatchNode =
  WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function rewardControlMarkers(control: {
  readonly marker: WorkspaceMarker;
  readonly traitOffers?: readonly { readonly marker: WorkspaceMarker }[];
}): readonly WorkspaceMarker[] {
  return Object.freeze([
    control.marker,
    ...(control.traitOffers ?? []).map((trait) => trait.marker),
  ]);
}

/** A workbench's room-local surface excludes its incoming offer. */
export function workspaceLocalDetailMarkers(
  roomLocal: WorkspaceRoomLocal,
): readonly WorkspaceMarker[] {
  switch (roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze([]);
    case 'ephyra':
      return roomLocal.sideRooms.kind === 'withheld'
        ? Object.freeze([])
        : Object.freeze([
            roomLocal.sideRooms.group.marker,
            ...roomLocal.sideRooms.group.slots.flatMap((slot) => [
              slot.marker,
              ...slot.encounterPhases.map((phase) => phase.marker),
              ...(slot.generation === 'generated' ? rewardControlMarkers(slot.rewardControl) : []),
            ]),
          ]);
    case 'fields':
      return Object.freeze(roomLocal.cages.flatMap((cage) => rewardControlMarkers(cage.control)));
    case 'ship':
      return Object.freeze(
        roomLocal.wheels.flatMap((wheel) => [
          wheel.marker,
          ...wheel.offers.flatMap((offer) => rewardControlMarkers(offer.control)),
        ]),
      );
    case 'shop':
      return Object.freeze(
        roomLocal.offers.flatMap((offer) => [
          offer.purchase.marker,
          ...rewardControlMarkers(offer.rewardControl),
        ]),
      );
  }
}

/**
 * Exact occurrence owners may be nested in a decision workbench, but they
 * retain one shared marker package for containment routing.
 */
export function workspaceOccurrenceOwnedMarkers(
  room: WorkspaceRoomSummary,
): readonly WorkspaceMarker[] {
  return Object.freeze([
    room.marker,
    ...room.encounterPhases.map((phase) => phase.marker),
    ...room.rewardControls.flatMap((control) => [
      control.marker,
      ...(control.traitOffers ?? []).map((trait) => trait.marker),
    ]),
    ...workspaceLocalDetailMarkers(room.roomLocal),
    ...(room.zagreusSpawn === undefined ? [] : [room.zagreusSpawn.marker]),
    ...(room.naturalChaosSpawn === undefined ? [] : [room.naturalChaosSpawn.marker]),
    ...(room.roomLocal.kind === 'fixed' ? [room.roomLocal.marker] : []),
  ]);
}

/** Decision-owned markers include each nested authored occurrence package. */
export function workspaceDecisionOwnedMarkers(
  node: WorkspaceDecisionBatchNode,
): readonly WorkspaceMarker[] {
  return Object.freeze([
    node.marker,
    node.selection,
    ...(node.hubTakeover === undefined ? [] : [node.hubTakeover.marker]),
    ...(node.rewardStore === undefined ? [] : [node.rewardStore]),
    ...(node.zagreusContract === undefined
      ? []
      : [
          node.zagreusContract.marker,
          ...workspaceOccurrenceOwnedMarkers(node.zagreusContract.contractRoom),
        ]),
    ...(node.naturalChaos === undefined
      ? []
      : [
          node.naturalChaos.marker,
          ...workspaceOccurrenceOwnedMarkers(node.naturalChaos.chaosRoom),
        ]),
    ...node.targets.flatMap((target) => [
      target.marker,
      ...workspaceOccurrenceOwnedMarkers(target.room),
    ]),
    ...node.missingTargets.map((target) => target.marker),
  ]);
}

/** Hub main-offer owners route to the board rather than a nested workbench. */
export function workspaceHubMainRewardMarkers(
  room: WorkspaceRoomSummary,
): readonly WorkspaceMarker[] {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return Object.freeze([
        room.roomLocal.marker,
        ...(room.roomLocal.control?.traitOffers ?? []).map((trait) => trait.marker),
      ]);
    case 'incomingReward':
      return Object.freeze(rewardControlMarkers(room.roomLocal.control));
    case 'ephyra':
      return Object.freeze(rewardControlMarkers(room.roomLocal.incomingReward));
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return Object.freeze([]);
  }
}
