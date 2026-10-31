import type { RawEnemyGoldDropDeclaration } from '../types';
import { generatedEnemyDifficultyRating, unitGroupSizes } from './enemies';

// Native MoneyDropOnDeath of every enemy a known roster can field: generated
// pool members, fixed-roster spawns, Menace targets and unit-group members.
// Each row names the InheritFrom table that supplies it; the parcel value
// scales with the enemy's own GeneratorData DifficultyRating
// (RoomLogic.lua:3440-3447).

interface DropTable {
  readonly chance: number;
  readonly valuePerDifficulty: number;
}

/** EnemyData.lua:166-176 BaseVulnerableEnemy: every combat enemy's default. */
const baseVulnerableEnemy: DropTable = { chance: 0.7, valuePerDifficulty: 0.33 };
/** EnemyData.lua:895-905 BaseOEnemy (Thessaly). */
const baseOEnemy: DropTable = { chance: 0.7, valuePerDifficulty: 0.125 };
/** EnemyData.lua:960-970 BasePEnemy (Olympus). */
const basePEnemy: DropTable = { chance: 0.7, valuePerDifficulty: 0.035 };
/** EnemyData.lua:1025-1035 BaseQEnemy (the Summit). */
const baseQEnemy: DropTable = { chance: 0.7, valuePerDifficulty: 0.16 };

function parcel(
  key: string,
  table: DropTable,
  difficultyRating = generatedEnemyDifficultyRating(key),
): RawEnemyGoldDropDeclaration {
  return {
    key,
    kind: 'parcel',
    chance: table.chance,
    minParcels: 1,
    maxParcels: 1,
    value: {
      kind: 'perDifficulty',
      valuePerDifficulty: table.valuePerDifficulty,
      maxValueVariance: 1.3,
      difficultyRating,
    },
  };
}

const pair = (key: string, table: DropTable) => [parcel(key, table), parcel(`${key}_Elite`, table)];

function unitGroup(key: string, unitKey: string): RawEnemyGoldDropDeclaration {
  const size = unitGroupSizes[key];
  if (size === undefined) throw new Error(`Missing unit group size for ${key}`);
  return { key, kind: 'unitGroup', unitKey, size };
}

export const enemyGoldDrops: readonly RawEnemyGoldDropDeclaration[] = [
  // BaseVulnerableEnemy, unchanged by the enemy or its biome base.
  ...[
    'Brawler',
    'Radiator',
    'Screamer',
    'Mage',
    'SiegeVine',
    'FishmanMelee',
    'FishmanRanged',
    'WaterUnit',
    'Radiator2',
    'CorruptedShadeSmall',
    'CorruptedShadeMedium',
    'CorruptedShadeLarge',
    'BrokenHearted',
    'Lovesick',
    'Mourner',
    'Lamia',
    'GoldElemental',
    'TimeElemental',
    'SwarmerClockwork',
    'ClockworkHeavyMelee',
    'SatyrLancer',
    'SatyrRatCatcher',
  ].flatMap((key) => pair(key, baseVulnerableEnemy)),
  parcel('Lycanthrope', baseVulnerableEnemy),
  parcel('Screamer2', baseVulnerableEnemy),
  parcel('DespairElemental_Elite', baseVulnerableEnemy),
  // Menace targets outside every generated pool: EnemyData_DespairElemental.lua:70,
  // EnemyData_LycanSwarmer.lua:61, 87.
  parcel('DespairElemental', baseVulnerableEnemy, 50),
  parcel('LycanSwarmer', baseVulnerableEnemy, 40),
  parcel('LycanSwarmer_Elite', baseVulnerableEnemy, 80),
  // EnemyData_Lycanthrope.lua:126: the elite's own value per difficulty.
  parcel('Lycanthrope_Elite', { chance: 0.7, valuePerDifficulty: 0.225 }),
  // EnemyData_Guard.lua:47, which Guard2 inherits.
  ...pair('Guard', { chance: 0.25, valuePerDifficulty: 0.33 }),
  ...pair('Guard2', { chance: 0.25, valuePerDifficulty: 0.33 }),
  // EnemyData_Turtle.lua:55.
  ...pair('Turtle', { chance: 0.7, valuePerDifficulty: 0.2 }),
  // EnemyData_FogEmitter.lua:180.
  parcel('FogEmitter2', { chance: 0.7, valuePerDifficulty: 0.15 }),
  // EnemyData_Treant.lua:50: Treant drops nothing, and Treant2 inherits it.
  { key: 'Treant2', kind: 'none' },
  // EnemyData_FishSwarmer.lua:59, 77, 150: the Pinhead squads' units.
  parcel('FishSwarmer', { chance: 0.25, valuePerDifficulty: 0.33 }, 5),
  parcel('FishSwarmer_Elite', { chance: 0.25, valuePerDifficulty: 0.33 }, 10),
  // EnemyData_FishSwarmer.lua:155-199: a squad drops through its units.
  unitGroup('FishSwarmerSquad', 'FishSwarmer'),
  unitGroup('FishSwarmerSquad_Elite', 'FishSwarmer_Elite'),
  // Ephyra's own tables: EnemyData_Carrion.lua:68, EnemyData_Mudman.lua:67,
  // EnemyData_Zombie.lua:60, EnemyData_ZombieSpawner.lua:56,
  // EnemyData_ZombieHeavyRanged.lua:66, EnemyData_ZombieAssassin.lua:54.
  ...pair('Carrion', { chance: 0.25, valuePerDifficulty: 0.2 }),
  ...pair('Mudman', { chance: 0.7, valuePerDifficulty: 0.125 }),
  ...pair('Zombie', { chance: 0.25, valuePerDifficulty: 0.17 }),
  ...pair('ZombieSpawner', { chance: 0.7, valuePerDifficulty: 0.1 }),
  ...pair('ZombieHeavyRanged', { chance: 0.7, valuePerDifficulty: 0.125 }),
  ...pair('ZombieAssassin', { chance: 0.7, valuePerDifficulty: 0.1 }),
  // BaseOEnemy, with EnemyData_Scimiterror.lua:60 and EnemyData_WaterElemental.lua:61.
  ...['Stickler', 'Swab', 'Drunk', 'HarpyCutter', 'Mage2', 'ZombieCrewman'].flatMap((key) =>
    pair(key, baseOEnemy),
  ),
  ...pair('Scimiterror', { chance: 0.4, valuePerDifficulty: 0.05 }),
  ...pair('WaterElemental', { chance: 0.2, valuePerDifficulty: 0.075 }),
  // BasePEnemy.
  ...[
    'SentryBot',
    'AutomatonBeamer',
    'AutomatonEnforcer',
    'Dragon',
    'HarpyDropper',
    'SatyrSapper',
    'SatyrLancer2',
    'SatyrCrossbow2',
    'ZombieOlympus',
  ].flatMap((key) => pair(key, basePEnemy)),
  // BaseQEnemy, with the Polyp squads' units (EnemyData_Simple.lua:74, 117, 122-160).
  ...['Stalker', 'Brute', 'Mati', 'DragonBurrower'].flatMap((key) => pair(key, baseQEnemy)),
  parcel('Simple', baseQEnemy, 20),
  parcel('Simple_Elite', baseQEnemy, 50),
  unitGroup('SimpleSquad', 'Simple'),
  unitGroup('SimpleSquad_Elite', 'Simple_Elite'),
  // Miniboss rosters: each unit's own GeneratorData DifficultyRating and inherited table.
  parcel('ZombieAssassin_Miniboss', { chance: 0.7, valuePerDifficulty: 0.1 }, 60), // EnemyData_ZombieAssassin.lua:162
  parcel('WaterUnitMiniboss', baseVulnerableEnemy, 60), // EnemyData_WaterUnit.lua:149
  parcel('Octofish_Miniboss', baseVulnerableEnemy, 300), // EnemyData_Octofish.lua:89
  parcel('Jellyfish', baseVulnerableEnemy, 30), // EnemyData_Jellyfish.lua:4
  parcel('CrawlerMiniboss', baseVulnerableEnemy, 100), // EnemyData_Crawler.lua:90
  parcel('Vampire', baseVulnerableEnemy, 80), // EnemyData_Vampire.lua:4
  parcel('Lamia_Miniboss', baseVulnerableEnemy, 200), // EnemyData_Lamia.lua:144
  parcel('Lamia_Support', baseVulnerableEnemy, 110), // EnemyData_Lamia.lua:116
  parcel('SatyrCrossbow', baseVulnerableEnemy, 100), // EnemyData_SatyrCrossbow.lua:3
  parcel('Boar', baseVulnerableEnemy, 100), // EnemyData_Boar.lua:3
  parcel('Captain', { chance: 0.25, valuePerDifficulty: 0.2 }, 200), // EnemyData_Captain.lua:4
  parcel('SatyrRatCatcher_Miniboss', baseVulnerableEnemy, 400), // EnemyData_SatyrRatCatcher.lua:134
  parcel('GoldElemental_MiniBoss', baseVulnerableEnemy, 200), // EnemyData_GoldElemental.lua:115
  parcel('Talos', basePEnemy, 500), // EnemyData_Talos.lua:3
  parcel('Dragon_MiniBoss', basePEnemy, 1000), // EnemyData_Dragon.lua:146
  parcel('EarthElemental', baseQEnemy, 30), // EnemyData_EarthElemental.lua:4
  // EnemyData_FogEmitter.lua:61-81: a certain 50-70 parcel, set without a value per difficulty.
  {
    key: 'FogEmitter_Elite',
    kind: 'parcel',
    chance: 1,
    minParcels: 1,
    maxParcels: 1,
    value: { kind: 'fixed', min: 50, max: 70 },
  },
  // Boss rosters' adds.
  parcel('LightRanged', baseVulnerableEnemy, 10), // EnemyData_LightRanged.lua:4
  parcel('LightRanged_Elite', baseVulnerableEnemy, 10), // EnemyData_LightRanged.lua:100
  parcel('BloodlessPitcher_Elite', baseVulnerableEnemy, 95), // EnemyData_BloodlessGrenadier.lua:180
  parcel('BloodlessWaveFist_Elite', baseVulnerableEnemy, 75), // EnemyData_BloodlessNaked.lua:170
  parcel('BloodlessGrenadier_Elite', baseVulnerableEnemy, 80), // EnemyData_BloodlessGrenadier.lua:70
  parcel('BloodlessSelfDestruct_Elite', baseVulnerableEnemy, 55), // EnemyData_BloodlessGrenadier.lua:124
  parcel('SatyrCultist', baseVulnerableEnemy, 75), // EnemyData_SatyrCultist.lua:3
  parcel('SatyrCultist_Elite', baseVulnerableEnemy, 75), // EnemyData_SatyrCultist.lua:61
  parcel('Simple2', baseQEnemy, 50), // EnemyData_Simple.lua:164
  parcel('Brute2', baseQEnemy, 400), // EnemyData_Brute.lua:310
  parcel('Boar_SuperElite', baseQEnemy, 100), // EnemyData_Boar.lua:151
  // Bosses keep BaseVulnerableEnemy's rating of 1 (EnemyData.lua:197-200): their
  // parcel range truncates to 0, which drops nothing (RoomLogic.lua:2391).
  ...[
    'Hecate',
    'Scylla',
    'SirenDrummer',
    'SirenKeytarist',
    'InfestedCerberus',
    'Chronos',
    'Polyphemus',
  ].map((key) => parcel(key, baseVulnerableEnemy, 1)),
  parcel('TyphonHead', baseQEnemy, 1),
  // Chance 0: EnemyData_Eris.lua:52; EnemyData_Prometheus.lua:35; EnemyData_Charybdis.lua:122, 369;
  // EnemyData_Mudman.lua:207; EnemyData_FishmanMelee.lua:136; EnemyData_Captain.lua:118;
  // EnemyData_Dragon.lua:244.
  ...[
    'Eris',
    'Prometheus',
    'Charybdis_ScyllaFight',
    'CharybdisTentacle2',
    'Mudman2',
    'FishmanMelee2',
    'Captain_SuperElite',
    'Dragon_SuperElite',
  ].map((key): RawEnemyGoldDropDeclaration => ({ key, kind: 'none' })),
  // Chance 0: EnemyData_Treant.lua:4, 68; EnemyData_Brute.lua:128; EnemyData_Stalker.lua:109;
  // EnemyData_TyphonTail.lua:3; EnemyData_TyphonEye.lua:3; EnemyData_Charybdis.lua:3, 229.
  ...[
    'Treant',
    'Treant_Shadow',
    'Brute_Miniboss',
    'Stalker_Miniboss',
    'TyphonTail',
    'TyphonEye',
    'Charybdis',
    'CharybdisTentacle',
  ].map((key): RawEnemyGoldDropDeclaration => ({ key, kind: 'none' })),
];
