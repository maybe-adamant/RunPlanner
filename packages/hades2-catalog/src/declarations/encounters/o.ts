import type { RawEncounterProfileDeclaration } from '../types';

export const oEncounterProfiles = [
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
] as const satisfies readonly RawEncounterProfileDeclaration[];
