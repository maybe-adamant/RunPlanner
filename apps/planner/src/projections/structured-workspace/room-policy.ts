import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

/** Narrow declaration facts shared by decision and topology assembly. */
export function workspaceRoomTakesOverNormalDoors(room: RoomDeclaration | undefined): boolean {
  return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
}

export function workspaceRoomRetainsNormalPeers(room: RoomDeclaration | undefined): boolean {
  return room?.prebossBatchPolicy?.kind === 'retainNormalPeers';
}
