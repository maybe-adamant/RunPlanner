import type { Catalog } from '../catalog-schema';
import { roomAnchorObjectHosted } from '../simulation/room-layout/object-anchor-positions';

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** The room actions that act on each object, which go with it. */
const OBJECT_ACTIONS = Object.freeze({
  stygianWell: Object.freeze(['purchaseStygianWellOffer', 'rerollStygianWell']),
  purgingPool: Object.freeze(['sellPurgingPoolTrait', 'rerollPurgingPool']),
});

function dropOccurrenceObjects(occurrence: unknown, catalog: Catalog, routeKey: string): unknown {
  const record = rawRecord(occurrence);
  const gameName = record?.gameName;
  if (record === undefined || typeof gameName !== 'string') return occurrence;
  const dropped = (Object.keys(OBJECT_ACTIONS) as (keyof typeof OBJECT_ACTIONS)[]).filter(
    (kind) =>
      record[kind] !== undefined && !roomAnchorObjectHosted(catalog, gameName, routeKey, kind),
  );
  if (dropped.length === 0) return occurrence;
  const actionKinds = new Set<unknown>(dropped.flatMap((kind) => OBJECT_ACTIONS[kind]));
  const next: RawRecord = { ...record };
  for (const kind of dropped) delete next[kind];
  const roomActions = rawRecord(record.roomActions);
  const order = roomActions?.order;
  if (roomActions !== undefined && Array.isArray(order))
    next.roomActions = {
      ...roomActions,
      order: order.filter((action) => !actionKinds.has(rawRecord(action)?.kind)),
    };
  return next;
}

/**
 * A plan saved before its route excluded an object (a Fresh File Postboss's
 * Well or Pool) can still hold it: the object native never spawns there goes,
 * with its purchase, sale and reroll rows. Anything else passes unchanged.
 */
export function dropRouteExcludedObjects(raw: unknown, catalog: Catalog): unknown {
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
        const topology = rawRecord(record?.topology);
        const occurrences = topology?.occurrences;
        if (record === undefined || topology === undefined || !Array.isArray(occurrences))
          return biome;
        return {
          ...record,
          topology: {
            ...topology,
            occurrences: occurrences.map((occurrence) =>
              dropOccurrenceObjects(occurrence, catalog, routeKey),
            ),
          },
        };
      }),
    },
  };
}
