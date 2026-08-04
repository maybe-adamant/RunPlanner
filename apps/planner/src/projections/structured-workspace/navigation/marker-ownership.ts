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
              ...(slot.generation === 'generated' ? [slot.rewardControl.marker] : []),
            ]),
          ]);
    case 'fields':
      return Object.freeze(roomLocal.cages.map((cage) => cage.control.marker));
    case 'ship':
      return Object.freeze(
        roomLocal.wheels.flatMap((wheel) => [
          wheel.marker,
          ...wheel.offers.map((offer) => offer.control.marker),
        ]),
      );
    case 'shop':
      return Object.freeze(
        roomLocal.offers.flatMap((offer) => [offer.purchase.marker, offer.rewardControl.marker]),
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
    ...room.rewardControls.map((control) => control.marker),
    ...workspaceLocalDetailMarkers(room.roomLocal),
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
    ...node.targets.flatMap((target) => [
      target.marker,
      ...workspaceOccurrenceOwnedMarkers(target.room),
    ]),
    ...node.missingTargets.map((target) => target.marker),
  ]);
}

/** Hub main-offer owners route to the board rather than a nested workbench. */
export function workspaceHubMainRewardMarker(
  room: WorkspaceRoomSummary,
): WorkspaceMarker | undefined {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return room.roomLocal.marker;
    case 'incomingReward':
      return room.roomLocal.control.marker;
    case 'ephyra':
      return room.roomLocal.incomingReward.marker;
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return undefined;
  }
}
