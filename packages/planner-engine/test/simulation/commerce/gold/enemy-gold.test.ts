import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  affordableProbability,
  encounterStoreMoments,
  enemyGoldAmount,
  heraclesBountyAmount,
  medeaGoldAmount,
  urnGoldAmount,
} from '../../../../src/simulation/commerce/gold/enemy-gold';
import { enemyGoldPolicy } from '../../../../src/simulation/commerce/gold/enemy-gold-policy';
import type { GoldGain } from '../../../../src/simulation/commerce/gold/gain-context';

type EnemyGold = Extract<GoldGain, { readonly kind: 'enemyGold' }>;
const enemyGold = (encounterKey: string, biomeKey: string, facts: Partial<EnemyGold> = {}) =>
  ({
    kind: 'enemyGold',
    encounterKey,
    biomeKey,
    runDepth: 1,
    hordesRank: 0,
    ...facts,
  }) as const satisfies EnemyGold;
const NATIVE = {};
const definition = (key: string) => catalog.encounterDefinitions.byKey[key]!;
const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const variance = (values: readonly number[]) => {
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
};

describe('enemy gold cap', () => {
  it('draws the integer cap, adds the run-depth ramp and rounds the multiplied store up', () => {
    const store = definition('GeneratedF').moneyStore!;
    // RandomInt(10, 15) + 3 x 0.5, then ceil: 12..17.
    expect(encounterStoreMoments(store, 3, 1, undefined)).toEqual({
      mean: mean([12, 13, 14, 15, 16, 17]),
      variance: variance([12, 13, 14, 15, 16, 17]),
    });
    // ceil((roll + 1.5) x 1.2) for each roll: 14, 15, 17, 18, 19, 20.
    expect(encounterStoreMoments(store, 3, 1.2, undefined).mean).toBeCloseTo(
      mean([14, 15, 17, 18, 19, 20]),
      12,
    );
    // Native double arithmetic: 25 x 1.2 is exactly 30, 25 x 2.2 is 55.00000000000001 and rounds up.
    expect(encounterStoreMoments(definition('GeneratedG').moneyStore!, 1, 1.2, 100)).toEqual({
      mean: 30,
      variance: 0,
    });
    expect(
      encounterStoreMoments(definition('GeneratedG').moneyStore!, 1, 1 + (2.2 - 1), 100),
    ).toEqual({ mean: 56, variance: 0 });
  });

  it('fixes the roll at the encounterGoldRange point with no store spread', () => {
    const store = definition('GeneratedF').moneyStore!;
    // floor((100 x 10 + 29 x 5 + 50) / 100) = 11, plus the ramp.
    expect(encounterStoreMoments(store, 3, 1, 29)).toEqual({ mean: 13, variance: 0 });
    expect(encounterStoreMoments(store, 0, 1, 0)).toEqual({ mean: 10, variance: 0 });
    expect(encounterStoreMoments(store, 0, 1, 100)).toEqual({ mean: 15, variance: 0 });
  });
});

describe('enemy gold payout policy', () => {
  it('resolves an encounter to its own policy or its room biome’s generated combat', () => {
    expect(enemyGoldPolicy(definition('GeneratedF'), 'F')?.kind).toBe('storeOvershoot');
    expect(enemyGoldPolicy(definition('GeneratedQ'), 'Q')?.kind).toBe('storeFraction');
    expect(enemyGoldPolicy(definition('P_Combat07_PreCombat02'), 'P')).toBe(
      enemyGoldPolicy(definition('GeneratedP'), 'P'),
    );
    expect(enemyGoldPolicy(definition('MiniBossFogEmitter'), 'F')).toMatchObject({
      kind: 'constant',
      mean: 60,
    });
    expect(enemyGoldPolicy(definition('BossHecate01'), 'F')).toEqual({ kind: 'none', kills: 1 });
    expect(enemyGoldPolicy(definition('Empty'), 'F')).toEqual({ kind: 'none', kills: 0 });
  });

  it('covers every combat and miniboss in the biomes whose rooms bind it', () => {
    const missing: string[] = [];
    const checked = new Set<string>();
    for (const room of catalog.rooms.values) {
      const biomeKey = /^[FGHINOPQ](?=$|_)/.exec(room.roomSetKey)?.[0];
      const keys = room.encounterSlotBindings.flatMap((binding) =>
        binding.kind === 'fixed'
          ? [binding.encounterDefinitionKey]
          : (catalog.encounterSets.byKey[binding.encounterSetKey]?.authoringProfiles.flatMap(
              (profile) => profile.encounterDefinitionKeys,
            ) ?? []),
      );
      for (const key of keys) {
        const encounter = definition(key);
        if (encounter.kind !== 'combat' && encounter.kind !== 'miniboss') continue;
        checked.add(key);
        if (enemyGoldPolicy(encounter, biomeKey ?? room.roomSetKey) === undefined)
          missing.push(`${room.gameName}:${key}`);
      }
    }
    expect(missing).toEqual([]);
    expect(checked.size).toBeGreaterThan(140);
  });

  it('pays an exhausting biome its store plus the overshoot, a sparse one a fraction', () => {
    const f = enemyGoldAmount(catalog, enemyGold('GeneratedF', 'F'), 1, NATIVE);
    // Store 11..16 at depth 1; F's native overshoot is 1.9 with a residual SD of 3.
    expect(f.mean).toBeCloseTo(13.5 + 1.9, 12);
    expect(f.variance).toBeCloseTo(variance([11, 12, 13, 14, 15, 16]) + 9, 12);
    const q = enemyGoldAmount(catalog, enemyGold('GeneratedQ', 'Q'), 1, NATIVE);
    const qStore = Array.from({ length: 26 }, (_, i) => 60 + i);
    expect(q.mean).toBeCloseTo(0.73 * mean(qStore), 12);
    expect(q.variance).toBeCloseTo(0.73 ** 2 * variance(qStore) + 27.4 ** 2, 9);
    // The money multiplier scales the store and the drops alike.
    const doubled = enemyGoldAmount(catalog, enemyGold('GeneratedQ', 'Q'), 2, NATIVE);
    expect(doubled.mean).toBeCloseTo(2 * q.mean, 9);
  });

  it('reads the Hordes row where Hordes changes the kills', () => {
    const at = (hordesRank: number) =>
      enemyGoldAmount(catalog, enemyGold('GeneratedQ', 'Q', { hordesRank }), 1, NATIVE).mean;
    expect(at(3) / at(0)).toBeCloseTo(0.9 / 0.73, 12);
    expect(at(1)).toBeGreaterThan(at(0));
  });

  it('interpolates an enemyGoldDropChance between its calibrated chances and pays nothing at 0', () => {
    const at = (enemyGoldDropChance: number) =>
      enemyGoldAmount(catalog, enemyGold('GeneratedQ', 'Q'), 1, { enemyGoldDropChance }).mean;
    const store = mean(Array.from({ length: 26 }, (_, i) => 60 + i));
    expect(at(0)).toBe(0);
    expect(at(25)).toBeCloseTo(0.28 * store, 12);
    expect(at(50)).toBeCloseTo(0.54 * store, 12);
    expect(at(60)).toBeCloseTo((0.54 + 0.4 * (0.77 - 0.54)) * store, 12);
    expect(at(10)).toBeCloseTo(0.4 * at(25), 12);
    // A fixed-roster ungenerated encounter keeps its native drops: the override needs a store.
    expect(
      enemyGoldAmount(catalog, enemyGold('PIntroCombat07', 'P'), 1, { enemyGoldDropChance: 0 })
        .mean,
    ).toBe(24.5);
    expect(
      enemyGoldAmount(catalog, enemyGold('MiniBossBoar', 'N'), 1, { enemyGoldDropChance: 0 }).mean,
    ).toBe(0);
  });

  it('scales a store-bearing constant by the drop chance up to the native chance', () => {
    const at = (enemyGoldDropChance?: number) =>
      enemyGoldAmount(
        catalog,
        enemyGold('MiniBossBoar', 'N'),
        1,
        enemyGoldDropChance === undefined ? NATIVE : { enemyGoldDropChance },
      );
    // MiniBossBoar's constant is 36 with a spread of 5, taken at the native 70%.
    expect(at().mean).toBe(36);
    expect(at(35).mean).toBeCloseTo(18, 12);
    expect(at(35).variance).toBeCloseTo(2.5 ** 2, 12);
    expect(at(100).mean).toBe(36);
  });

  it('leaves only the residual spread when encounterGoldRange fixes the store', () => {
    const fixed = enemyGoldAmount(catalog, enemyGold('GeneratedG', 'G'), 1, {
      encounterGoldRange: 50,
    });
    // floor((1500 + 50 x 10 + 50) / 100) = 20; G overshoots by 10.4 with a residual SD of 9.9.
    expect(fixed).toMatchObject({ mean: 30.4 });
    expect(fixed.variance).toBeCloseTo(9.9 ** 2, 12);
  });

  it('pays Heracles’s bounty flat and unmultiplied beside the store drops', () => {
    expect(heraclesBountyAmount()).toEqual({ mean: 100, variance: 0, min: 100, max: 100 });
    const p = enemyGoldAmount(catalog, enemyGold('HeraclesCombatP', 'P'), 1, NATIVE);
    expect(p.mean).toBeCloseTo(0.27 * 122.5, 12);
  });
});

describe('Medea and urn gold', () => {
  const binomialCapped = (n: number, p: number, cap: number) => {
    let total = 0;
    let probability = (1 - p) ** n;
    for (let k = 0; k <= n; k += 1) {
      total += Math.min(k, cap) * probability;
      probability *= ((n - k) / (k + 1)) * (p / (1 - p));
    }
    return total;
  };

  it('caps Wealth from the Dead at two drops over the room’s kills, collected at 70%', () => {
    const gain = {
      kind: 'medeaGold',
      goldPerDrop: 20,
      chance: 0.1,
      dropCap: 2,
      // A Boar miniboss alone in its room: 1 + 15 adds.
      encounters: [{ encounterKey: 'MiniBossBoar', biomeKey: 'N', hordesRank: 0 }],
    } as const;
    expect(medeaGoldAmount(catalog, gain, 1).mean).toBeCloseTo(
      20 * 0.7 * binomialCapped(16, 0.1, 2),
      9,
    );
    // The multiplier rounds each drop: round(20 x 1.3) = 26.
    expect(medeaGoldAmount(catalog, gain, 1.3).mean).toBeCloseTo(
      26 * 0.7 * binomialCapped(16, 0.1, 2),
      9,
    );
    // A second fight pays only what it adds under the room's cap.
    const boar = gain.encounters[0]!;
    const second = medeaGoldAmount(catalog, { ...gain, encounters: [boar, boar] }, 1).mean;
    expect(medeaGoldAmount(catalog, gain, 1).mean + second).toBeCloseTo(
      20 * 0.7 * binomialCapped(32, 0.1, 2),
      9,
    );
    // Hordes grows a generated roster's kills.
    const generated = (hordesRank: number) =>
      medeaGoldAmount(
        catalog,
        { ...gain, encounters: [{ encounterKey: 'GeneratedF', biomeKey: 'F', hordesRank }] },
        1,
      ).mean;
    expect(generated(3)).toBeGreaterThan(generated(0));
  });

  it('breaks the biome’s golden urns and the listed rooms’ own', () => {
    // Four Chronos-pot attempts: 15, 10 or 5 gold at 1%, 2% and 2% tried in order.
    const attempt = 0.01 * 15 + 0.99 * 0.02 * 10 + 0.99 * 0.98 * 0.02 * 5;
    expect(
      urnGoldAmount({ kind: 'urnGold', biomeKey: 'F', roomGameName: 'F_Combat01' }, 1).mean,
    ).toBeCloseTo(4 * 0.7 * attempt, 12);
    expect(
      urnGoldAmount({ kind: 'urnGold', biomeKey: 'I', roomGameName: 'I_MiniBoss02' }, 1).mean,
    ).toBeCloseTo(13 * 15 * 0.7, 12);
    expect(
      urnGoldAmount({ kind: 'urnGold', biomeKey: 'H', roomGameName: 'H_Combat01' }, 1),
    ).toEqual({ mean: 0, variance: 0, min: 0, max: 0 });
    const side = urnGoldAmount({ kind: 'urnGold', biomeKey: 'N', roomGameName: 'N_Sub01' }, 1);
    const sideAttempt = 0.1 * 15 + 0.9 * 0.1 * 10 + 0.81 * 0.1 * 5;
    expect(side.mean).toBeCloseTo(2 * 0.7 * sideAttempt, 12);
  });
});

describe('affordability', () => {
  it('is certain for a fixed balance that covers the price and impossible otherwise', () => {
    expect(affordableProbability({ mean: 100, variance: 0 }, { mean: 100, variance: 0 })).toBe(1);
    expect(affordableProbability({ mean: 100, variance: 0 }, { mean: 101, variance: 0 })).toBe(0);
  });

  it('reads the normal approximation of balance less price', () => {
    // (100 - 100 + 0.5) / 10 standard deviations.
    expect(
      affordableProbability({ mean: 100, variance: 64 }, { mean: 100, variance: 36 }),
    ).toBeCloseTo(0.5199, 3);
    expect(
      affordableProbability({ mean: 150, variance: 100 }, { mean: 100, variance: 0 }),
    ).toBeCloseTo(0.99999, 4);
    expect(
      affordableProbability({ mean: 80, variance: 100 }, { mean: 100, variance: 0 }),
    ).toBeCloseTo(0.0256, 3);
  });
});
