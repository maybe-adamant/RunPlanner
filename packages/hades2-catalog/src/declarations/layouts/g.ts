import type { RawBiomeLayoutDeclaration } from '../types';

export const gBiomeLayout = {
  biomeKey: 'G',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'fixed',
    roomGameNames: ['G_Intro'],
  },
  entries: [],
  continuation: {
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      targetMetaRewardsRatio: 0.35,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [],
  },
  terminal: {
    kind: 'forkedTransition',
    roomGameName: 'G_PreBoss01',
    exitPolicy: { kind: 'allExitsTerminal' },
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
  bounds: { maxBatches: 7, maxTargets: 21 },
} as const satisfies RawBiomeLayoutDeclaration;
