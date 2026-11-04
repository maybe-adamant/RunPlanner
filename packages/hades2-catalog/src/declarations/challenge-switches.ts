import type { ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';

import type { RawChallengeSwitchInput } from './challenge-switches-types';
import { stackLegal, talentLegal } from './rewards/requirements';
import {
  eliteAttributeFacts,
  fangsPerks,
  generatedEnemyPools,
} from './encounters/generated/enemies';

const enemyChoices = Object.values(generatedEnemyPools).flat();

/** EncounterData_Challenge.lua EliteChallenge<Set>: one elite from `Biome<Set>_EliteChallenge`. */
function eliteEncounter(roomSetKey: string, enemyKeys: readonly string[]) {
  return Object.freeze({
    encounterKey: `EliteChallenge${roomSetKey}`,
    enemies: enemyKeys.map((key) => {
      const choice = enemyChoices.find((candidate) => candidate.key === key);
      if (choice === undefined) throw new Error(`Missing Elite challenge enemy ${key}`);
      return choice;
    }),
    attributeOptionsByEnemy: Object.fromEntries(
      enemyKeys.map((key) => [key, eliteAttributeFacts(key)]),
    ),
    // EncounterData_Challenge.lua:468-481 ManualWaveTemplates: one Generated spawn, TotalCount 1.
    spawnCount: 1,
    // EncounterData_Challenge.lua:411-412.
    attributeCount: 2,
    bannedAttributeKeys: ['Metallic', 'SpreadHitShields', 'StasisDeath', 'HeavyArmor'],
    attributes: Object.fromEntries(
      Object.entries(fangsPerks).map(([key, perk]) => [
        key,
        {
          label: perk.label,
          excludes: perk.excludes,
          ...('roomSets' in perk ? { roomSets: perk.roomSets } : {}),
        },
      ]),
    ),
  });
}

function roomSet(roomSetKey: string, spawnChance: number) {
  return Object.freeze({
    roomSetKey,
    spawnChance,
    encounterKeyBySwitchKind: Object.freeze({
      time: `TimeChallenge${roomSetKey}`,
      perfectClear: `PerfectClearChallenge${roomSetKey}`,
      elite: `EliteChallenge${roomSetKey}`,
    }) satisfies Record<ChallengeSwitchKind, string>,
  });
}

export const challengeSwitches = {
  // RoomData.lua BaseRoom ChallengeSpawnRequirements: BiomeDepthCache >= 5 and
  // RequiredMinRoomsSinceEvent ChallengeSwitch Count 3 (RequirementsLogic.lua).
  minimumBiomeDepth: 5,
  minimumRoomsSinceLast: 3,
  producerLifecycleKey: 'ChallengeSwitchLoot',
  // EncounterData_TimeChallenge.lua StartingValue 100 (ValueDepthRamp 0);
  // EventLogic.lua HandleChallengeLootDecay floors it at MinValue 10.
  gold: { startingValue: 100, minimumValue: 10, defaultValue: 90 },
  // EncounterData_Challenge.lua / _TimeChallenge.lua LootDrops: a hitless
  // claim rolls one GiftDrop at DropChance 0.05 (EventLogic.lua HandleChallengeLoot).
  bonusReward: { rewardType: 'GiftDrop', dropChance: 0.05 },
  kinds: [
    { key: 'time', defaultVariantKey: 'TimeChallengeSwitch_Money', goldReward: true },
    {
      key: 'perfectClear',
      defaultVariantKey: 'PerfectClearChallengeSwitch_Pom',
      // HandleChallengeLoot: a PerfectClear hit claims the consolation prize.
      hitRewardType: 'RoomRewardConsolationPrize',
      goldReward: false,
    },
    {
      key: 'elite',
      defaultVariantKey: 'EliteChallengeSwitch_Talent',
      // ObstacleData.lua EliteChallengeSwitch BiomeDepthCache >= 3;
      // RoomData.lua EliteSwitchRequirements TalentLegal.
      minimumBiomeDepth: 3,
      requirement: talentLegal,
      goldReward: false,
    },
  ],
  // ObstacleData.lua switch obstacles; weights are EncounterSets.lua
  // Time/PerfectClear/EliteChallengeOptions multiplicities.
  variants: [
    {
      key: 'TimeChallengeSwitch_Money',
      switchKind: 'time',
      weight: 4,
      rewardType: 'Money',
    },
    {
      key: 'PerfectClearChallengeSwitch_Pom',
      switchKind: 'perfectClear',
      weight: 3,
      rewardType: 'StackUpgrade',
      requirement: stackLegal,
    },
    {
      key: 'PerfectClearChallengeSwitch_MaxHealth',
      switchKind: 'perfectClear',
      weight: 1,
      rewardType: 'MaxHealthDrop',
    },
    {
      key: 'EliteChallengeSwitch_Talent',
      switchKind: 'elite',
      weight: 5,
      rewardType: 'TalentDrop',
      requirement: talentLegal,
    },
    {
      key: 'EliteChallengeSwitch_MaxMana',
      switchKind: 'elite',
      weight: 2,
      rewardType: 'MaxManaDrop',
    },
  ],
  // RoomData.lua BaseRoom ChallengeSpawnChance 0.15; RoomDataF.lua BaseF 0.25.
  // Each Base<Set> names one encounter per kind.
  roomSets: [
    roomSet('F', 0.25),
    roomSet('G', 0.15),
    roomSet('H', 0.15),
    roomSet('I', 0.15),
    roomSet('N', 0.15),
    roomSet('O', 0.15),
    roomSet('P', 0.15),
    roomSet('Q', 0.15),
  ],
  // EnemySets.lua Biome<Set>_EliteChallenge.
  eliteEncounters: [
    eliteEncounter('F', ['Brawler_Elite']),
    eliteEncounter('G', ['FishmanMelee_Elite']),
    eliteEncounter('H', ['Lycanthrope_Elite', 'Mourner_Elite']),
    eliteEncounter('I', [
      'SatyrLancer_Elite',
      'SatyrRatCatcher_Elite',
      'ClockworkHeavyMelee_Elite',
    ]),
    eliteEncounter('N', ['Mudman_Elite', 'ZombieHeavyRanged_Elite', 'ZombieAssassin_Elite']),
    eliteEncounter('O', ['Swab_Elite']),
    eliteEncounter('P', [
      'SatyrSapper_Elite',
      'Dragon_Elite',
      'AutomatonEnforcer_Elite',
      'AutomatonBeamer_Elite',
    ]),
    eliteEncounter('Q', ['Brute_Elite']),
  ],
  // ChallengeSpawnChance = 0.0 on these anchored rooms or their bases.
  noSpawnRoomGameNames: [
    // RoomDataDream.lua Dream_PostBoss01 (02 and 03 inherit it).
    'Dream_PostBoss01',
    'Dream_PostBoss02',
    'Dream_PostBoss03',
    'F_PostBoss01',
    'G_PostBoss01',
    'H_PostBoss01',
    'N_PostBoss01',
    'O_PostBoss01',
    'O_Reprieve01',
    'P_PostBoss01',
    'P_Reprieve01',
    // RoomDataN.lua BaseN_SubRooms.
    'N_Sub01',
    'N_Sub02',
    'N_Sub03',
    'N_Sub04',
    'N_Sub06',
    'N_Sub07',
    'N_Sub08',
    'N_Sub09',
    'N_Sub10',
    'N_Sub11',
    'N_Sub12',
    'N_Sub13',
    'N_Sub14',
    'N_Sub15',
  ],
} as const satisfies RawChallengeSwitchInput;
