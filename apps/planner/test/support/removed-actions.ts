import {
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  echoGoldIPrebossShopId,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';

/** The I Preboss Shop whose Gold Gold Gold duplicate follows the H bridge Echo. */
export const echoShop: OccurrenceAddress = createOccurrenceAddress(
  goldenIBiome,
  echoGoldIPrebossShopId,
);

/** The H bridge Echo takes another option than Gold Gold Gold, in another room than the Shop. */
export const swapEchoAway: ProjectCommand = {
  kind: 'ReplaceTraitSelection',
  trait: createTraitOfferAddress(
    createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
      'Encounter',
    ),
    'selection',
  ),
  selectedOptionKey: 'option2',
};

export const echoDuplicateKey = roomActionKey({
  kind: 'interactAcquisitionEntry',
  siteKey: 'roomExit',
  entryKey: 'echoDoubleShopReward',
});

/** The Shop's saved Timeline row keys. */
export function echoShopRows(project: ProjectDocument): readonly string[] {
  const room = project.route.biomes
    .find((plan) => plan.biomeKey === echoShop.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === echoShop.occurrenceId);
  if (room === undefined) throw new Error('the Echo Shop is missing');
  return room.roomActions.order.map(roomActionKey);
}
