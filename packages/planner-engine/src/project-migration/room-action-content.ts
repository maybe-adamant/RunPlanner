import type { Catalog } from '../catalog-schema';
import { createBiomeAddress } from '../authored-project/addresses';
import { decodeProjectDocument } from '../authored-project/codec';
import type {
  OccurrenceId,
  ProjectDocument,
  RoomActionReference,
  RoomOccurrence,
} from '../authored-project/model';
import { roomActionDomainForOccurrence } from '../authored-project/room-actions/defaults';
import { roomActionKey } from '../authored-project/room-actions/key';
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

/**
 * The keys of a room's active actions, as the decoded plan's action domain
 * names them; undefined when the plan does not decode yet, where a role check
 * stands in.
 */
type ActiveKeys = (biomeKey: string, occurrenceId: string) => ReadonlySet<string> | undefined;

function activeKeysOf(raw: unknown, catalog: Catalog, routeKey: string): ActiveKeys {
  let document: ProjectDocument | undefined;
  try {
    document = decodeProjectDocument(raw, catalog);
  } catch {
    // Strict decoding reports a malformed plan after the lift; it stamps by role meanwhile.
    return () => undefined;
  }
  const decoded = document;
  return (biomeKey, occurrenceId) => {
    try {
      return new Set(
        (
          roomActionDomainForOccurrence(
            decoded,
            catalog,
            createBiomeAddress(routeKey, biomeKey),
            occurrenceId as OccurrenceId,
          )?.domain.contributions ?? []
        ).map((entry) => roomActionKey(entry.reference)),
      );
    } catch {
      // A plan that decodes but whose route the domain cannot place stamps by role.
      return undefined;
    }
  };
}

/** The content a stored row gets, or none when its item or its own shape cannot say. */
function storedContent(
  source: RoomActionContentSource,
  occurrence: RawRecord,
  action: RawRecord,
  active: ReadonlySet<string> | undefined,
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
    // A stale row acts on no item of its room and records none.
    if (active !== undefined)
      return active.has(roomActionKey(action as unknown as RoomActionReference))
        ? content
        : undefined;
    return action.kind === 'interactIncomingReward' &&
      !rewardHasRole(source.catalog, content[1]!, action.acquisitionRole)
      ? undefined
      : content;
  } catch {
    return undefined;
  }
}

function stampOccurrence(
  source: RoomActionContentSource,
  occurrence: unknown,
  activeKeys: (occurrenceId: string) => ReadonlySet<string> | undefined,
): unknown {
  const record = rawRecord(occurrence);
  const roomActions = rawRecord(record?.roomActions);
  const order = roomActions?.order;
  if (record === undefined || roomActions === undefined || !Array.isArray(order)) return occurrence;
  const active =
    typeof record.occurrenceId === 'string' ? activeKeys(record.occurrenceId) : undefined;
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
        const content = storedContent(source, record, action, active);
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
  activeKeys: ActiveKeys,
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
      occurrences: occurrences.map((occurrence) =>
        stampOccurrence(source, occurrence, (occurrenceId) =>
          activeKeys(String(record.biomeKey), occurrenceId),
        ),
      ),
    },
  };
}

/**
 * Schema 103 rows record the content of the item they act on. Every stored
 * pickup, purchase and sale row without it that its room still offers (a stale
 * row acts on no item) gets its item's current content
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
  const activeKeys = activeKeysOf(raw, catalog, routeKey);
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
          activeKeys,
        );
      }),
    },
  };
}
