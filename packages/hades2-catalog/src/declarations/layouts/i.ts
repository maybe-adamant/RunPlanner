import type { RawBiomeLayoutDeclaration } from '../types';

export const iBiomeLayout = {
  biomeKey: 'I',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'fixed',
    roomGameNames: ['I_Intro'],
  },
  entries: [],
  continuation: {
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: {
      kind: 'clockwork',
      initialGoalCount: 5,
      fields: [],
    },
    rewardStorePolicy: { kind: 'none' },
    rewardStoreOverrides: [],
  },
  terminal: {
    kind: 'generatedTarget',
    roomGameName: 'I_PreBoss02',
    closesBiomeWhenPicked: true,
  },
  completion: {
    rooms: [
      { role: 'boss', roomGameName: 'I_Boss01' },
      { role: 'postboss', roomGameName: 'I_PostBoss01' },
    ],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [
    {
      key: 'maxNonGoalRewards',
      kind: 'boundedInteger',
      min: 3,
      max: 6,
      defaultValue: 3,
    },
  ],
  bounds: { maxBatches: 13, maxTargets: 23 },
} as const satisfies RawBiomeLayoutDeclaration;
