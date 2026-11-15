import type { Catalog } from '../../catalog-schema';
import { createOccurrenceAddress, type OccurrenceAddress } from '../addresses';
import type { ProjectDocument, RoomActionReference } from '../model';
import { roomActionDomainForOccurrence } from './defaults';
import {
  biomePlanContentSource,
  roomActionContentMatches,
  roomActionItemContent,
  roomActionReferenceContent,
} from './item-content';
import { roomActionKey } from './key';

/** One row whose item was replaced since it was placed. */
export interface ReplacedItemRow {
  readonly owner: OccurrenceAddress;
  readonly reference: RoomActionReference;
}

/**
 * Every row of the plan the roster judges on a replaced item, in every room,
 * reached or not: an active action whose item now holds content other than
 * the row recorded. A row with no active action is stale, not replaced.
 */
export function roomActionsOnReplacedItems(
  document: ProjectDocument,
  catalog: Catalog,
): readonly ReplacedItemRow[] {
  const rows: ReplacedItemRow[] = [];
  for (const plan of document.route.biomes) {
    const source = biomePlanContentSource(catalog, document, plan);
    if (source === undefined) continue;
    for (const occurrence of plan.topology?.occurrences ?? []) {
      // The item's own content first; the action domain only for a room that differs.
      const candidates = occurrence.roomActions.order.filter(
        (reference) =>
          roomActionReferenceContent(reference) !== undefined &&
          !roomActionContentMatches(
            reference,
            roomActionItemContent(source, occurrence, reference),
          ),
      );
      if (candidates.length === 0) continue;
      const active = new Map(
        (
          roomActionDomainForOccurrence(document, catalog, source.biome, occurrence.occurrenceId)
            ?.domain.contributions ?? []
        ).map((entry) => [roomActionKey(entry.reference), entry.reference] as const),
      );
      for (const reference of candidates) {
        const item = active.get(roomActionKey(reference));
        if (
          item === undefined ||
          roomActionContentMatches(reference, roomActionReferenceContent(item) ?? null)
        )
          continue;
        rows.push(
          Object.freeze({
            owner: createOccurrenceAddress(source.biome, occurrence.occurrenceId),
            reference,
          }),
        );
      }
    }
  }
  return Object.freeze(rows);
}
