import type { Catalog, RoomDeclaration } from '../catalog-schema';

/** Resolves the physical completion map from route position and configured Rivals rank. */
export function resolveCompletionBoss(
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
  rivalsRank: number,
): RoomDeclaration {
  const route = catalog.routes.byKey[routeKey];
  const routePosition = route?.biomeKeys.indexOf(biomeKey) ?? -1;
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (routePosition < 0 || layout === undefined)
    throw new Error(`cannot resolve completion Boss for ${routeKey}:${biomeKey}`);
  const gameName =
    layout.completion.rivalsBossRoomGameName !== undefined && rivalsRank >= routePosition + 1
      ? layout.completion.rivalsBossRoomGameName
      : layout.completion.bossRoomGameName;
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined || room.kind !== 'Boss') throw new Error(`${gameName} is not a Boss room`);
  return room;
}
