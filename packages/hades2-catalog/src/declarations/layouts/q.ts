import type { RawBiomeLayoutDeclaration } from '../types';

export const qBiomeLayout = {
  biomeKey: 'Q',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'fixed',
    roomGameNames: ['Q_Intro'],
  },
  entries: [],
  continuation: {
    progressionPolicy: {
      kind: 'staged',
      stages: [
        { key: 'foyer', roomGameNames: ['Q_Combat10', 'Q_Combat11'] },
        {
          key: 'firstFork',
          roomGameNames: ['Q_Combat03', 'Q_Combat05', 'Q_Combat15'],
        },
        { key: 'firstMiniboss', roomGameNames: ['Q_MiniBoss02', 'Q_MiniBoss05'] },
        {
          key: 'ordinary',
          roomGameNames: [
            'Q_Combat01',
            'Q_Combat02',
            'Q_Combat04',
            'Q_Combat06',
            'Q_Combat07',
            'Q_Combat08',
            'Q_Combat09',
            'Q_Combat16',
          ],
        },
        {
          key: 'secondFork',
          roomGameNames: ['Q_Combat12', 'Q_Combat13', 'Q_Combat14'],
        },
        { key: 'secondMiniboss', roomGameNames: ['Q_MiniBoss03', 'Q_MiniBoss04'] },
      ],
    },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: { kind: 'none' },
    rewardStoreOverrides: [],
  },
  terminal: { kind: 'directTransition', roomGameName: 'Q_PreBoss01' },
  completion: {
    rooms: [{ role: 'boss', roomGameName: 'Q_Boss01' }],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
  bounds: { maxBatches: 6, maxTargets: 8 },
} as const satisfies RawBiomeLayoutDeclaration;
