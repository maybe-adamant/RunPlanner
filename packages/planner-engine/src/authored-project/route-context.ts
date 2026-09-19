import type { Catalog } from '../catalog-schema';
import type { AuthoredRoutePlan } from './model';

/** One resolved placement in an authored route itinerary. */
export interface ResolvedRoutePosition {
  readonly routeKey: string;
  readonly itineraryBiomeKeys: readonly string[];
  readonly biomeKey: string;
  readonly ordinal: number;
  readonly previousBiomeKey?: string;
  readonly nextBiomeKey?: string;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  /** Exact fixed completion identities resolved from this route position. */
  readonly completion: {
    readonly prebossRoomGameName: string;
    readonly postbossRoomGameName: string | null;
  };
  /** Exact previous completion identity when the declaration resolves one. */
  readonly previousPostbossRoomGameName?: string;
}

/**
 * Resolves the one route-owned context every chronological consumer shares.
 * It deliberately never substitutes a catalog route for a missing authored
 * itinerary.
 */
export function resolveRoutePosition(
  catalog: Catalog,
  route: Pick<AuthoredRoutePlan, 'routeKey' | 'itineraryBiomeKeys'>,
  biomeKey: string,
): ResolvedRoutePosition {
  const ordinalIndex = route.itineraryBiomeKeys.indexOf(biomeKey);
  if (ordinalIndex < 0) {
    throw new Error(`${route.routeKey} itinerary does not contain ${biomeKey}`);
  }
  const declaration = catalog.routes.byKey[route.routeKey];
  if (declaration === undefined) throw new Error(`unknown route ${route.routeKey}`);
  const presetPosition = declaration.biomeKeys.indexOf(biomeKey);
  if (route.routeKey !== 'Dream' && presetPosition !== ordinalIndex) {
    throw new Error(`${route.routeKey} preset itinerary disagrees at ${biomeKey}`);
  }
  const prebossRoomGameName = declaration.completion.prebossRoomGameNameByBiomeKey[biomeKey];
  const declaredPostbossRoomGameName =
    declaration.completion.postbossRoomGameNamesByOrdinal[ordinalIndex];
  if (prebossRoomGameName === undefined || declaredPostbossRoomGameName === undefined) {
    throw new Error(
      `${route.routeKey} has no completion mapping for ${biomeKey} at ${ordinalIndex + 1}`,
    );
  }
  const postbossRoomGameName =
    ordinalIndex === route.itineraryBiomeKeys.length - 1 ? null : declaredPostbossRoomGameName;
  return Object.freeze({
    routeKey: route.routeKey,
    itineraryBiomeKeys: route.itineraryBiomeKeys,
    biomeKey,
    ordinal: ordinalIndex + 1,
    ...(route.itineraryBiomeKeys[ordinalIndex - 1] === undefined
      ? {}
      : { previousBiomeKey: route.itineraryBiomeKeys[ordinalIndex - 1] }),
    ...(route.itineraryBiomeKeys[ordinalIndex + 1] === undefined
      ? {}
      : { nextBiomeKey: route.itineraryBiomeKeys[ordinalIndex + 1] }),
    isFirst: ordinalIndex === 0,
    isLast: ordinalIndex === route.itineraryBiomeKeys.length - 1,
    completion: Object.freeze({ prebossRoomGameName, postbossRoomGameName }),
    ...(ordinalIndex <= 0 ||
    declaration.completion.postbossRoomGameNamesByOrdinal[ordinalIndex - 1] === null
      ? {}
      : {
          previousPostbossRoomGameName:
            declaration.completion.postbossRoomGameNamesByOrdinal[ordinalIndex - 1]!,
        }),
  });
}
