import type {
  BiomeDeclaration,
  CatalogCollection,
  RoomDeclaration,
  RouteDeclaration,
} from '@run-planner/engine/catalog-schema';

import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

function normalizeDreamItinerary(
  route: RouteDeclaration,
  routePath: string,
  biomes: CatalogCollection<BiomeDeclaration>,
): RouteDeclaration['dreamItinerary'] {
  if (route.key !== 'Dream') {
    if (route.dreamItinerary !== undefined) fail(`${routePath}.dreamItinerary`, 'is Dream-only');
    return undefined;
  }
  const declaration = route.dreamItinerary;
  if (declaration === undefined) fail(`${routePath}.dreamItinerary`, 'is required for Dream');
  if (!Number.isInteger(declaration.biomeCount) || declaration.biomeCount <= 0) {
    fail(`${routePath}.dreamItinerary.biomeCount`, 'must be a positive integer');
  }
  const normalizePool = (keys: readonly string[], path: string) => {
    if (keys.length === 0) fail(path, 'must not be empty');
    const seen = new Set<string>();
    return Object.freeze(
      keys.map((key, index) => {
        const keyPath = `${path}[${index}]`;
        requireNonEmpty(key, keyPath);
        if (biomes.byKey[key] === undefined) fail(keyPath, `unknown biome ${key}`);
        if (seen.has(key)) fail(keyPath, `duplicates biome ${key}`);
        seen.add(key);
        return key;
      }),
    );
  };
  const initialBiomeKeys = normalizePool(
    declaration.initialBiomeKeys,
    `${routePath}.dreamItinerary.initialBiomeKeys`,
  );
  const laterAdditionalBiomeKeys = normalizePool(
    declaration.laterAdditionalBiomeKeys,
    `${routePath}.dreamItinerary.laterAdditionalBiomeKeys`,
  );
  for (const key of laterAdditionalBiomeKeys) {
    if (initialBiomeKeys.includes(key)) {
      fail(
        `${routePath}.dreamItinerary.laterAdditionalBiomeKeys`,
        `duplicates initial biome ${key}`,
      );
    }
  }
  const allowed = new Set([...initialBiomeKeys, ...laterAdditionalBiomeKeys]);
  const successors = Object.entries(declaration.naturalSuccessorByBiomeKey).map(
    ([biomeKey, successor]) => {
      const path = `${routePath}.dreamItinerary.naturalSuccessorByBiomeKey.${biomeKey}`;
      if (!allowed.has(biomeKey)) fail(path, `unknown itinerary biome ${biomeKey}`);
      if (!allowed.has(successor)) fail(path, `unknown successor biome ${successor}`);
      return [biomeKey, successor] as const;
    },
  );
  return Object.freeze({
    biomeCount: declaration.biomeCount,
    initialBiomeKeys,
    laterAdditionalBiomeKeys,
    naturalSuccessorByBiomeKey: Object.freeze(Object.fromEntries(successors)),
  });
}

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
    const dreamItinerary = normalizeDreamItinerary(route, routePath, biomes);

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
      ...(dreamItinerary === undefined ? {} : { dreamItinerary }),
    });
  });

  return createCollection(routes, 'routes', (route) => route.key);
}
