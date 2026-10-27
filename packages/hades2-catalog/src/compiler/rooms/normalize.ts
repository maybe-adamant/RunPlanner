import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  ExitTypeDeclaration,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../../declarations/index';
import { createCollection } from '../common';
import { fail } from '../errors';
import { validateRoomCollectionClosure } from './collection-closure';
import { normalizeRoom } from './normalize-room';
import { validateRoomTemplateContracts } from './template-contracts';

/** Produces the compiler-private immutable room collection. */
export function normalizeRooms(
  rawRooms: readonly RawRoomDeclaration[],
  rawNativeExitDoorOrders: Readonly<Record<string, readonly number[]>>,
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): CatalogCollection<RoomDeclaration> {
  const declaredGameNames = new Set(rawRooms.map((room) => room.gameName));
  for (const gameName of Object.keys(rawNativeExitDoorOrders))
    if (!declaredGameNames.has(gameName))
      fail(`nativeExitDoorOrders.${gameName}`, 'is not a declared room');
  const rooms = rawRooms.map((room, roomIndex) =>
    normalizeRoom(
      room,
      roomIndex,
      rewards,
      encounterEnvelopes,
      encounterDefinitions,
      encounterSets,
      exitTypes,
      Object.hasOwn(rawNativeExitDoorOrders, room.gameName)
        ? rawNativeExitDoorOrders[room.gameName]
        : undefined,
    ),
  );
  const collection = createCollection(rooms, 'rooms', (room) => room.gameName, 'gameName');
  collection.values.forEach((room, roomIndex) => {
    validateRoomTemplateContracts(room, roomIndex, encounterEnvelopes);
  });
  validateRoomCollectionClosure(collection, encounterEnvelopes);
  return collection;
}
