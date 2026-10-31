import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog, EnemyGoldDrop } from '../../../../src/catalog-schema';
import { encounterStoreValues } from '../../../../src/simulation/commerce/gold/enemy-gold';
import {
  knownEncounterRoster,
  knownRosterKills,
  knownRosterPayout,
  type KnownRoster,
} from '../../../../src/simulation/commerce/gold/known-roster';
import type { GeneratedEncounterOperands } from '../../../../src/simulation/encounters/generation';

// EnemyData_FogEmitter.lua:61-70: the miniboss pays one fixed 50-70 parcel.
const fogEmitter: EnemyGoldDrop = {
  key: 'FogEmitter_Elite',
  kind: 'parcel',
  chance: 1,
  value: { min: 50, max: 70 },
};
const withFogEmitter: Catalog = {
  ...catalog,
  enemyGoldDrops: {
    values: [...catalog.enemyGoldDrops.values, fogEmitter],
    byKey: { ...catalog.enemyGoldDrops.byKey, FogEmitter_Elite: fogEmitter },
  },
};

const roster = (...waves: (readonly [string, number])[][]): KnownRoster =>
  waves.map((wave) => wave.map(([enemyKey, count]) => ({ enemyKey, count })));
const stores = (key: string, runDepth = 0, sigma = 1) =>
  encounterStoreValues(
    catalog.encounterDefinitions.byKey[key]!.moneyStore!,
    runDepth,
    sigma,
    undefined,
  );

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monte Carlo of the native drop rule: each wave's kills in a shuffled order,
 * each kill dropping at its chance a parcel round(RandomInt(min, max) × Σ),
 * at least one against a store, while the store is positive.
 */
function simulate(
  source: Catalog,
  waves: KnownRoster,
  options: { stores?: readonly number[]; sigma?: number; dropChance?: number },
  samples: number,
) {
  const random = mulberry32(7);
  const sigma = options.sigma ?? 1;
  const kills = waves.map((wave) =>
    wave.flatMap(({ enemyKey, count }) => {
      const drop = source.enemyGoldDrops.byKey[enemyKey]!;
      const [unit, size] =
        drop.kind === 'unitGroup'
          ? [source.enemyGoldDrops.byKey[drop.unitKey]!, drop.size]
          : [drop, 1];
      return Array.from({ length: count * size }, () => unit);
    }),
  );
  let sum = 0;
  let squares = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const store =
      options.stores === undefined
        ? Number.POSITIVE_INFINITY
        : options.stores[Math.floor(random() * options.stores.length)]!;
    let paid = 0;
    for (const wave of kills) {
      const order = [...wave];
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      for (const drop of order) {
        if (paid >= store) break;
        if (drop.kind !== 'parcel') continue;
        const chance =
          options.stores !== undefined && options.dropChance !== undefined
            ? options.dropChance / 100
            : drop.chance;
        if (!(random() <= chance)) continue;
        const roll = drop.value.min + Math.floor(random() * (drop.value.max - drop.value.min + 1));
        const amount = Math.floor(roll * sigma + 0.5);
        paid += options.stores === undefined ? Math.max(0, amount) : Math.max(1, amount);
      }
    }
    sum += paid;
    squares += paid * paid;
  }
  const mean = sum / samples;
  return { mean, sd: Math.sqrt(squares / samples - mean * mean) };
}

describe('known roster', () => {
  it('reads an all-fixed identity’s declared waves', () => {
    expect(knownEncounterRoster(catalog, 'FishmanIntro', undefined)).toEqual(
      roster(
        [['FishmanMelee', 1]],
        [
          ['FishmanMelee', 2],
          ['FishmanRanged', 1],
        ],
        [
          ['FishmanMelee', 3],
          ['FishmanRanged', 3],
        ],
      ),
    );
    expect(knownEncounterRoster(catalog, 'GeneratedF', undefined)).toBeUndefined();
  });

  it('reads a complete composition’s counts, Menace conversions spawning their targets', () => {
    const operands = {
      expectedBudget: 60,
      waveCount: 1,
      menace: [
        {
          waveIndex: 1,
          conversions: [
            { sourceKey: 'Guard', sourceNativeId: 'Guard', count: 2, targetNativeId: 'Guard2' },
          ],
        },
      ],
      waves: [
        {
          waveIndex: 1,
          typeKeys: ['Guard', 'Mage'],
          sources: { Guard: 'addition', Mage: 'addition' },
          counts: { Guard: 5, Mage: 2 },
        },
      ],
    } satisfies GeneratedEncounterOperands;
    expect(knownEncounterRoster(catalog, 'GeneratedF', operands)).toEqual(
      roster([
        ['Guard', 3],
        ['Mage', 2],
        ['Guard2', 2],
      ]),
    );
  });

  it('counts a unit group’s members as kills', () => {
    expect(
      knownRosterKills(
        catalog,
        roster([
          ['FishSwarmerSquad', 3],
          ['WaterUnit', 2],
        ]),
      ),
    ).toBe(17);
  });

  it('pays an uncapped roster every drop', () => {
    // Two Dragons: 0.7 × RandomInt(8, 11) each (0.035 × 250 = 8.75, × 1.3 = 11.375).
    const paid = knownRosterPayout(catalog, roster([['Dragon', 2]]), { moneyMultiplier: 1 });
    const parcel = [8, 9, 10, 11];
    const mean = parcel.reduce((sum, value) => sum + value, 0) / 4;
    const second = parcel.reduce((sum, value) => sum + value * value, 0) / 4;
    expect(paid.mean).toBeCloseTo(2 * 0.7 * mean, 12);
    expect(paid.variance).toBeCloseTo(2 * (0.7 * second - (0.7 * mean) ** 2), 12);
    // An uncapped parcel rounding to zero drops nothing: Σ 0.4 turns WaterElemental's 0..1 into 0.
    expect(
      knownRosterPayout(catalog, roster([['WaterElemental', 3]]), { moneyMultiplier: 0.4 }).mean,
    ).toBe(0);
  });

  it('pays a lone parcel larger than its store in full', () => {
    const paid = knownRosterPayout(withFogEmitter, roster([['FogEmitter_Elite', 1]]), {
      moneyMultiplier: 1,
      stores: [15],
    });
    expect(paid.mean).toBeCloseTo(60, 12);
    expect(paid.variance).toBeCloseTo((21 * 21 - 1) / 12, 9);
  });

  it('pays nothing at a zero drop chance and every kill at certainty against a store', () => {
    const waves = roster([
      ['Mati_Elite', 1],
      ['Brute', 1],
    ]);
    expect(
      knownRosterPayout(catalog, waves, {
        moneyMultiplier: 1,
        stores: stores('GeneratedQ'),
        dropChance: 0,
      }),
    ).toEqual({ mean: 0, variance: 0 });
    // Without a store the override does not apply.
    expect(
      knownRosterPayout(catalog, waves, { moneyMultiplier: 1, dropChance: 0 }).mean,
    ).toBeGreaterThan(0);
  });

  // Representative rosters across the biomes; the closed form is exact for the
  // native rule up to quadrature, so it meets the Monte Carlo within its error.
  const cases: readonly {
    readonly name: string;
    readonly waves: KnownRoster;
    readonly stores?: readonly number[];
    readonly sigma?: number;
    readonly dropChance?: number;
  }[] = [
    {
      name: 'Erebus, one wave',
      waves: roster([
        ['Radiator_Elite', 5],
        ['Mage', 4],
        ['Guard', 1],
      ]),
      stores: stores('GeneratedF', 5),
    },
    {
      name: 'Erebus, three waves',
      waves: roster(
        [['Brawler_Elite', 1]],
        [
          ['Brawler_Elite', 1],
          ['Mage', 1],
        ],
        [
          ['Brawler_Elite', 1],
          ['Guard', 3],
          ['Screamer', 2],
        ],
      ),
      stores: stores('GeneratedF', 5),
    },
    {
      name: 'Oceanus, Pinhead squads',
      waves: roster([
        ['WaterUnit_Elite', 4],
        ['FishSwarmerSquad', 9],
      ]),
      stores: stores('GeneratedG'),
    },
    {
      name: 'Oceanus at a money multiplier of 2.2',
      waves: roster([
        ['FishSwarmerSquad_Elite', 6],
        ['WaterUnit', 7],
      ]),
      stores: stores('GeneratedG', 0, 2.2),
      sigma: 2.2,
    },
    {
      name: 'Fields, elite overshoot',
      waves: roster([
        ['Lovesick', 5],
        ['Mourner_Elite', 3],
      ]),
      stores: stores('GeneratedH'),
    },
    {
      name: 'Tartarus, three waves',
      waves: roster(
        [['GoldElemental', 7]],
        [
          ['GoldElemental', 2],
          ['TimeElemental_Elite', 1],
        ],
        [
          ['GoldElemental', 4],
          ['SatyrRatCatcher', 3],
          ['SatyrLancer_Elite', 1],
        ],
      ),
      stores: stores('GeneratedI'),
    },
    {
      name: 'Ephyra, sparse drops',
      waves: roster([
        ['Mudman_Elite', 2],
        ['Carrion', 5],
        ['ZombieHeavyRanged', 1],
      ]),
      stores: stores('GeneratedN'),
    },
    {
      name: 'Thessaly',
      waves: roster([
        ['Scimiterror', 4],
        ['Stickler', 6],
      ]),
      stores: stores('GeneratedO'),
    },
    {
      name: 'Olympus pre-combat',
      waves: knownEncounterRoster(catalog, 'P_Combat01_PreCombat03', undefined)!,
      stores: stores('P_Combat01_PreCombat03'),
    },
    {
      name: 'Summit, two heavy parcels',
      waves: roster([
        ['Brute_Elite', 1],
        ['DragonBurrower_Elite', 1],
      ]),
      stores: stores('GeneratedQ'),
    },
    {
      name: 'Summit at a 25% drop chance',
      waves: roster([
        ['Mati_Elite', 1],
        ['Brute', 1],
      ]),
      stores: stores('GeneratedQ'),
      dropChance: 25,
    },
    {
      name: 'Lycaon introduction',
      waves: knownEncounterRoster(catalog, 'LycanthropeIntro', undefined)!,
      stores: stores('LycanthropeIntro'),
    },
    {
      name: 'FogEmitter miniboss before its Thorn-Weepers',
      waves: roster([['FogEmitter_Elite', 1]], [['SiegeVine', 3]]),
      stores: [15],
    },
    {
      name: 'FogEmitter miniboss among six Whispers',
      waves: roster([
        ['FogEmitter_Elite', 1],
        ['Guard', 6],
      ]),
      stores: [15],
    },
    {
      name: 'Chronos introduction, uncapped',
      waves: knownEncounterRoster(catalog, 'ClockworkIntro', undefined)!,
    },
  ];

  it.each(cases)('meets the Monte Carlo of the native rule: $name', (entry) => {
    const options = {
      ...(entry.stores === undefined ? {} : { stores: entry.stores }),
      ...(entry.sigma === undefined ? {} : { sigma: entry.sigma }),
      ...(entry.dropChance === undefined ? {} : { dropChance: entry.dropChance }),
    };
    const closed = knownRosterPayout(withFogEmitter, entry.waves, {
      moneyMultiplier: entry.sigma ?? 1,
      ...(entry.stores === undefined ? {} : { stores: entry.stores }),
      ...(entry.dropChance === undefined ? {} : { dropChance: entry.dropChance }),
    });
    const samples = 40_000;
    const sampled = simulate(withFogEmitter, entry.waves, options, samples);
    // Four standard errors of the sampled mean, floored at a quarter gold.
    expect(Math.abs(closed.mean - sampled.mean)).toBeLessThan(
      Math.max(0.25, (4 * sampled.sd) / Math.sqrt(samples)),
    );
    expect(Math.abs(Math.sqrt(closed.variance) - sampled.sd)).toBeLessThan(
      Math.max(0.15 * sampled.sd, 0.5),
    );
  });
});
