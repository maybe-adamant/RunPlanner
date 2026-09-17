import type { Catalog, RoomDeclaration } from '../catalog-schema';

/** Rivals applies to the first configured number of biomes on the route. */
export function rivalsActiveForBiome(
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
  rivalsRank: number,
): boolean {
  const route = catalog.routes.byKey[routeKey];
  const routePosition = route?.biomeKeys.indexOf(biomeKey) ?? -1;
  if (routePosition < 0) throw new Error(`cannot resolve Rivals for ${routeKey}:${biomeKey}`);
  return rivalsRank >= routePosition + 1;
}

/** Resolves the physical completion map from route position and configured Rivals rank. */
export function resolveCompletionBoss(
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
  rivalsRank: number,
): RoomDeclaration {
  const rivalsActive = rivalsActiveForBiome(catalog, routeKey, biomeKey, rivalsRank);
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (layout === undefined)
    throw new Error(`cannot resolve completion Boss for ${routeKey}:${biomeKey}`);
  const gameName =
    layout.completion.rivalsBossRoomGameName !== undefined && rivalsActive
      ? layout.completion.rivalsBossRoomGameName
      : layout.completion.bossRoomGameName;
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined || room.kind !== 'Boss') throw new Error(`${gameName} is not a Boss room`);
  return room;
}
