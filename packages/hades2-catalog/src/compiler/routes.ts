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

    const prebossEntries = Object.entries(route.completion.prebossRoomGameNameByBiomeKey);
    if (prebossEntries.length === 0) {
      fail(`${routePath}.completion.prebossRoomGameNameByBiomeKey`, 'must not be empty');
    }
    const expectedPrebossBiomeKeys =
      route.key === 'Dream' ? new Set(biomes.values.map((biome) => biome.key)) : new Set(biomeKeys);
    if (
      prebossEntries.length !== expectedPrebossBiomeKeys.size ||
      prebossEntries.some(([biomeKey]) => !expectedPrebossBiomeKeys.has(biomeKey))
    ) {
      fail(
        `${routePath}.completion.prebossRoomGameNameByBiomeKey`,
        'must contain exactly one entry for every route biome',
      );
    }
    const prebossRoomGameNameByBiomeKey = Object.fromEntries(
      prebossEntries.map(([biomeKey, roomGameName]) => {
        const path = `${routePath}.completion.prebossRoomGameNameByBiomeKey.${biomeKey}`;
        requireNonEmpty(biomeKey, path);
        if (biomes.byKey[biomeKey] === undefined) fail(path, `unknown biome ${biomeKey}`);
        requireNonEmpty(roomGameName, path);
        const room = rooms.byKey[roomGameName];
        if (room === undefined) fail(path, `unknown Preboss room ${roomGameName}`);
        if (room.kind !== 'Preboss' || room.roomSetKey !== biomeKey) {
          fail(path, `${roomGameName} must be the Preboss for route biome ${biomeKey}`);
        }
        return [biomeKey, room.gameName];
      }),
    );

    const postbossRoomGameNamesByOrdinal = route.completion.postbossRoomGameNamesByOrdinal;
    const expectedPostbossCount = route.key === 'Dream' ? 4 : biomeKeys.length;
    if (postbossRoomGameNamesByOrdinal.length !== expectedPostbossCount) {
      fail(
        `${routePath}.completion.postbossRoomGameNamesByOrdinal`,
        'must contain exactly one entry for every supported route ordinal',
      );
    }
    const normalizedPostbossRoomGameNamesByOrdinal = postbossRoomGameNamesByOrdinal.map(
      (roomGameName, index) => {
        const path = `${routePath}.completion.postbossRoomGameNamesByOrdinal[${index}]`;
        if (index === expectedPostbossCount - 1 && roomGameName !== null) {
          fail(path, 'the terminal route position must be null');
        }
        if (roomGameName === null) {
          if (index !== expectedPostbossCount - 1)
            fail(path, 'only the terminal route position may be null');
          return null;
        }
        requireNonEmpty(roomGameName, path);
        const room = rooms.byKey[roomGameName];
        if (room === undefined) fail(path, `unknown PostBoss room ${roomGameName}`);
        if (
          room.kind !== 'PostBoss' ||
          (route.key === 'Dream'
            ? room.roomSetKey !== 'Dream'
            : room.roomSetKey !== biomeKeys[index])
        ) {
          fail(
            path,
            `${roomGameName} must be the PostBoss for route ${route.key === 'Dream' ? 'Dream' : `biome ${biomeKeys[index]}`}`,
          );
        }
        return room.gameName;
      },
    );

    return Object.freeze({
      key: route.key,
      label: route.label,
      biomeKeys: Object.freeze(biomeKeys),
      completion: Object.freeze({
        prebossRoomGameNameByBiomeKey: Object.freeze(prebossRoomGameNameByBiomeKey),
        postbossRoomGameNamesByOrdinal: Object.freeze(normalizedPostbossRoomGameNamesByOrdinal),
      }),
    });
  });

  return createCollection(routes, 'routes', (route) => route.key);
}
