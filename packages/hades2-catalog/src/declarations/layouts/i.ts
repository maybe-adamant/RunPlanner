import type { RawBiomeLayoutDeclaration } from '../types';

export const iBiomeLayout = {
  biomeKey: 'I',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: { kind: 'fixedAuthored', roomGameName: 'I_Intro' },
  progression: {
    kind: 'generated',
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: {
      kind: 'clockwork',
      initialGoalCount: 5,
      fields: [],
    },
    rewardStorePolicy: { kind: 'none' },
    rewardStoreOverrides: [],
    bounds: { maxBatches: 13, maxTargets: 23 },
  },
  sparkChaos: {
    roomGameNames: ['Chaos_01', 'Chaos_02', 'Chaos_03', 'Chaos_04', 'Chaos_05', 'Chaos_06'],
    defaultRoomGameName: 'Chaos_01',
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
      initialization: { kind: 'required' },
    },
  ],
} as const satisfies RawBiomeLayoutDeclaration;
