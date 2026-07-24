import type { RawBiomeLayoutDeclaration } from '../types';

export const oBiomeLayout = {
  biomeKey: 'O',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'fixed',
    roomGameNames: ['O_Intro'],
  },
  entries: [],
  continuation: {
    progressionPolicy: { kind: 'fixedCount', continuationCount: 6 },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      targetMetaRewardsRatio: 0.3,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [
      {
        sourceEncounterProfileKey: 'ShipCombat',
        policy: { kind: 'sourceOfferPoint', selector: 'lastActiveWheel' },
      },
    ],
  },
  terminal: { kind: 'directTransition', roomGameName: 'O_PreBoss01' },
  completion: {
    rooms: [
      { role: 'boss', roomGameName: 'O_Boss01' },
      { role: 'postboss', roomGameName: 'O_PostBoss01' },
    ],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
  bounds: { maxBatches: 6, maxTargets: 6 },
} as const satisfies RawBiomeLayoutDeclaration;
