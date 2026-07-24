import type { RawBiomeLayoutDeclaration } from '../types';

export const pBiomeLayout = {
  biomeKey: 'P',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'fixed',
    roomGameNames: ['P_Intro'],
  },
  entries: [],
  continuation: {
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      targetMetaRewardsRatio: 0.2,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [],
  },
  terminal: {
    kind: 'forkedTransition',
    roomGameName: 'P_PreBoss01',
    exitPolicy: { kind: 'allExitsTerminal' },
  },
  completion: {
    rooms: [
      { role: 'boss', roomGameName: 'P_Boss01' },
      { role: 'postboss', roomGameName: 'P_PostBoss01' },
    ],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
  bounds: { maxBatches: 8, maxTargets: 16 },
} as const satisfies RawBiomeLayoutDeclaration;
