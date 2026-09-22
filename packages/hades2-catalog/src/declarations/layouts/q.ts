import type { RawBiomeLayoutDeclaration } from './types';

export const qBiomeLayout = {
  biomeKey: 'Q',
  initialCounters: { biomeEncounterDepth: 1 },
  start: { kind: 'fixedAuthored', roomGameName: 'Q_Intro' },
  progression: {
    kind: 'generated',
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
  completion: {
    bossRoomGameName: 'Q_Boss01',
    rivalsBossRoomGameName: 'Q_Boss02',
    // Q's ordinary doors carry no store, but its boss door is an ordinary door
    // in native and genuinely rolls: BaseQ declares TargetMetaRewardsRatio =
    // 0.15 (RoomDataQ.lua:44) and the boss room pins nothing, so
    // ChooseNextRewardStore picks between RunProgress and MetaProgress there.
    // Declared here rather than on the progression because the batch policy
    // above must stay `none` — Q gains the boss-door decision and nothing else.
    bossRewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      targetMetaRewardsRatio: 0.15,
      targetMetaRewardsAdjustSpeed: 10,
    },
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
} as const satisfies RawBiomeLayoutDeclaration;
