import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  hermesShrineDeliveryEntryKey,
  positionedCommandInsertionIndexes,
  roomActionKey,
  type PositionedCommand,
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
import {
  loadSurfaceScheduledLifecycleCheckpoint,
  loadSurfaceShrineTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { placeRoomActionsAtChosenIndex } from '../../../src/authored-project/room-actions/chosen-position';
import { createCompleteNProject } from '../support/complete-n-project';
import { withItemContent } from '../../support/room-action-content';

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

  it('lists exactly the indices each positioned command accepts', () => {
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
    const cases: readonly [ProjectDocument, string, PositionedCommand][] = [
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
        },
      ],
      [
        oShrine,
        shrine.occurrenceId,
        {
          kind: 'SetHermesShrineRush',
          occurrence: shrine,
          generationKey: 'initial:secondLeft',
          rushed: true,
        },
      ],
    ];
    // Derived pickups the walk leaves unplaced: a due delivery, Gold Gold Gold's duplicate and a
    // matured Supply Chain drop.
    const deliveryHost = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const scheduled = loadSurfaceScheduledLifecycleCheckpoint();
    const pCombat = createOccurrenceAddress(
      createBiomeAddress('Surface', 'P'),
      createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    const drop = spawnedLootForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, scheduled),
      pCombat,
    )!.moments[0]!.items.at(-1)!;
    if (drop.placement.kind !== 'unplaced' || drop.placement.command === undefined)
      throw new Error('the Supply Chain drop is placed');
    const derived: readonly [ProjectDocument, string, PositionedCommand][] = [
      [
        oShrine,
        deliveryHost.occurrenceId,
        {
          kind: 'PlaceHermesShrineDelivery',
          entry: createAcquisitionEntryAddress(
            createAcquisitionSiteAddress(deliveryHost, 'hermesShrineDelivery'),
            hermesShrineDeliveryEntryKey(shrine, 'initial:secondLeft'),
          ),
          encounterPhaseKey: 'Encounter',
        },
      ],
      [
        fShop,
        goldenShop,
        {
          kind: 'PlaceEchoGoldPickup',
          site: createAcquisitionSiteAddress(
            createOccurrenceAddress(goldenFBiome, goldenShop),
            'roomExit',
          ),
          entryKey: 'echoDoubleShopReward',
          sourceOfferKey: 'Boon',
        },
      ],
      [scheduled, pCombat.occurrenceId, drop.placement.command as PositionedCommand],
    ];
    for (const [project, occurrenceId, command] of [...cases, ...derived]) {
      const listed = positionedCommandInsertionIndexes(project, catalog, command);
      expect(listed.length, command.kind).toBeGreaterThan(0);
      for (let index = 0; index <= order(project, occurrenceId).length; index += 1) {
        const apply = () => applyProjectCommand(project, catalog, { ...command, index });
        if (listed.includes(index)) expect(apply, `${command.kind} at ${index}`).not.toThrow();
        else expect(apply, `${command.kind} at ${index}`).toThrow();
      }
    }
  });

  it('lists the same indices for a blank Travel Deal item whatever value stocks it', () => {
    const nBiome = createBiomeAddress('Surface', 'N');
    const nShop = createOccurrenceId('round-trip-n-preboss');
    let project = createCompleteNProject();
    for (const offerKey of ['Boon', 'MajorNonBoon'])
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(nBiome, nShop, offerKey),
        purchased: true,
      });
    const room = project.route.biomes
      .find((plan) => plan.biomeKey === 'N')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === nShop)!;
    const profileKey = room.state.kind === 'shop' ? room.state.shop?.profileKey : undefined;
    const listed = catalog.rewards.shops.byKey[profileKey ?? '']!.groups.values.flatMap(
      (group) => group.options.values,
    )
      .flatMap((option) => {
        try {
          return [
            positionedCommandInsertionIndexes(project, catalog, {
              kind: 'PurchaseShopTravelDealRefill',
              occurrence: createOccurrenceAddress(nBiome, nShop),
              value: { optionKey: option.key, offer: { rewardType: option.rewardType } },
            }),
          ];
        } catch {
          // A bare offer of a reward that needs its payload is not a stockable value.
          return [];
        }
      })
      .filter((indexes) => indexes.length > 0);
    // The purchase places the same action under the same order rules for every value.
    expect(listed.length).toBeGreaterThan(1);
    for (const indexes of listed) expect(indexes).toEqual(listed[0]);
  });

  it('lists nothing for a command that cannot apply without an index', () => {
    const project = createCompleteNProject();
    const nShop = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('round-trip-n-preboss'),
    );
    // The Travel Deal item is blank and no value stocks it.
    expect(
      positionedCommandInsertionIndexes(project, catalog, {
        kind: 'PurchaseShopTravelDealRefill',
        occurrence: nShop,
      }),
    ).toEqual([]);
  });

  it('places a Shrine rush only directly after its purchase, without its pickup', () => {
    const loaded = loadSurfaceShrineTravelDealCheckpoint();
    const postboss = 'surface-n-preboss:postboss';
    const source = createOccurrenceAddress(
      createBiomeAddress(loaded.route.routeKey, 'N'),
      createOccurrenceId(postboss),
    );
    // [fountain, rack, first, its rush (the trigger), refill, first's pickup]
    expect(order(loaded, postboss).map((reference) => reference.kind)).toEqual([
      'useFountain',
      'interactKeepsakeRack',
      'purchaseHermesShrineOffer',
      'rushHermesShrineOffer',
      'purchaseHermesShrineOffer',
      'interactAcquisitionEntry',
    ]);
    // Bought before the first item, its rush settles with it as the first rush,
    // and stands only directly after its purchase.
    const project = applyProjectCommand(loaded, catalog, {
      kind: 'PurchaseHermesShrineOffer',
      occurrence: source,
      generationKey: 'initial:secondLeft',
      index: 2,
    });
    const before = order(project, postboss);
    const command = {
      kind: 'SetHermesShrineRush' as const,
      occurrence: source,
      generationKey: 'initial:secondLeft' as const,
      rushed: true,
    };
    expect(positionedCommandInsertionIndexes(project, catalog, command)).toEqual([3]);
    const placed = (index: number) =>
      order(applyProjectCommand(project, catalog, { ...command, index }), postboss);
    const rush = withItemContent(project, source, {
      kind: 'rushHermesShrineOffer',
      generationKey: 'initial:secondLeft',
    });
    expect(placed(3)).toEqual([...before.slice(0, 3), rush, ...before.slice(3)]);
    for (const index of [4, 5, 6])
      expect(() => placed(index)).toThrow(new RegExp(`index ${index} is not a legal position`));
  });
});
