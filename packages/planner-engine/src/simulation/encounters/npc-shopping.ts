import type { Catalog, NpcShoppingFamily } from '../../catalog-schema';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { BiomeHistoryPrefix, CanonicalBiomeHistory } from '../history/model';
import { projectEncounterPreparationRoomWindow } from '../history/facts';

export interface NpcShoppingExecutionPolicy {
  readonly occurrences: readonly {
    readonly occurrenceId: string;
    readonly suppressedNpcShopping: readonly NpcShoppingFamily[];
  }[];
}

/** Only selected identities recorded at reached preparation checkpoints protect shops. */
export function deriveNpcShoppingExecutionPolicy(
  catalog: Catalog,
  histories: readonly (BiomeHistoryPrefix | CanonicalBiomeHistory)[],
): NpcShoppingExecutionPolicy {
  const protectedShops = new Map<string, Set<NpcShoppingFamily>>();
  for (const history of histories) {
    for (const room of history.rooms) {
      const owner = semanticAddressKey(room.origin);
      const records = history.ledgers.encounterRecords.filter(
        (record) => semanticAddressKey(record.origin) === owner,
      );
      for (const record of records) {
        const protection =
          catalog.encounterDefinitions.byKey[record.encounterKey]?.npcShoppingProtection;
        if (protection === undefined) continue;
        const window = projectEncounterPreparationRoomWindow(room.preparation, room.origin);
        for (const previous of window.slice(-protection.roomWindow)) {
          // These native events belong to Shop, not optional inventories in other encounters.
          if (
            previous.origin.kind !== 'occurrence' ||
            !previous.encounterKeys.some(
              (key) => catalog.encounterDefinitions.byKey[key]?.hostsNpcShoppingEvents === true,
            )
          )
            continue;
          const id = previous.origin.occurrenceId;
          const families = protectedShops.get(id) ?? new Set<NpcShoppingFamily>();
          families.add(protection.family);
          protectedShops.set(id, families);
        }
      }
    }
  }
  return Object.freeze({
    occurrences: Object.freeze(
      [...protectedShops].map(([occurrenceId, families]) =>
        Object.freeze({
          occurrenceId,
          suppressedNpcShopping: Object.freeze(
            (['Nemesis', 'Heracles'] as const).filter((family) => families.has(family)),
          ),
        }),
      ),
    ),
  });
}
