import type { EncounterEnemyChoice } from '@run-planner/engine/catalog-schema';

type EnemyFacts = Partial<
  Omit<EncounterEnemyChoice, 'key' | 'label' | 'nativeId' | 'difficultyRating'>
>;

const budgetFacts: Readonly<Record<string, readonly [number, number?]>> = {
  Guard: [5],
  Guard_Elite: [12],
  Brawler: [18],
  Brawler_Elite: [39],
  Radiator: [7],
  Radiator_Elite: [17],
  Screamer: [13],
  Screamer_Elite: [34],
  Mage: [12],
  Mage_Elite: [24],
  SiegeVine: [22],
  SiegeVine_Elite: [48],
  FishmanMelee: [45],
  FishmanMelee_Elite: [105],
  FishmanRanged: [39],
  FishmanRanged_Elite: [79],
  FishSwarmerSquad: [16],
  FishSwarmerSquad_Elite: [33],
  Turtle: [55],
  Turtle_Elite: [89],
  WaterUnit: [30],
  WaterUnit_Elite: [62],
  Guard2: [12],
  Guard2_Elite: [29],
  Radiator2: [14],
  Radiator2_Elite: [27],
  DespairElemental_Elite: [80],
  CorruptedShadeSmall: [10],
  CorruptedShadeSmall_Elite: [25],
  CorruptedShadeMedium: [15],
  CorruptedShadeMedium_Elite: [30],
  CorruptedShadeLarge: [70],
  CorruptedShadeLarge_Elite: [130],
  BrokenHearted: [38],
  BrokenHearted_Elite: [65],
  Lovesick: [55],
  Lovesick_Elite: [120],
  Lycanthrope: [115],
  Lycanthrope_Elite: [310, 1],
  Mourner: [85],
  Mourner_Elite: [160],
  Lamia: [70],
  Lamia_Elite: [165],
  FogEmitter2: [80, 1],
  GoldElemental: [44],
  GoldElemental_Elite: [88],
  TimeElemental: [55],
  TimeElemental_Elite: [105],
  SwarmerClockwork: [35],
  SwarmerClockwork_Elite: [65],
  ClockworkHeavyMelee: [125],
  ClockworkHeavyMelee_Elite: [305],
  SatyrLancer: [120],
  SatyrLancer_Elite: [220],
  SatyrRatCatcher: [110],
  SatyrRatCatcher_Elite: [280],
  Carrion: [11],
  Carrion_Elite: [22],
  Mudman: [41],
  Mudman_Elite: [94],
  Zombie: [6],
  Zombie_Elite: [16],
  ZombieSpawner: [40, 4],
  ZombieSpawner_Elite: [90],
  ZombieHeavyRanged: [40],
  ZombieHeavyRanged_Elite: [85],
  ZombieAssassin: [30],
  ZombieAssassin_Elite: [60],
  ZombieCrewman: [15],
  ZombieCrewman_Elite: [35],
  Stickler: [50],
  Stickler_Elite: [135],
  Scimiterror: [30],
  Scimiterror_Elite: [65],
  Swab: [65],
  Swab_Elite: [155],
  Drunk: [50],
  Drunk_Elite: [105],
  HarpyCutter: [75],
  HarpyCutter_Elite: [165],
  WaterElemental: [13],
  WaterElemental_Elite: [24],
  Mage2: [40],
  Mage2_Elite: [90],
  SentryBot: [55],
  SentryBot_Elite: [95],
  AutomatonBeamer: [130],
  AutomatonBeamer_Elite: [255],
  AutomatonEnforcer: [150],
  AutomatonEnforcer_Elite: [280],
  Dragon: [250],
  Dragon_Elite: [480],
  HarpyDropper: [90],
  HarpyDropper_Elite: [190],
  SatyrSapper: [115],
  SatyrSapper_Elite: [285],
  SatyrLancer2: [220],
  SatyrLancer2_Elite: [260],
  SatyrCrossbow2: [240],
  SatyrCrossbow2_Elite: [390],
  ZombieOlympus: [35],
  ZombieOlympus_Elite: [60],
  SimpleSquad: [120],
  SimpleSquad_Elite: [160],
  Stalker: [145],
  Stalker_Elite: [245],
  Brute: [200],
  Brute_Elite: [400],
  Mati: [95],
  Mati_Elite: [190],
  DragonBurrower: [50],
  DragonBurrower_Elite: [90],
  Treant2: [480],
  Screamer2: [405],
};

function enemy(key: string, label: string, facts: EnemyFacts = {}): EncounterEnemyChoice {
  const budget = budgetFacts[key];
  if (budget === undefined) throw new Error(`Missing generated enemy budget fact for ${key}`);
  return {
    key,
    label,
    nativeId: key,
    elite: false,
    blockSolo: false,
    excludes: [],
    blacklistAfterAppearance: false,
    difficultyRating: budget[0],
    ...(budget[1] === undefined ? {} : { maxCount: budget[1] }),
    ...facts,
  };
}

// Every listed pair has these explicit native counterpart exclusions. Elite
// requirements replace normal requirements; only supplied facts are inherited.
function pair(
  key: string,
  label: string,
  normal: EnemyFacts = {},
  elite: EnemyFacts = {},
): readonly EncounterEnemyChoice[] {
  return [
    enemy(key, label, { excludes: [`${key}_Elite`], ...normal }),
    enemy(`${key}_Elite`, `${label} (Elite)`, {
      elite: true,
      excludes: [key],
      minimumDepth: { axis: 'biomeDepthCache', value: 3 },
      ...elite,
    }),
  ];
}

const encounterDepth = (value: number): EnemyFacts => ({
  minimumDepth: { axis: 'biomeEncounterDepth', value },
});
const soloBlocked = { blockSolo: true } as const;
const automatons = { group: 'Automatons' } as const;
const chronosForces = { group: 'ChronosForces' } as const;

// Labels: native English HelpText, Enemies section. Multiplicity weights native
// draws, not possibility; these domains contain each supported identity once.
const f = [
  ...pair('Guard', 'Whisper'),
  ...pair('Brawler', 'Wastrel'),
  ...pair('Radiator', 'Spindle'),
  ...pair('Screamer', 'Wailer'),
  ...pair('Mage', 'Casket'),
  ...pair('SiegeVine', 'Thorn-Weeper', soloBlocked, soloBlocked),
];
const g = [
  ...pair('FishmanMelee', 'Lurker'),
  ...pair('FishmanRanged', 'Hippo'),
  ...pair('FishSwarmerSquad', 'Pinhead'),
  ...pair('Turtle', 'Shellback'),
  ...pair('WaterUnit', 'Sea-Serpent'),
  ...pair('Guard2', 'Wet-Whisper'),
  ...pair('Radiator2', 'Sop-Spindle', soloBlocked, soloBlocked),
];
const hPassive = [
  enemy('DespairElemental_Elite', 'Bawlder (Elite)', {
    elite: true,
    excludes: ['DespairElemental'],
    minimumDepth: { axis: 'biomeDepthCache', value: 2 },
  }),
  ...pair('CorruptedShadeSmall', 'Blight-Shade'),
  ...pair('CorruptedShadeMedium', 'Blood-Shade'),
  ...pair('CorruptedShadeLarge', 'Bloat-Shade'),
];
const h = [
  ...pair('BrokenHearted', 'Smacker', {}, encounterDepth(2)),
  ...pair('Lovesick', 'Holeheart', {}, encounterDepth(2)),
  ...pair('Lycanthrope', 'Lycaon'),
  ...pair('Mourner', 'Mourner', {}, encounterDepth(2)),
  ...pair(
    'Lamia',
    'Lamia',
    { excludes: ['Lamia_Elite', 'Lamia_Miniboss'] },
    {
      ...encounterDepth(2),
      excludes: ['Lamia', 'Lamia_Miniboss'],
    },
  ),
  enemy('FogEmitter2', 'Sorrow-Spiller', {
    blockSolo: true,
    blacklistAfterAppearance: true,
    excludes: ['FogEmitter'],
  }),
];
const i = [
  ...pair('GoldElemental', 'Goldwraith'),
  ...pair('TimeElemental', 'Tempus', soloBlocked),
  ...pair('SwarmerClockwork', 'Sandskull'),
  ...pair('ClockworkHeavyMelee', 'Wretched Thug'),
  ...pair('SatyrLancer', 'Satyr Hoplite'),
  ...pair('SatyrRatCatcher', 'Satyr Vierophant'),
];
const n = [
  ...pair('Carrion', 'Bronzebeak', {}, encounterDepth(3)),
  ...pair('Mudman', 'Eidolon', {}, encounterDepth(3)),
  ...pair('Zombie', 'Shambler', {}, encounterDepth(3)),
  ...pair('ZombieSpawner', 'Tombstone', soloBlocked, encounterDepth(3)),
  ...pair('ZombieHeavyRanged', 'Lubber', {}, encounterDepth(3)),
  // Armored variants retain their native names but do not inherit IsElite.
  ...pair('ZombieAssassin', 'Cutthroat', {}, { ...encounterDepth(3), elite: false }),
];
const o = [
  ...pair('Stickler', 'Stickler'),
  ...pair('Scimiterror', 'Seesword'),
  ...pair('Swab', 'Anchor'),
  ...pair('Drunk', 'Boozer'),
  ...pair('HarpyCutter', 'Harpy Talon'),
  ...pair('WaterElemental', 'Droplet'),
  ...pair('Mage2', 'Blasket'),
];
const oIntro = [
  ...pair('Stickler', 'Stickler'),
  ...pair('Swab', 'Anchor'),
  ...pair('Drunk', 'Boozer'),
  ...pair('ZombieCrewman', 'Sea-Shambler', {}, { elite: false }),
];
const p = [
  ...pair('SentryBot', 'Auto-Seeker', automatons, automatons),
  ...pair('AutomatonBeamer', 'Auto-Watcher', automatons, automatons),
  ...pair('AutomatonEnforcer', 'Auto-Forcer', automatons, automatons),
  ...pair('Dragon', 'Sky-Dracon', chronosForces, chronosForces),
  ...pair('HarpyDropper', 'Harpy Raptor', chronosForces, chronosForces),
  ...pair('SatyrSapper', 'Satyr Sapper', chronosForces, chronosForces),
  ...pair('SatyrLancer2', 'Satyr Goldpike', chronosForces, chronosForces),
  ...pair('SatyrCrossbow2', 'Satyr Raider', chronosForces, chronosForces),
  ...pair('ZombieOlympus', 'Snow-Shambler', chronosForces, { ...chronosForces, elite: false }),
];
const q = [
  ...pair('SimpleSquad', 'Polyp'),
  ...pair('Stalker', 'Stalker', {}, encounterDepth(3)),
  ...pair('Brute', 'Horror', encounterDepth(1), encounterDepth(3)),
  ...pair('Mati', 'Eyesore'),
  ...pair('DragonBurrower', 'Land-Dracon'),
];

export const generatedEnemyPools = {
  f,
  g,
  hPassive,
  h,
  i,
  n,
  o,
  oIntro,
  p,
  q,
  iOptional: i.filter(
    (entry) => !['SwarmerClockwork', 'SwarmerClockwork_Elite'].includes(entry.key),
  ),
  pIntro: p.filter((entry) => !['ZombieOlympus', 'ZombieOlympus_Elite'].includes(entry.key)),
  qIslands: q.filter((entry) =>
    [
      'SimpleSquad',
      'SimpleSquad_Elite',
      'Mati',
      'Mati_Elite',
      'DragonBurrower',
      'DragonBurrower_Elite',
    ].includes(entry.key),
  ),
} as const;

export const fixedFieldsEnemies = {
  treant: enemy('Treant2', 'Brush-Stalker', { elite: true, fixedCount: 1 }),
  screamer: enemy('Screamer2', 'Dread-Wailer', { elite: true, fixedCount: 1 }),
} as const;
