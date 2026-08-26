import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  ExitTypeDeclaration,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../declarations';
import { createCollection } from './common';
import { validateRoomCollectionClosure } from './room-collection-closure';
import { normalizeRoom } from './room-normalization';
import { validateRoomTemplateContracts } from './room-template-contracts';

/** Produces the compiler-private immutable room collection. */
export function normalizeRooms(
  rawRooms: readonly RawRoomDeclaration[],
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): CatalogCollection<RoomDeclaration> {
  const rooms = rawRooms.map((room, roomIndex) =>
    normalizeRoom(
      room,
      roomIndex,
      rewards,
      encounterEnvelopes,
      encounterDefinitions,
      encounterSets,
      exitTypes,
    ),
  );
  const collection = createCollection(rooms, 'rooms', (room) => room.gameName, 'gameName');
  collection.values.forEach((room, roomIndex) => {
    validateRoomTemplateContracts(room, roomIndex, encounterEnvelopes);
  });
  validateRoomCollectionClosure(collection, encounterEnvelopes);
  return collection;
}
