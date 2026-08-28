import type {
  BiomeDeclaration,
  CatalogCollection,
  RoomDeclaration,
  RouteDeclaration,
} from '@run-planner/engine/catalog-schema';

import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

export function normalizeRoutes(
  rawRoutes: readonly RouteDeclaration[],
  biomes: CatalogCollection<BiomeDeclaration>,
  rooms: CatalogCollection<RoomDeclaration>,
): CatalogCollection<RouteDeclaration> {
  const routes = rawRoutes.map((route, routeIndex) => {
    const routePath = `routes[${routeIndex}]`;
    requireNonEmpty(route.key, `${routePath}.key`);
    requireNonEmpty(route.label, `${routePath}.label`);

    const seenBiomes = new Set<string>();
    const biomeKeys = route.biomeKeys.map((biomeKey, biomeIndex) => {
      const path = `${routePath}.biomeKeys[${biomeIndex}]`;
      requireNonEmpty(biomeKey, path);
      if (biomes.byKey[biomeKey] === undefined) {
        fail(path, `unknown biome ${biomeKey}`);
      }
      if (seenBiomes.has(biomeKey)) {
        fail(path, `duplicates biome ${biomeKey} within route ${route.key}`);
      }
      seenBiomes.add(biomeKey);
      return biomeKey;
    });

    if (route.postbossRoomGameNames.length !== biomeKeys.length) {
      fail(
        `${routePath}.postbossRoomGameNames`,
        'must contain exactly one entry for every route biome',
      );
    }
    const postbossRoomGameNames = route.postbossRoomGameNames.map((roomGameName, index) => {
      const path = `${routePath}.postbossRoomGameNames[${index}]`;
      if (index === biomeKeys.length - 1 && roomGameName !== null) {
        fail(path, 'the terminal route position must be null');
      }
      if (roomGameName === null) {
        if (index !== biomeKeys.length - 1)
          fail(path, 'only the terminal route position may be null');
        return null;
      }
      requireNonEmpty(roomGameName, path);
      const room = rooms.byKey[roomGameName];
      if (room === undefined) fail(path, `unknown PostBoss room ${roomGameName}`);
      if (room.kind !== 'PostBoss' || room.roomSetKey !== biomeKeys[index]) {
        fail(path, `${roomGameName} must be the PostBoss for route biome ${biomeKeys[index]}`);
      }
      return room.gameName;
    });

    return Object.freeze({
      key: route.key,
      label: route.label,
      biomeKeys: Object.freeze(biomeKeys),
      postbossRoomGameNames: Object.freeze(postbossRoomGameNames),
    });
  });

  return createCollection(routes, 'routes', (route) => route.key);
}
