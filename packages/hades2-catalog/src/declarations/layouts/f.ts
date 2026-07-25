import type { RawBiomeLayoutDeclaration } from '../types';

export const fBiomeLayout = {
  biomeKey: 'F',
  initialCounters: { biomeDepthCache: 0, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredChoice',
    roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
  },
  progression: {
    kind: 'generated',
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      targetMetaRewardsRatio: 0.315,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [],
    bounds: { maxBatches: 10, maxTargets: 20 },
  },
  completion: {
    rooms: [
      { role: 'boss', roomGameName: 'F_Boss01' },
      { role: 'postboss', roomGameName: 'F_PostBoss01' },
    ],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
} as const satisfies RawBiomeLayoutDeclaration;
