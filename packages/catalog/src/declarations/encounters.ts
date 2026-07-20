import type { RawEncounterProfileDeclaration } from './types';

export const encounterProfiles = [
  {
    key: 'F_Opening',
    phases: [
      {
        key: 'OpeningGeneratedF',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'OpeningGeneratedF',
      },
    ],
  },
  {
    key: 'StandardCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'FixedIntro',
    phases: [],
  },
  {
    key: 'Story',
    phases: [{ key: 'Story', kind: 'story', countsEncounterDepth: false }],
  },
  {
    key: 'HealthRestore',
    phases: [{ key: 'HealthRestore', kind: 'nonCombat', countsEncounterDepth: false }],
  },
  {
    key: 'Shop',
    phases: [{ key: 'Shop', kind: 'nonCombat', countsEncounterDepth: false }],
  },
  {
    key: 'Preboss',
    phases: [{ key: 'Preboss', kind: 'nonCombat', countsEncounterDepth: false }],
  },
  {
    key: 'F_MiniBoss01',
    phases: [
      {
        key: 'F_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossTreant',
      },
    ],
  },
  {
    key: 'F_MiniBoss02',
    phases: [
      {
        key: 'F_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossFogEmitter',
      },
    ],
  },
  {
    key: 'F_MiniBoss03',
    phases: [
      {
        key: 'F_MiniBoss03',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossAssassin',
      },
    ],
  },
  {
    key: 'G_MiniBoss01',
    phases: [
      {
        key: 'G_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossWaterUnit',
      },
    ],
  },
  {
    key: 'G_MiniBoss02',
    phases: [
      {
        key: 'G_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'MiniBossCrawler',
      },
    ],
  },
  {
    key: 'G_MiniBoss03',
    phases: [
      {
        key: 'G_MiniBoss03',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossJellyfish',
      },
    ],
  },
  {
    key: 'F_Boss01',
    phases: [
      {
        key: 'F_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossHecate01',
      },
    ],
  },
  {
    key: 'F_PostBoss01',
    phases: [
      {
        key: 'F_PostBoss01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Chronos_01',
      },
    ],
  },
  {
    key: 'G_Boss01',
    phases: [
      {
        key: 'G_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossScylla01',
      },
    ],
  },
  {
    key: 'G_PostBoss01',
    phases: [
      {
        key: 'G_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
  {
    key: 'OlympusCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'P_MiniBoss01',
    phases: [
      {
        key: 'P_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'MiniBossTalos',
      },
    ],
  },
  {
    key: 'P_MiniBoss02',
    phases: [
      {
        key: 'P_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossDragon',
      },
    ],
  },
  {
    key: 'P_Boss01',
    phases: [
      {
        key: 'P_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossPrometheus01',
      },
    ],
  },
  {
    key: 'P_PostBoss01',
    phases: [
      {
        key: 'P_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
  {
    key: 'SummitCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'Q_MiniBoss02',
    phases: [
      {
        key: 'Q_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossBrute',
      },
    ],
  },
  {
    key: 'Q_MiniBoss05',
    phases: [
      {
        key: 'Q_MiniBoss05',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossStalker',
      },
    ],
  },
  {
    key: 'Q_MiniBoss03',
    phases: [
      {
        key: 'Q_MiniBoss03',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'BossTyphonTail01',
      },
    ],
  },
  {
    key: 'Q_MiniBoss04',
    phases: [
      {
        key: 'Q_MiniBoss04',
        kind: 'miniboss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossTyphonEye01',
      },
    ],
  },
  {
    key: 'Q_Boss01',
    phases: [
      {
        key: 'Q_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossTyphonHead01',
      },
    ],
  },
  {
    key: 'H_FieldsCombatCage2',
    phases: [
      { key: 'Passive', kind: 'combat', countsEncounterDepth: false },
      {
        key: 'Cage01',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
      {
        key: 'Cage02',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
    ],
  },
  {
    key: 'H_FieldsCombatCage3',
    phases: [
      { key: 'Passive', kind: 'combat', countsEncounterDepth: false },
      {
        key: 'Cage01',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
      {
        key: 'Cage02',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
      {
        key: 'Cage03',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
    ],
  },
  {
    key: 'H_MiniBoss01',
    phases: [
      {
        key: 'H_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossVampire',
      },
    ],
  },
  {
    key: 'H_MiniBoss02',
    phases: [
      {
        key: 'H_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossLamia',
      },
    ],
  },
  {
    key: 'H_Bridge01',
    phases: [
      {
        key: 'H_Bridge01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Echo_01',
      },
    ],
  },
  {
    key: 'H_Boss01',
    phases: [
      {
        key: 'H_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossInfestedCerberus01',
      },
    ],
  },
  {
    key: 'H_PostBoss01',
    phases: [
      {
        key: 'H_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
  {
    key: 'ShipCombat',
    phases: [
      {
        key: 'Intro',
        kind: 'combat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'GeneratedO_Intro01',
      },
      {
        key: 'Combat1',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedO',
        offerPoint: {
          kind: 'rewardWheel',
          key: 'wheel1',
          reward: {
            kind: 'countedChoice',
            storeKeys: ['RunProgress', 'MetaProgress'],
            eligibleRewardTypes: [],
            ineligibleRewardTypes: [],
            producerLifecycleKey: 'RoomReward',
          },
          defaultStoreKey: 'RunProgress',
          offerKeys: ['offer1', 'offer2'],
          offerCount: { min: 1, max: 2, defaultValue: 1 },
          picked: 'exactlyOne',
          offerTiming: 'encounterStart',
          acquisitionTiming: 'postCombat',
        },
      },
      {
        key: 'Combat2',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedO',
        presence: {
          kind: 'authoredOptional',
          decisionPoint: 'prepareRoom',
          requirement: {
            kind: 'counterRange',
            axis: 'biomeEncounterDepth',
            range: { min: 2, max: 5 },
          },
          defaultActive: false,
        },
        offerPoint: {
          kind: 'rewardWheel',
          key: 'wheel2',
          reward: {
            kind: 'countedChoice',
            storeKeys: ['RunProgress', 'MetaProgress'],
            eligibleRewardTypes: [],
            ineligibleRewardTypes: [],
            producerLifecycleKey: 'RoomReward',
          },
          defaultStoreKey: 'RunProgress',
          offerKeys: ['offer1', 'offer2'],
          offerCount: { min: 1, max: 2, defaultValue: 1 },
          picked: 'exactlyOne',
          offerTiming: 'encounterStart',
          acquisitionTiming: 'postCombat',
        },
      },
    ],
  },
  {
    key: 'O_MiniBoss01',
    phases: [
      {
        key: 'O_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'MiniBossCharybdis',
      },
    ],
  },
  {
    key: 'O_MiniBoss02',
    phases: [
      {
        key: 'O_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossCaptain',
      },
    ],
  },
  {
    key: 'O_Story01',
    phases: [
      {
        key: 'O_Story01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Circe_01',
      },
    ],
  },
  {
    key: 'O_Devotion01',
    phases: [
      {
        key: 'O_Devotion01',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'DevotionTestO',
      },
    ],
  },
  {
    key: 'O_Boss01',
    phases: [
      {
        key: 'O_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossEris01',
      },
    ],
  },
  {
    key: 'O_PostBoss01',
    phases: [
      {
        key: 'O_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
  {
    key: 'ClockworkCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'I_Story01',
    phases: [
      {
        key: 'I_Story01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Hades_01',
      },
    ],
  },
  {
    key: 'I_MiniBoss01',
    phases: [
      {
        key: 'I_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossRatCatcher',
      },
    ],
  },
  {
    key: 'I_MiniBoss02',
    phases: [
      {
        key: 'I_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossGoldElemental',
      },
    ],
  },
  {
    key: 'I_Boss01',
    phases: [
      {
        key: 'I_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossChronos01',
      },
    ],
  },
  {
    key: 'I_PostBoss01',
    phases: [
      {
        key: 'I_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
  {
    key: 'N_Opening',
    phases: [
      {
        key: 'OpeningGeneratedN',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'OpeningGeneratedN',
      },
    ],
  },
  {
    key: 'N_PreHub',
    phases: [
      {
        key: 'PreHubGeneratedN',
        kind: 'combat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'PreHubGeneratedN',
      },
    ],
  },
  {
    key: 'EphyraCombat',
    phases: [
      {
        key: 'Combat',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedN',
      },
    ],
  },
  {
    key: 'EphyraSideRoom',
    phases: [
      {
        key: 'Combat',
        kind: 'combat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'GeneratedNSubRoom',
      },
    ],
  },
  {
    key: 'EphyraSideRoomHard',
    phases: [
      {
        key: 'Combat',
        kind: 'combat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'GeneratedNSubRoomBigger',
      },
    ],
  },
  {
    key: 'N_MiniBoss01',
    phases: [
      {
        key: 'N_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossSatyrCrossbow',
      },
    ],
  },
  {
    key: 'N_MiniBoss02',
    phases: [
      {
        key: 'N_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossBoar',
      },
    ],
  },
  {
    key: 'N_Boss01',
    phases: [
      {
        key: 'N_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossPolyphemus01',
      },
    ],
  },
  {
    key: 'N_PostBoss01',
    phases: [
      {
        key: 'N_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
