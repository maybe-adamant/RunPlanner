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
  /** Deferred completion is not a terminal resolution. */
  readonly completion:
    | {
        readonly kind: 'resolved';
        readonly prebossRoomGameName: string;
        readonly postbossRoomGameName: string | null;
      }
    | { readonly kind: 'deferred' };
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
  const presetPosition = route.routeKey !== 'Dream' ? declaration.biomeKeys.indexOf(biomeKey) : -1;
  if (route.routeKey !== 'Dream' && presetPosition !== ordinalIndex) {
    throw new Error(`${route.routeKey} preset itinerary disagrees at ${biomeKey}`);
  }
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
    completion:
      presetPosition < 0
        ? Object.freeze({ kind: 'deferred' as const })
        : Object.freeze({
            kind: 'resolved' as const,
            prebossRoomGameName: declaration.prebossRoomGameNames[presetPosition]!,
            postbossRoomGameName: declaration.postbossRoomGameNames[presetPosition]!,
          }),
    ...(presetPosition <= 0 || declaration.postbossRoomGameNames[presetPosition - 1] === null
      ? {}
      : { previousPostbossRoomGameName: declaration.postbossRoomGameNames[presetPosition - 1]! }),
  });
}
