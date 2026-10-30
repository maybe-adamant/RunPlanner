import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { GoldLedgerContractError } from '@run-planner/engine/simulation';
import { biomeGoldPrices } from '../../../../src/simulation/commerce/gold/ledger';
import type {
  PurchasePriceContext,
  PurchasePriceContextPublication,
  PurchasePriceVenue,
} from '../../../../src/simulation/commerce/gold/price-context';

const biome = createBiomeAddress('Underworld', 'F');
const room = createOccurrenceAddress(biome, 'room' as never);
const otherRoom = createOccurrenceAddress(biome, 'other' as never);

interface Facts {
  readonly first?: boolean;
  readonly vowRank?: number;
  readonly vouchers?: readonly string[];
  readonly travelDeal?: PurchasePriceContext['travelDealRarity'];
  readonly at?: typeof room;
}

let ordinal = 0;
function purchase(venue: PurchasePriceVenue, facts: Facts = {}): PurchasePriceContextPublication {
  ordinal += 1;
  return {
    owner: createRoomActionAddress(biome, 'room' as never, `purchase-${ordinal}`),
    room: facts.at ?? room,
    contexts: [
      {
        venue,
        firstPaidPurchase: facts.first ?? false,
        vowRank: facts.vowRank ?? 0,
        activeVoucherItemKeys: facts.vouchers ?? [],
        ...(facts.travelDeal === undefined ? {} : { travelDealRarity: facts.travelDeal }),
      },
    ],
  };
}

const prices = (publications: readonly PurchasePriceContextPublication[]) => {
  const priced = biomeGoldPrices(catalog, publications);
  return publications.map((publication) => {
    const outcome = priced.purchases.get(semanticAddressKey(publication.owner!));
    if (outcome?.kind !== 'priced') throw new Error(`unpriced ${outcome?.kind}`);
    const price = outcome.purchase.price;
    return price.variance === 0 ? price.mean : price;
  });
};

const randomLoot: PurchasePriceVenue = {
  kind: 'worldShop',
  profileKey: 'WorldShop',
  itemKey: 'RandomLoot',
};
const voucher = ['TemporaryDiscountTrait'];

describe('gold prices', () => {
  it('multiplies by the Vow and Voucher and subtracts Travel Deal on the first purchase only', () => {
    // round(150 x Vow x (Voucher - discount)); Rare Travel Deal takes 10%.
    const expected: Record<number, readonly number[]> = {
      0: [150, 105, 135, 90],
      1: [210, 147, 189, 126],
      2: [270, 189, 243, 162],
    };
    for (const vowRank of [0, 1, 2]) {
      expect(
        prices([
          purchase(randomLoot, { vowRank }),
          purchase(randomLoot, { vowRank, vouchers: voucher }),
          purchase(randomLoot, { vowRank, first: true, travelDeal: 'Rare' }),
          purchase(randomLoot, { vowRank, first: true, travelDeal: 'Rare', vouchers: voucher }),
        ]),
      ).toEqual(expected[vowRank]);
      // A later purchase pays the full price although Travel Deal is held.
      expect(prices([purchase(randomLoot, { vowRank, travelDeal: 'Rare' })])).toEqual([
        expected[vowRank]![0],
      ]);
    }
  });

  it('subtracts the Travel Deal factor as the trait holds it', () => {
    // 0.7 - (1 - 0.8) is exactly 0.5 in the game's arithmetic, unlike 0.7 - 0.2.
    expect(
      prices([
        purchase(
          { kind: 'stygianWell', itemKey: 'RandomStoreItem', rollKey: 'initial' },
          { first: true, travelDeal: 'Heroic', vouchers: voucher },
        ),
      ]),
    ).toEqual([23]);
  });

  it('rounds a Shrine order twice and charges a rush the impatience price at the repriced shop', () => {
    const heal = (delay: number, rushed: boolean): PurchasePriceVenue => ({
      kind: 'hermesShrine',
      itemKey: 'HealBigDrop',
      delay,
      rushed,
    });
    expect(
      prices([
        // round(90 x 1.2)
        purchase(heal(2, false)),
        // round(90 x 0.6)
        purchase(heal(8, false)),
        // round(round(90 x 1.4) x 0.9) = round(113.4)
        purchase(heal(5, false), { vowRank: 1 }),
        // Ordered and rushed without Travel Deal: round(90 x 1.5).
        purchase(heal(2, true)),
        // Common Travel Deal: order round(round(85.5) x 1.2) = 103, rush 135 - 108.
        purchase(heal(2, true), { first: true, travelDeal: 'Common' }),
        purchase(heal(2, false), { first: true, travelDeal: 'Common' }),
      ]),
    ).toEqual([108, 54, 113, 135, 130, 103]);
  });

  it('prices a rolled Well item over its roll, its end amounts half as likely', () => {
    const [plain, discounted] = prices([
      purchase({ kind: 'stygianWell', itemKey: 'HealDropRange', rollKey: 'initial' }),
      purchase(
        { kind: 'stygianWell', itemKey: 'MetaCardPointsCommonRange', rollKey: 'initial' },
        { vouchers: voucher },
      ),
    ]);
    // 21..39 over 18 intervals: mean 30, variance (2 x (1 + 4 + ... + 64) + 81) / 18.
    expect(plain).toMatchObject({ mean: expect.closeTo(30, 10), min: 21, max: 39 });
    expect((plain as { variance: number }).variance).toBeCloseTo(489 / 18, 10);
    // 30, 35, ... 60 at 0.7 in double arithmetic: 31.499... rounds down.
    const values = [21, 25, 28, 31, 35, 39, 42];
    const weights = [0.5, 1, 1, 1, 1, 1, 0.5].map((weight) => weight / 6);
    const mean = values.reduce((sum, value, index) => sum + value * weights[index]!, 0);
    expect(discounted).toMatchObject({ min: 21, max: 42 });
    expect((discounted as { mean: number }).mean).toBeCloseTo(mean, 10);
    expect((discounted as { variance: number }).variance).toBeCloseTo(
      values.reduce((sum, value, index) => sum + weights[index]! * (value - mean) ** 2, 0),
      10,
    );
  });

  it('reprices open Well items from their rounded price when a Twist grants the Voucher', () => {
    const well = (itemKey: string, rollKey = 'initial'): PurchasePriceVenue => ({
      kind: 'stygianWell',
      itemKey,
      rollKey,
    });
    const twist: PurchasePriceVenue = {
      kind: 'stygianWell',
      itemKey: 'RandomStoreItem',
      rollKey: 'initial',
      twistResultKey: 'TemporaryDiscountTrait',
    };
    const held = { vowRank: 1, vouchers: voucher };
    const [, , open, rerolled] = prices([
      purchase(well('TemporaryMoveSpeedTrait'), { vowRank: 1, first: true }),
      purchase(twist, { vowRank: 1 }),
      purchase(well('HealDropRange'), held),
      purchase(well('HealDropRange', 'r1'), held),
    ]);
    // round(round(21 x 1.4) x 0.7) = 20 on the open roll; round(21 x 0.98) = 21 once restocked.
    expect(open).toMatchObject({ min: 20 });
    expect(rerolled).toMatchObject({ min: 21 });
    // The Travel Deal purchase resets the Well, so the open roll reprices from base.
    const [, travelDealOpen] = prices([
      purchase(twist, { vowRank: 1, first: true, travelDeal: 'Common' }),
      purchase(well('HealDropRange'), held),
    ]);
    expect(travelDealOpen).toMatchObject({ min: 21 });
  });

  it('charges nothing for free items and sums each room in settlement order', () => {
    const publications = [
      purchase({ kind: 'free' }),
      purchase(randomLoot),
      purchase({ kind: 'stygianWell', itemKey: 'HealDropRange', rollKey: 'initial' }),
      purchase(randomLoot, { at: otherRoom }),
    ];
    const priced = biomeGoldPrices(catalog, publications);
    expect(prices(publications.slice(0, 1))).toEqual([0]);
    const spending = [...priced.rooms.values()].map((entry) =>
      entry.kind !== 'priced'
        ? entry.kind
        : {
            purchases: entry.room.purchases.map((candidate) => candidate.venue),
            spending: entry.room.spending,
          },
    );
    expect(spending).toEqual([
      {
        purchases: ['free', 'worldShop', 'stygianWell'],
        spending: { mean: 180, variance: expect.closeTo(489 / 18, 10), min: 171, max: 189 },
      },
      { purchases: ['worldShop'], spending: { mean: 150, variance: 0, min: 150, max: 150 } },
    ]);
  });

  it('refuses only the divergent purchase and its room', () => {
    const divergent = purchase(randomLoot, { first: true, travelDeal: 'Rare' });
    const other = purchase(randomLoot, { first: true, travelDeal: 'Epic' });
    const later = purchase(randomLoot);
    const elsewhere = purchase(randomLoot, { at: otherRoom });
    const priced = biomeGoldPrices(catalog, [
      { ...divergent, contexts: [...divergent.contexts, ...other.contexts] },
      later,
      elsewhere,
    ]);
    const outcome = (publication: PurchasePriceContextPublication) =>
      priced.purchases.get(semanticAddressKey(publication.owner!));
    expect(outcome(divergent)).toMatchObject({ kind: 'fault' });
    expect(outcome(divergent)?.kind === 'fault' && outcome(divergent)).toMatchObject({
      error: expect.any(GoldLedgerContractError),
    });
    expect(outcome(later)).toMatchObject({ kind: 'priced', purchase: { price: { mean: 150 } } });
    expect(outcome(elsewhere)).toMatchObject({ kind: 'priced' });
    expect(priced.rooms.get(semanticAddressKey(room))).toMatchObject({ kind: 'fault' });
    expect(priced.rooms.get(semanticAddressKey(otherRoom))).toMatchObject({ kind: 'priced' });
  });

  it('keeps an unresolved item unpriced and a contract failure on its own purchase', () => {
    const unresolved = {
      ...purchase(randomLoot),
      contexts: [],
      unpriced: { kind: 'itemUnresolved' },
    };
    const broken = {
      ...purchase(randomLoot, { at: otherRoom }),
      contexts: [],
      unpriced: { kind: 'contractFailure', detail: 'no ranked action row' },
    };
    const priced = biomeGoldPrices(catalog, [
      unresolved as PurchasePriceContextPublication,
      broken as PurchasePriceContextPublication,
    ]);
    expect(priced.purchases.get(semanticAddressKey(unresolved.owner!))).toEqual({
      kind: 'itemUnresolved',
    });
    expect(priced.rooms.get(semanticAddressKey(room))).toEqual({ kind: 'itemUnresolved' });
    expect(priced.purchases.get(semanticAddressKey(broken.owner!))).toMatchObject({
      kind: 'fault',
      error: { message: 'no ranked action row' },
    });
  });

  it('refuses later Well purchases after a Twist whose branches disagree on its reprice', () => {
    const twist = purchase({
      kind: 'stygianWell',
      itemKey: 'RandomStoreItem',
      rollKey: 'initial',
      twistResultKey: 'TemporaryDiscountTrait',
    });
    const travelDeal = purchase(
      {
        kind: 'stygianWell',
        itemKey: 'RandomStoreItem',
        rollKey: 'initial',
        twistResultKey: 'TemporaryDiscountTrait',
      },
      { first: true, travelDeal: 'Common' },
    );
    const next = purchase(
      { kind: 'stygianWell', itemKey: 'HealDropRange', rollKey: 'initial' },
      { vouchers: voucher },
    );
    const priced = biomeGoldPrices(catalog, [
      { ...twist, contexts: [...twist.contexts, ...travelDeal.contexts] },
      next,
    ]);
    expect(priced.purchases.get(semanticAddressKey(next.owner!))).toMatchObject({
      kind: 'fault',
    });
  });
});
