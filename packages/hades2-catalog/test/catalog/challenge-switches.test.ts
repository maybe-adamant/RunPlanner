import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { declarations } from '../../src/declarations';

const switches = catalog.challengeSwitches;

function withSwitches(edit: (raw: Record<string, unknown>) => void) {
  const raw = JSON.parse(JSON.stringify(declarations.challengeSwitches)) as Record<string, unknown>;
  edit(raw);
  return () => createCatalog({ ...declarations, challengeSwitches: raw as never });
}

describe('challenge switch declarations', () => {
  it('normalizes the three kinds, five variants and their source weights', () => {
    expect(switches.kinds.values.map((kind) => kind.key)).toEqual([
      'time',
      'perfectClear',
      'elite',
    ]);
    expect(
      switches.variants.values.map((variant) => [
        variant.key,
        variant.switchKind,
        variant.weight,
        variant.rewardType,
        variant.requirement !== undefined,
      ]),
    ).toEqual([
      ['TimeChallengeSwitch_Money', 'time', 4, 'Money', false],
      ['PerfectClearChallengeSwitch_Pom', 'perfectClear', 3, 'StackUpgrade', true],
      ['PerfectClearChallengeSwitch_MaxHealth', 'perfectClear', 1, 'MaxHealthDrop', false],
      ['EliteChallengeSwitch_Talent', 'elite', 5, 'TalentDrop', true],
      ['EliteChallengeSwitch_MaxMana', 'elite', 2, 'MaxManaDrop', false],
    ]);
    expect(switches.kinds.byKey.perfectClear).toMatchObject({
      defaultVariantKey: 'PerfectClearChallengeSwitch_Pom',
      hitRewardType: 'RoomRewardConsolationPrize',
      goldReward: false,
    });
    expect(switches.kinds.byKey.elite?.minimumBiomeDepth).toBe(3);
    expect(switches.kinds.byKey.elite?.requirement).toBeDefined();
    expect(switches.kinds.byKey.time).toMatchObject({ goldReward: true });
    expect(switches.minimumBiomeDepth).toBe(5);
    expect(switches.minimumRoomsSinceLast).toBe(3);
    expect(switches.gold).toEqual({ startingValue: 100, minimumValue: 10, defaultValue: 90 });
    expect(switches.bonusReward).toEqual({ rewardType: 'GiftDrop', dropChance: 0.05 });
  });

  it('spawns claim pickups through one lifecycle with no RunProgress upgrade', () => {
    const lifecycle = catalog.rewards.producerLifecycles.byKey[switches.producerLifecycleKey]!;
    expect(lifecycle.runProgressUpgradeEligible).toBeUndefined();
    expect(lifecycle.rewardTypes.byKey.GiftDrop?.acquisitionLifecycle).toEqual([
      { role: 'self', lifecyclePoint: 'roomRewardPickup' },
    ]);
    // The gold gush is not a consumable: Sea Star and Time Piece never touch it.
    expect(catalog.rewards.acquisitions.byKey.Money).toMatchObject({
      canDuplicate: false,
      goldConversionEligible: false,
    });
  });

  it('hosts exactly the anchored rooms of a RoomSet with a nonzero chance', () => {
    const hosts = switches.hosts.byKey;
    expect(hosts.F_Combat05).toEqual({
      gameName: 'F_Combat05',
      spawnChance: 0.25,
      encounterKeyBySwitchKind: {
        time: 'TimeChallengeF',
        perfectClear: 'PerfectClearChallengeF',
        elite: 'EliteChallengeF',
      },
    });
    expect(hosts.I_MiniBoss02?.spawnChance).toBe(0.15);
    expect(hosts.Q_Combat09?.encounterKeyBySwitchKind.elite).toBe('EliteChallengeQ');
    for (const gameName of [
      'F_PostBoss01',
      'O_Reprieve01',
      'N_Sub01',
      'Dream_PostBoss02',
      'F_Combat99',
      'F_PreBoss01',
    ])
      expect(hosts[gameName]).toBeUndefined();
    for (const host of switches.hosts.values)
      expect(catalog.rooms.byKey[host.gameName]?.challengeSwitchAnchorCount).toBeGreaterThan(0);
  });

  it('refuses an anchored room without a chance and a spawn-free room without anchors', () => {
    expect(
      withSwitches((raw) => {
        raw.noSpawnRoomGameNames = (raw.noSpawnRoomGameNames as string[]).filter(
          (name) => name !== 'Dream_PostBoss01',
        );
      }),
    ).toThrow(/anchored room Dream_PostBoss01 has no RoomSet switch chance/);
    expect(
      withSwitches((raw) => {
        raw.noSpawnRoomGameNames = [...(raw.noSpawnRoomGameNames as string[]), 'F_Boss01'];
      }),
    ).toThrow(/noSpawnRoomGameNames\[\d+\]: F_Boss01 is not an anchored room/);
  });

  it('refuses a reward outside the lifecycle and a default from another kind', () => {
    expect(
      withSwitches((raw) => {
        (raw.variants as { rewardType: string }[])[2]!.rewardType = 'MaxHealthDropBig';
      }),
    ).toThrow(/variants\[2\]\.rewardType: MaxHealthDropBig is not a ChallengeSwitchLoot reward/);
    expect(
      withSwitches((raw) => {
        (raw.kinds as { defaultVariantKey: string }[])[0]!.defaultVariantKey =
          'EliteChallengeSwitch_Talent';
      }),
    ).toThrow(/kinds\[0\]\.defaultVariantKey: is not a time variant/);
    expect(
      withSwitches((raw) => {
        (raw.gold as { defaultValue: number }).defaultValue = 120;
      }),
    ).toThrow(/gold: must order minimumValue <= defaultValue <= startingValue/);
  });

  it('declares each Elite switch encounter with its elite set and forced attributes', () => {
    const elite = switches.eliteEncounters;
    expect(
      elite.values.map((encounter) => [
        encounter.encounterKey,
        encounter.enemies.map((enemy) => enemy.key),
      ]),
    ).toEqual([
      ['EliteChallengeF', ['Brawler_Elite']],
      ['EliteChallengeG', ['FishmanMelee_Elite']],
      ['EliteChallengeH', ['Lycanthrope_Elite', 'Mourner_Elite']],
      [
        'EliteChallengeI',
        ['SatyrLancer_Elite', 'SatyrRatCatcher_Elite', 'ClockworkHeavyMelee_Elite'],
      ],
      ['EliteChallengeN', ['Mudman_Elite', 'ZombieHeavyRanged_Elite', 'ZombieAssassin_Elite']],
      ['EliteChallengeO', ['Swab_Elite']],
      [
        'EliteChallengeP',
        ['SatyrSapper_Elite', 'Dragon_Elite', 'AutomatonEnforcer_Elite', 'AutomatonBeamer_Elite'],
      ],
      ['EliteChallengeQ', ['Brute_Elite']],
    ]);
    expect(elite.byKey.EliteChallengeQ).toMatchObject({
      attributeCount: 2,
      bannedAttributeKeys: ['Metallic', 'SpreadHitShields', 'StasisDeath', 'HeavyArmor'],
    });
    expect(elite.byKey.EliteChallengeQ?.attributes.Frenzy).toEqual({
      label: 'Swifter',
      excludes: ['Homing', 'Vacuuming'],
    });
    for (const host of switches.hosts.values)
      expect(elite.byKey[host.encounterKeyBySwitchKind.elite]).toBeDefined();
  });

  it('refuses an Elite set member without attributes and a host without its encounter', () => {
    expect(
      withSwitches((raw) => {
        (
          raw.eliteEncounters as { attributeOptionsByEnemy: Record<string, unknown> }[]
        )[0]!.attributeOptionsByEnemy.Brawler_Elite = { options: [], blockedOptions: [] };
      }),
    ).toThrow(/eliteEncounters\[0\]\.enemies\[0\]: Brawler_Elite has no attribute options/);
    expect(
      withSwitches((raw) => {
        raw.eliteEncounters = (raw.eliteEncounters as { encounterKey: string }[]).filter(
          (encounter) => encounter.encounterKey !== 'EliteChallengeQ',
        );
      }),
    ).toThrow(/names no declared EliteChallengeQ/);
  });
});

const sets = ['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q'] as const;

function generatedPolicy(key: string) {
  const selection = catalog.encounterDefinitions.byKey[key]?.customization?.[0]?.selection;
  if (selection?.kind !== 'generated') throw new Error(`${key} has no generated composition`);
  return selection;
}

function withDefinitions(edit: (definitions: Record<string, unknown>[]) => void) {
  const raw = JSON.parse(JSON.stringify(declarations.encounterDefinitions)) as Record<
    string,
    unknown
  >[];
  edit(raw);
  return () => createCatalog({ ...declarations, encounterDefinitions: raw as never });
}

describe('challenge switch encounters', () => {
  it('declares every RoomSet encounter outside the room encounter sets', () => {
    for (const set of sets)
      for (const [key, label] of [
        [`TimeChallenge${set}`, 'Time challenge'],
        [`PerfectClearChallenge${set}`, 'Perfect Clear challenge'],
        [`EliteChallenge${set}`, 'Elite challenge'],
      ] as const)
        expect(catalog.encounterDefinitions.byKey[key], key).toMatchObject({
          label,
          kind: 'combat',
          countsEncounterDepth: true,
          canEncounterSkip: false,
          skipEndEncounterEffects: false,
          advancesHermesShrineDeliveryUses: false,
        });
    const members = new Set(
      catalog.encounterSets.values.flatMap((set) => set.encounterDefinitionKeys),
    );
    for (const host of switches.hosts.values)
      for (const key of Object.values(host.encounterKeyBySwitchKind))
        expect(members.has(key), key).toBe(false);
    // Each set's GeneratedX store, drawn by native GenerateEncounter at entry.
    expect(
      sets.map((set) => catalog.encounterDefinitions.byKey[`EliteChallenge${set}`]?.moneyStore),
    ).toEqual(sets.map((set) => catalog.encounterDefinitions.byKey[`Generated${set}`]?.moneyStore));
    expect(catalog.encounterDefinitions.byKey.TimeChallengeQ?.moneyStore).toEqual({
      capMin: 60,
      capMax: 85,
      runDepthRamp: 0,
    });
  });

  it('generates Time and PerfectClear rosters through their inherited policies', () => {
    for (const set of sets) {
      expect(generatedPolicy(`TimeChallenge${set}`), set).toMatchObject({
        preparation: 'roomEntry',
        waveCount: { min: 1, max: 1 },
        types: { min: 2, max: 3, cap: 3, depthRamp: 0 },
        requireCompletedIntro: true,
        choices: generatedPolicy(`Generated${set}`).choices,
      });
      expect(generatedPolicy(`PerfectClearChallenge${set}`), set).toMatchObject({
        waveCount: { min: 1, max: 1 },
        types: {
          min: 3,
          max: 3,
          cap: 3,
          depthRamp: generatedPolicy(`Generated${set}`).types.depthRamp,
        },
        maxEliteTypes: generatedPolicy(`Generated${set}`).maxEliteTypes,
        requireCompletedIntro: true,
      });
      // Never a hard encounter, so no hard override.
      expect(generatedPolicy(`TimeChallenge${set}`).types.hardCap).toBeUndefined();
      expect(generatedPolicy(`TimeChallenge${set}`).budget.hardDepthRamp).toBeUndefined();
    }
    // EncounterData_TimeChallenge.lua:87-99 TimeChallengeI.
    expect(generatedPolicy('TimeChallengeI')).toMatchObject({
      maxEliteTypes: 2,
      budget: { base: 380, depthRamp: 10, depthAxis: 'biomeDepthCache' },
    });
    // GeneratedH's EscalateTypeCount and UseEncounterDepth.
    expect(generatedPolicy('TimeChallengeH')).toMatchObject({
      types: { escalate: true, depthAxis: 'biomeDepthCache' },
      budget: { base: 290, depthRamp: 0, depthAxis: 'biomeEncounterDepth' },
    });
    // GeneratedQ's UseEncounterDepthForTypes.
    expect(generatedPolicy('PerfectClearChallengeQ').types).toMatchObject({
      escalate: true,
      depthAxis: 'biomeEncounterDepth',
    });
    expect(generatedPolicy('TimeChallengeP').maxTypesPerGroup).toEqual({
      Automatons: 1,
      ChronosForces: 2,
    });
    expect(generatedPolicy('PerfectClearChallengeF').budget).toMatchObject({
      base: 60,
      depthRamp: 11,
    });
  });

  it('fields an Elite switch’s one elite with no composition', () => {
    for (const set of sets) {
      expect(
        catalog.encounterDefinitions.byKey[`EliteChallenge${set}`]?.customization,
      ).toBeUndefined();
      expect(switches.eliteEncounters.byKey[`EliteChallenge${set}`]?.spawnCount).toBe(1);
    }
  });

  it('refuses a missing, bound or misshapen switch encounter', () => {
    expect(
      withDefinitions((definitions) => {
        definitions.splice(
          definitions.findIndex((definition) => definition.key === 'TimeChallengeF'),
          1,
        );
      }),
    ).toThrow(/encounterKeyBySwitchKind\.time: undeclared encounter TimeChallengeF/);
    expect(
      withDefinitions((definitions) => {
        const elite = definitions.find((definition) => definition.key === 'EliteChallengeG')!;
        elite.customization = definitions.find(
          (definition) => definition.key === 'TimeChallengeG',
        )!.customization;
      }),
    ).toThrow(/EliteChallengeG fields its one elite/);
    expect(
      withDefinitions((definitions) => {
        delete definitions.find((definition) => definition.key === 'PerfectClearChallengeO')!
          .customization;
      }),
    ).toThrow(/PerfectClearChallengeO must declare one generated composition/);
    expect(
      withDefinitions((definitions) => {
        delete definitions.find((definition) => definition.key === 'TimeChallengeI')!.moneyStore;
      }),
    ).toThrow(/TimeChallengeI must draw a money store/);
    expect(
      withDefinitions((definitions) => {
        const time = definitions.find((definition) => definition.key === 'TimeChallengeP')! as {
          customization: { selection: Record<string, unknown> }[];
        };
        delete time.customization[0]!.selection.requireCompletedIntro;
      }),
    ).toThrow(/TimeChallengeP must require completed introductions/);
    expect(
      withSwitches((raw) => {
        const roomSets = raw.roomSets as { encounterKeyBySwitchKind: Record<string, string> }[];
        roomSets[0]!.encounterKeyBySwitchKind.time = 'GeneratedF';
      }),
    ).toThrow(/GeneratedF is also a room encounter/);
  });
});
