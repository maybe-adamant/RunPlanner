import type { Catalog, RoomDeclaration } from '../catalog-schema';
import type { ResolvedRoutePosition } from './route-context';

/** Rivals applies to the first configured number of biomes on the route. */
export function rivalsActiveForBiome(position: ResolvedRoutePosition, rivalsRank: number): boolean {
  return rivalsRank >= position.ordinal;
}

/** Resolves the physical completion map from route position and configured Rivals rank. */
export function resolveCompletionBoss(
  catalog: Catalog,
  position: ResolvedRoutePosition,
  rivalsRank: number,
): RoomDeclaration {
  const biomeKey = position.biomeKey;
  const rivalsActive = rivalsActiveForBiome(position, rivalsRank);
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (layout === undefined) throw new Error(`cannot resolve completion Boss for ${biomeKey}`);
  const gameName =
    layout.completion.rivalsBossRoomGameName !== undefined && rivalsActive
      ? layout.completion.rivalsBossRoomGameName
      : layout.completion.bossRoomGameName;
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined || room.kind !== 'Boss') throw new Error(`${gameName} is not a Boss room`);
  return room;
}
