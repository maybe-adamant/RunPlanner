import type { Catalog } from '../catalog-schema';
import { createBiomeAddress } from '../authored-project/addresses';
import type { RoomActionReference, RoomOccurrence } from '../authored-project/model';
import {
  roomActionCarriesContent,
  roomActionContentSource,
  roomActionItemContent,
  type RoomActionContentSource,
} from '../authored-project/room-actions/item-content';

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** Whether some producer acquires a reward of this type in this role. */
function rewardHasRole(catalog: Catalog, rewardType: string, role: unknown): boolean {
  return Object.values(catalog.rewards.producerLifecycles.byKey).some((lifecycle) =>
    (lifecycle.rewardTypes.byKey[rewardType]?.acquisitionLifecycle ?? []).some(
      (binding) => binding.role === role,
    ),
  );
}

/** The content a stored row gets, or none when its item or its own shape cannot say. */
function storedContent(
  source: RoomActionContentSource,
  occurrence: RawRecord,
  action: RawRecord,
): readonly string[] | undefined {
  try {
    const content = roomActionItemContent(
      source,
      occurrence as unknown as RoomOccurrence,
      action as unknown as RoomActionReference,
    );
    // A malformed item stays for strict decoding to reject, unstamped.
    if (
      content === null ||
      content.length === 0 ||
      !content.every((value) => typeof value === 'string' && value.trim().length > 0)
    )
      return undefined;
    // A stale pickup of a role its reward never has acts on no item and records none.
    return action.kind === 'interactIncomingReward' &&
      !rewardHasRole(source.catalog, content[1]!, action.acquisitionRole)
      ? undefined
      : content;
  } catch {
    return undefined;
  }
}

function stampOccurrence(source: RoomActionContentSource, occurrence: unknown): unknown {
  const record = rawRecord(occurrence);
  const roomActions = rawRecord(record?.roomActions);
  const order = roomActions?.order;
  if (record === undefined || roomActions === undefined || !Array.isArray(order)) return occurrence;
  return {
    ...record,
    roomActions: {
      ...roomActions,
      order: order.map((entry) => {
        const action = rawRecord(entry);
        if (
          action === undefined ||
          Object.hasOwn(action, 'content') ||
          !roomActionCarriesContent(action as unknown as RoomActionReference)
        )
          return entry;
        const content = storedContent(source, record, action);
        return content === undefined ? entry : { ...action, content: [...content] };
      }),
    },
  };
}

function stampBiome(
  catalog: Catalog,
  routeKey: string,
  biome: unknown,
  routeStart: { readonly startingReward: unknown } | undefined,
): unknown {
  const record = rawRecord(biome);
  const topology = rawRecord(record?.topology);
  const occurrences = topology?.occurrences;
  if (
    record === undefined ||
    topology === undefined ||
    !Array.isArray(occurrences) ||
    typeof record.biomeKey !== 'string'
  )
    return biome;
  let source: RoomActionContentSource;
  try {
    source = roomActionContentSource(
      catalog,
      createBiomeAddress(routeKey, record.biomeKey),
      topology as never,
      routeStart === undefined || typeof topology.startOccurrenceId !== 'string'
        ? undefined
        : {
            occurrenceId: topology.startOccurrenceId as never,
            offer: (routeStart.startingReward ?? null) as never,
          },
    );
  } catch {
    // A malformed topology stays for strict decoding to reject.
    return biome;
  }
  return {
    ...record,
    topology: {
      ...topology,
      occurrences: occurrences.map((occurrence) => stampOccurrence(source, occurrence)),
    },
  };
}

/**
 * Schema 103 rows record the content of the item they act on. Every stored
 * pickup, purchase and sale row without it gets its item's current content
 * (a door, cage or wheel reward's press is `native` or the last reroll's id);
 * a row whose item is not observed yet stays without, to be stamped once it
 * is. Lossless, and a row already carrying content is kept; the catalog
 * gives a wheel's declared offer order.
 */
export function stampRoomActionItemContent(raw: unknown, catalog: Catalog): unknown {
  const document = rawRecord(raw);
  const route = rawRecord(document?.route);
  const biomes = route?.biomes;
  if (
    document === undefined ||
    route === undefined ||
    !Array.isArray(biomes) ||
    typeof route.routeKey !== 'string'
  )
    return raw;
  const routeKey = route.routeKey;
  const itinerary = Array.isArray(route.itineraryBiomeKeys) ? route.itineraryBiomeKeys : [];
  const loadout = rawRecord(route.loadout);
  return {
    ...document,
    route: {
      ...route,
      biomes: biomes.map((biome, index) => {
        const biomeKey = rawRecord(biome)?.biomeKey;
        const first = index === 0 && biomeKey !== undefined && itinerary[0] === biomeKey;
        return stampBiome(
          catalog,
          routeKey,
          biome,
          first ? { startingReward: loadout?.startingReward ?? null } : undefined,
        );
      }),
    },
  };
}
