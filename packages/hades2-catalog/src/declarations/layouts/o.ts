import type { RawBiomeLayoutDeclaration } from '../types';

export const oBiomeLayout = {
  biomeKey: 'O',
  initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
  start: { kind: 'fixedAuthored', roomGameName: 'O_Intro' },
  progression: {
    kind: 'generated',
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
        sourceRoomTemplateKey: 'ShipCombat',
        policy: { kind: 'sourceOfferPoint', selector: 'lastActiveWheel' },
      },
    ],
    bounds: { maxBatches: 6, maxTargets: 6 },
  },
  completion: {
    bossRoomGameName: 'O_Boss01',
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
} as const satisfies RawBiomeLayoutDeclaration;
