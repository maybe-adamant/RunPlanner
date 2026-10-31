import type { RawBossRosterDeclaration } from './types';

// Each miniboss and boss encounter's own enemies: its wave template or
// SpawnWaves, its pre-placed units (ActivatePrePlaced) and the encounters its
// AI stages spawn, shrine-only shadows excluded. Weapon spawner adds get
// ClearLootDrops (EnemyAILogic.lua:4847) and are not listed.
// `wipedByEnemyKey` is the encounter's WipeEnemiesOnKill (CombatLogic.lua:3873),
// whose death kills the rest with BlockLoot (RoomLogic.lua:5201-5219).

const one = (enemyKey: string, count = 1) => ({ enemyKey, count });

/** EncounterData.lua:699-756. */
export const treantRoster = {
  waves: [[one('Treant')]],
  wipedByEnemyKey: 'Treant',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData.lua:759-787. */
export const treantShrineRoster = {
  waves: [[one('Treant_Shadow')]],
  wipedByEnemyKey: 'Treant_Shadow',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData.lua:790-860: the elite, then its vines; its wipe is commented out. */
export const fogEmitterRoster = {
  waves: [[one('FogEmitter_Elite')], [one('SiegeVine', 3)]],
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:7-76. */
export const assassinRoster = {
  waves: [[one('ZombieAssassin_Miniboss')]],
  wipedByEnemyKey: 'ZombieAssassin_Miniboss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:79-150. */
export const waterUnitRoster = {
  waves: [[one('WaterUnitMiniboss'), one('Radiator2_Elite', 4)]],
  wipedByEnemyKey: 'WaterUnitMiniboss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:159-222; 24 jellyfish over G_MiniBoss03's 30 spawn points. */
export const jellyfishRoster = {
  waves: [[one('Octofish_Miniboss'), one('Jellyfish', 24)]],
  wipedByEnemyKey: 'Octofish_Miniboss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:232-257. */
export const crawlerRoster = {
  waves: [[one('CrawlerMiniboss')]],
  wipedByEnemyKey: 'CrawlerMiniboss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:260-328. */
export const vampireRoster = {
  waves: [[one('Vampire'), one('CorruptedShadeSmall', 13)]],
  wipedByEnemyKey: 'Vampire',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:331-402. */
export const lamiaRoster = {
  waves: [[one('Lamia_Miniboss'), one('Lamia_Support', 4)]],
  wipedByEnemyKey: 'Lamia_Miniboss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:405-472. */
export const satyrCrossbowRoster = {
  waves: [[one('SatyrCrossbow')], [one('Carrion', 5)]],
  wipedByEnemyKey: 'SatyrCrossbow',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:477-552. */
export const boarRoster = {
  waves: [[one('Boar')], [one('Zombie', 12)]],
  wipedByEnemyKey: 'Boar',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:555-593: the tentacles O_MiniBoss01's map places (5). */
export const charybdisRoster = {
  waves: [[one('Charybdis'), one('CharybdisTentacle', 5)]],
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:596-670: the pre-placed Captain, then its SpawnWaves crew. */
export const captainRoster = {
  waves: [[one('Captain')], [one('ZombieCrewman', 14)]],
  wipedByEnemyKey: 'Captain',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:673-728. */
export const ratCatcherRoster = {
  waves: [[one('SatyrRatCatcher_Miniboss')]],
  wipedByEnemyKey: 'SatyrRatCatcher_Miniboss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:731-783. */
export const goldElementalRoster = {
  waves: [[one('GoldElemental_MiniBoss')]],
  wipedByEnemyKey: 'GoldElemental_MiniBoss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:786-808. */
export const talosRoster = {
  waves: [[one('Talos')]],
  wipedByEnemyKey: 'Talos',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:812-870. */
export const dragonRoster = {
  waves: [[one('Dragon_MiniBoss')]],
  wipedByEnemyKey: 'Dragon_MiniBoss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:879-929. */
export const bruteRoster = {
  waves: [[one('Brute_Miniboss')]],
  wipedByEnemyKey: 'Brute_Miniboss',
} as const satisfies RawBossRosterDeclaration;
/**
 * EncounterData_MiniBoss.lua:933-1005: Q_MiniBoss05's two pre-placed stalkers,
 * then the SpawnWaves elementals; the last stalker's death wipes the rest
 * (WipeEnemiesOnKillAllTypes).
 */
export const stalkerRoster = {
  waves: [[one('Stalker_Miniboss', 2)], [one('EarthElemental', 8)]],
  wipedByEnemyKey: 'Stalker_Miniboss',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:1011-1030. */
export const typhonEyeRoster = {
  waves: [[one('TyphonEye')]],
  wipedByEnemyKey: 'TyphonEye',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_MiniBoss.lua:1036-1086. */
export const typhonTailRoster = {
  waves: [[one('TyphonTail')]],
  wipedByEnemyKey: 'TyphonTail',
} as const satisfies RawBossRosterDeclaration;

const hatched = (enemyKey: string, count: number) => ({ enemyKey, count, hatched: true as const });

/**
 * EncounterData.lua:926-930: the interludes spawn `HecateSpawns01` (4) and
 * `HecateSpawns02` (8) and end only when they die (EnemyData_Hecate.lua:326-378;
 * EncounterData.lua:950-1005).
 */
export const hecateRoster = {
  waves: [[one('Hecate')], [one('LightRanged', 4)], [one('LightRanged', 8)]],
  wipedByEnemyKey: 'Hecate',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData.lua:945-948, 1007-1050: the Rivals interludes' elites (EnemyData_Hecate.lua:315, 370). */
export const hecateRivalsRoster = {
  waves: [[one('Hecate')], [one('LightRanged_Elite', 4)], [one('LightRanged_Elite', 6)]],
  wipedByEnemyKey: 'Hecate',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:772-811: the pre-placed trio; its tentacle spawn encounters are unreferenced. */
export const scyllaRoster = {
  waves: [[one('Scylla'), one('SirenDrummer'), one('SirenKeytarist')]],
  wipedByEnemyKey: 'Scylla',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:814-849, with the Charybdis and six tentacles G_Boss02's map places. */
export const scyllaRivalsRoster = {
  waves: [
    [
      one('Scylla'),
      one('SirenDrummer'),
      one('SirenKeytarist'),
      one('Charybdis_ScyllaFight'),
      one('CharybdisTentacle2', 6),
    ],
  ],
  wipedByEnemyKey: 'Scylla',
} as const satisfies RawBossRosterDeclaration;
/**
 * EncounterData_Boss.lua:7-16: one `CerberusSpawns01-05` at the 50% stage,
 * drawn evenly (EnemyData_InfestedCerberus.lua:380-402; EncounterData_Boss.lua:492-640).
 */
export const cerberusRoster = {
  waves: [[one('InfestedCerberus')]],
  choices: [
    [
      { weight: 1, spawns: [one('Lamia_Elite', 4)] },
      { weight: 1, spawns: [one('Lycanthrope_Elite', 2)] },
      { weight: 1, spawns: [one('Mourner_Elite', 3)] },
      { weight: 1, spawns: [one('Lovesick_Elite', 4)] },
      { weight: 1, spawns: [one('CorruptedShadeSmall_Elite', 9), one('FogEmitter2')] },
    ],
  ],
  wipedByEnemyKey: 'InfestedCerberus',
} as const satisfies RawBossRosterDeclaration;
/**
 * EncounterData_Boss.lua:487: the Rivals spawn list names EM04 twice and never
 * reaches EM05 (EnemyData_InfestedCerberus.lua:386).
 */
export const cerberusRivalsRoster = {
  waves: [[one('InfestedCerberus')]],
  choices: [
    [
      { weight: 1, spawns: [one('BloodlessPitcher_Elite', 5)] },
      { weight: 1, spawns: [one('BloodlessWaveFist_Elite', 6)] },
      { weight: 1, spawns: [one('BloodlessGrenadier_Elite', 5)] },
      { weight: 2, spawns: [one('BloodlessSelfDestruct_Elite', 7)] },
    ],
  ],
  wipedByEnemyKey: 'InfestedCerberus',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:712-733: the six cultists I_Boss01's map places. */
export const chronosRoster = {
  waves: [[one('Chronos')], [one('SatyrCultist', 6)]],
  wipedByEnemyKey: 'Chronos',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:736-742: the map's six elite cultists. */
export const chronosRivalsRoster = {
  waves: [[one('Chronos')], [one('SatyrCultist_Elite', 6)]],
  wipedByEnemyKey: 'Chronos',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:922-971: every add is weapon-spawned. */
export const polyphemusRoster = {
  waves: [[one('Polyphemus')]],
  wipedByEnemyKey: 'Polyphemus',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:754-767: every add is weapon-spawned. */
export const erisRoster = {
  waves: [[one('Eris')]],
  wipedByEnemyKey: 'Eris',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:976-1000: every add is weapon-spawned; the Eagle cannot die. */
export const prometheusRoster = {
  waves: [[one('Prometheus')]],
  wipedByEnemyKey: 'Prometheus',
} as const satisfies RawBossRosterDeclaration;
/**
 * EncounterData_Boss.lua:1014-1023: each summon stage lobs one of two egg casts,
 * evenly, whose eggs hatch their enemy (EnemyData_TyphonHead.lua:332-338,
 * 409-415; Enemy_BiomeQ_Projectiles.sjson:2553-2634; EnemyAILogic.lua:6661-6690).
 */
export const typhonRoster = {
  waves: [[one('TyphonHead')]],
  choices: [
    [
      { weight: 1, spawns: [hatched('Simple2', 5)] },
      { weight: 1, spawns: [hatched('Mudman2', 3)] },
    ],
    [
      { weight: 1, spawns: [hatched('Brute2', 2)] },
      { weight: 1, spawns: [hatched('FishmanMelee2', 4)] },
    ],
  ],
  wipedByEnemyKey: 'TyphonHead',
} as const satisfies RawBossRosterDeclaration;
/** EncounterData_Boss.lua:1557: the Rivals casts (EnemyData_TyphonHead.lua:368-376, 430-436). */
export const typhonRivalsRoster = {
  waves: [[one('TyphonHead')]],
  choices: [
    [{ weight: 1, spawns: [hatched('Captain_SuperElite', 2)] }],
    [
      { weight: 1, spawns: [hatched('Boar_SuperElite', 2)] },
      { weight: 1, spawns: [hatched('Dragon_SuperElite', 2)] },
    ],
  ],
  wipedByEnemyKey: 'TyphonHead',
} as const satisfies RawBossRosterDeclaration;
