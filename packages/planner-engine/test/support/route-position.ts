import type { Catalog } from '../../src/catalog-schema';
import {
  resolveRoutePosition,
  type ResolvedRoutePosition,
} from '../../src/authored-project/route-context';

/** Explicit ordinary route context for direct-biome test adapters. */
export function ordinaryRoutePosition(
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
): ResolvedRoutePosition {
  const declaration = catalog.routes.byKey[routeKey];
  if (declaration === undefined || (routeKey !== 'Underworld' && routeKey !== 'Surface')) {
    throw new Error(`${routeKey} is not an ordinary test route`);
  }
  return resolveRoutePosition(
    catalog,
    {
      routeKey,
      itineraryBiomeKeys: declaration.biomeKeys,
    },
    biomeKey,
  );
}

export function ordinaryPositionFor(
  catalog: Catalog,
  biome: { readonly routeKey: string; readonly biomeKey: string },
): ResolvedRoutePosition {
  return ordinaryRoutePosition(catalog, biome.routeKey, biome.biomeKey);
}
