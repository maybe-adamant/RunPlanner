import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  objectCommandInsertionIndexes,
  roomActionKey,
  type PositionedObjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createGoldenFGHIProject,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { loadSurfaceShrineTravelDealCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { placeRoomActionsAtChosenIndex } from '../../../src/authored-project/room-actions/chosen-position';
import { createCompleteNProject } from '../support/complete-n-project';

const well = createOccurrenceAddress(
  goldenFBiome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);

function order(document: ProjectDocument, occurrenceId: string) {
  return document.route.biomes
    .flatMap((plan) => plan.topology?.occurrences ?? [])
    .find((occurrence) => occurrence.occurrenceId === occurrenceId)!.roomActions.order;
}

/** The F Postboss with only the fountain, the rack and one Well purchase. */
function wellWithOnePurchase(): ProjectDocument {
  let project = createUnderworldFWellCheckpoint(false);
  for (const generationKey of [
    'initial:secondLeft',
    'initial:secondRight',
    'travelDealRefill',
  ] as const)
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey,
      purchased: false,
    });
  return applyProjectCommand(project, catalog, {
    kind: 'SetStygianWellPurchase',
    occurrence: well,
    generationKey: 'initial:secondLeft',
    purchased: true,
  });
}

describe('placing actions at a chosen index', () => {
  it('accepts the default unchanged and refuses an index outside the remaining order', () => {
    const placed = wellWithOnePurchase();
    const key = roomActionKey({
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:secondLeft',
    });
    const at = (index: number) =>
      placeRoomActionsAtChosenIndex(
        catalog,
        { document: placed, occurrence: well, keys: [key] },
        index,
      );
    // [fountain, rack, purchase]: the purchase's default is index 2 of [fountain, rack].
    expect(at(2)).toEqual({ kind: 'placed', document: placed });
    expect(at(1)).toMatchObject({ kind: 'placed' });
    for (const index of [-1, 3, 0.5, Number.NaN])
      expect(at(index)).toEqual({
        kind: 'refused',
        reason: 'index must be an integer from 0 through 2',
      });
    expect(at(0)).toMatchObject({
      kind: 'refused',
      reason: expect.stringMatching(/a required action of an earlier window/),
    });
    expect(
      placeRoomActionsAtChosenIndex(
        catalog,
        { document: placed, occurrence: well, keys: ['["absent"]'] },
        0,
      ),
    ).toEqual({ kind: 'refused', reason: 'has no placed action to position' });
  });

  it('lists exactly the indices each object command accepts', () => {
    const goldenShop = createOccurrenceId('golden-f-preboss-shop');
    const nShop = createOccurrenceId('round-trip-n-preboss');
    const nBiome = createBiomeAddress('Surface', 'N');
    const travelOption = (project: ProjectDocument) => {
      const room = project.route.biomes
        .find((plan) => plan.biomeKey === 'N')!
        .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === nShop)!;
      const profileKey = room.state.kind === 'shop' ? room.state.shop?.profileKey : undefined;
      return catalog.rewards.shops.byKey[profileKey ?? '']!.groups.values.flatMap(
        (group) => group.options.values,
      ).find((candidate) => candidate.rewardType === 'BlindBoxLoot')!;
    };
    let nProject = createCompleteNProject();
    for (const offerKey of ['Boon', 'MajorNonBoon'])
      nProject = applyProjectCommand(nProject, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(nBiome, nShop, offerKey),
        purchased: true,
      });
    let fShop = createGoldenFGHIProject();
    fShop = applyProjectCommand(fShop, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: createShopOfferAddress(goldenFBiome, goldenShop, 'Boon'),
      purchased: true,
    });
    const shrine = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const oShrine = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const cases: readonly [ProjectDocument, string, PositionedObjectCommand][] = [
      [
        fShop,
        goldenShop,
        {
          kind: 'ReplaceShopPurchaseParticipation',
          offer: createShopOfferAddress(goldenFBiome, goldenShop, 'Minor'),
          purchased: true,
        },
      ],
      [
        nProject,
        nShop,
        {
          kind: 'PurchaseShopTravelDealRefill',
          occurrence: createOccurrenceAddress(nBiome, nShop),
          value: {
            optionKey: travelOption(nProject).key,
            offer: { rewardType: 'BlindBoxLoot' },
          },
        },
      ],
      [
        wellWithOnePurchase(),
        well.occurrenceId,
        {
          kind: 'SetStygianWellPurchase',
          occurrence: well,
          generationKey: 'travelDealRefill',
          purchased: true,
        },
      ],
      [
        oShrine,
        shrine.occurrenceId,
        {
          kind: 'SetHermesShrinePurchase',
          occurrence: shrine,
          generationKey: 'initial:secondRight',
          purchased: true,
        },
      ],
      [
        oShrine,
        shrine.occurrenceId,
        {
          kind: 'PurchaseHermesShrineOffer',
          occurrence: shrine,
          generationKey: 'initial:secondRight',
          rushed: true,
        },
      ],
    ];
    for (const [project, occurrenceId, command] of cases) {
      const listed = objectCommandInsertionIndexes(project, catalog, command);
      expect(listed.length, command.kind).toBeGreaterThan(0);
      for (let index = 0; index <= order(project, occurrenceId).length; index += 1) {
        const apply = () => applyProjectCommand(project, catalog, { ...command, index });
        if (listed.includes(index)) expect(apply, `${command.kind} at ${index}`).not.toThrow();
        else expect(apply, `${command.kind} at ${index}`).toThrow();
      }
    }
  });

  it('lists nothing for a command that cannot apply without an index', () => {
    const project = createCompleteNProject();
    const nShop = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('round-trip-n-preboss'),
    );
    // The Travel Deal item is blank and no value stocks it.
    expect(
      objectCommandInsertionIndexes(project, catalog, {
        kind: 'PurchaseShopTravelDealRefill',
        occurrence: nShop,
      }),
    ).toEqual([]);
  });

  it('moves a rushed Shrine purchase before or after the refill trigger with its pickup', () => {
    const project = loadSurfaceShrineTravelDealCheckpoint();
    const postboss = 'surface-n-preboss:postboss';
    const source = createOccurrenceAddress(
      createBiomeAddress(project.route.routeKey, 'N'),
      createOccurrenceId(postboss),
    );
    const before = order(project, postboss);
    // [fountain, rack, rushed first (the trigger), refill, first's pickup]
    expect(before.map((reference) => reference.kind)).toEqual([
      'useFountain',
      'interactKeepsakeRack',
      'purchaseHermesShrineOffer',
      'purchaseHermesShrineOffer',
      'interactAcquisitionEntry',
    ]);
    const command = {
      kind: 'PurchaseHermesShrineOffer' as const,
      occurrence: source,
      generationKey: 'initial:secondLeft' as const,
      rushed: true,
    };
    expect(objectCommandInsertionIndexes(project, catalog, command)).toEqual([1, 2, 3, 4, 5]);
    const placed = (index: number) =>
      order(applyProjectCommand(project, catalog, { ...command, index }), postboss);
    const purchase = { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondLeft' };
    const pickup = { kind: 'interactAcquisitionEntry', siteKey: 'hermesShrineDelivery' };
    // Before the trigger it becomes the first rush; the refill still follows it.
    expect(placed(2)).toEqual([
      ...before.slice(0, 2),
      expect.objectContaining(purchase),
      expect.objectContaining(pickup),
      ...before.slice(2),
    ]);
    // After the refill's purchase it changes nothing about the trigger.
    expect(placed(4)).toEqual([
      ...before.slice(0, 4),
      expect.objectContaining(purchase),
      expect.objectContaining(pickup),
      before[4],
    ]);
  });
});
