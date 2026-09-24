import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { normalizeEncounterGeneration } from '../../src/compiler/encounters/generation';

const definitions = catalog.encounterDefinitions.values.filter((definition) =>
  definition.customization?.some((decision) => decision.selection.kind === 'generated'),
);
function selection(key: string) {
  const value = definitions.find((definition) => definition.key === key)?.customization?.[0]
    ?.selection;
  if (value?.kind !== 'generated') throw new Error(key);
  return value;
}

type BudgetRow = readonly [
  key: string,
  base: number | { readonly min: number; readonly max: number },
  depthRamp: number,
  depthAxis: 'biomeDepthCache' | 'biomeEncounterDepth',
  modifier: number,
  multiplier: number,
  hardDepthRamp: number | undefined,
];
// Native GenerateEncounter budget facts (RunLogic.lua:1181-1213) after
// InheritFrom resolution (RunData.lua:1363-1416): own value, then first parent.
// Absent modifier/multiplier use native 0/1; every row uses the minimum 10
// (EncounterData.lua:1). UseEncounterDepth: EncounterData_Generated.lua:245,697,850,1314.
// Dream DataOverrides and HardEncounterOverrideValues carry no budget key except
// the hard DepthDifficultyRamp, so no Dream rows exist.
const budgetEvidence: readonly BudgetRow[] = [
  // EncounterData.lua:199-200, hard :248
  ['GeneratedF', 55, 15, 'biomeDepthCache', 0, 1, 30],
  // BaseDevotion EncounterData_Devotion.lua:6-7, own base :157
  ['DevotionTestF', 150, 0, 'biomeDepthCache', 0, 1, 30],
  // GeneratedF plus BaseArtemisCombat modifier EncounterData_Artemis.lua:55
  ['ArtemisCombatF', 55, 15, 'biomeDepthCache', 60, 1, 30],
  // GeneratedF plus BaseNemesisCombat modifier EncounterData_Nemesis.lua:57
  ['NemesisCombatF', 55, 15, 'biomeDepthCache', 60, 1, 30],
  // EncounterData_Generated.lua:23-24, hard :110
  ['GeneratedG', 140, 40, 'biomeDepthCache', 0, 1, 30],
  // EncounterData_Devotion.lua:167-168,175
  ['DevotionTestG', 270, 5, 'biomeDepthCache', 0, 1, 30],
  // GeneratedG plus own modifier EncounterData_Artemis.lua:160
  ['ArtemisCombatG', 140, 40, 'biomeDepthCache', 145, 1, 30],
  ['NemesisCombatG', 140, 40, 'biomeDepthCache', 60, 1, 30],
  // EncounterData_Generated.lua:162-163 and :217-218; no UseEncounterDepth
  ['GeneratedH_Passive', 180, 60, 'biomeDepthCache', 0, 1, undefined],
  ['GeneratedH_PassiveSmall', 60, 15, 'biomeDepthCache', 0, 1, undefined],
  // EncounterData_Generated.lua:243-245, hard :309; Treant2/Screamer2 inherit
  ['GeneratedH', 290, 82, 'biomeEncounterDepth', 0, 1, 30],
  ['GeneratedH_Treant2', 290, 82, 'biomeEncounterDepth', 0, 1, 30],
  ['GeneratedH_Screamer2', 290, 82, 'biomeEncounterDepth', 0, 1, 30],
  ['NemesisCombatH', 290, 82, 'biomeEncounterDepth', 60, 1, 30],
  // EncounterData_Generated.lua:440-441, hard :485
  ['GeneratedI', 325, 105, 'biomeDepthCache', 0, 1, 30],
  ['GeneratedI_GoalReward', 250, 105, 'biomeDepthCache', 0, 1, 30],
  // DifficultyMultiplier EncounterData_Generated.lua:585,604
  ['GeneratedI_Small', 325, 105, 'biomeDepthCache', 0, 0.85, 30],
  ['GeneratedI_Small_GoalReward', 325, 105, 'biomeDepthCache', 0, 0.85, 30],
  // EncounterData_Devotion.lua:198-199
  ['DevotionTestI', 400, 110, 'biomeDepthCache', 0, 1, 30],
  ['NemesisCombatI', 325, 105, 'biomeDepthCache', 60, 1, 30],
  // EncounterData_Generated.lua:695-697, 749-750, 756-759
  ['GeneratedN', 110, 25, 'biomeEncounterDepth', 0, 1, undefined],
  ['GeneratedN_Smaller', 85, 25, 'biomeEncounterDepth', 0, 1, undefined],
  ['GeneratedN_Bigger', 135, 25, 'biomeEncounterDepth', 0, 1, undefined],
  // Own base EncounterData_Artemis.lua:191-192; BaseArtemisCombat modifier :55
  ['ArtemisCombatN', 200, 20, 'biomeEncounterDepth', 60, 1, undefined],
  // Own modifier EncounterData_Heracles.lua:64
  ['HeraclesCombatN', 110, 25, 'biomeEncounterDepth', 150, 1, undefined],
  // EncounterData_Generated.lua:940-941; GeneratedO depth :850, hard :895
  ['GeneratedO_Intro01', 50, 45, 'biomeEncounterDepth', 0, 1, 45],
  ['GeneratedO', 115, 55, 'biomeEncounterDepth', 0, 1, 45],
  // EncounterData_Devotion.lua:227-228
  ['DevotionTestO', 425, 15, 'biomeEncounterDepth', 0, 1, 45],
  // Own modifier EncounterData_Heracles.lua:130
  ['HeraclesCombatO', 115, 55, 'biomeEncounterDepth', 155, 1, 45],
  // BaseIcarusCombat EncounterData_Icarus.lua:46
  ['IcarusCombatO', 115, 55, 'biomeEncounterDepth', 0, 3, 45],
  // EncounterData_Generated.lua:1204-1206; GeneratedP hard :1150
  ['GeneratedP_PreCombat', { min: 340, max: 500 }, 0, 'biomeDepthCache', 0, 1, 50],
  // EncounterData_Generated.lua:1023-1024
  ['GeneratedP', 430, 85, 'biomeDepthCache', 0, 1, 50],
  ['GeneratedP_Large', 430, 85, 'biomeDepthCache', 0, 1, 50],
  // EncounterData_Heracles.lua:185-186
  ['HeraclesCombatP', 600, 50, 'biomeDepthCache', 0, 1, 50],
  ['IcarusCombatP', 430, 85, 'biomeDepthCache', 0, 3, 50],
  // BaseAthenaCombat EncounterData_Athena.lua:48-49
  ['AthenaCombatP', 680, 180, 'biomeDepthCache', 0, 1, 50],
  // EncounterData_Generated.lua:1312-1314, 1416-1417
  ['GeneratedQ', 150, 25, 'biomeEncounterDepth', 0, 1, undefined],
  ['GeneratedQ_Large', 525, 25, 'biomeEncounterDepth', 0, 1, undefined],
  ['GeneratedQ_Islands', 150, 25, 'biomeEncounterDepth', 0, 1, undefined],
];

describe('source-declared generated encounter policies', () => {
  it('preserves native unit-group sizes without treating ordinary enemies as groups', () => {
    const enemies = new Map(
      definitions
        .flatMap((definition) => [
          ...selection(definition.key).choices,
          ...selection(definition.key).fixedEnemies,
        ])
        .map((enemy) => [enemy.key, enemy]),
    );
    expect(
      Object.fromEntries(
        [...enemies.values()]
          .filter((enemy) => enemy.unitGroupSize !== undefined)
          .map((enemy) => [enemy.key, enemy.unitGroupSize]),
      ),
    ).toEqual({
      FishSwarmerSquad: 5,
      FishSwarmerSquad_Elite: 2,
      SimpleSquad: 4,
      SimpleSquad_Elite: 2,
    });
    expect(enemies.get('Guard')?.unitGroupSize).toBeUndefined();
  });
  it('partitions all 114 Menace sources and preserves every mapped replacement identity', () => {
    const enemies = new Map(
      definitions
        .flatMap((definition) => [
          ...selection(definition.key).choices,
          ...selection(definition.key).fixedEnemies,
        ])
        .map((enemy) => [enemy.key, enemy]),
    );
    expect(enemies.size).toBe(114);
    const classes = [...enemies.values()].reduce<Record<string, number>>((counts, enemy) => {
      const kind = enemy.menace!.kind;
      counts[kind] = (counts[kind] ?? 0) + 1;
      return counts;
    }, {});
    expect(classes).toEqual({ mapped: 68, random: 9, blocked: 15, none: 22 });
    const mappings = {
      Guard: 'Guard2',
      Brawler: 'FishmanMelee',
      Radiator: 'Radiator2',
      Screamer: 'FishSwarmerSquad',
      Mage: 'FishmanRanged',
      SiegeVine: 'Turtle',
      FishmanMelee: 'Mourner',
      FishmanRanged: 'Lamia',
      FishSwarmerSquad: 'LycanSwarmer',
      Turtle: 'DespairElemental',
      Guard2: 'CorruptedShadeMedium',
      Radiator2: 'CorruptedShadeSmall',
      BrokenHearted: 'SwarmerClockwork',
      Lovesick: 'TimeElemental',
      Mourner: 'ClockworkHeavyMelee',
      Lamia: 'SatyrLancer',
      Carrion: 'Scimiterror',
      Mudman: 'Stickler',
      Zombie: 'WaterElemental',
      ZombieSpawner: 'Swab',
      ZombieHeavyRanged: 'HarpyCutter',
      ZombieAssassin: 'Drunk',
      Stickler: 'AutomatonBeamer',
      Swab: 'Dragon',
      Drunk: 'AutomatonEnforcer',
      Scimiterror: 'SatyrSapper',
      HarpyCutter: 'HarpyDropper',
      WaterElemental: 'SentryBot',
      Mage2: 'SatyrLancer2',
      Dragon: 'Brute',
      HarpyDropper: 'Stalker',
      SatyrLancer2: 'Mati',
      SatyrCrossbow2: 'DragonBurrower',
      ZombieOlympus: 'Simple',
    };
    for (const [source, target] of Object.entries(mappings))
      for (const suffix of ['', '_Elite']) {
        expect(enemies.get(`${source}${suffix}`)?.menace).toMatchObject({
          kind: 'mapped',
          targetNativeId: `${target}${suffix}`,
        });
      }
    const random = [...enemies.values()].filter((enemy) => enemy.menace?.kind === 'random');
    expect(random.map((enemy) => enemy.key).sort()).toEqual(
      [
        'DespairElemental_Elite',
        'CorruptedShadeSmall',
        'CorruptedShadeSmall_Elite',
        'CorruptedShadeMedium',
        'CorruptedShadeMedium_Elite',
        'CorruptedShadeLarge',
        'CorruptedShadeLarge_Elite',
        'Lycanthrope',
        'Treant2',
      ].sort(),
    );
    const pool = [
      'GoldElemental',
      'TimeElemental',
      'SwarmerClockwork',
      'ClockworkHeavyMelee',
      'SatyrLancer',
      'SatyrRatCatcher',
    ].flatMap((key) => [key, `${key}_Elite`]);
    for (const enemy of random)
      expect(enemy.menace).toMatchObject({ kind: 'random', targetNativeIds: pool });
    expect(
      [...enemies.values()]
        .filter((enemy) => enemy.menace?.kind === 'blocked')
        .map((enemy) => enemy.key)
        .sort(),
    ).toEqual(
      [
        'WaterUnit',
        'WaterUnit_Elite',
        'Lycanthrope_Elite',
        'FogEmitter2',
        'Screamer2',
        'ZombieCrewman',
        'ZombieCrewman_Elite',
        'SentryBot',
        'AutomatonBeamer',
        'AutomatonEnforcer',
        'SatyrSapper',
        'SentryBot_Elite',
        'AutomatonBeamer_Elite',
        'AutomatonEnforcer_Elite',
        'SatyrSapper_Elite',
      ].sort(),
    );
    expect(
      definitions
        .filter((definition) => selection(definition.key).blockMenace)
        .map((definition) => definition.key)
        .sort(),
    ).toEqual(['GeneratedH_Passive', 'GeneratedH_PassiveSmall', 'GeneratedP_PreCombat']);
  });
  it('keeps Arachne spacing only where native requirements inherit it', () => {
    const f = catalog.encounterDefinitions.byKey.ArachneCombatF!.requirements!;
    const g = catalog.encounterDefinitions.byKey.ArachneCombatG!.requirements!;
    if (f.kind !== 'all' || g.kind !== 'all') throw new Error('Missing Arachne requirements');
    expect(f.requirements.some((rule) => rule.kind === 'previousRoomEncounterKeyCount')).toBe(
      false,
    );
    expect(f.requirements).toContainEqual({
      kind: 'counterRange',
      axis: 'biomeDepthCache',
      range: { min: 4, max: 8 },
    });
    expect(g.requirements).toContainEqual({
      kind: 'previousRoomEncounterKeyCount',
      encounterKeys: ['ArachneCombatF', 'ArachneCombatG'],
      roomWindow: 5,
      range: { max: 0 },
    });
  });
  it('preserves native armored variants without counting them as elites', () => {
    for (const [encounter, key, axis] of [
      ['GeneratedN', 'ZombieAssassin_Elite', 'biomeEncounterDepth'],
      ['GeneratedO_Intro01', 'ZombieCrewman_Elite', 'biomeDepthCache'],
      ['GeneratedP', 'ZombieOlympus_Elite', 'biomeDepthCache'],
    ] as const) {
      expect(selection(encounter).choices.find((enemy) => enemy.key === key)).toMatchObject({
        nativeId: key,
        elite: false,
        minimumDepth: { axis, value: 3 },
        excludes: [key.replace('_Elite', '')],
      });
    }
    expect(
      selection('GeneratedP').choices.find((enemy) => enemy.key === 'HarpyDropper_Elite')?.elite,
    ).toBe(true);
    expect(selection('GeneratedH_Screamer2').fixedEnemies[0]?.excludes).toEqual([]);
  });

  it('retains Fields special encounter admission independently of composition', () => {
    for (const key of ['GeneratedH_Treant2', 'GeneratedH_Screamer2']) {
      expect(catalog.encounterDefinitions.byKey[key]?.requirements).toEqual({
        kind: 'all',
        requirements: [
          { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
          { kind: 'encounterKeyCount', scope: 'route', encounterKeys: [key], range: { max: 0 } },
        ],
      });
    }
  });

  it('excludes Nemesis random events from Dream without excluding her combat encounters', () => {
    const exclusion = { kind: 'not', requirement: { kind: 'routeKeyEquals', routeKey: 'Dream' } };
    expect(catalog.encounterDefinitions.byKey.NemesisRandomEvent?.requirements).toMatchObject({
      kind: 'all',
      requirements: expect.arrayContaining([exclusion]),
    });
    for (const key of ['NemesisCombatF', 'NemesisCombatG', 'NemesisCombatH', 'NemesisCombatI']) {
      expect(catalog.encounterDefinitions.byKey[key]?.requirements).not.toMatchObject({
        kind: 'all',
        requirements: expect.arrayContaining([exclusion]),
      });
    }
  });

  it('covers the audited 39 concrete identities without boss/prescribed vignettes', () => {
    expect(definitions).toHaveLength(39);
    expect(definitions.every((definition) => definition.kind === 'combat')).toBe(true);
    expect(
      definitions
        .filter((definition) => selection(definition.key).preparation === 'rewardGeneration')
        .map((definition) => definition.key)
        .sort(),
    ).toEqual(['DevotionTestF', 'DevotionTestG', 'DevotionTestI', 'DevotionTestO']);
    for (const definition of definitions) {
      const policy = selection(definition.key);
      expect(Object.isFrozen(policy)).toBe(true);
      expect(
        policy.choices.every((enemy) => Object.isFrozen(enemy) && enemy.label.length > 0),
      ).toBe(true);
      expect(new Set(policy.choices.map((enemy) => enemy.nativeId)).size).toBe(
        policy.choices.length,
      );
    }
  });
  it('retains exact NPC, template, depth and pool differences', () => {
    expect(selection('ArtemisCombatF')).toMatchObject({
      waveCount: { min: 4, max: 4 },
      blockHighlightElites: true,
    });
    expect(selection('HeraclesCombatO').choices.map((enemy) => enemy.key)).toContain('Scimiterror');
    expect(selection('GeneratedO_Intro01').choices.map((enemy) => enemy.key)).toContain(
      'ZombieCrewman',
    );
    expect(selection('HeraclesCombatO').choices.map((enemy) => enemy.key)).not.toContain(
      'ZombieCrewman',
    );
    expect(selection('GeneratedH_Treant2').fixedEnemies).toMatchObject([
      { key: 'Treant2', elite: true },
    ]);
    expect(selection('GeneratedH_Screamer2').fixedEnemies).toMatchObject([
      { key: 'Screamer2', elite: true },
    ]);
    expect(selection('GeneratedN').types).toMatchObject({
      depthAxis: 'biomeEncounterDepth',
      escalate: true,
    });
    expect(selection('GeneratedP').maxTypesPerGroup).toEqual({ Automatons: 1, ChronosForces: 2 });
    expect(selection('GeneratedP_PreCombat').maxTypesPerGroup).toEqual({
      Automatons: 1,
      ChronosForces: 1,
    });
  });
  it('normalizes the audited Fangs pools, blocks, room restrictions, and native presentation', () => {
    const fangs = selection('GeneratedF').fangs!;
    expect(fangs.perks).toMatchObject({
      Massive: { label: 'Bigger' },
      ExtraDamage: { label: 'Bruiser', excludes: ['Molten'] },
      Molten: { label: 'Burner', excludes: ['ExtraDamage'] },
      Blink: { label: 'Shifter', excludes: ['Orbit'] },
      Orbit: { label: 'Spinner', excludes: ['Blink'] },
      Frenzy: { label: 'Swifter', excludes: ['Homing', 'Vacuuming'] },
      Homing: { label: 'Seeker', excludes: ['Frenzy'] },
      Vacuuming: { label: 'Sucker', excludes: ['Frenzy'] },
      Fog: { label: 'Spiller', excludes: ['Metallic'], maxPerRoom: 1 },
      Metallic: { label: 'Clanger', excludes: ['Fog'], maxPerRoom: 1 },
      Hex: { label: 'Morpher', maxPerRoom: 1 },
      Rooting: { label: 'Burrower', roomSets: ['F', 'H'] },
      StasisDeath: { label: 'Stopper', roomSets: ['N', 'N_SubRooms', 'O', 'P'] },
    });
    expect(
      selection('GeneratedF').choices.find((enemy) => enemy.key === 'Mage_Elite')?.fangs,
    ).toMatchObject({ blockedOptions: ['ExtraDamage'] });
    expect(
      selection('GeneratedH_Screamer2').fixedEnemies.find((enemy) => enemy.key === 'Screamer2')
        ?.fangs,
    ).toMatchObject({ blockedOptions: ['Tracking', 'Vacuuming'] });
    expect(selection('GeneratedH_Treant2').fixedEnemies[0]?.fangs).toMatchObject({
      blockedOptions: ['Frenzy'],
    });
    expect(
      selection('GeneratedN').choices.find((enemy) => enemy.key === 'ZombieAssassin_Elite')?.fangs,
    ).toBeUndefined();
  });
  it('declares the complete source-backed budget of every supported profile', () => {
    expect(budgetEvidence.map(([key]) => key).sort()).toEqual(
      definitions.map((definition) => definition.key).sort(),
    );
    for (const [key, base, depthRamp, depthAxis, modifier, multiplier, hard] of budgetEvidence)
      expect(selection(key).budget, key).toEqual({
        base,
        depthRamp,
        depthAxis,
        modifier,
        multiplier,
        minimum: 10,
        ...(hard === undefined ? {} : { hardDepthRamp: hard }),
      });
  });
  it('excludes the Tartarus Chronos introductions from ordinary authored encounters', () => {
    for (const key of ['GeneratedIChronosIntro', 'GeneratedI_SmallChronosIntro']) {
      expect(catalog.encounterDefinitions.byKey[key], key).toBeUndefined();
      expect(
        catalog.encounterSets.values.some((set) => set.encounterDefinitionKeys.includes(key)),
        key,
      ).toBe(false);
    }
  });
  it('rejects budget axes and wave counts the engine cannot price', () => {
    const base = selection('GeneratedF');
    expect(() =>
      normalizeEncounterGeneration(
        {
          ...base,
          budget: {
            ...base.budget,
            depthAxis: 'runDepthCache' as (typeof base.budget)['depthAxis'],
          },
        },
        'test',
      ),
    ).toThrow(/budget\.depthAxis/);
    // Native's fifth wave pattern is outside the supported generation domain.
    expect(() =>
      normalizeEncounterGeneration({ ...base, waveCount: { min: 1, max: 5 } }, 'test'),
    ).toThrow(/waveCount\.max/);
    expect(() =>
      normalizeEncounterGeneration(
        { ...base, budget: { ...base.budget, modifier: Number.NaN } },
        'test',
      ),
    ).toThrow(/budget\.modifier/);
    expect(normalizeEncounterGeneration(base, 'test')).toEqual(base);
  });
  it('rejects malformed declaration boundaries', () => {
    const base = selection('GeneratedF');
    expect(() =>
      normalizeEncounterGeneration({ ...base, waveCount: { min: 3, max: 2 } }, 'test'),
    ).toThrow();
    expect(() =>
      normalizeEncounterGeneration(
        { ...base, choices: [base.choices[0]!, base.choices[0]!] },
        'test',
      ),
    ).toThrow();
    expect(() =>
      normalizeEncounterGeneration(
        { ...base, types: { ...base.types, depthRamp: Number.NaN } },
        'test',
      ),
    ).toThrow();
  });
});
