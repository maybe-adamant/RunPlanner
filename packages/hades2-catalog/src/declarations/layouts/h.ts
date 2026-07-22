import type { RawBiomeLayoutDeclaration } from '../types';

export const hBiomeLayout = {
  biomeKey: 'H',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'fixed',
    roomGameNames: ['H_Intro'],
  },
  entries: [],
  continuation: {
    progressionPolicy: { kind: 'fixedCount', continuationCount: 4 },
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
          defaultValue: 'min',
        },
      ],
    },
    rewardStorePolicy: { kind: 'none' },
    rewardStoreOverrides: [],
  },
  terminal: {
    kind: 'forkedTransition',
    roomGameName: 'H_PreBoss01',
    exitPolicy: { kind: 'allExitsTerminal' },
  },
  completion: {
    rooms: [
      { role: 'boss', roomGameName: 'H_Boss01' },
      { role: 'postboss', roomGameName: 'H_PostBoss01' },
    ],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
  bounds: { maxBatches: 4, maxTargets: 7 },
} as const satisfies RawBiomeLayoutDeclaration;
