import type { RawBiomeLayoutDeclaration } from '../types';

export const pBiomeLayout = {
  biomeKey: 'P',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: { kind: 'fixedAuthored', roomGameName: 'P_Intro' },
  progression: {
    kind: 'generated',
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      targetMetaRewardsRatio: 0.2,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [],
    bounds: { maxBatches: 8, maxTargets: 16 },
  },
  chaos: {
    roomGameNames: ['Chaos_01', 'Chaos_02', 'Chaos_03', 'Chaos_04', 'Chaos_05', 'Chaos_06'],
    defaultRoomGameName: 'Chaos_01',
    offerSpacingWindow: 10,
  },
  completion: {
    bossRoomGameName: 'P_Boss01',
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
} as const satisfies RawBiomeLayoutDeclaration;
