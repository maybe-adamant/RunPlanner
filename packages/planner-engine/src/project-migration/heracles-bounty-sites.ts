import type { Catalog } from '../catalog-schema';
import { createBiomeAddress } from '../authored-project/addresses';
import { heraclesBountyPickupProducers } from '../authored-project/acquisition/pickup-producers';
import type { RoomOccurrence } from '../authored-project/model';
import {
  resolveRoutePosition,
  type ResolvedRoutePosition,
} from '../authored-project/route-context';
import { resolveEntryDeclaration } from '../authored-project/room-state/entry-resolution';
import { createSelectedPickupEntries } from '../authored-project/traits/state';

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** The occurrence with every bounty site its phases own and it lacks, or undefined when none is missing. */
function withBountySites(
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
  routePosition: ResolvedRoutePosition,
  occurrence: RawRecord,
): RawRecord | undefined {
  const room =
    typeof occurrence.gameName === 'string' ? catalog.rooms.byKey[occurrence.gameName] : undefined;
  const encounters = rawRecord(occurrence.encounters);
  if (room === undefined || room.mode.kind !== 'authored' || encounters === undefined)
    return undefined;
  const sites = rawRecord(occurrence.acquisitionSites);
  if (occurrence.acquisitionSites !== undefined && sites === undefined) return undefined;
  const producers = heraclesBountyPickupProducers(
    catalog,
    createBiomeAddress(routeKey, biomeKey),
    occurrence as unknown as RoomOccurrence,
    resolveEntryDeclaration(room, routePosition),
  ).filter((producer) => sites?.[producer.siteKey] === undefined);
  if (producers.length === 0) return undefined;
  return {
    ...occurrence,
    acquisitionSites: {
      ...sites,
      ...Object.fromEntries(
        producers.map((producer) => [
          producer.siteKey,
          {
            pickupEntries: JSON.parse(
              JSON.stringify(createSelectedPickupEntries(catalog, producer, routeKey)),
            ) as unknown,
          },
        ]),
      ),
    },
  };
}

/**
 * A plan saved before Heracles's bounty was a pickup (schema 101.2) holds no
 * bounty site for a phase he fights. Adds each missing site with its unresolved
 * money drop, never its collect row, which stays the owner's to place; returns
 * the input itself when nothing is missing. Malformed structure is left for
 * strict decoding to reject.
 */
export function addHeraclesBountySites(value: unknown, catalog: Catalog): unknown {
  const document = rawRecord(value);
  const route = rawRecord(document?.route);
  const routeKey = route?.routeKey;
  const itinerary = route?.itineraryBiomeKeys;
  const biomes = route?.biomes;
  if (
    document === undefined ||
    route === undefined ||
    typeof routeKey !== 'string' ||
    !Array.isArray(itinerary) ||
    !Array.isArray(biomes)
  )
    return value;
  let changed = false;
  const nextBiomes = biomes.map((biome) => {
    const plan = rawRecord(biome);
    const topology = rawRecord(plan?.topology);
    const occurrences = topology?.occurrences;
    const biomeKey = plan?.biomeKey;
    if (typeof biomeKey !== 'string' || topology === undefined || !Array.isArray(occurrences))
      return biome;
    let routePosition: ResolvedRoutePosition;
    try {
      routePosition = resolveRoutePosition(
        catalog,
        { routeKey, itineraryBiomeKeys: itinerary as readonly string[] },
        biomeKey,
      );
    } catch {
      return biome;
    }
    let biomeChanged = false;
    const nextOccurrences = occurrences.map((raw) => {
      const occurrence = rawRecord(raw);
      if (occurrence === undefined) return raw;
      let next: RawRecord | undefined;
      try {
        next = withBountySites(catalog, routeKey, biomeKey, routePosition, occurrence);
      } catch {
        return raw;
      }
      if (next === undefined) return raw;
      biomeChanged = true;
      return next;
    });
    if (!biomeChanged) return biome;
    changed = true;
    return { ...plan, topology: { ...topology, occurrences: nextOccurrences } };
  });
  return changed ? { ...document, route: { ...route, biomes: nextBiomes } } : value;
}
