import type { Catalog } from '../catalog-schema';

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

/** The roles of a room's fixed reward that are granted with no pickup, at any point. */
function automaticRoles(catalog: Catalog, gameName: string): ReadonlySet<string> {
  const binding = catalog.rooms.byKey[gameName]?.incomingReward;
  if (binding?.kind !== 'fixed') return new Set();
  const lifecycle =
    catalog.rewards.producerLifecycles.byKey[binding.producerLifecycleKey]?.rewardTypes.byKey[
      binding.rewardType
    ];
  return new Set(
    (lifecycle?.acquisitionLifecycle ?? []).flatMap((role) =>
      role.automatic === true ? [role.role] : [],
    ),
  );
}

function dropOccurrenceRows(occurrence: unknown, catalog: Catalog): unknown {
  const record = rawRecord(occurrence);
  const gameName = record?.gameName;
  if (record === undefined || typeof gameName !== 'string') return occurrence;
  const automatic = automaticRoles(catalog, gameName);
  const roomActions = rawRecord(record.roomActions);
  const order = roomActions?.order;
  if (automatic.size === 0 || roomActions === undefined || !Array.isArray(order)) return occurrence;
  const kept = order.filter((action) => {
    const row = rawRecord(action);
    return !(
      row?.kind === 'interactIncomingReward' &&
      typeof row.acquisitionRole === 'string' &&
      automatic.has(row.acquisitionRole)
    );
  });
  return kept.length === order.length
    ? occurrence
    : { ...record, roomActions: { ...roomActions, order: kept } };
}

/**
 * A plan saved while a room's automatic reward (the Zagreus contract's
 * Champion of Elysium) still had a pickup row loses that row: nothing in the
 * room takes it. Anything else passes unchanged.
 */
export function dropAutomaticRewardRows(raw: unknown, catalog: Catalog): unknown {
  const document = rawRecord(raw);
  const route = rawRecord(document?.route);
  const biomes = route?.biomes;
  if (document === undefined || route === undefined || !Array.isArray(biomes)) return raw;
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
            occurrences: occurrences.map((occurrence) => dropOccurrenceRows(occurrence, catalog)),
          },
        };
      }),
    },
  };
}
