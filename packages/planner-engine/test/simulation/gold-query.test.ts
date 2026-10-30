import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createShopOfferAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  goldLedgerForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type GoldPurchaseAvailability,
} from '@run-planner/engine/simulation';
import {
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
  underworldCheckpointArtifacts,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { createEchoGoldIAnvilDuplicateProject } from '@run-planner/test-fixtures/underworld';
import { surfaceShrineTravelDealProject } from '@run-planner/test-fixtures/surface';

const f = createBiomeAddress('Underworld', 'F');
const n = createBiomeAddress('Surface', 'N');
const wellRoomId = 'golden-f-preboss-shop:postboss' as never;
const wellRoom = createOccurrenceAddress(f, wellRoomId);
const shopRoomId = 'golden-f-preboss-shop' as never;
const shrineRoomId = 'surface-n-preboss:postboss' as never;

const action = (biome: typeof f, occurrenceId: never, reference: RoomActionReference) =>
  createRoomActionAddress(biome, occurrenceId, roomActionKey(reference));
const wellPurchase = (
  generationKey: 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill',
) => action(f, wellRoomId, { kind: 'purchaseStygianWellOffer', generationKey });

const ledger = (project: ProjectDocument) =>
  goldLedgerForProjectEvaluationAssembly(catalog, simulateProjectAssembly(catalog, project));
const price = (availability: GoldPurchaseAvailability) =>
  availability.availability === 'available' ? availability.purchase.price.mean : availability;

function withDebt(project: ProjectDocument, rank: number): ProjectDocument {
  return {
    ...project,
    route: {
      ...project.route,
      loadout: {
        ...project.route.loadout,
        fearRanks: { ...project.route.loadout.fearRanks, ShopPricesShrineUpgrade: rank },
      },
    },
  };
}

describe('gold ledger query', () => {
  it('prices the Well in purchase order with Travel Deal on the first purchase only', () => {
    const gold = ledger(loadUnderworldFStygianWellCheckpoint());
    // Epic Travel Deal: round(70 x 0.85); then the Hymn and the Seal restock at full price.
    expect(
      [
        wellPurchase('initial:secondLeft'),
        wellPurchase('initial:secondRight'),
        wellPurchase('travelDealRefill'),
      ].map((owner) => price(gold.purchaseAt(owner))),
    ).toEqual([60, 25, 90]);
    expect(gold.roomAt(wellRoom)).toMatchObject({
      availability: 'available',
      room: { spending: { mean: 175, variance: 0 } },
    });
  });

  it('applies the Vow of Debt to every Well price', () => {
    const gold = ledger(withDebt(loadUnderworldFStygianWellCheckpoint(), 2));
    // round(70 x 1.8 x 0.85), round(25 x 1.8), round(90 x 1.8).
    expect(
      [
        wellPurchase('initial:secondLeft'),
        wellPurchase('initial:secondRight'),
        wellPurchase('travelDealRefill'),
      ].map((owner) => price(gold.purchaseAt(owner))),
    ).toEqual([107, 45, 162]);
  });

  it('prices the World Shop and reprices its restock after the first purchase', () => {
    const gold = ledger(loadUnderworldWorldShopTravelDealCheckpoint());
    expect(
      ['MajorNonBoon', 'travelDealRefill'].map((offerKey) =>
        price(gold.purchaseAt(createShopOfferAddress(f, shopRoomId, offerKey))),
      ),
    ).toEqual([106, 40]);
  });

  it('prices a Shrine buy-and-rush from its Travel Deal order and repriced rush', () => {
    const gold = ledger(surfaceShrineTravelDealProject());
    expect(
      [
        { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first', rushed: true },
        { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill', rushed: false },
      ].map((reference) =>
        price(gold.purchaseAt(action(n, shrineRoomId, reference as RoomActionReference))),
      ),
      // Order round(round(76.5) x 1.2) = 92, rush round(135) - round(90 x 1.2) = 27;
      // the restocked Armor ordered at round(40 x 1.2).
    ).toEqual([119, 48]);
  });

  it('leaves purchases and rooms past the assessment stop unavailable, never zero', () => {
    const project = applyProjectCommand(loadUnderworldFStygianWellCheckpoint(), catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: wellRoom,
      slotKey: 'secondRight',
      itemKey: null,
    });
    const gold = ledger(project);
    expect(price(gold.purchaseAt(wellPurchase('initial:secondLeft')))).toBe(60);
    // The unpinned item is the purchase's own finding, not a missing price.
    expect(gold.purchaseAt(wellPurchase('initial:secondRight'))).toEqual({
      availability: 'unavailable',
      reason: 'itemUnresolved',
    });
    expect(gold.purchaseAt(wellPurchase('travelDealRefill'))).toEqual({
      availability: 'unavailable',
      reason: 'coverageNotReached',
    });
    expect(gold.roomAt(wellRoom)).toEqual({
      availability: 'unavailable',
      reason: 'coverageNotReached',
    });
    expect(
      gold.purchaseAt(
        createRoomActionAddress(createBiomeAddress('Surface', 'F'), wellRoomId, 'unknown'),
      ),
    ).toEqual({ availability: 'unavailable', reason: 'coverageNotReached' });
  });

  it('reports a reached room the walk published no gold point in as spending nothing', () => {
    const assembly = simulateProjectAssembly(catalog, loadUnderworldFStygianWellCheckpoint());
    const roomKey = semanticAddressKey(wellRoom);
    const stripped = {
      ...assembly,
      evaluation: {
        ...assembly.evaluation,
        route: {
          ...assembly.evaluation.route,
          biomes: assembly.evaluation.route.biomes.map((biome) =>
            'rewards' in biome
              ? {
                  ...biome,
                  rewards: {
                    ...biome.rewards,
                    purchasePriceContexts: biome.rewards.purchasePriceContexts.filter(
                      (publication) => semanticAddressKey(publication.room) !== roomKey,
                    ),
                    goldEvents: biome.rewards.goldEvents.filter(
                      (publication) =>
                        publication.room === undefined ||
                        semanticAddressKey(publication.room) !== roomKey,
                    ),
                  },
                }
              : biome,
          ),
        },
      },
    } as typeof assembly;
    const notWalked = { availability: 'unavailable', reason: 'notWalked' };
    expect(goldLedgerForProjectEvaluationAssembly(catalog, stripped).roomAt(wellRoom)).toEqual({
      availability: 'available',
      room: {
        room: wellRoom,
        purchases: [],
        spending: { mean: 0, variance: 0, min: 0, max: 0 },
        gains: [],
        doorsOpenBalance: notWalked,
        balanceAfter: notWalked,
      },
    });
  });

  it('memoizes the ledger per catalog and assembly', () => {
    const assembly = simulateProjectAssembly(catalog, loadUnderworldFStygianWellCheckpoint());
    expect(goldLedgerForProjectEvaluationAssembly(catalog, assembly)).toBe(
      goldLedgerForProjectEvaluationAssembly(catalog, assembly),
    );
  });

  it('leaves the room first paid purchase to the shop item after a free Contract pedestal', () => {
    const shop = createOccurrenceAddress(
      f,
      createOccurrenceId('e157e3cb-37ae-40d9-92b0-f22621b672c3'),
    );
    const assembly = simulateProjectAssembly(
      catalog,
      underworldCheckpointArtifacts['underworld-f-trait-order-checks'].load(),
    );
    const published = assembly.evaluation.route.biomes
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.purchasePriceContexts : []))
      .filter((publication) => publication.room.occurrenceId === shop.occurrenceId)
      .map((publication) =>
        publication.contexts.map((context) => [
          context.venue.kind,
          context.firstPaidPurchase,
          context.travelDealRarity ?? null,
        ]),
      );
    expect(published).toEqual([
      [['free', false, null]],
      [['worldShop', true, 'Epic']],
      [['worldShop', false, null]],
    ]);
    const gold = goldLedgerForProjectEvaluationAssembly(catalog, assembly);
    expect(gold.roomAt(shop)).toMatchObject({
      availability: 'available',
      // Pedestal 0, then RandomLoot at round(150 x 0.85) and at full price.
      room: { spending: { mean: 128 + 150 } },
    });
  });

  it('prices the Echo duplicate at nothing without taking the first paid purchase', () => {
    const shopId = createOccurrenceId('golden-i-preboss');
    const i = createBiomeAddress('Underworld', 'I');
    const gold = ledger(createEchoGoldIAnvilDuplicateProject());
    expect(price(gold.purchaseAt(createShopOfferAddress(i, shopId, 'PremiumProgress')))).toBe(650);
    const duplicate = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(i, shopId), 'roomExit'),
      'echoDoubleShopReward',
    );
    expect(gold.purchaseAt(duplicate)).toMatchObject({
      availability: 'available',
      purchase: { venue: 'free', price: { mean: 0 } },
    });
  });

  it('counts a Price of Midas purchase as the room first purchase though it costs no gold', () => {
    let project = loadUnderworldFStygianWellCheckpoint();
    for (const generationKey of [
      'travelDealRefill',
      'initial:secondRight',
      'initial:secondLeft',
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: wellRoom,
        generationKey,
        purchased: false,
      });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: wellRoom,
      slotKey: 'healing',
      itemKey: 'DamageSelfDrop',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: wellRoom,
      itemKey: 'HealDropRange',
    });
    for (const generationKey of ['initial:healing', 'initial:secondRight'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: wellRoom,
        generationKey,
        purchased: true,
      });
    const gold = ledger(project);
    // StoreLogic sets FirstPurchase on every Well purchase, so Travel Deal is spent on Midas.
    expect(
      (['initial:healing', 'initial:secondRight'] as const).map((generationKey) =>
        price(
          gold.purchaseAt(
            action(f, wellRoomId, { kind: 'purchaseStygianWellOffer', generationKey }),
          ),
        ),
      ),
    ).toEqual([0, 25]);
    // Midas pays round(1.1 x 10) to round(1.8 x 30) at its purchase.
    expect(gold.roomAt(wellRoom)).toMatchObject({
      availability: 'available',
      room: { gains: [{ kind: 'midasPayout', amount: { min: 11, max: 54 } }] },
    });
  });
});
