import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { biomeGoldPrices } from '../../../../src/simulation/commerce/gold/ledger';
import { routeGoldLedger } from '../../../../src/simulation/commerce/gold/route-ledger';
import type {
  GoldEventPublication,
  GoldGain,
  GoldMultipliers,
} from '../../../../src/simulation/commerce/gold/gain-context';
import type { PurchasePriceContextPublication } from '../../../../src/simulation/commerce/gold/price-context';

const biome = createBiomeAddress('Underworld', 'F');
const room = createOccurrenceAddress(biome, 'room' as never);
const later = createOccurrenceAddress(biome, 'later' as never);
const plain: GoldMultipliers = { moneyMultiplier: 1, moneyRewardBonus: 1, blocksGold: false };

let sequence = 0;
const gain = (
  value: GoldGain,
  multipliers: Partial<GoldMultipliers> = {},
  at = room,
): GoldEventPublication => {
  sequence += 1;
  return {
    kind: 'gain',
    sequence,
    room: at,
    contexts: [{ gain: value, multipliers: { ...plain, ...multipliers } }],
  };
};
const marker = (kind: 'roomEntered' | 'doorsOpen', at = room): GoldEventPublication => {
  sequence += 1;
  return { kind, sequence, room: at };
};
const purchase = (itemKey: string, at = room): PurchasePriceContextPublication => {
  sequence += 1;
  return {
    sequence,
    owner: createRoomActionAddress(biome, 'room' as never, `buy-${sequence}`),
    room: at,
    contexts: [
      {
        venue: { kind: 'worldShop', profileKey: 'WorldShop', itemKey },
        firstPaidPurchase: false,
        vowRank: 0,
        activeVoucherItemKeys: [],
      },
    ],
  };
};

function ledger(entries: readonly (GoldEventPublication | PurchasePriceContextPublication)[]) {
  const purchases = entries.filter(
    (entry): entry is PurchasePriceContextPublication => !('kind' in entry),
  );
  const events = entries.filter((entry): entry is GoldEventPublication => 'kind' in entry);
  return routeGoldLedger(catalog, [
    { prices: biomeGoldPrices(catalog, purchases), purchases, events },
  ]);
}

const roomOf = (result: ReturnType<typeof ledger>, at = room) => {
  const entry = result.rooms.get(semanticAddressKey(at));
  if (entry?.kind !== 'priced') throw new Error(`room is ${entry?.kind}`);
  return entry.room;
};
const balance = (mean: number, variance = 0) => ({
  availability: 'available',
  balance: { mean, variance },
});

describe('gold ledger', () => {
  it('multiplies money pickups by the money multiplier and non-NPC money by the reward bonus', () => {
    const result = ledger([
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: false }, { moneyMultiplier: 1.2 }),
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: false }, { moneyRewardBonus: 1.5 }),
      // Additive: round(50 x (1 + 0.3 + 0.75)), whose double product falls just under 102.5.
      gain(
        { kind: 'moneyPickup', gold: 50, npcDrop: false },
        { moneyMultiplier: 1 + (1.3 - 1), moneyRewardBonus: 1 + (1.75 - 1) },
      ),
      gain({ kind: 'moneyPickup', gold: 300, npcDrop: true }, { moneyRewardBonus: 2 }),
      gain({ kind: 'currencyPickup', gold: 150 }, { moneyMultiplier: 1.5, moneyRewardBonus: 2 }),
      gain({ kind: 'fallbackGold', gold: 90 }, { moneyMultiplier: 1.4 }),
      gain({ kind: 'keepsakeGold', gold: 150 }, { moneyMultiplier: 1.2 }),
      gain({ kind: 'timePiece', gold: 400 }, { moneyMultiplier: 1.3 }),
    ]);
    expect(roomOf(result).gains.map((entry) => entry.amount?.mean)).toEqual([
      120, 150, 102, 300, 225, 126, 180, 520,
    ]);
    expect(roomOf(result).balanceAfter).toEqual(balance(1723));
  });

  it('values coins at their spawn and re-multiplies a room object per money multiplier taken', () => {
    const result = ledger([
      // Spawned under Chaos Affluence 1.4 and Buried Treasure 1.5: round(100 x 1.9) = 190,
      // then Quick Buck 1.2 taken before collection: round(190 x 1.2) = 228.
      gain(
        {
          kind: 'moneyPickup',
          gold: 100,
          npcDrop: false,
          spawn: { moneyMultiplier: 1.4, moneyRewardBonus: 1.5 },
          remultipliers: [1.2],
        },
        { moneyMultiplier: 1.6, moneyRewardBonus: 1.5 },
      ),
      // Each multiplier rounds in turn: round(round(20 x 1.3) x 1.3) = round(33.8) = 34.
      gain(
        {
          kind: 'moneyPickup',
          gold: 20,
          npcDrop: false,
          spawn: { moneyMultiplier: 1, moneyRewardBonus: 1 },
          remultipliers: [1.3, 1.3],
        },
        { moneyMultiplier: 1.6 },
      ),
      // A trait's coins keep their spawn value whatever is held at collection.
      gain(
        {
          kind: 'currencyPickup',
          gold: 100,
          spawn: { moneyMultiplier: 1.2, moneyRewardBonus: 1 },
        },
        { moneyMultiplier: 2 },
      ),
    ]);
    expect(roomOf(result).gains.map((entry) => entry.amount?.mean)).toEqual([228, 34, 120]);
  });

  it('pays run-start and Arcana gold unmultiplied and blocks the blockable sources under a curse', () => {
    const start: GoldEventPublication = {
      kind: 'gain',
      sequence: 0,
      contexts: [
        {
          gain: { kind: 'startingGold', gold: 450 },
          multipliers: { ...plain, moneyMultiplier: 2 },
        },
      ],
    };
    const blocked = { blocksGold: true };
    const result = ledger([
      start,
      gain({ kind: 'arcanaGold', gold: 300 }, { moneyMultiplier: 1.5 }),
      gain({ kind: 'arcanaGold', gold: 50 }, blocked),
      gain({ kind: 'timePiece', gold: 400 }, blocked),
      gain({ kind: 'midasPayout', itemKey: 'DamageSelfDrop' }, blocked),
      gain({ kind: 'poolSale', traitKey: 'ZeusWeaponBoon', rarity: 'Rare', level: 1 }, blocked),
      gain({ kind: 'nemesisBet', maxBet: 100, outcome: 'win' }, blocked),
    ]);
    expect(result.runStart).toEqual({
      kind: 'priced',
      runStart: {
        gains: [{ kind: 'startingGold', amount: { mean: 450, variance: 0, min: 450, max: 450 } }],
        balance: balance(450),
      },
    });
    expect(roomOf(result).gains.map((entry) => entry.amount?.mean)).toEqual([300, 0, 0, 0, 0, 0]);
  });

  it('blocks every coin collected under a curse but a Gold Purse and spending', () => {
    const blocked = { blocksGold: true };
    const result = ledger([
      gain({ kind: 'moneyPickup', gold: 200, npcDrop: false }),
      gain({ kind: 'loanTake', traitKey: 'BankBoon', returnGold: 300 }),
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: false }, blocked),
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: true }, blocked),
      gain({ kind: 'currencyPickup', gold: 100 }, blocked),
      gain({ kind: 'fallbackGold', gold: 90 }, blocked),
      gain({ kind: 'heraclesBounty', encounterKey: 'HeraclesCombatN' }, blocked),
      gain(
        {
          kind: 'medeaGold',
          goldPerDrop: 20,
          chance: 0.1,
          dropCap: 2,
          encounters: [{ encounterKey: 'GeneratedN', biomeKey: 'N', hordesRank: 0 }],
        },
        blocked,
      ),
      gain({ kind: 'keepsakeGold', gold: 100 }, blocked),
      gain({ kind: 'nemesisTrade', min: 80, max: 80 }, blocked),
      // The payback gushes its coins, so the stored gold is lost.
      gain({ kind: 'loanPayback', traitKey: 'BankBoon' }, blocked),
      gain({ kind: 'loanPayback', traitKey: 'BankBoon' }),
    ]);
    expect(result.rooms.get(semanticAddressKey(room))).toMatchObject({ kind: 'fault' });
    const kept = ledger([
      gain({ kind: 'moneyPickup', gold: 200, npcDrop: false }),
      gain({ kind: 'loanTake', traitKey: 'BankBoon', returnGold: 300 }),
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: false }, blocked),
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: true }, blocked),
      gain({ kind: 'currencyPickup', gold: 100 }, blocked),
      gain({ kind: 'fallbackGold', gold: 90 }, blocked),
      gain({ kind: 'heraclesBounty', encounterKey: 'HeraclesCombatN' }, blocked),
      gain(
        {
          kind: 'medeaGold',
          goldPerDrop: 20,
          chance: 0.1,
          dropCap: 2,
          encounters: [{ encounterKey: 'GeneratedN', biomeKey: 'N', hordesRank: 0 }],
        },
        blocked,
      ),
      gain({ kind: 'keepsakeGold', gold: 100 }, blocked),
      gain({ kind: 'nemesisTrade', min: 80, max: 80 }, blocked),
      gain({ kind: 'loanPayback', traitKey: 'BankBoon' }, blocked),
    ]);
    expect(roomOf(kept).gains.map((entry) => [entry.kind, entry.amount?.mean])).toEqual([
      ['moneyPickup', 200],
      ['loanTake', -200],
      ['moneyPickup', 0],
      ['moneyPickup', 0],
      ['currencyPickup', 0],
      ['fallbackGold', 0],
      ['heraclesBounty', 0],
      ['medeaGold', 0],
      ['keepsakeGold', 100],
      ['nemesisTrade', -80],
      ['loanPayback', 0],
    ]);
    expect(roomOf(kept).balanceAfter).toEqual(balance(20));
  });

  it('prices a Pool sale from its floored rarity roll plus its levels', () => {
    const result = ledger([
      gain({ kind: 'poolSale', traitKey: 'A', rarity: 'Common', level: 1 }),
      gain({ kind: 'poolSale', traitKey: 'B', rarity: 'Epic', level: 3 }),
      gain({ kind: 'poolSale', traitKey: 'C', rarity: 'infusion', level: 1 }),
      gain({ kind: 'poolSale', traitKey: 'D', rarity: 'unranked', level: 2 }),
    ]);
    const [common, epic, infusion, unranked] = roomOf(result).gains.map((entry) => entry.amount!);
    // RandomInt(30, 50) floored to 5: 30, 35, 40, 45 five ways each, 50 one way of 21.
    expect(common).toMatchObject({ min: 30, max: 50 });
    expect(common!.mean).toBeCloseTo((5 * (30 + 35 + 40 + 45) + 50) / 21, 10);
    expect(epic).toMatchObject({ min: 180, max: 200 });
    expect(infusion).toMatchObject({ min: 100, max: 130 });
    expect(unranked).toEqual({ mean: 40, variance: 0, min: 40, max: 40 });
  });

  it('pays a Price of Midas over its health and payout rolls', () => {
    const amount = roomOf(ledger([gain({ kind: 'midasPayout', itemKey: 'DamageSelfDrop' })]))
      .gains[0]!.amount!;
    // round(1.1 x 10) to round(1.8 x 30).
    expect(amount).toMatchObject({ min: 11, max: 54 });
    expect(amount.mean).toBeCloseTo(29.016, 2);
  });

  it('takes the held gold into a loan, credits a rarity change and pays it back at the boss', () => {
    const result = ledger([
      gain({ kind: 'moneyPickup', gold: 200, npcDrop: false }),
      gain({ kind: 'loanTake', traitKey: 'BankBoon', returnGold: 300 }),
      gain({ kind: 'moneyPickup', gold: 50, npcDrop: false }),
      gain({ kind: 'loanCredit', traitKey: 'BankBoon', returnGold: 100 }),
      gain({ kind: 'loanPayback', traitKey: 'BankBoon' }),
    ]);
    expect(roomOf(result).gains.map((entry) => [entry.kind, entry.amount?.mean])).toEqual([
      ['moneyPickup', 200],
      ['loanTake', -200],
      ['moneyPickup', 50],
      ['loanPayback', 600],
    ]);
    expect(roomOf(result).balanceAfter).toEqual(balance(650));
  });

  it('bets the mean balance up to the cap and pays Nemesis trades from an even roll', () => {
    const result = ledger([
      gain({ kind: 'moneyPickup', gold: 60, npcDrop: false }),
      gain({ kind: 'nemesisBet', maxBet: 100, outcome: 'win' }, { moneyMultiplier: 1.5 }),
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: false }),
      gain({ kind: 'nemesisBet', maxBet: 100, outcome: 'win' }),
      gain({ kind: 'nemesisTrade', min: 105, max: 130 }),
    ]);
    const gains = roomOf(result).gains.map((entry) => entry.amount!);
    expect(gains.map((amount) => amount.mean)).toEqual([60, 90, 100, 100, -117.5]);
    expect(gains[4]).toEqual({ mean: -117.5, variance: (26 * 26 - 1) / 12, min: -130, max: -105 });
  });

  it('moves nothing on a tied Nemesis bet and takes a lost one even under a gold-blocking curse', () => {
    const result = ledger([
      gain({ kind: 'moneyPickup', gold: 160, npcDrop: false }),
      gain({ kind: 'nemesisBet', maxBet: 100, outcome: 'tie' }, { moneyMultiplier: 1.5 }),
      gain({ kind: 'nemesisBet', maxBet: 100, outcome: 'loss' }, { moneyMultiplier: 1.5 }),
      gain({ kind: 'nemesisBet', maxBet: 100, outcome: 'loss' }, { blocksGold: true }),
      gain({ kind: 'nemesisBet', maxBet: 100, outcome: 'loss' }),
    ]);
    expect(roomOf(result).gains.map((entry) => entry.amount)).toEqual([
      { mean: 160, variance: 0, min: 160, max: 160 },
      { mean: 0, variance: 0, min: 0, max: 0 },
      { mean: -100, variance: 0, min: -100, max: -100 },
      { mean: -60, variance: 0, min: -60, max: -60 },
      { mean: 0, variance: 0, min: 0, max: 0 },
    ]);
    expect(roomOf(result).balanceAfter).toEqual(balance(0));
  });

  it('records the balance before each purchase and when the doors open', () => {
    const opening = [
      marker('roomEntered'),
      gain({ kind: 'moneyPickup', gold: 300, npcDrop: false }),
      marker('doorsOpen'),
    ];
    const shop = purchase('RandomLoot');
    const result = ledger([
      ...opening,
      shop,
      marker('roomEntered', later),
      gain({ kind: 'moneyPickup', gold: 20, npcDrop: false }, {}, later),
    ]);
    expect(roomOf(result)).toMatchObject({
      doorsOpenBalance: balance(300),
      balanceAfter: balance(150),
      spending: { mean: 150 },
    });
    expect(result.purchases.get(semanticAddressKey(shop.owner!))).toMatchObject({
      kind: 'priced',
      purchase: { balanceBefore: balance(300) },
    });
    // A room whose doors never opened reads its door balance at its end.
    expect(roomOf(result, later)).toMatchObject({
      doorsOpenBalance: balance(170),
      balanceAfter: balance(170),
    });
  });

  it('refuses a divergent gain on its own room and leaves later balances unavailable', () => {
    sequence += 1;
    const divergent: GoldEventPublication = {
      kind: 'gain',
      sequence,
      room,
      contexts: [
        { gain: { kind: 'moneyPickup', gold: 100, npcDrop: false }, multipliers: plain },
        {
          gain: { kind: 'moneyPickup', gold: 100, npcDrop: false },
          multipliers: { ...plain, moneyMultiplier: 1.2 },
        },
      ],
    };
    const unresolved = { ...gain({ kind: 'fallbackGold', gold: 90 }, {}, later), contexts: [] };
    const result = ledger([
      divergent,
      marker('roomEntered', later),
      { ...unresolved, unpriced: { kind: 'itemUnresolved' } } as GoldEventPublication,
    ]);
    expect(result.rooms.get(semanticAddressKey(room))).toMatchObject({ kind: 'fault' });
    expect(result.rooms.get(semanticAddressKey(later))).toEqual({ kind: 'itemUnresolved' });
    const pending = gain({ kind: 'fallbackGold', gold: 90 });
    const unresolvedOnly = ledger([
      gain({ kind: 'moneyPickup', gold: 100, npcDrop: false }, {}, later),
      { ...pending, contexts: [], unpriced: { kind: 'itemUnresolved' } } as GoldEventPublication,
      marker('roomEntered', later),
    ]);
    expect(unresolvedOnly.rooms.get(semanticAddressKey(room))).toEqual({ kind: 'itemUnresolved' });
    expect(roomOf(unresolvedOnly, later).balanceAfter).toEqual({
      availability: 'unavailable',
      reason: 'itemUnresolved',
    });
  });
});
