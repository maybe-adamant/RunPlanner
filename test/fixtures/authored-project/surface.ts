import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTargetAddress,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

/**
 * The canonical Surface regression fixture is intentionally translated from
 * the former N/O/P/Q product fixture.  It keeps the audited room, reward and
 * local-child choices, while authoring their unified decision topology.
 */
export const nBiome = createBiomeAddress('Surface', 'N');
export const oBiome = createBiomeAddress('Surface', 'O');
export const pBiome = createBiomeAddress('Surface', 'P');
export const qBiome = createBiomeAddress('Surface', 'Q');

export const nOccurrenceIds = Object.freeze({
  opening: createOccurrenceId('surface-n-opening'),
  preHub: createOccurrenceId('surface-n-prehub'),
  preboss: createOccurrenceId('surface-n-preboss'),
});

/** N names concrete Opening, PreHub, and Preboss authored occurrences. */
export const nFixedOccurrenceIds = nOccurrenceIds;

export const oOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('surface-o-intro'),
  combat04: createOccurrenceId('surface-o-combat04'),
  combat07: createOccurrenceId('surface-o-combat07'),
  combat01: createOccurrenceId('surface-o-combat01'),
  devotion: createOccurrenceId('surface-o-devotion'),
  story: createOccurrenceId('surface-o-story'),
  combat02: createOccurrenceId('surface-o-combat02'),
  preboss: createOccurrenceId('surface-o-preboss'),
});

export const pOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('surface-p-intro'),
  prebossShop: createOccurrenceId('surface-p-preboss-shop'),
  prebossReward: createOccurrenceId('surface-p-preboss-reward'),
});

export const qOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('surface-q-intro'),
  foyer: createOccurrenceId('surface-q-foyer'),
  firstFork: createOccurrenceId('surface-q-first-fork'),
  firstMiniboss1: createOccurrenceId('surface-q-first-miniboss-1'),
  firstMiniboss2: createOccurrenceId('surface-q-first-miniboss-2'),
  ordinary: createOccurrenceId('surface-q-ordinary'),
  secondFork: createOccurrenceId('surface-q-second-fork'),
  secondMiniboss1: createOccurrenceId('surface-q-second-miniboss-1'),
  secondMiniboss2: createOccurrenceId('surface-q-second-miniboss-2'),
  preboss: createOccurrenceId('surface-q-preboss'),
});

export const nOpenSlotKeys = [
  'combat11',
  'combat10',
  'combat09',
  'combat05',
  'combat03',
  'combat02',
  'combat01',
  'miniBoss01',
  'combat23',
] as const;

export const nVisitSlotKeys = [
  'combat05',
  'miniBoss01',
  'combat02',
  'combat11',
  'combat23',
  'combat09',
] as const;

export function nOccurrenceId(slotKey: string): OccurrenceId {
  return createOccurrenceId(`surface-n-${slotKey}`);
}

export function pOccurrenceId(
  gameName: string,
  batchIndex: number,
  exitIndex: number,
): OccurrenceId {
  return createOccurrenceId(`surface-p-${batchIndex}-${exitIndex}-${gameName.toLowerCase()}`);
}

function occurrenceSource(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function decision(biome: BiomeAddress, occurrenceId: OccurrenceId) {
  return createExitDecisionAddress(biome, occurrenceSource(occurrenceId));
}

function replaceIncoming(
  project: ProjectDocument,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId),
    value,
  });
}

function appendBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId,
  targets: readonly { readonly occurrenceId: OccurrenceId; readonly gameName: string }[],
  storeKey?: 'RunProgress' | 'MetaProgress',
): ProjectDocument {
  const source = occurrenceSource(parentOccurrenceId);
  const owner = createExitDecisionAddress(biome, source);
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: owner });
  if (storeKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, source),
      storeKey,
    });
  }
  for (const [offset, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, source, `exit${offset + 1}`),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return targets.length === 1
    ? next
    : applyProjectCommand(next, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, source),
        value: { kind: 'normal', exitKey: 'exit1' },
      });
}

function configureNSideRooms(project: ProjectDocument): ProjectDocument {
  let next = project;
  for (const [parentSlotKey, sideSlotKeys] of Object.entries({
    combat05: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
    combat02: ['sideDoor1', 'sideDoor2'],
    combat11: ['sideDoor1'],
  })) {
    for (const sideSlotKey of sideSlotKeys) {
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId(parentSlotKey),
          'sideRooms',
          sideSlotKey,
        ),
        generation: 'generated',
      });
    }
  }
  for (const [parentSlotKey, enteredSlotKeys] of [
    ['combat05', ['sideDoor2', 'sideDoor1']],
    ['combat02', ['sideDoor1']],
    ['combat11', ['sideDoor1']],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId(parentSlotKey), 'sideRooms'),
      enteredSlotKeys,
    });
  }
  for (const [parentSlotKey, sideSlotKey, rewardType] of [
    ['combat05', 'sideDoor1', 'MaxManaDropSmall'],
    ['combat05', 'sideDoor2', 'MaxHealthDropSmall'],
    ['combat05', 'sideDoor3', 'EmptyMaxHealthSmallDrop'],
    ['combat02', 'sideDoor1', 'RoomMoneyTinyDrop'],
    ['combat02', 'sideDoor2', 'AirBoost'],
    ['combat11', 'sideDoor1', 'EarthBoost'],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(
        nBiome,
        nOccurrenceId(parentSlotKey),
        'sideRooms',
        sideSlotKey,
      ),
      value: { rewardType },
    });
  }
  return next;
}

export interface CompleteNFixtureOptions {
  readonly includePreboss?: boolean;
  readonly openSlotKeys?: readonly string[];
  readonly visitSlotKeys?: readonly string[];
}

export function appendCompleteN(
  project: ProjectDocument,
  options: CompleteNFixtureOptions = {},
): ProjectDocument {
  const openSlotKeys = options.openSlotKeys ?? nOpenSlotKeys;
  const visitSlotKeys = options.visitSlotKeys ?? nVisitSlotKeys;
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: nOccurrenceIds.opening,
  });
  const opening = decision(nBiome, nOccurrenceIds.opening);
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateLinkedExit',
    decision: opening,
    occurrenceId: nOccurrenceIds.preHub,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateHubDecision',
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  for (const hubSlotKey of openSlotKeys) {
    next = applyProjectCommand(next, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', hubSlotKey),
      occurrenceId: nOccurrenceId(hubSlotKey),
    });
  }
  for (const [offset, hubSlotKey] of visitSlotKeys.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(nBiome, 'hub', offset + 1),
      hubSlotKey,
    });
  }
  for (const [slotKey, value] of Object.entries({
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat05: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
    combat10: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AphroditeUpgrade' },
    },
    combat11: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AresUpgrade' },
    },
    combat23: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    miniBoss01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'HephaestusUpgrade' },
    },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>).filter(([slotKey]) =>
    openSlotKeys.includes(slotKey),
  )) {
    next = replaceIncoming(next, nBiome, nOccurrenceId(slotKey), value);
  }
  next = configureNSideRooms(next);
  if (options.includePreboss === false) return next;
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: nOccurrenceIds.preboss },
  });
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

export function appendCompleteO(project: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: oOccurrenceIds.intro,
  });
  for (const [parent, occurrenceId, gameName, storeKey] of [
    [oOccurrenceIds.intro, oOccurrenceIds.combat04, 'O_Combat04', 'RunProgress'],
    [oOccurrenceIds.combat04, oOccurrenceIds.combat07, 'O_Combat07', undefined],
    [oOccurrenceIds.combat07, oOccurrenceIds.combat01, 'O_Combat01', undefined],
    [oOccurrenceIds.combat01, oOccurrenceIds.devotion, 'O_Devotion01', undefined],
    [oOccurrenceIds.devotion, oOccurrenceIds.story, 'O_Story01', 'MetaProgress'],
    [oOccurrenceIds.story, oOccurrenceIds.combat02, 'O_Combat02', 'MetaProgress'],
  ] as const) {
    next = appendBatch(next, oBiome, parent, [{ occurrenceId, gameName }], storeKey);
  }
  for (const [occurrenceId, rewardType] of [
    [oOccurrenceIds.combat04, 'MaxHealthDrop'],
    [oOccurrenceIds.combat07, 'MaxManaDrop'],
    [oOccurrenceIds.combat01, 'RoomMoneyDrop'],
    [oOccurrenceIds.combat02, 'StackUpgrade'],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, occurrenceId, 'wheel1', 'offer1'),
      value: { rewardType },
    });
  }
  next = replaceIncoming(next, oBiome, oOccurrenceIds.devotion, {
    rewardType: 'Devotion',
    payload: {
      kind: 'DevotionPair',
      chosenSource: 'AresUpgrade',
      spurnedSource: 'HephaestusUpgrade',
    },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: decision(oBiome, oOccurrenceIds.combat02),
    gameName: 'O_PreBoss01',
    targetOccurrenceIds: { exit1: oOccurrenceIds.preboss },
  });
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(oBiome, oOccurrenceIds.preboss, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

export function appendCompleteP(project: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: pBiome,
    occurrenceId: pOccurrenceIds.intro,
  });
  const batches = [
    { targets: ['P_Combat03', 'P_Combat05'], storeKey: 'RunProgress' },
    { targets: ['P_Combat02', 'P_Combat06'], storeKey: 'MetaProgress' },
    { targets: ['P_Combat04', 'P_Combat08'], storeKey: 'RunProgress' },
    { targets: ['P_Combat07', 'P_Combat11'], storeKey: 'RunProgress' },
    { targets: ['P_MiniBoss01', 'P_Combat09'], storeKey: 'RunProgress' },
    { targets: ['P_Combat10', 'P_Combat13'], storeKey: 'RunProgress' },
    { targets: ['P_Story01', 'P_Reprieve01'], storeKey: 'RunProgress' },
    { targets: ['P_Combat12', 'P_Combat14'], storeKey: 'RunProgress' },
  ] as const;
  let parent = pOccurrenceIds.intro;
  for (const [offset, batch] of batches.entries()) {
    const batchIndex = offset + 1;
    const targets = batch.targets.map((gameName, targetOffset) => ({
      occurrenceId: pOccurrenceId(gameName, batchIndex, targetOffset + 1),
      gameName,
    }));
    next = appendBatch(next, pBiome, parent, targets, batch.storeKey);
    parent = targets[0]!.occurrenceId;
  }
  for (const [batchIndex, exitIndex, gameName, value] of [
    [1, 1, 'P_Combat03', { rewardType: 'MaxHealthDrop' }],
    [1, 2, 'P_Combat05', { rewardType: 'MaxManaDrop' }],
    [2, 1, 'P_Combat02', { rewardType: 'MetaCurrencyBigDrop' }],
    [2, 2, 'P_Combat06', { rewardType: 'MetaCardPointsCommonBigDrop' }],
    [3, 1, 'P_Combat04', { rewardType: 'RoomMoneyDrop' }],
    [3, 2, 'P_Combat08', { rewardType: 'StackUpgrade' }],
    [4, 1, 'P_Combat07', { rewardType: 'HermesUpgrade' }],
    [
      4,
      2,
      'P_Combat11',
      { rewardType: 'Boon', payload: { kind: 'BoonSource' as const, source: 'DemeterUpgrade' } },
    ],
    [
      5,
      1,
      'P_MiniBoss01',
      { rewardType: 'Boon', payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' } },
    ],
    [5, 2, 'P_Combat09', { rewardType: 'WeaponUpgrade' }],
    [6, 1, 'P_Combat10', { rewardType: 'RoomMoneyDrop' }],
    [6, 2, 'P_Combat13', { rewardType: 'MaxHealthDrop' }],
    [7, 2, 'P_Reprieve01', { rewardType: 'MaxManaDrop' }],
    [8, 1, 'P_Combat12', { rewardType: 'StackUpgrade' }],
    [8, 2, 'P_Combat14', { rewardType: 'MaxManaDrop' }],
  ] as const satisfies readonly (readonly [number, number, string, ResolvedRewardOffer])[]) {
    next = replaceIncoming(next, pBiome, pOccurrenceId(gameName, batchIndex, exitIndex), value);
  }
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: decision(pBiome, parent),
    gameName: 'P_PreBoss01',
    targetOccurrenceIds: {
      exit1: pOccurrenceIds.prebossShop,
      exit2: pOccurrenceIds.prebossReward,
    },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(pBiome, occurrenceSource(parent)),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

export function appendCompleteQ(project: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: qBiome,
    occurrenceId: qOccurrenceIds.intro,
  });
  for (const [parent, targets] of [
    [qOccurrenceIds.intro, [{ occurrenceId: qOccurrenceIds.foyer, gameName: 'Q_Combat10' }]],
    [qOccurrenceIds.foyer, [{ occurrenceId: qOccurrenceIds.firstFork, gameName: 'Q_Combat03' }]],
    [
      qOccurrenceIds.firstFork,
      [
        { occurrenceId: qOccurrenceIds.firstMiniboss1, gameName: 'Q_MiniBoss02' },
        { occurrenceId: qOccurrenceIds.firstMiniboss2, gameName: 'Q_MiniBoss05' },
      ],
    ],
    [
      qOccurrenceIds.firstMiniboss1,
      [{ occurrenceId: qOccurrenceIds.ordinary, gameName: 'Q_Combat01' }],
    ],
    [
      qOccurrenceIds.ordinary,
      [{ occurrenceId: qOccurrenceIds.secondFork, gameName: 'Q_Combat12' }],
    ],
    [
      qOccurrenceIds.secondFork,
      [
        { occurrenceId: qOccurrenceIds.secondMiniboss1, gameName: 'Q_MiniBoss03' },
        { occurrenceId: qOccurrenceIds.secondMiniboss2, gameName: 'Q_MiniBoss04' },
      ],
    ],
  ] as const) {
    next = appendBatch(next, qBiome, parent, targets);
  }
  for (const [occurrenceId, value] of [
    [
      qOccurrenceIds.firstMiniboss1,
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
    ],
    [
      qOccurrenceIds.firstMiniboss2,
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    ],
    [qOccurrenceIds.secondMiniboss1, { rewardType: 'WeaponUpgrade' }],
    [qOccurrenceIds.secondMiniboss2, { rewardType: 'StackUpgradeTriple' }],
  ] as const satisfies readonly (readonly [OccurrenceId, ResolvedRewardOffer])[]) {
    next = replaceIncoming(next, qBiome, occurrenceId, value);
  }
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: decision(qBiome, qOccurrenceIds.secondMiniboss1),
    gameName: 'Q_PreBoss01',
    targetOccurrenceIds: { exit1: qOccurrenceIds.preboss },
  });
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'PremiumProgress'),
    value: { rewardType: 'MaxHealthDropBig' },
  });
}

function emptySurfaceProject(configuredBiomeCount: 1 | 2 | 3 | 4): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `surface-${configuredBiomeCount}`,
    name: `Surface ${configuredBiomeCount}`,
    configuredBiomeCounts: { Surface: configuredBiomeCount },
  });
}

export function createRepresentativeNProject(
  options: CompleteNFixtureOptions = {},
): ProjectDocument {
  return appendCompleteN(emptySurfaceProject(1), options);
}

export function createRepresentativeNOProject(): ProjectDocument {
  return appendCompleteO(appendCompleteN(emptySurfaceProject(2)));
}

export function createRepresentativeNOPProject(): ProjectDocument {
  return appendCompleteP(appendCompleteO(appendCompleteN(emptySurfaceProject(3))));
}

export function createRepresentativeNOPQProject(): ProjectDocument {
  return appendCompleteQ(appendCompleteP(appendCompleteO(appendCompleteN(emptySurfaceProject(4)))));
}
