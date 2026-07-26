import type { Catalog } from '../../catalog-schema';
import type { EnteredRewardStoreHistoryPolicy } from '../../reward-kernel/bindings';
import type { RoomLifecycleExecutionInput } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalCompletionRoom,
  CanonicalHubRoom,
  CanonicalLocalChildRoom,
} from '../materialization';

export type CanonicalLifecycleRoom =
  CanonicalAuthoredRoom | CanonicalCompletionRoom | CanonicalHubRoom | CanonicalLocalChildRoom;

export class HistoryLifecycleInputContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HistoryLifecycleInputContractError';
  }
}

function enteredStoreKey(
  policy: EnteredRewardStoreHistoryPolicy,
  room: CanonicalLifecycleRoom,
): string | undefined {
  if (room.kind === 'authored' && room.clockworkReward === 'goal') {
    return undefined;
  }
  switch (policy.kind) {
    case 'fixed':
      return policy.storeKey;
    case 'none':
      return undefined;
    case 'resolvedOffer': {
      const resolvedStoreKey =
        room.kind === 'completion'
          ? room.enteredRewardStoreKey
          : 'incomingReward' in room
            ? room.incomingReward?.resolvedStoreKey
            : undefined;
      if (resolvedStoreKey === undefined) {
        throw new HistoryLifecycleInputContractError(
          `${room.gameName} requires resolved entered-store provenance`,
        );
      }
      return resolvedStoreKey;
    }
  }
}

export function createRoomLifecycleInput(
  catalog: Catalog,
  room: CanonicalLifecycleRoom,
): RoomLifecycleExecutionInput {
  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration === undefined) {
    throw new HistoryLifecycleInputContractError(`unknown canonical room ${room.gameName}`);
  }
  const storeKey = enteredStoreKey(declaration.enteredRewardStoreHistory, room);
  const incomingReward = 'incomingReward' in room ? room.incomingReward : undefined;
  const requiredObjects = 'requiredObjects' in room ? room.requiredObjects : undefined;
  const rewardWheels = 'rewardWheels' in room ? room.rewardWheels : undefined;
  const offerPointRewardStores =
    rewardWheels === undefined
      ? undefined
      : Object.freeze(
          Object.fromEntries(rewardWheels.map((wheel) => [wheel.wheelKey, wheel.storeKey])),
        );
  return {
    origin: room.origin,
    lifecycleProfileKey: room.lifecycleProfileKey,
    encounterProfileKey: room.encounterProfileKey,
    encounterPhases: room.encounterPhases,
    counterEffects: room.counterEffects,
    ...(requiredObjects === undefined ? {} : { requiredObjects }),
    ...(offerPointRewardStores === undefined ? {} : { offerPointRewardStores }),
    ...(incomingReward === undefined
      ? {}
      : {
          producer: {
            lifecycleProfileKey: incomingReward.producerLifecycleKey,
            offer: incomingReward.offer,
          },
        }),
    ...(storeKey === undefined ? {} : { enteredRewardStoreKey: storeKey }),
  };
}
