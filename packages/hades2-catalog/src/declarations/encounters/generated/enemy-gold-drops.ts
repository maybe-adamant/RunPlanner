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
];
