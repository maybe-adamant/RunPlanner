import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createInfernalContractPedestalAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  roomObjectInteractionsForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldZagreusContractCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  nBiome as surfaceNBiome,
  surfaceShrineTravelDealProject,
} from '@run-planner/test-fixtures/surface';
import {
  goldenFBiome,
  goldenGBiome,
  underworldWorldShopTravelDealProject,
} from '@run-planner/test-fixtures/underworld';

const interactionsAt = (
  project: ProjectDocument,
  occurrence: ReturnType<typeof createOccurrenceAddress>,
) =>
  roomObjectInteractionsForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    occurrence,
  );
const apply = (project: ProjectDocument, command: ProjectCommand) =>
  applyProjectCommand(project, catalog, command);

describe('World Shop interaction', () => {
  const shop = createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-preboss-shop'));
  const refill = {
    kind: 'interactAcquisitionEntry',
    siteKey: 'roomExit',
    entryKey: 'travelDealRefill',
  } as const;

  it('offers each unbought stocked item and no refill once it is bought', () => {
    const project = underworldWorldShopTravelDealProject();
    const shopInteraction = interactionsAt(project, shop)?.worldShop;
    expect(shopInteraction).toBeDefined();
    expect(shopInteraction!.offers.map((offer) => offer.offerKey)).not.toContain('MajorNonBoon');
    expect(shopInteraction!.travelDealRefill).toBeUndefined();
    for (const offer of shopInteraction!.offers)
      expect(offer.command).toEqual({
        kind: 'ReplaceShopPurchaseParticipation',
        offer: expect.objectContaining({
          occurrenceId: shop.occurrenceId,
          offerKey: offer.offerKey,
        }),
        purchased: true,
      });
  });

  it('offers the live Travel Deal item until it is bought, appending its purchase', () => {
    const project = apply(underworldWorldShopTravelDealProject(), {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, shop.occurrenceId, roomActionKey(refill)),
    });
    const travel = interactionsAt(project, shop)?.worldShop?.travelDealRefill;
    expect(travel).toMatchObject({
      rewardType: 'ArmorBoost',
      command: { kind: 'PurchaseShopTravelDealRefill', occurrence: shop },
    });
    expect(travel!.rewardTypes).toContain('ArmorBoost');
    const bought = apply(project, travel!.command);
    const order = bought.route.biomes
      .find((biome) => biome.biomeKey === 'F')!
      .topology!.occurrences.find((room) => room.occurrenceId === shop.occurrenceId)!.roomActions
      .order;
    expect(order.at(-1)).toEqual(refill);
    expect(interactionsAt(bought, shop)?.worldShop?.travelDealRefill).toBeUndefined();
  });
});

describe('Hermes Shrine interaction', () => {
  const shrine = createOccurrenceAddress(
    surfaceNBiome,
    createOccurrenceId('surface-n-preboss:postboss'),
  );

  it('offers Buy and Rush for each unbought item and reports the live refill', () => {
    const project = surfaceShrineTravelDealProject();
    const interaction = interactionsAt(project, shrine)?.hermesShrine;
    expect(interaction?.travelDealRefillLive).toBe(true);
    // The refill is already bought.
    expect(interaction?.travelDealRefill).toBeUndefined();
    expect(interaction?.offers.map((offer) => offer.generationKey)).toEqual([
      'initial:secondLeft',
      'initial:secondRight',
    ]);
    const [left] = interaction!.offers;
    expect(left).toMatchObject({
      rewardType: expect.any(String),
      delay: expect.any(Number),
      buy: {
        kind: 'PurchaseHermesShrineOffer',
        generationKey: 'initial:secondLeft',
        rushed: false,
      },
      rush: {
        kind: 'PurchaseHermesShrineOffer',
        generationKey: 'initial:secondLeft',
        rushed: true,
      },
    });
    const bought = apply(project, left!.rush);
    expect(
      interactionsAt(bought, shrine)?.hermesShrine?.offers.map((offer) => offer.generationKey),
    ).toEqual(['initial:secondRight']);
  });

  it('offers the unbought refill with its candidates while a Travel Deal rush realizes it', () => {
    const cleared = apply(surfaceShrineTravelDealProject(), {
      kind: 'SetHermesShrinePurchase',
      occurrence: shrine,
      generationKey: 'travelDealRefill',
      purchased: false,
    });
    const refill = interactionsAt(cleared, shrine)?.hermesShrine?.travelDealRefill;
    expect(refill).toMatchObject({
      generationKey: 'travelDealRefill',
      rewardType: 'ArmorBoost',
      buy: { generationKey: 'travelDealRefill', rushed: false },
    });
    expect(refill!.candidateRewardTypes).toContain('ArmorBoost');

    // Without the rush, nothing refills.
    const unrushed = apply(cleared, {
      kind: 'SetHermesShrinePurchaseRush',
      action: createRoomActionAddress(
        surfaceNBiome,
        shrine.occurrenceId,
        roomActionKey({
          kind: 'purchaseHermesShrineOffer',
          generationKey: 'initial:first',
          rushed: false,
        }),
      ),
      rushed: false,
    });
    const unlive = interactionsAt(unrushed, shrine)?.hermesShrine;
    expect(unlive?.travelDealRefillLive).toBe(false);
    expect(unlive?.travelDealRefill).toBeUndefined();
  });
});

describe('Champion item interaction', () => {
  const gShop = createOccurrenceId('zagreus-contract-preboss-shop');
  const fShop = createOccurrenceId('golden-f-preboss-shop');

  it('has nothing to collect once collected, and is unreached in an unentered form', () => {
    const project = loadUnderworldZagreusContractCheckpoint();
    const interactions = interactionsAt(project, createOccurrenceAddress(goldenGBiome, gShop));
    expect(interactions?.championItem).toEqual({ historySequence: expect.any(Number) });
    expect(interactions?.worldShop).toBeDefined();
    expect(
      interactionsAt(
        project,
        createOccurrenceAddress(goldenGBiome, createOccurrenceId('zagreus-contract-preboss-peer')),
      ),
    ).toBeUndefined();
  });

  it('locks Collect while the Contract is not held and collects through its command', () => {
    const fPreboss = createOccurrenceAddress(goldenFBiome, fShop);
    const pedestal = createInfernalContractPedestalAddress(goldenFBiome, fShop);
    const stocked = apply(loadUnderworldZagreusContractCheckpoint(), {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal,
      value: { rewardType: 'StackUpgrade' },
    });
    expect(interactionsAt(stocked, fPreboss)?.championItem?.collect).toEqual({
      locked: 'inactive',
    });

    const gPedestal = createInfernalContractPedestalAddress(goldenGBiome, gShop);
    const uncollected = apply(loadUnderworldZagreusContractCheckpoint(), {
      kind: 'SetInfernalContractPedestalCollected',
      pedestal: gPedestal,
      collected: false,
    });
    const collect = interactionsAt(uncollected, createOccurrenceAddress(goldenGBiome, gShop))
      ?.championItem?.collect;
    expect(collect).toEqual({
      command: {
        kind: 'SetInfernalContractPedestalCollected',
        pedestal: gPedestal,
        collected: true,
      },
    });
    expect(apply(uncollected, (collect as { command: ProjectCommand }).command)).toEqual(
      loadUnderworldZagreusContractCheckpoint(),
    );
  });
});
