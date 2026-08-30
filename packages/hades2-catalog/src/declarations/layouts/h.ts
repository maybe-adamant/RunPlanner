import type { RawBiomeLayoutDeclaration } from '../types';

export const hBiomeLayout = {
  biomeKey: 'H',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: { kind: 'fixedAuthored', roomGameName: 'H_Intro' },
  progression: {
    kind: 'generated',
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: {
      kind: 'fields',
      minDoorCageRewards: 2,
      maxDoorCageRewards: 3,
      maxDoorCageCeiling: 2,
      maxOutcomeSupport: {
        optionalBiomeDepths: [1, 2, 3],
        requiredBiomeDepths: [4, 5],
      },
      fields: [
        {
          key: 'cageOutcome',
          kind: 'enum',
          values: ['min', 'max'],
          initialization: { kind: 'required' },
        },
      ],
    },
    rewardStorePolicy: { kind: 'none' },
    rewardStoreOverrides: [],
  },
  chaos: {
    roomGameNames: ['Chaos_01', 'Chaos_02', 'Chaos_03', 'Chaos_04', 'Chaos_05', 'Chaos_06'],
    defaultRoomGameName: 'Chaos_01',
    offerSpacingWindow: 10,
  },
  completion: {
    bossRoomGameName: 'H_Boss01',
    rivalsBossRoomGameName: 'H_Boss02',
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
} as const satisfies RawBiomeLayoutDeclaration;
