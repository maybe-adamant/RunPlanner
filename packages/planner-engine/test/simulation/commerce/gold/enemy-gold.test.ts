import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  affordableProbability,
  encounterStoreMoments,
  encounterStoreValues,
  enemyGoldAmount,
  heraclesBountyAmount,
  medeaGoldAmount,
  urnGoldAmount,
} from '../../../../src/simulation/commerce/gold/enemy-gold';
import { enemyGoldPolicy } from '../../../../src/simulation/commerce/gold/enemy-gold-policy';
import {
  knownEncounterRoster,
  knownRosterPayout,
} from '../../../../src/simulation/commerce/gold/known-roster';
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
    expect(enemyGoldPolicy(definition('MiniBossFogEmitter_Shrine'), 'F')).toMatchObject({
      kind: 'constant',
      mean: 38,
    });
    // Fields cages drain the room's Passive store and pay nothing of their own.
    expect(enemyGoldPolicy(definition('GeneratedH'), 'H')).toEqual({
      kind: 'roomStore',
      kills: 7.2,
    });
    expect(enemyGoldPolicy(definition('BossHecate01'), 'F')).toEqual({ kind: 'none', kills: 1 });
    expect(enemyGoldPolicy(definition('Empty'), 'F')).toEqual({ kind: 'none', kills: 0 });
  });

  it('covers every combat and miniboss without a fixed roster in the biomes whose rooms bind it', () => {
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
        // An all-fixed identity or a miniboss always pays from its roster.
        if (encounter.fixedRoster !== undefined || encounter.bossRoster !== undefined) continue;
        checked.add(key);
        if (enemyGoldPolicy(encounter, biomeKey ?? room.roomSetKey) === undefined)
          missing.push(`${room.gameName}:${key}`);
      }
    }
    expect(missing).toEqual([]);
    expect(checked.size).toBeGreaterThan(50);
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
    expect(
      enemyGoldAmount(catalog, enemyGold('MiniBossFogEmitter_Shrine', 'F'), 1, {
        enemyGoldDropChance: 0,
      }).mean,
    ).toBe(0);
  });

  it('scales a store-bearing constant by the drop chance up to the native chance', () => {
    const at = (enemyGoldDropChance?: number) =>
      enemyGoldAmount(
        catalog,
        enemyGold('MiniBossFogEmitter_Shrine', 'F'),
        1,
        enemyGoldDropChance === undefined ? NATIVE : { enemyGoldDropChance },
      );
    // The shadow Fog emitter's constant is 38 with a spread of 21, taken at the native 70%.
    expect(at().mean).toBe(38);
    expect(at(35).mean).toBeCloseTo(19, 12);
    expect(at(35).variance).toBeCloseTo(10.5 ** 2, 12);
    expect(at(100).mean).toBe(38);
  });

  it('leaves only the residual spread when encounterGoldRange fixes the store', () => {
    const fixed = enemyGoldAmount(catalog, enemyGold('GeneratedG', 'G'), 1, {
      encounterGoldRange: 50,
    });
    // floor((1500 + 50 x 10 + 50) / 100) = 20; G overshoots by 10.4 with a residual SD of 14.
    expect(fixed).toMatchObject({ mean: 30.4 });
    expect(fixed.variance).toBeCloseTo(14 ** 2, 12);
  });

  it('pays Heracles’s bounty flat and unmultiplied beside the store drops', () => {
    expect(heraclesBountyAmount()).toEqual({ mean: 100, variance: 0, min: 100, max: 100 });
    const p = enemyGoldAmount(catalog, enemyGold('HeraclesCombatP', 'P'), 1, NATIVE);
    expect(p.mean).toBeCloseTo(0.27 * 122.5, 12);
  });
});

describe('known-roster enemy gold', () => {
  const roster = [
    [
      { enemyKey: 'Brawler', count: 2 },
      { enemyKey: 'Guard', count: 4 },
    ],
  ];

  it('pays a known roster against the encounter’s exact store in place of the policy', () => {
    const gain = enemyGold('GeneratedF', 'F', { runDepth: 3, roster });
    const sigma = 1.3;
    const paid = enemyGoldAmount(catalog, gain, sigma, NATIVE);
    const expected = knownRosterPayout(catalog, roster, {
      moneyMultiplier: sigma,
      stores: encounterStoreValues(definition('GeneratedF').moneyStore!, 3, sigma, undefined),
    });
    expect(paid).toMatchObject({ mean: expected.mean, variance: expected.variance });
    // encounterGoldRange fixes the store; enemyGoldDropChance rewrites every kill's chance.
    expect(
      enemyGoldAmount(catalog, gain, 1, { encounterGoldRange: 0, enemyGoldDropChance: 100 }).mean,
    ).toBeCloseTo(
      knownRosterPayout(catalog, roster, { moneyMultiplier: 1, stores: [12], dropChance: 100 })
        .mean,
      12,
    );
    expect(enemyGoldAmount(catalog, gain, 1, { enemyGoldDropChance: 0 }).mean).toBe(0);
  });

  it('pays an ungenerated fixed roster every drop, untouched by the drop chance', () => {
    const fishman = knownEncounterRoster(catalog, 'FishmanIntro', undefined)!;
    const gain = enemyGold('FishmanIntro', 'G', { roster: fishman });
    expect(enemyGoldAmount(catalog, gain, 1, { enemyGoldDropChance: 0 }).mean).toBeCloseTo(
      knownRosterPayout(catalog, fishman, { moneyMultiplier: 1 }).mean,
      12,
    );
  });

  it('counts a known roster’s kills for Wealth from the Dead', () => {
    const gain = {
      kind: 'medeaGold',
      goldPerDrop: 20,
      chance: 0.1,
      dropCap: 2,
      encounters: [{ encounterKey: 'GeneratedF', biomeKey: 'F', hordesRank: 0, roster }],
    } as const;
    // Six kills, not Erebus's 12.5 expected: E[min(Binomial(6, 0.1), 2)].
    const none = 0.9 ** 6;
    const one = 6 * 0.1 * 0.9 ** 5;
    expect(medeaGoldAmount(catalog, gain, 1).mean).toBeCloseTo(
      20 * 0.7 * (one + 2 * (1 - none - one)),
      9,
    );
  });
});

describe('Fields store and miniboss rosters', () => {
  it('pays a Fields room’s Passive store in full with the crossing overshoot', () => {
    const passive = enemyGoldAmount(catalog, enemyGold('GeneratedH_Passive', 'H'), 1, NATIVE);
    const store = Array.from({ length: 21 }, (_, i) => 10 + i);
    expect(passive.mean).toBeCloseTo(mean(store) + 9, 12);
    expect(passive.variance).toBeCloseTo(variance(store) + 7 ** 2, 9);
    // A Nemesis event in the Passive slot holds an undrawn 25: no ramp, no multiplier.
    const store25 = definition('NemesisRandomEvent').moneyStore!;
    expect(encounterStoreValues(store25, 6, 2, 50)).toEqual([25]);
    expect(
      enemyGoldAmount(catalog, enemyGold('NemesisRandomEvent', 'H'), 2, NATIVE).mean,
    ).toBeCloseTo(25 + 2 * 9, 12);
  });

  it('kills a miniboss’s own enemies, the one whose death wipes the rest last', () => {
    expect(knownEncounterRoster(catalog, 'MiniBossSatyrCrossbow', undefined)).toEqual([
      [{ enemyKey: 'Carrion', count: 5 }],
      [{ enemyKey: 'SatyrCrossbow', count: 1 }],
    ]);
    expect(knownEncounterRoster(catalog, 'MiniBossVampire', undefined)).toEqual([
      [{ enemyKey: 'CorruptedShadeSmall', count: 13 }],
      [{ enemyKey: 'Vampire', count: 1 }],
    ]);
    // The Fog emitter's wipe is commented out: native wave order stands.
    expect(knownEncounterRoster(catalog, 'MiniBossFogEmitter', undefined)).toEqual([
      [{ enemyKey: 'FogEmitter_Elite', count: 1 }],
      [{ enemyKey: 'SiegeVine', count: 3 }],
    ]);
  });

  it('pays a miniboss from its roster against its store', () => {
    const paid = (encounterKey: string, biomeKey: string) =>
      enemyGoldAmount(
        catalog,
        enemyGold(encounterKey, biomeKey, {
          roster: knownEncounterRoster(catalog, encounterKey, undefined)!,
        }),
        1,
        NATIVE,
      );
    // Chance-0 minibosses pay nothing.
    for (const [key, biome] of [
      ['MiniBossTreant', 'F'],
      ['MiniBossBrute', 'Q'],
      ['MiniBossCharybdis', 'O'],
      ['BossTyphonTail01', 'Q'],
    ] as const)
      expect(paid(key, biome).mean).toBe(0);
    // The elite's certain 50-70 parcel is paid in full against a store of 15.
    expect(paid('MiniBossFogEmitter', 'F').mean).toBeCloseTo(60, 9);
    // Thirteen shades drain the store of 15 before the Vampire falls.
    const vampire = paid('MiniBossVampire', 'H').mean;
    expect(vampire).toBeGreaterThan(15);
    expect(vampire).toBeLessThan(20);
    // Ungenerated Talos pays its uncapped parcel at 70%: 17..22.
    expect(paid('MiniBossTalos', 'P').mean).toBeCloseTo(0.7 * 19.5, 9);
  });
});

describe('boss rosters', () => {
  const paid = (encounterKey: string, sigma = 1) => {
    const roster = knownEncounterRoster(catalog, encounterKey, undefined);
    return enemyGoldAmount(
      catalog,
      enemyGold(encounterKey, 'F', roster === undefined ? {} : { roster }),
      sigma,
      NATIVE,
    );
  };

  it('pays a boss’s encounter-spawned and pre-placed adds uncapped, the boss itself nothing', () => {
    // Hecate's 12 LightRanged at 70%, each 3..4 gold; Hecate's rating of 1 truncates to 0.
    expect(paid('BossHecate01').mean).toBeCloseTo(12 * 0.7 * 3.5, 9);
    // Six pre-placed cultists at 24..32.
    expect(paid('BossChronos01').mean).toBeCloseTo(6 * 0.7 * 28, 9);
    for (const key of ['BossScylla01', 'BossEris01', 'BossPrometheus01', 'BossPolyphemus02'])
      expect(paid(key).mean).toBe(0);
    // The money multiplier rounds each parcel: round(28 x 2) per cultist on average.
    expect(paid('BossChronos01', 2).mean).toBeCloseTo(2 * paid('BossChronos01').mean, 9);
  });

  it('mixes a boss’s random spawn picks by weight', () => {
    // One of five Cerberus spawn encounters, each all killed before Cerberus.
    const parcel = (min: number, max: number) => 0.7 * ((min + max) / 2);
    const picks = [
      4 * parcel(54, 70),
      2 * parcel(69, 90),
      3 * parcel(52, 68),
      4 * parcel(39, 51),
      9 * parcel(8, 10) + parcel(12, 15),
    ];
    expect(paid('BossInfestedCerberus01').mean).toBeCloseTo(mean(picks), 9);
    expect(paid('BossInfestedCerberus01').variance).toBeGreaterThan(variance(picks));
    // The Rivals list draws its fourth encounter twice in five.
    expect(paid('BossInfestedCerberus02').mean).toBeCloseTo(
      (5 * parcel(31, 40) + 6 * parcel(24, 32) + 5 * parcel(26, 34) + 2 * 7 * parcel(18, 23)) / 5,
      9,
    );
  });

  it('pays Typhon’s hatchlings at the egg hatch rate', () => {
    // Half the time five Simple2 eggs (8..10), half the time two Brute2 eggs (64..83); a quarter hatch.
    expect(paid('BossTyphonHead01').mean).toBeCloseTo(
      0.25 * 0.7 * (0.5 * 5 * 9 + 0.5 * 2 * 73.5),
      9,
    );
    expect(paid('BossTyphonHead02').mean).toBeCloseTo(0.25 * 0.7 * 0.5 * 2 * 18, 9);
    // Medea counts Typhon and the expected hatchlings: 1 + 0.25 x (4 + 3).
    const medea = (encounterKey: string) =>
      medeaGoldAmount(
        catalog,
        {
          kind: 'medeaGold',
          goldPerDrop: 20,
          chance: 1,
          dropCap: 10,
          encounters: [{ encounterKey, biomeKey: 'Q', hordesRank: 0 }],
        },
        1,
      ).mean;
    expect(medea('BossTyphonHead01')).toBeCloseTo(20 * 0.7 * 2.75, 9);
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
      // A Boar miniboss alone in its room: the boar and its 12 zombies.
      encounters: [
        {
          encounterKey: 'MiniBossBoar',
          biomeKey: 'N',
          hordesRank: 0,
          roster: knownEncounterRoster(catalog, 'MiniBossBoar', undefined)!,
        },
      ],
    } as const;
    expect(medeaGoldAmount(catalog, gain, 1).mean).toBeCloseTo(
      20 * 0.7 * binomialCapped(13, 0.1, 2),
      9,
    );
    // The multiplier rounds each drop: round(20 x 1.3) = 26.
    expect(medeaGoldAmount(catalog, gain, 1.3).mean).toBeCloseTo(
      26 * 0.7 * binomialCapped(13, 0.1, 2),
      9,
    );
    // A second fight pays only what it adds under the room's cap.
    const boar = gain.encounters[0]!;
    const second = medeaGoldAmount(catalog, { ...gain, encounters: [boar, boar] }, 1).mean;
    expect(medeaGoldAmount(catalog, gain, 1).mean + second).toBeCloseTo(
      20 * 0.7 * binomialCapped(26, 0.1, 2),
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

  it('swaps one more urn than the room set’s limit, bounded by the map’s breakables', () => {
    const urns = (roomGameName: string) =>
      urnGoldAmount(catalog, { kind: 'urnGold', roomGameName }, 1);
    // Four Chronos-pot candidates: 15, 10 or 5 gold at 1%, 2% and 2% tried in order.
    const attempt = 0.01 * 15 + 0.99 * 0.02 * 10 + 0.99 * 0.98 * 0.02 * 5;
    expect(urns('F_Combat01').mean).toBeCloseTo(4 * 0.7 * attempt, 12);
    // A shop or a Chaos room swaps as its set does.
    expect(urns('F_Shop01').mean).toBeCloseTo(4 * 0.7 * attempt, 12);
    expect(urns('Chaos_01').mean).toBeCloseTo(4 * 0.7 * attempt, 12);
    // I_Combat08's map places one breakable, under Tartarus's seven candidates.
    expect(urns('I_Combat08').mean).toBeCloseTo(0.7 * attempt, 12);
    expect(urns('I_MiniBoss02').mean).toBeCloseTo(13 * 15 * 0.7, 12);
    const none = { mean: 0, variance: 0, min: 0, max: 0 };
    // Fields maps place no breakables; Thessaly's and the Anomaly's swap none; I_PreBoss01 has none.
    for (const room of ['H_Combat01', 'O_Combat01', 'B_Combat01', 'I_PreBoss01'])
      expect(urns(room)).toEqual(none);
    const sideAttempt = 0.1 * 15 + 0.9 * 0.1 * 10 + 0.81 * 0.1 * 5;
    expect(urns('N_Sub01').mean).toBeCloseTo(2 * 0.7 * sideAttempt, 12);
    // Q_Combat04's map places four, under the Summit's nine.
    const surfaceAttempt = 0.05 * 15 + 0.95 * 0.05 * 10 + 0.95 * 0.95 * 0.05 * 5;
    expect(urns('Q_Combat04').mean).toBeCloseTo(4 * 0.7 * surfaceAttempt, 12);
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
