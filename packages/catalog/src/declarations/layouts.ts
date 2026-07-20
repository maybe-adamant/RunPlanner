import type { RawLinearBiomeLayoutDeclaration } from './types';

export const biomeLayouts = [
  {
    biomeKey: 'F',
    kind: 'LinearBiome',
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
    },
    fields: [],
    bounds: { maxBatches: 10, maxTargets: 20 },
  },
  {
    biomeKey: 'G',
    kind: 'LinearBiome',
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
        defaultStoreKey: 'RunProgress',
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
    },
    fields: [],
    bounds: { maxBatches: 8, maxTargets: 21 },
  },
  {
    biomeKey: 'P',
    kind: 'LinearBiome',
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
        defaultStoreKey: 'RunProgress',
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
    },
    fields: [],
    bounds: { maxBatches: 9, maxTargets: 18 },
  },
  {
    biomeKey: 'Q',
    kind: 'LinearBiome',
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
    },
    fields: [],
    bounds: { maxBatches: 6, maxTargets: 8 },
  },
  {
    biomeKey: 'H',
    kind: 'LinearBiome',
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
    },
    fields: [],
    bounds: { maxBatches: 4, maxTargets: 7 },
  },
  {
    biomeKey: 'O',
    kind: 'LinearBiome',
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
        defaultStoreKey: 'RunProgress',
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
    },
    fields: [],
    bounds: { maxBatches: 6, maxTargets: 6 },
  },
  {
    biomeKey: 'I',
    kind: 'LinearBiome',
    start: { kind: 'fixedEntry', role: 'intro', roomGameName: 'I_Intro' },
    entries: [{ kind: 'fixedEntry', role: 'story', roomGameName: 'I_Story01' }],
    continuation: {
      progressionPolicy: { kind: 'eligibilityDriven' },
      batchPolicy: { kind: 'clockwork', fields: [] },
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
    bounds: { maxBatches: 12, maxTargets: 22 },
  },
] as const satisfies readonly RawLinearBiomeLayoutDeclaration[];
