import type { Catalog } from '../catalog-schema';
import { createBiomeAddress, createOccurrenceId } from '../authored-project/addresses';
import {
  encounterUnduplicableOwnerKeys,
  parseSeaStarDuplicateSiteKey,
} from '../authored-project/acquisition/sea-star';

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

function dropOccurrenceDuplicates(
  occurrence: unknown,
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
): unknown {
  const record = rawRecord(occurrence);
  const gameName = record?.gameName;
  const occurrenceId = record?.occurrenceId;
  const sites = rawRecord(record?.acquisitionSites);
  if (
    record === undefined ||
    sites === undefined ||
    typeof gameName !== 'string' ||
    typeof occurrenceId !== 'string' ||
    occurrenceId.trim() === '' ||
    routeKey.trim() === '' ||
    biomeKey.trim() === ''
  )
    return occurrence;
  const owners = encounterUnduplicableOwnerKeys(catalog, createBiomeAddress(routeKey, biomeKey), {
    occurrenceId: createOccurrenceId(occurrenceId),
    gameName,
    acquisitionSites: Object.fromEntries(
      Object.entries(sites).map(([key, site]) => [
        key,
        { pickupEntries: rawRecord(rawRecord(site)?.pickupEntries) ?? {} },
      ]),
    ),
  });
  const dropped = new Set(
    Object.keys(sites).filter((siteKey) => {
      const source = parseSeaStarDuplicateSiteKey(siteKey)?.sourceKey;
      return source !== undefined && owners.has(source);
    }),
  );
  if (dropped.size === 0) return occurrence;
  const next: RawRecord = { ...record };
  const kept = Object.fromEntries(Object.entries(sites).filter(([key]) => !dropped.has(key)));
  if (Object.keys(kept).length === 0) delete next.acquisitionSites;
  else next.acquisitionSites = kept;
  const roomActions = rawRecord(record.roomActions);
  const order = roomActions?.order;
  if (roomActions !== undefined && Array.isArray(order))
    next.roomActions = {
      ...roomActions,
      order: order.filter((action) => {
        const row = rawRecord(action);
        return !(
          row?.kind === 'interactAcquisitionEntry' &&
          typeof row.siteKey === 'string' &&
          dropped.has(row.siteKey)
        );
      }),
    };
  return next;
}

/**
 * A plan saved while Sea Star could still copy a reward its room's encounter
 * spawns as never duplicating (an Anomaly's reward or its Artificer
 * replacement) loses that copy and its pickup row, as clearing the proc does.
 * Anything else passes unchanged.
 */
export function dropUnduplicableSeaStarDuplicates(raw: unknown, catalog: Catalog): unknown {
  const document = rawRecord(raw);
  const route = rawRecord(document?.route);
  const routeKey = route?.routeKey;
  const biomes = route?.biomes;
  if (document === undefined || route === undefined || typeof routeKey !== 'string') return raw;
  if (!Array.isArray(biomes)) return raw;
  return {
    ...document,
    route: {
      ...route,
      biomes: biomes.map((biome) => {
        const record = rawRecord(biome);
        const biomeKey = record?.biomeKey;
        const topology = rawRecord(record?.topology);
        const occurrences = topology?.occurrences;
        if (
          record === undefined ||
          typeof biomeKey !== 'string' ||
          topology === undefined ||
          !Array.isArray(occurrences)
        )
          return biome;
        return {
          ...record,
          topology: {
            ...topology,
            occurrences: occurrences.map((occurrence) =>
              dropOccurrenceDuplicates(occurrence, catalog, routeKey, biomeKey),
            ),
          },
        };
      }),
    },
  };
}
