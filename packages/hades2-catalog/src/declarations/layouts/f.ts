import type { RawBiomeLayoutDeclaration } from '../types';

export const fBiomeLayout = {
  biomeKey: 'F',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 0, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'oneOf',
    roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
  },
  entries: [],
  continuation: {
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      defaultStoreKey: 'RunProgress',
      targetMetaRewardsRatio: 0.315,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [],
  },
  terminal: {
    kind: 'forkedTransition',
    roomGameName: 'F_PreBoss01',
    exitPolicy: { kind: 'allExitsTerminal' },
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
  bounds: { maxBatches: 10, maxTargets: 20 },
} as const satisfies RawBiomeLayoutDeclaration;
