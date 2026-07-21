import type { RawBiomeLayoutDeclaration } from './types';

export const biomeLayouts = [
  {
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
  },
  {
    biomeKey: 'G',
    kind: 'LinearBiome',
    initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
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
        targetMetaRewardsRatio: 0.35,
        targetMetaRewardsAdjustSpeed: 10,
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
      transitionEffects: [
        { kind: 'resetCounter', axis: 'biomeDepthCache' },
        { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
      ],
    },
    fields: [],
    bounds: { maxBatches: 8, maxTargets: 21 },
  },
  {
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
        defaultStoreKey: 'RunProgress',
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
    bounds: { maxBatches: 9, maxTargets: 18 },
  },
  {
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
  },
  {
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
  },
  {
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
        defaultStoreKey: 'RunProgress',
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
  },
  {
    biomeKey: 'I',
    kind: 'LinearBiome',
    initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
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
    bounds: { maxBatches: 12, maxTargets: 22 },
  },
  {
    biomeKey: 'N',
    kind: 'HubBiome',
    entries: [
      { kind: 'fixedAuthoredSlot', slotKey: 'opening', roomGameName: 'N_Opening01' },
      { kind: 'fixedAuthoredSlot', slotKey: 'preHub', roomGameName: 'N_PreHub01' },
    ],
    hub: {
      roomGameName: 'N_Hub',
      slots: [
        { slotKey: 'combat01', roomGameName: 'N_Combat01', physicalDoorId: 617113 },
        { slotKey: 'combat02', roomGameName: 'N_Combat02', physicalDoorId: 560725 },
        { slotKey: 'combat03', roomGameName: 'N_Combat03', physicalDoorId: 560702 },
        { slotKey: 'combat04', roomGameName: 'N_Combat04', physicalDoorId: 560707 },
        { slotKey: 'combat05', roomGameName: 'N_Combat05', physicalDoorId: 561337 },
        { slotKey: 'combat06', roomGameName: 'N_Combat06', physicalDoorId: 560708 },
        { slotKey: 'combat07', roomGameName: 'N_Combat07', physicalDoorId: 617138 },
        { slotKey: 'combat08', roomGameName: 'N_Combat08', physicalDoorId: 560699 },
        { slotKey: 'combat09', roomGameName: 'N_Combat09', physicalDoorId: 617012 },
        { slotKey: 'combat10', roomGameName: 'N_Combat10', physicalDoorId: 617151 },
        { slotKey: 'combat11', roomGameName: 'N_Combat11', physicalDoorId: 561449 },
        { slotKey: 'combat12', roomGameName: 'N_Combat12', physicalDoorId: 561389 },
        { slotKey: 'combat13', roomGameName: 'N_Combat13', physicalDoorId: 616992 },
        { slotKey: 'combat14', roomGameName: 'N_Combat14', physicalDoorId: 561403 },
        { slotKey: 'combat15', roomGameName: 'N_Combat15', physicalDoorId: 560705 },
        { slotKey: 'combat16', roomGameName: 'N_Combat16', physicalDoorId: 561354 },
        { slotKey: 'combat17', roomGameName: 'N_Combat17', physicalDoorId: 561424 },
        { slotKey: 'combat18', roomGameName: 'N_Combat18', physicalDoorId: 561374 },
        { slotKey: 'combat19', roomGameName: 'N_Combat19', physicalDoorId: 560620 },
        { slotKey: 'combat20', roomGameName: 'N_Combat20', physicalDoorId: 561418 },
        { slotKey: 'combat21', roomGameName: 'N_Combat21', physicalDoorId: 560713 },
        { slotKey: 'combat22', roomGameName: 'N_Combat22', physicalDoorId: 560776 },
        { slotKey: 'combat23', roomGameName: 'N_Combat23', physicalDoorId: 561368 },
        { slotKey: 'miniBoss01', roomGameName: 'N_MiniBoss01', physicalDoorId: 617043 },
        { slotKey: 'miniBoss02', roomGameName: 'N_MiniBoss02', physicalDoorId: 560889 },
      ],
      openCount: { min: 9, max: 10 },
      openSlotConstraints: [
        { kind: 'maxOpenFromSlots', slotKeys: ['miniBoss01', 'miniBoss02'], max: 1 },
      ],
      requiredVisits: 6,
      targetCompletion: { kind: 'requiredRoomObject', objectKey: 'SoulPylon' },
      restoreRoomGameName: 'N_Hub',
      rewardStorePolicy: { kind: 'none' },
      rewardLookup: { key: 'hubRewardLookup', source: 'allOpenTargetOffers' },
      sideRoomGeneration: {
        kind: 'visitPressure',
        generatedCountKey: 'numSubRoomsSpawned',
        minimumPerVisit: { numerator: 1, denominator: 2 },
        remainingSlots: 'optional',
        forcedOrder: 'availabilityRankPrefix',
      },
      fields: [],
    },
    terminal: {
      kind: 'fixedAuthoredSlot',
      slotKey: 'preboss',
      roomGameName: 'N_PreBoss01',
    },
    completion: {
      rooms: [
        { role: 'boss', roomGameName: 'N_Boss01' },
        { role: 'postboss', roomGameName: 'N_PostBoss01' },
      ],
      transitionEffects: [
        { kind: 'resetCounter', axis: 'biomeDepthCache' },
        { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
      ],
    },
    fields: [],
  },
] as const satisfies readonly RawBiomeLayoutDeclaration[];
