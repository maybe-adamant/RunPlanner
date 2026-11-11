import type {
  OccurrenceAddress,
  ProjectDocument,
  StygianWellSlotKey,
} from '@run-planner/engine/authored-project';
import { settleTestEdit } from '@run-planner/test-fixtures/shared';

/**
 * Pins another item in a bought Well slot: the swap removes its purchase, and
 * the owner buys it again where it stood.
 */
export function repinBoughtStygianWellSlot(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  slotKey: StygianWellSlotKey,
  itemKey: string,
): ProjectDocument {
  const generationKey = `initial:${slotKey}` as const;
  const index = project.route.biomes
    .find((biome) => biome.biomeKey === occurrence.biomeKey)
    ?.topology?.occurrences.find((room) => room.occurrenceId === occurrence.occurrenceId)
    ?.roomActions.order.findIndex(
      (row) => row.kind === 'purchaseStygianWellOffer' && row.generationKey === generationKey,
    );
  if (index === undefined || index < 0) throw new Error(`${slotKey} is not bought`);
  const swapped = settleTestEdit(project, {
    kind: 'ReplaceStygianWellOffer',
    occurrence,
    slotKey,
    itemKey,
  });
  return settleTestEdit(swapped, {
    kind: 'SetStygianWellPurchase',
    occurrence,
    generationKey,
    purchased: true,
    index,
  });
}
