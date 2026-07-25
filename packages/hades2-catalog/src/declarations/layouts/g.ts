import type { RawBiomeLayoutDeclaration } from '../types';

export const gBiomeLayout = {
  biomeKey: 'G',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: { kind: 'fixedAuthored', roomGameName: 'G_Intro' },
  progression: {
    kind: 'generated',
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      targetMetaRewardsRatio: 0.35,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [],
    bounds: { maxBatches: 7, maxTargets: 21 },
  },
  completion: {
    rooms: [
      { role: 'boss', roomGameName: 'G_Boss01' },
      { role: 'postboss', roomGameName: 'G_PostBoss01' },
    ],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
} as const satisfies RawBiomeLayoutDeclaration;
