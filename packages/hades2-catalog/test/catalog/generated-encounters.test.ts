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
