import type { BiomeDeclaration, CatalogCollection, RouteDeclaration } from '@run-planner/core';

import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

export function normalizeRoutes(
  rawRoutes: readonly RouteDeclaration[],
  biomes: CatalogCollection<BiomeDeclaration>,
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

    return Object.freeze({
      key: route.key,
      label: route.label,
      biomeKeys: Object.freeze(biomeKeys),
    });
  });

  return createCollection(routes, 'routes', (route) => route.key);
}
