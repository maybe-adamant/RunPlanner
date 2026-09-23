import type { EncounterEnemyChoice } from '@run-planner/engine/catalog-schema';

type EnemyFacts = Partial<Omit<EncounterEnemyChoice, 'key' | 'label' | 'nativeId'>>;

function enemy(key: string, label: string, facts: EnemyFacts = {}): EncounterEnemyChoice {
  return {
    key,
    label,
    nativeId: key,
    elite: false,
    blockSolo: false,
    excludes: [],
    blacklistAfterAppearance: false,
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
  treant: enemy('Treant2', 'Brush-Stalker', { elite: true }),
  screamer: enemy('Screamer2', 'Dread-Wailer', { elite: true }),
} as const;
