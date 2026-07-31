import type { AuthoredRoomState } from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import { StructuredWorkspaceProjectionContractError } from './contract';

/** Resolve one declaration-owned room for workspace assembly and binding. */
export function requireWorkspaceRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
}

/** Resolve the declaration-owned fixed offer while retaining an authored payload override. */
export function resolveWorkspaceFixedRewardOffer(
  room: RoomDeclaration,
  state: Extract<AuthoredRoomState, { readonly kind: 'fixed' }>,
): ResolvedRewardOffer {
  if (room.incomingReward.kind !== 'fixed') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} fixed state has ${room.incomingReward.kind} reward binding`,
    );
  }
  return Object.freeze({
    rewardType: room.incomingReward.offer.rewardType,
    ...(state.payload === undefined
      ? room.incomingReward.offer.payload === undefined
        ? {}
        : { payload: room.incomingReward.offer.payload }
      : { payload: state.payload }),
  });
}
