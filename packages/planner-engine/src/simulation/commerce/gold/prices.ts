import type { ShopOptionCost } from '../../../reward-kernel';

/** An amount of gold as a mean and variance with its bounds; a fixed amount has no spread. */
export interface GoldAmount {
  readonly mean: number;
  readonly variance: number;
  readonly min: number;
  readonly max: number;
}

/** The game's `round`: half up. */
export function roundGold(value: number): number {
  return Math.floor(value + 0.5);
}

/** One base amount a cost can take and its probability. */
export interface WeightedBase {
  readonly base: number;
  readonly probability: number;
}

/**
 * The base amounts a cost can take. A rolled amount is drawn continuously and
 * rounded to its step, so each end amount is half as likely as an inner one.
 */
export function baseCostSupport(cost: ShopOptionCost): readonly WeightedBase[] {
  if (cost.kind === 'fixed') return [{ base: cost.gold, probability: 1 }];
  const intervals = (cost.max - cost.min) / cost.step;
  const values: WeightedBase[] = [];
  for (let index = 0; index <= intervals; index += 1)
    values.push({
      base: cost.min + index * cost.step,
      probability: (index === 0 || index === intervals ? 0.5 : 1) / intervals,
    });
  return values;
}

/** The moments of a price over its weighted base amounts. */
export function priceAmount(
  support: readonly WeightedBase[],
  price: (base: number) => number,
): GoldAmount {
  const prices = support.map(({ base, probability }) => ({ value: price(base), probability }));
  const mean = prices.reduce((sum, { value, probability }) => sum + value * probability, 0);
  const variance = prices.reduce(
    (sum, { value, probability }) => sum + probability * (value - mean) ** 2,
    0,
  );
  return Object.freeze({
    mean,
    variance,
    min: Math.min(...prices.map(({ value }) => value)),
    max: Math.max(...prices.map(({ value }) => value)),
  });
}

export const ZERO_GOLD: GoldAmount = Object.freeze({ mean: 0, variance: 0, min: 0, max: 0 });

/** Independent prices add their means, variances and bounds. */
export function sumGold(amounts: readonly GoldAmount[]): GoldAmount {
  return Object.freeze(
    amounts.reduce(
      (total, amount) => ({
        mean: total.mean + amount.mean,
        variance: total.variance + amount.variance,
        min: total.min + amount.min,
        max: total.max + amount.max,
      }),
      { ...ZERO_GOLD },
    ),
  );
}

/**
 * Native `GetShopCostMultiplier`: the Vow times the held price multipliers,
 * less the Travel Deal discount on the room's first purchase.
 */
export function shopCostMultiplier(inputs: {
  readonly vowMultiplier: number;
  readonly voucherMultiplier: number;
  readonly travelDealDiscount: number | undefined;
}): number {
  const vow = 1 + (inputs.vowMultiplier - 1);
  if (inputs.travelDealDiscount === undefined) return vow * inputs.voucherMultiplier;
  // The trait holds `FirstPurchaseDiscount` as a factor rounded to the percent.
  const firstPurchaseFactor = Math.floor((1 - inputs.travelDealDiscount) * 100 + 0.5) / 100;
  return vow * (inputs.voucherMultiplier - (1 - firstPurchaseFactor));
}

/** A Shrine order: the shop price, then rounded again after its delay factor. */
export function shrineOrderPrice(base: number, multiplier: number, delayFactor: number): number {
  return roundGold(roundGold(base * multiplier) * delayFactor);
}

/** A Shrine rush of an ordered item: the impatience price less what the order cost. */
export function shrineRushPrice(
  base: number,
  multiplier: number,
  delayFactor: number,
  rushMultiplier: number,
): number {
  return (
    roundGold(base * multiplier * rushMultiplier) - shrineOrderPrice(base, multiplier, delayFactor)
  );
}
