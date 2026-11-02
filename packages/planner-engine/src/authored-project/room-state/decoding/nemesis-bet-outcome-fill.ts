import type { Catalog } from '../../../catalog-schema';
import { resolveRoutePosition, type ResolvedRoutePosition } from '../../route-context';
import { encounterBindingHostsNemesisBet, encounterBindingsBySlot } from '../encounter-envelope';
import { resolveEntryDeclaration } from '../entry-resolution';

type RawRecord = Record<string, unknown>;

interface MissingOutcomes {
  readonly biomeIndex: number;
  readonly occurrenceIndex: number;
  readonly phaseKeys: readonly string[];
}

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** The biome's route position as strict decoding resolves it, or undefined where it would reject. */
function rawRoutePosition(
  catalog: Catalog,
  route: RawRecord,
  routeKey: string,
  biomeIndex: number,
): ResolvedRoutePosition | undefined {
  const itinerary = route.itineraryBiomeKeys;
  if (!Array.isArray(itinerary) || !itinerary.every((key) => typeof key === 'string'))
    return undefined;
  const biomeKey = itinerary[biomeIndex] as string | undefined;
  const biomes = route.biomes as readonly unknown[];
  if (biomeKey === undefined || rawRecord(biomes[biomeIndex])?.biomeKey !== biomeKey)
    return undefined;
  try {
    return resolveRoutePosition(
      catalog,
      { routeKey, itineraryBiomeKeys: itinerary as readonly string[] },
      biomeKey,
    );
  } catch {
    return undefined;
  }
}

function rawOccurrences(route: RawRecord, biomeIndex: number): readonly unknown[] | undefined {
  const biomes = route.biomes;
  if (!Array.isArray(biomes)) return undefined;
  const occurrences = rawRecord(rawRecord(biomes[biomeIndex])?.topology)?.occurrences;
  return Array.isArray(occurrences) ? occurrences : undefined;
}

/**
 * Schema 100 documents saved before the Nemesis kill race became a complete
 * leaf stored a win by omission. Fills a win for each phase whose binding can
 * field a bet combat and has no outcome, keeping an authored tie or loss, and
 * returns the input itself when nothing is missing. Malformed structure is
 * left for strict decoding to reject.
 */
export function fillSchema100NemesisBetOutcomes(value: unknown, catalog: Catalog): unknown {
  const document = rawRecord(value);
  const route = rawRecord(document?.route);
  const routeKey = route?.routeKey;
  if (document?.schemaVersion !== 100 || route === undefined || typeof routeKey !== 'string')
    return value;
  const missing: MissingOutcomes[] = [];
  const biomeCount = Array.isArray(route.biomes) ? route.biomes.length : 0;
  for (let biomeIndex = 0; biomeIndex < biomeCount; biomeIndex += 1) {
    const routePosition = rawRoutePosition(catalog, route, routeKey, biomeIndex);
    if (routePosition === undefined) continue;
    (rawOccurrences(route, biomeIndex) ?? []).forEach((rawOccurrence, occurrenceIndex) => {
      const occurrence = rawRecord(rawOccurrence);
      const encounters = rawRecord(occurrence?.encounters);
      const gameName = occurrence?.gameName;
      if (encounters === undefined || typeof gameName !== 'string') return;
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined || room.mode.kind !== 'authored') return;
      const stored = encounters.nemesisBetOutcomeByPhase;
      const storedOutcomes = rawRecord(stored);
      if (stored !== undefined && storedOutcomes === undefined) return;
      const declaration = resolveEntryDeclaration(room, routePosition);
      const path = `rooms.${gameName}.encounters`;
      const phaseKeys = [...encounterBindingsBySlot(catalog, declaration, path).values()]
        .filter((binding) => encounterBindingHostsNemesisBet(catalog, binding, path))
        .map((binding) => binding.slotKey)
        .filter((phaseKey) => storedOutcomes?.[phaseKey] === undefined);
      if (stored === undefined || phaseKeys.length > 0)
        missing.push({ biomeIndex, occurrenceIndex, phaseKeys });
    });
  }
  if (missing.length === 0) return value;
  const copy = JSON.parse(JSON.stringify(document)) as RawRecord;
  const copiedRoute = copy.route as RawRecord;
  for (const { biomeIndex, occurrenceIndex, phaseKeys } of missing) {
    const encounters = (rawOccurrences(copiedRoute, biomeIndex)![occurrenceIndex] as RawRecord)
      .encounters as RawRecord;
    encounters.nemesisBetOutcomeByPhase = {
      ...rawRecord(encounters.nemesisBetOutcomeByPhase),
      ...Object.fromEntries(phaseKeys.map((phaseKey) => [phaseKey, 'win'])),
    };
  }
  return copy;
}
