import type {
  CatalogCollection,
  CompletionDescriptor,
  RoomDeclaration,
  StartDescriptor,
} from '@run-planner/engine/catalog-schema';

import type { RawBiomeLayoutDeclaration } from '../../declarations/index';
import { freezeUniqueStrings, requireNonEmpty } from '../common';
import { fail } from '../errors';

export function requireLayoutRoom(
  gameName: string,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): RoomDeclaration {
  requireNonEmpty(gameName, path);
  const room = rooms.byKey[gameName];
  if (room === undefined) {
    fail(path, `unknown room ${gameName}`);
  }
  if (room.roomSetKey !== biomeKey) {
    fail(path, `${gameName} must belong to ${biomeKey}`);
  }
  return room;
}
export function normalizeLayoutStart(
  rawStart: RawBiomeLayoutDeclaration['start'],
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): StartDescriptor {
  if (rawStart.kind === 'authoredChoice') {
    const roomGameNames = freezeUniqueStrings(rawStart.roomGameNames, `${path}.roomGameNames`);
    if (roomGameNames.length === 0) {
      fail(`${path}.roomGameNames`, 'must not be empty');
    }
    roomGameNames.forEach((gameName, index) => {
      const room = requireLayoutRoom(gameName, biomeKey, rooms, `${path}.roomGameNames[${index}]`);
      if (room.mode.kind !== 'authored' || room.kind !== 'Opening') {
        fail(`${path}.roomGameNames[${index}]`, `${gameName} must be an authored Opening`);
      }
    });
    return Object.freeze({
      kind: 'authoredChoice',
      roomGameNames: roomGameNames as readonly [string, ...string[]],
    });
  }
  if (rawStart.kind !== 'fixedAuthored') {
    fail(
      `${path}.kind`,
      `unknown start descriptor ${String((rawStart as { kind?: unknown }).kind)}`,
    );
  }
  const room = requireLayoutRoom(rawStart.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
  if (room.mode.kind !== 'authored' || (room.kind !== 'Intro' && room.kind !== 'Opening')) {
    fail(`${path}.roomGameName`, `${room.gameName} must be an authored Intro or Opening`);
  }
  return Object.freeze({ kind: 'fixedAuthored', roomGameName: room.gameName });
}

export function normalizeLayoutCompletion(
  rawCompletion: CompletionDescriptor,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): CompletionDescriptor {
  const bossRoom = requireLayoutRoom(
    rawCompletion.bossRoomGameName,
    biomeKey,
    rooms,
    `${path}.bossRoomGameName`,
  );
  if (bossRoom.kind !== 'Boss') {
    fail(`${path}.bossRoomGameName`, `${bossRoom.gameName} must be a Boss room`);
  }
  const rivalsBossRoom =
    rawCompletion.rivalsBossRoomGameName === undefined
      ? undefined
      : requireLayoutRoom(
          rawCompletion.rivalsBossRoomGameName,
          biomeKey,
          rooms,
          `${path}.rivalsBossRoomGameName`,
        );
  if (rivalsBossRoom !== undefined && rivalsBossRoom.kind !== 'Boss') {
    fail(`${path}.rivalsBossRoomGameName`, `${rivalsBossRoom.gameName} must be a Boss room`);
  }
  if (rivalsBossRoom?.gameName === bossRoom.gameName) {
    fail(`${path}.rivalsBossRoomGameName`, 'must name a distinct Boss room');
  }
  const expectedAxes = ['biomeDepthCache', 'biomeEncounterDepth'] as const;
  if (rawCompletion.transitionEffects.length !== expectedAxes.length) {
    fail(`${path}.transitionEffects`, `requires resets for ${expectedAxes.join(', ')}`);
  }
  const transitionEffects = rawCompletion.transitionEffects.map((effect, index) => {
    if (effect.kind !== 'resetCounter' || effect.axis !== expectedAxes[index]) {
      fail(`${path}.transitionEffects[${index}]`, `must reset ${expectedAxes[index]}`);
    }
    return Object.freeze({ kind: 'resetCounter' as const, axis: effect.axis });
  });
  return Object.freeze({
    bossRoomGameName: bossRoom.gameName,
    ...(rivalsBossRoom === undefined ? {} : { rivalsBossRoomGameName: rivalsBossRoom.gameName }),
    transitionEffects: Object.freeze(transitionEffects),
  });
}
