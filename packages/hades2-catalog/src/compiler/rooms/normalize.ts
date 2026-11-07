import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  ExitTypeDeclaration,
  RoomDeclaration,
  RoomMapPoints,
  RoomOrientation,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../../declarations/index';
import { createCollection } from '../common';
import { fail } from '../errors';
import { validateRoomCollectionClosure } from './collection-closure';
import { normalizeRoomMapPoints } from './map-points';
import { normalizeRoom } from './normalize-room';
import { normalizeRoomOrientation } from './orientation';
import { validateRoomTemplateContracts } from './template-contracts';

/** Produces the compiler-private immutable room collection. */
export function normalizeRooms(
  rawRooms: readonly RawRoomDeclaration[],
  rawExitDoorSetupOrders: Readonly<Record<string, readonly (readonly [number, string])[]>>,
  rawSwappableBreakables: Readonly<Record<string, number>>,
  rawRoomMapPoints: Readonly<Record<string, RoomMapPoints>>,
  rawRoomOrientations: Readonly<Record<string, RoomOrientation>>,
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): CatalogCollection<RoomDeclaration> {
  const declaredGameNames = new Set(rawRooms.map((room) => room.gameName));
  for (const gameName of Object.keys(rawExitDoorSetupOrders))
    if (!declaredGameNames.has(gameName))
      fail(`exitDoorSetupOrders.${gameName}`, 'is not a declared room');
  for (const [gameName, count] of Object.entries(rawSwappableBreakables)) {
    if (!declaredGameNames.has(gameName))
      fail(`swappableBreakables.${gameName}`, 'is not a declared room');
    if (!Number.isInteger(count) || count <= 0)
      fail(`swappableBreakables.${gameName}`, 'must be a positive integer');
  }
  for (const gameName of Object.keys(rawRoomMapPoints))
    if (!declaredGameNames.has(gameName))
      fail(`roomMapPoints.${gameName}`, 'is not a declared room');
  for (const gameName of Object.keys(rawRoomOrientations))
    if (!declaredGameNames.has(gameName))
      fail(`roomOrientations.${gameName}`, 'is not a declared room');
  const rooms = rawRooms.map((room, roomIndex) => {
    const mapPoints = Object.hasOwn(rawRoomMapPoints, room.gameName)
      ? normalizeRoomMapPoints(rawRoomMapPoints[room.gameName]!, `roomMapPoints.${room.gameName}`)
      : undefined;
    const orientation = Object.hasOwn(rawRoomOrientations, room.gameName)
      ? normalizeRoomOrientation(
          rawRoomOrientations[room.gameName]!,
          mapPoints,
          `roomOrientations.${room.gameName}`,
        )
      : undefined;
    return normalizeRoom(
      room,
      roomIndex,
      rewards,
      encounterEnvelopes,
      encounterDefinitions,
      encounterSets,
      exitTypes,
      Object.hasOwn(rawExitDoorSetupOrders, room.gameName)
        ? rawExitDoorSetupOrders[room.gameName]
        : undefined,
      Object.hasOwn(rawSwappableBreakables, room.gameName)
        ? rawSwappableBreakables[room.gameName]
        : undefined,
      mapPoints,
      orientation,
    );
  });
  const collection = createCollection(rooms, 'rooms', (room) => room.gameName, 'gameName');
  collection.values.forEach((room, roomIndex) => {
    validateRoomTemplateContracts(room, roomIndex, encounterEnvelopes);
  });
  validateRoomCollectionClosure(collection, encounterEnvelopes);
  return collection;
}
