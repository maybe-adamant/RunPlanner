import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  type OccurrenceAddress,
  type ProjectDocument,
  type StygianWellSlotKey,
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

/** Restocks the Travel Deal refill with one item and buys it, as the owner's after-choice would. */
export function restockAndBuyStygianWellRefill(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  itemKey: string,
): ProjectDocument {
  const restocked = settleTestEdit(project, {
    kind: 'ReplaceStygianWellTravelDealRefill',
    occurrence,
    itemKey,
  });
  return settleTestEdit(restocked, {
    kind: 'SetStygianWellPurchase',
    occurrence,
    generationKey: 'travelDealRefill',
    purchased: true,
  });
}

/** Fixed items for a Well's blank initial slots, for plans no edit has settled. */
const FIXED_WELL_STOCK = Object.freeze({
  healing: 'HealDropRange',
  secondLeft: 'MemPointsCommonRange',
  secondRight: 'LimitedSwapTraitDrop',
} as const satisfies Record<StygianWellSlotKey, string>);

/** Stocks every present Well's blank initial slots with fixed items. */
export function withFixedTestWellStock(project: ProjectDocument): ProjectDocument {
  let stocked = project;
  for (const plan of project.route.biomes)
    for (const room of plan.topology?.occurrences ?? []) {
      const well = room.stygianWell;
      if (well === undefined) continue;
      const occurrence = createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, plan.biomeKey),
        room.occurrenceId,
      );
      for (const slotKey of Object.keys(FIXED_WELL_STOCK) as StygianWellSlotKey[])
        if (well.offerKeyBySlot[slotKey] === null)
          stocked = applyProjectCommand(stocked, catalog, {
            kind: 'ReplaceStygianWellOffer',
            occurrence,
            slotKey,
            itemKey: FIXED_WELL_STOCK[slotKey],
          });
    }
  return stocked;
}
