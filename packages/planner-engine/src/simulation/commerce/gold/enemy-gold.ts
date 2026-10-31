import type { Catalog, EncounterMoneyStore } from '../../../catalog-schema';
import type { RunModifiers } from '../../../authored-project/run-modifiers';
import {
  DROPPED_GOLD_COLLECTION_RATE,
  HERACLES_BOUNTY_GOLD,
  NATIVE_ENEMY_GOLD_DROP_CHANCE,
  enemyGoldKills,
  enemyGoldPolicy,
  urnAttempts,
  type DropChanceCells,
  type EnemyGoldPolicy,
} from './enemy-gold-policy';
import type { GoldGain } from './gain-context';
import { GoldLedgerContractError } from './ledger';
import { roundGold, ZERO_GOLD, type GoldAmount } from './prices';

interface Moments {
  readonly mean: number;
  readonly variance: number;
}

/**
 * An estimated amount: its moments, with bounds three standard deviations
 * either side of the mean, floored at zero.
 */
export function estimatedGold({ mean, variance }: Moments): GoldAmount {
  const spread = 3 * Math.sqrt(Math.max(0, variance));
  return Object.freeze({
    mean,
    variance: Math.max(0, variance),
    min: Math.max(0, Math.floor(mean - spread)),
    max: Math.max(0, Math.ceil(mean + spread)),
  });
}

/**
 * The store native draws (RunLogic.lua:1186-1190): an integer cap roll plus
 * the run-depth ramp, times the money multiplier, rounded up. An
 * `encounterGoldRange` fixes the roll at that point of the cap range.
 */
export function encounterStoreMoments(
  store: EncounterMoneyStore,
  runDepth: number,
  moneyMultiplier: number,
  encounterGoldRange: number | undefined,
): Moments {
  const rolls =
    encounterGoldRange === undefined
      ? Array.from({ length: store.capMax - store.capMin + 1 }, (_, index) => store.capMin + index)
      : [
          Math.floor(
            (100 * store.capMin + encounterGoldRange * (store.capMax - store.capMin) + 50) / 100,
          ),
        ];
  // Plain double arithmetic as native: 25 × 2.2 is 55.00000000000001 and rounds up to 56.
  const values = rolls.map((roll) =>
    Math.ceil((roll + runDepth * store.runDepthRamp) * moneyMultiplier),
  );
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    mean,
    variance: values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
  };
}

const DROP_CHANCE_GRID = [25, 50, 75, 100] as const;

/**
 * The paid amount at an `enemyGoldDropChance`: the native cell when unset,
 * else linear between the calibrated chances, with nothing paid at zero.
 */
function atDropChance(
  dropChance: number | undefined,
  amountAt: (cell: number) => Moments,
): Moments {
  if (dropChance === undefined) return amountAt(0);
  const q = Math.max(0, Math.min(100, dropChance));
  if (q === 0) return { mean: 0, variance: 0 };
  let lower: { q: number; amount: Moments } = { q: 0, amount: { mean: 0, variance: 0 } };
  for (const [index, gridQ] of DROP_CHANCE_GRID.entries()) {
    const upper = { q: gridQ, amount: amountAt(index + 1) };
    if (q <= gridQ) {
      const t = (q - lower.q) / (upper.q - lower.q);
      return {
        mean: lower.amount.mean + t * (upper.amount.mean - lower.amount.mean),
        variance: lower.amount.variance + t * (upper.amount.variance - lower.amount.variance),
      };
    }
    lower = upper;
  }
  return lower.amount;
}

function policyFor(
  catalog: Catalog,
  encounterKey: string,
  biomeKey: string,
): { readonly policy: EnemyGoldPolicy; readonly store?: EncounterMoneyStore } {
  const definition = catalog.encounterDefinitions.byKey[encounterKey];
  if (definition === undefined)
    throw new GoldLedgerContractError(`${encounterKey} is not a declared encounter`);
  const policy = enemyGoldPolicy(definition, biomeKey);
  if (policy === undefined)
    throw new GoldLedgerContractError(`${encounterKey} in ${biomeKey} has no enemy gold policy`);
  return {
    policy,
    ...(definition.moneyStore === undefined ? {} : { store: definition.moneyStore }),
  };
}

/**
 * What a completed encounter's kills pay. A store-paying policy reads the
 * exact store; `enemyGoldDropChance` overrides only drops that pay from a
 * store, so it leaves an ungenerated encounter native.
 */
export function enemyGoldAmount(
  catalog: Catalog,
  gain: Extract<GoldGain, { readonly kind: 'enemyGold' }>,
  moneyMultiplier: number,
  modifiers: Pick<RunModifiers, 'enemyGoldDropChance' | 'encounterGoldRange'>,
): GoldAmount {
  const { policy, store } = policyFor(catalog, gain.encounterKey, gain.biomeKey);
  const dropChance = store === undefined ? undefined : modifiers.enemyGoldDropChance;
  const sigma = moneyMultiplier;
  switch (policy.kind) {
    case 'none':
      return ZERO_GOLD;
    case 'constant': {
      // Approximation: the override rewrites every kill's chance, so the
      // constant scales with it up to the native chance and the store caps it above.
      const scale =
        dropChance === undefined
          ? 1
          : Math.min(1, Math.max(0, dropChance) / NATIVE_ENEMY_GOLD_DROP_CHANCE);
      return estimatedGold({
        mean: policy.mean * sigma * scale,
        variance: (policy.sd * sigma * scale) ** 2,
      });
    }
    case 'storeOvershoot':
    case 'storeFraction': {
      if (store === undefined)
        throw new GoldLedgerContractError(`${gain.encounterKey} pays from a store it lacks`);
      const cap = encounterStoreMoments(store, gain.runDepth, sigma, modifiers.encounterGoldRange);
      const residual = (policy.residualSd * sigma) ** 2;
      const cells: DropChanceCells =
        policy.kind === 'storeOvershoot'
          ? policy.overshoot
          : policy.fractionByHordesRank[
              Math.min(policy.fractionByHordesRank.length - 1, Math.max(0, gain.hordesRank))
            ]!;
      return estimatedGold(
        atDropChance(dropChance, (cell) =>
          policy.kind === 'storeOvershoot'
            ? {
                mean: Math.max(0, cap.mean + cells[cell]! * sigma),
                variance: cap.variance + residual,
              }
            : {
                mean: cells[cell]! * cap.mean,
                variance: cells[cell]! ** 2 * cap.variance + residual,
              },
        ),
      );
    }
  }
}

/** Heracles's credited bounty: one pickup paying the marked kills' gold, unmultiplied. */
export function heraclesBountyAmount(): GoldAmount {
  return Object.freeze({
    mean: HERACLES_BOUNTY_GOLD,
    variance: 0,
    min: HERACLES_BOUNTY_GOLD,
    max: HERACLES_BOUNTY_GOLD,
  });
}

/** Moments of `min(Binomial(kills, chance), cap)` for a real expected kill count. */
function cappedDrops(kills: number, chance: number, cap: number): Moments {
  if (kills <= 0 || chance <= 0) return { mean: 0, variance: 0 };
  // P(N = k) = C(n, k) p^k (1-p)^(n-k), extended to a real n through the gamma ratio.
  let probability = (1 - chance) ** kills;
  let below = 0;
  let mean = 0;
  let second = 0;
  for (let k = 0; k < cap; k += 1) {
    below += probability;
    mean += k * probability;
    second += k * k * probability;
    probability *= ((kills - k) / (k + 1)) * (chance / (1 - chance));
    if (kills - k <= 0) probability = 0;
  }
  const atCap = Math.max(0, 1 - below);
  mean += cap * atCap;
  second += cap * cap * atCap;
  return { mean, variance: second - mean * mean };
}

/**
 * Wealth from the Dead as one fight adds to its room: each kill drops at the
 * luck-scaled chance, at most `dropCap` per room, so the fight pays what its
 * kills add to the room's capped drops. Each drop pays its gold times the
 * money multiplier and is collected at the dropped-gold rate.
 */
export function medeaGoldAmount(
  catalog: Catalog,
  gain: Extract<GoldGain, { readonly kind: 'medeaGold' }>,
  moneyMultiplier: number,
): GoldAmount {
  const killsOf = (encounters: typeof gain.encounters) =>
    encounters.reduce((total, encounter) => {
      const { policy } = policyFor(catalog, encounter.encounterKey, encounter.biomeKey);
      return total + enemyGoldKills(policy, encounter.biomeKey, encounter.hordesRank);
    }, 0);
  const value = roundGold(gain.goldPerDrop * moneyMultiplier);
  const rate = DROPPED_GOLD_COLLECTION_RATE;
  const collected = (kills: number): Moments => {
    const chance = Math.min(1, gain.chance);
    const drops =
      chance >= 1
        ? { mean: Math.min(kills, gain.dropCap), variance: 0 }
        : cappedDrops(kills, chance, gain.dropCap);
    // Each drop is picked up independently at the collection rate.
    return {
      mean: value * rate * drops.mean,
      variance: value * value * (rate * (1 - rate) * drops.mean + rate * rate * drops.variance),
    };
  };
  const room = collected(killsOf(gain.encounters));
  const before = collected(killsOf(gain.encounters.slice(0, -1)));
  return estimatedGold({
    mean: room.mean - before.mean,
    variance: Math.max(0, room.variance - before.variance),
  });
}

/** A room's golden urns, each drop times the money multiplier and collected at the dropped-gold rate. */
export function urnGoldAmount(
  gain: Extract<GoldGain, { readonly kind: 'urnGold' }>,
  moneyMultiplier: number,
): GoldAmount {
  const room = urnAttempts(gain.biomeKey, gain.roomGameName);
  if (room === undefined) return ZERO_GOLD;
  const rate = DROPPED_GOLD_COLLECTION_RATE;
  let mean = 0;
  let second = 0;
  for (const { gold, probability } of room.values) {
    const value = roundGold(gold * moneyMultiplier);
    mean += rate * probability * value;
    second += rate * probability * value * value;
  }
  return estimatedGold({
    mean: room.attempts * mean,
    variance: room.attempts * (second - mean * mean),
  });
}

/** The standard normal distribution function (Abramowitz-Stegun 7.1.26 through erf). */
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    t *
      (0.254829592 +
        t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
      Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * The chance a balance covers a price under the normal approximation:
 * P(balance − price ≥ 0), gold being whole, with both spreads.
 */
export function affordableProbability(balance: Moments, price: Moments): number {
  const mean = balance.mean - price.mean;
  const variance = balance.variance + price.variance;
  if (variance <= 1e-9) return mean >= -1e-9 ? 1 : 0;
  return normalCdf((mean + 0.5) / Math.sqrt(variance));
}
