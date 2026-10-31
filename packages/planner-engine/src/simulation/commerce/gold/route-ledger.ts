import type { Catalog } from '../../../catalog-schema';
import {
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type {
  GoldEventContext,
  GoldEventPublication,
  GoldGain,
  GoldGainPublication,
} from './gain-context';
import { GoldLedgerContractError, type BiomeGoldPrices, type GoldPurchaseQuote } from './ledger';
import type { PurchasePriceContextPublication } from './price-context';
import { roundGold, sumGold, ZERO_GOLD, type GoldAmount } from './prices';
import type { RunModifiers } from '../../../authored-project/run-modifiers';
import {
  affordableProbability,
  enemyGoldAmount,
  heraclesBountyAmount,
  medeaGoldAmount,
  urnGoldAmount,
} from './enemy-gold';

/** A balance as the mean and variance of its normal approximation. */
export interface GoldMoments {
  readonly mean: number;
  readonly variance: number;
}

/**
 * The gold held at one point: unavailable after an earlier item the plan
 * leaves unresolved, after an earlier entry whose gold broke a contract, or in
 * a room the walk reached without a point of its own.
 */
export type GoldBalance =
  | { readonly availability: 'available'; readonly balance: GoldMoments }
  | {
      readonly availability: 'unavailable';
      readonly reason: 'itemUnresolved' | 'priorFault' | 'notWalked';
    };

/** One reached purchase's price and the gold held just before it. */
export interface GoldPurchasePrice extends GoldPurchaseQuote {
  readonly balanceBefore: GoldBalance;
  /**
   * The chance the gold held covers the price, P(balance − price ≥ 0) under
   * the normal approximation; absent while the balance before it is unavailable.
   */
  readonly affordableProbability?: number;
}

/** The run modifiers that adjust the enemy gold estimate. */
export type GoldRunModifiers = Pick<RunModifiers, 'enemyGoldDropChance' | 'encounterGoldRange'>;

const NATIVE_GOLD_MODIFIERS: GoldRunModifiers = Object.freeze({});

/** One reached gold gain (or loss) in chronological order. */
export interface GoldGainEntry {
  readonly kind: Exclude<GoldGain['kind'], 'loanCredit'>;
  readonly owner?: SemanticAddress;
  /**
   * Absent when it follows an unavailable balance; bounds equal the mean
   * where the amount follows the balance (a loan, a bet).
   */
  readonly amount?: GoldAmount;
}

/** A fully reached room's purchases, gains and balances. */
export interface GoldRoomSpending {
  readonly room: OccurrenceAddress;
  readonly purchases: readonly GoldPurchasePrice[];
  readonly spending: GoldAmount;
  readonly gains: readonly GoldGainEntry[];
  /**
   * Gold held when the doors open: after the room's encounter and reward gold,
   * before the purchases and sales that follow; where the exit waits on a
   * required action after purchases (flushed Shrine deliveries), after them.
   */
  readonly doorsOpenBalance: GoldBalance;
  readonly balanceAfter: GoldBalance;
}

/** Gold the run starts with, before its first room. */
export interface GoldRunStart {
  readonly gains: readonly GoldGainEntry[];
  readonly balance: GoldBalance;
}

export type GoldPurchaseResult =
  | { readonly kind: 'priced'; readonly purchase: GoldPurchasePrice }
  | { readonly kind: 'itemUnresolved' }
  | { readonly kind: 'fault'; readonly error: GoldLedgerContractError };

export type GoldRoomResult =
  | { readonly kind: 'priced'; readonly room: GoldRoomSpending }
  | { readonly kind: 'itemUnresolved' }
  | { readonly kind: 'fault'; readonly error: GoldLedgerContractError };

export interface RouteGoldLedger {
  readonly purchases: ReadonlyMap<string, GoldPurchaseResult>;
  readonly rooms: ReadonlyMap<string, GoldRoomResult>;
  readonly runStart:
    | { readonly kind: 'priced'; readonly runStart: GoldRunStart }
    | { readonly kind: 'fault'; readonly error: GoldLedgerContractError };
}

const START_BALANCE: GoldBalance = Object.freeze({
  availability: 'available',
  balance: Object.freeze({ mean: 0, variance: 0 }),
});

/** One evaluated biome's priced purchases and published gold contacts, in route order. */
export interface BiomeGoldInputs {
  readonly prices: BiomeGoldPrices;
  readonly purchases: readonly PurchasePriceContextPublication[];
  readonly events: readonly GoldEventPublication[];
}

/**
 * Gold a held `BlockMoney` curse stops. Every coin collected through
 * `UseMoneyDrop` pays nothing (RoomLogic.lua:2648-2652): money pickups, whose
 * `DropMoney` gushes coins (InteractLogic.lua:1075-1084, 1154-1174), Heracles's
 * bounty pickup, Wealth from the Dead's drops, the `Currency` coins of
 * Narcissus and fallback gold (`GiveRandomConsumables`, RoomLogic.lua:2002-2007)
 * and a loan's payback (CombatLogic.lua:3956-3965). Kill drops stop at
 * RoomLogic.lua:2354, urn drops being kill drops of their breakable; the bet
 * win, Time Piece, Price of Midas, Pool sale and Arcana gold check it
 * themselves. A Gold Purse's `AddResource` does not (KeepsakeLogic.lua:1209-1210,
 * 1365-1366), and run-start gold precedes any curse.
 */
const BLOCKABLE: ReadonlySet<GoldGain['kind']> = new Set([
  'moneyPickup',
  'currencyPickup',
  'fallbackGold',
  'heraclesBounty',
  'medeaGold',
  'loanPayback',
  'enemyGold',
  'urnGold',
  'arcanaGold',
  'timePiece',
  'midasPayout',
  'poolSale',
  'nemesisBet',
]);

const fixed = (gold: number): GoldAmount =>
  Object.freeze({ mean: gold, variance: 0, min: gold, max: gold });

/** Probabilities of an integer range drawn evenly and rounded, halving its ends. */
function roundedRoll(min: number, max: number): readonly { value: number; probability: number }[] {
  const intervals = max - min;
  return Array.from({ length: intervals + 1 }, (_, index) => ({
    value: min + index,
    probability: (index === 0 || index === intervals ? 0.5 : 1) / intervals,
  }));
}

function amountOf(values: readonly { value: number; probability: number }[]): GoldAmount {
  const mean = values.reduce((sum, { value, probability }) => sum + value * probability, 0);
  return Object.freeze({
    mean,
    variance: values.reduce(
      (sum, { value, probability }) => sum + probability * (value - mean) ** 2,
      0,
    ),
    min: Math.min(...values.map(({ value }) => value)),
    max: Math.max(...values.map(({ value }) => value)),
  });
}

function midasPayout(catalog: Catalog, itemKey: string, multiplier: number): GoldAmount {
  const payout = catalog.rewards.shops.byKey.RoomShop?.groups.values
    .flatMap((group) => group.options.values)
    .find((option) => option.key === itemKey)?.goldPayout;
  if (payout === undefined) throw new GoldLedgerContractError(`${itemKey} declares no payout`);
  const prices = new Map<number, number>();
  for (const health of roundedRoll(payout.healthCost.min, payout.healthCost.max))
    for (const perHealth of roundedRoll(
      payout.goldPerHealthHundredths.min,
      payout.goldPerHealthHundredths.max,
    )) {
      const gold = roundGold(roundGold((perHealth.value / 100) * health.value) * multiplier);
      prices.set(gold, (prices.get(gold) ?? 0) + health.probability * perHealth.probability);
    }
  return amountOf([...prices].map(([value, probability]) => ({ value, probability })));
}

function poolSale(
  catalog: Catalog,
  gain: Extract<GoldGain, { readonly kind: 'poolSale' }>,
): GoldAmount {
  const sale = catalog.gold.purgingPoolSale;
  const stack = sale.perLevel * Math.max(gain.level - 1, 0);
  if (gain.rarity === 'unranked') return fixed(sale.unranked + stack);
  const range = gain.rarity === 'infusion' ? sale.infusion : sale.byRarity[gain.rarity];
  const count = range.max - range.min + 1;
  const values = new Map<number, number>();
  for (let roll = range.min; roll <= range.max; roll += 1) {
    const value = Math.floor(roll / sale.roundDownTo) * sale.roundDownTo + stack;
    values.set(value, (values.get(value) ?? 0) + 1 / count);
  }
  return amountOf([...values].map(([value, probability]) => ({ value, probability })));
}

function evenInteger(min: number, max: number): GoldAmount {
  const count = max - min + 1;
  return Object.freeze({
    mean: (min + max) / 2,
    variance: (count * count - 1) / 12,
    min,
    max,
  });
}

const negate = (amount: GoldAmount): GoldAmount =>
  Object.freeze({
    mean: -amount.mean,
    variance: amount.variance,
    min: -amount.max,
    max: -amount.min,
  });

interface LedgerWalk {
  balance: GoldBalance;
  loans: Map<string, GoldBalance>;
}

function addTo(balance: GoldBalance, amount: GoldAmount): GoldBalance {
  return balance.availability === 'unavailable'
    ? balance
    : Object.freeze({
        availability: 'available',
        balance: Object.freeze({
          mean: balance.balance.mean + amount.mean,
          variance: balance.balance.variance + amount.variance,
        }),
      });
}

function worse(balance: GoldBalance, reason: 'itemUnresolved' | 'priorFault'): GoldBalance {
  if (balance.availability === 'unavailable' && balance.reason === 'priorFault') return balance;
  return Object.freeze({ availability: 'unavailable', reason });
}

/** Applies one priced gain to the walk and returns what it pays (negative when it takes). */
function applyGain(
  catalog: Catalog,
  modifiers: GoldRunModifiers,
  walk: LedgerWalk,
  { gain, multipliers }: GoldEventContext,
): GoldAmount | undefined {
  const blocked = multipliers.blocksGold && BLOCKABLE.has(gain.kind);
  const sigma = multipliers.moneyMultiplier;
  const bonus = multipliers.moneyRewardBonus;
  const pay = (amount: GoldAmount) => {
    walk.balance = addTo(walk.balance, amount);
    return amount;
  };
  // A blocked bet and payback still settle: the bet pays nothing, the stored loan gold is lost.
  if (blocked && gain.kind !== 'nemesisBet' && gain.kind !== 'loanPayback') return pay(ZERO_GOLD);
  switch (gain.kind) {
    case 'startingGold':
    case 'arcanaGold':
      return pay(fixed(gain.gold));
    case 'moneyPickup': {
      // Valued when it spawned, then re-multiplied by each money multiplier
      // taken while it lay uncollected (TraitLogic.lua:1045-1058).
      const base = gain.spawn ?? { moneyMultiplier: sigma, moneyRewardBonus: bonus };
      let gold = roundGold(
        gain.gold *
          (1 + (base.moneyMultiplier - 1) + (gain.npcDrop ? 0 : base.moneyRewardBonus - 1)),
      );
      for (const multiplier of gain.remultipliers ?? []) gold = roundGold(gold * multiplier);
      return pay(fixed(gold));
    }
    case 'currencyPickup':
      return pay(fixed(roundGold(gain.gold * (gain.spawn?.moneyMultiplier ?? sigma))));
    case 'fallbackGold':
    case 'keepsakeGold':
    case 'timePiece':
      return pay(fixed(roundGold(gain.gold * sigma)));
    case 'midasPayout':
      return pay(midasPayout(catalog, gain.itemKey, 1 + (sigma - 1) + (bonus - 1)));
    case 'poolSale':
      return pay(poolSale(catalog, gain));
    case 'nemesisTrade':
      return pay(negate(evenInteger(gain.min, gain.max)));
    case 'enemyGold':
      return pay(enemyGoldAmount(catalog, gain, sigma, modifiers));
    case 'heraclesBounty':
      return pay(heraclesBountyAmount());
    case 'medeaGold':
      return pay(medeaGoldAmount(catalog, gain, sigma));
    case 'urnGold':
      return pay(urnGoldAmount(catalog, gain, sigma));
    case 'nemesisBet': {
      if (blocked) return pay(ZERO_GOLD);
      if (walk.balance.availability === 'unavailable') return undefined;
      // GOLD_ESTIMATE_ASSUMPTIONS.md "Nemesis bet won", "Nemesis bet size".
      const bet = Math.min(gain.maxBet, Math.max(0, walk.balance.balance.mean));
      return pay(fixed(roundGold(bet * sigma)));
    }
    case 'loanTake': {
      const held = walk.balance;
      walk.loans.set(gain.traitKey, addTo(held, fixed(gain.returnGold)));
      if (held.availability === 'unavailable') return undefined;
      walk.balance = Object.freeze({
        availability: 'available',
        balance: Object.freeze({ mean: 0, variance: 0 }),
      });
      return Object.freeze({
        mean: -held.balance.mean,
        variance: held.balance.variance,
        min: -held.balance.mean,
        max: -held.balance.mean,
      });
    }
    case 'loanCredit': {
      const stored = walk.loans.get(gain.traitKey);
      if (stored !== undefined)
        walk.loans.set(gain.traitKey, addTo(stored, fixed(gain.returnGold)));
      return ZERO_GOLD;
    }
    case 'loanPayback': {
      const stored = walk.loans.get(gain.traitKey);
      walk.loans.delete(gain.traitKey);
      if (stored === undefined)
        throw new GoldLedgerContractError(`${gain.traitKey} pays back no loan`);
      if (blocked) return pay(ZERO_GOLD);
      if (stored.availability === 'unavailable') {
        walk.balance = worse(
          walk.balance,
          stored.reason === 'notWalked' ? 'priorFault' : stored.reason,
        );
        return undefined;
      }
      return pay(
        Object.freeze({
          ...stored.balance,
          min: stored.balance.mean,
          max: stored.balance.mean,
        }),
      );
    }
  }
}

interface RoomWalk {
  readonly room: OccurrenceAddress;
  readonly purchases: GoldPurchasePrice[];
  readonly gains: GoldGainEntry[];
  blocked?:
    | { readonly kind: 'itemUnresolved' }
    | { readonly kind: 'fault'; readonly error: GoldLedgerContractError };
  doorsOpenBalance?: GoldBalance;
  /** Purchases and sales follow the doors opening: the balance before the first, when no marker. */
  beforeFirstTrade?: GoldBalance;
  balanceAfter?: GoldBalance;
}

type Entry =
  | {
      readonly kind: 'purchase';
      readonly sequence: number;
      readonly publication: PurchasePriceContextPublication;
    }
  | {
      readonly kind: 'event';
      readonly sequence: number;
      readonly publication: GoldEventPublication;
    };

function contextOf(publication: GoldGainPublication): GoldEventContext {
  const [context, ...others] = publication.contexts;
  if (context === undefined || others.length > 0)
    throw new GoldLedgerContractError(
      `${publication.owner === undefined ? 'a gold contact' : semanticAddressKey(publication.owner)} has ${publication.contexts.length} distinct gold readings across reached branches`,
    );
  return context;
}

/**
 * Walks the route's purchases and gold contacts in chronological order,
 * carrying the balance and any loan, and records each room's gold.
 */
export function routeGoldLedger(
  catalog: Catalog,
  biomes: readonly BiomeGoldInputs[],
  modifiers: GoldRunModifiers = NATIVE_GOLD_MODIFIERS,
): RouteGoldLedger {
  const walk: LedgerWalk = {
    balance: START_BALANCE,
    loans: new Map(),
  };
  const purchases = new Map<string, GoldPurchaseResult>();
  const rooms = new Map<string, RoomWalk>();
  const runStartGains: GoldGainEntry[] = [];
  let runStartBalance: GoldBalance | undefined;
  let runStartFault: GoldLedgerContractError | undefined;
  const roomFor = (room: OccurrenceAddress) => {
    const key = semanticAddressKey(room);
    let entry = rooms.get(key);
    if (entry === undefined) {
      entry = { room, purchases: [], gains: [] };
      rooms.set(key, entry);
    }
    return entry;
  };
  const block = (room: RoomWalk | undefined, blocked: NonNullable<RoomWalk['blocked']>) => {
    if (room !== undefined && room.blocked?.kind !== 'fault') room.blocked = blocked;
  };
  for (const biome of biomes) {
    const entries: Entry[] = [
      ...biome.purchases.map((publication) => ({
        kind: 'purchase' as const,
        sequence: publication.sequence,
        publication,
      })),
      ...biome.events.map((publication) => ({
        kind: 'event' as const,
        sequence: publication.sequence,
        publication,
      })),
    ];
    // A purchase settles before the gold its own contact pays (a Price of Midas payout).
    entries.sort(
      (left, right) =>
        left.sequence - right.sequence ||
        (left.kind === right.kind ? 0 : left.kind === 'purchase' ? -1 : 1),
    );
    for (const entry of entries) {
      if (entry.kind === 'purchase') {
        const publication = entry.publication;
        const room = roomFor(publication.room);
        room.beforeFirstTrade ??= walk.balance;
        const quote =
          publication.owner === undefined
            ? undefined
            : biome.prices.purchases.get(semanticAddressKey(publication.owner));
        if (quote === undefined || quote.kind === 'fault') {
          const error =
            quote?.kind === 'fault'
              ? quote.error
              : new GoldLedgerContractError(
                  `a purchase in ${semanticAddressKey(publication.room)} has no price`,
                );
          block(room, { kind: 'fault', error });
          walk.balance = worse(walk.balance, 'priorFault');
        } else if (quote.kind === 'itemUnresolved') {
          purchases.set(semanticAddressKey(publication.owner!), quote);
          block(room, { kind: 'itemUnresolved' });
          walk.balance = worse(walk.balance, 'itemUnresolved');
        } else {
          const before = walk.balance;
          const purchase: GoldPurchasePrice = Object.freeze({
            ...quote.purchase,
            balanceBefore: before,
            ...(before.availability === 'available'
              ? {
                  affordableProbability: affordableProbability(
                    before.balance,
                    quote.purchase.price,
                  ),
                }
              : {}),
          });
          purchases.set(
            semanticAddressKey(quote.purchase.owner),
            Object.freeze({ kind: 'priced', purchase }),
          );
          room.purchases.push(purchase);
          walk.balance = addTo(walk.balance, negate(quote.purchase.price));
        }
        if (quote?.kind === 'fault' && publication.owner !== undefined)
          purchases.set(semanticAddressKey(publication.owner), quote);
        room.balanceAfter = walk.balance;
        continue;
      }
      const publication = entry.publication;
      if (publication.kind !== 'gain') {
        const room = roomFor(publication.room);
        if (publication.kind === 'doorsOpen') room.doorsOpenBalance = walk.balance;
        room.balanceAfter = walk.balance;
        continue;
      }
      const room = publication.room === undefined ? undefined : roomFor(publication.room);
      try {
        if (publication.unpriced?.kind === 'contractFailure')
          throw new GoldLedgerContractError(publication.unpriced.detail);
        if (publication.unpriced?.kind === 'itemUnresolved') {
          block(room, { kind: 'itemUnresolved' });
          walk.balance = worse(walk.balance, 'itemUnresolved');
        } else {
          const context = contextOf(publication);
          if (room !== undefined && context.gain.kind === 'poolSale')
            room.beforeFirstTrade ??= walk.balance;
          const amount = applyGain(catalog, modifiers, walk, context);
          if (context.gain.kind !== 'loanCredit') {
            const gainEntry: GoldGainEntry = Object.freeze({
              kind: context.gain.kind,
              ...(publication.owner === undefined ? {} : { owner: publication.owner }),
              ...(amount === undefined ? {} : { amount }),
            });
            if (room === undefined) runStartGains.push(gainEntry);
            else room.gains.push(gainEntry);
          }
        }
      } catch (error) {
        const fault =
          error instanceof GoldLedgerContractError
            ? error
            : new GoldLedgerContractError(error instanceof Error ? error.message : String(error));
        if (room === undefined) runStartFault = fault;
        else block(room, { kind: 'fault', error: fault });
        walk.balance = worse(walk.balance, 'priorFault');
      }
      if (room === undefined) runStartBalance = walk.balance;
      else room.balanceAfter = walk.balance;
    }
  }
  return Object.freeze({
    purchases,
    rooms: new Map(
      [...rooms].map(([key, room]): [string, GoldRoomResult] => {
        if (room.blocked !== undefined) return [key, Object.freeze(room.blocked)];
        const balanceAfter = room.balanceAfter ?? walk.balance;
        return [
          key,
          Object.freeze({
            kind: 'priced',
            room: Object.freeze({
              room: room.room,
              purchases: Object.freeze([...room.purchases]),
              spending: sumGold(room.purchases.map((purchase) => purchase.price)),
              gains: Object.freeze([...room.gains]),
              doorsOpenBalance: room.doorsOpenBalance ?? room.beforeFirstTrade ?? balanceAfter,
              balanceAfter,
            }),
          }),
        ];
      }),
    ),
    runStart:
      runStartFault === undefined
        ? Object.freeze({
            kind: 'priced' as const,
            runStart: Object.freeze({
              gains: Object.freeze(runStartGains),
              balance: runStartBalance ?? START_BALANCE,
            }),
          })
        : Object.freeze({ kind: 'fault' as const, error: runStartFault }),
  });
}
