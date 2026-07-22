import { catalog } from '@run-planner/catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRewardWheelOfferAddress,
  createRouteAddress,
  createShopOfferAddress,
  createTargetAddress,
  type HubBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/core';
import type { ResolvedRewardOffer } from '@run-planner/core/reward-kernel';

export const nBiome = createBiomeAddress('Surface', 'N');
export const oBiome = createBiomeAddress('Surface', 'O');
export const oOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('editor-o-intro'),
  combat04: createOccurrenceId('editor-o-combat04'),
  combat07: createOccurrenceId('editor-o-combat07'),
  combat01: createOccurrenceId('editor-o-combat01'),
  devotion: createOccurrenceId('editor-o-devotion'),
  story: createOccurrenceId('editor-o-story'),
  combat02: createOccurrenceId('editor-o-combat02'),
  preboss: createOccurrenceId('editor-o-preboss'),
});
export const pBiome = createBiomeAddress('Surface', 'P');
export const pOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('editor-p-intro'),
  prebossShop: createOccurrenceId('editor-p-preboss-shop'),
  prebossReward: createOccurrenceId('editor-p-preboss-reward'),
});
export const nFixedOccurrenceIds = Object.freeze({
  opening: createOccurrenceId('editor-n-opening'),
  preHub: createOccurrenceId('editor-n-prehub'),
  preboss: createOccurrenceId('editor-n-preboss'),
});
export const nOpenSlotKeys = Object.freeze([
  'combat11',
  'combat10',
  'combat09',
  'combat05',
  'combat03',
  'combat02',
  'combat01',
  'miniBoss01',
  'combat23',
] as const);
export const nVisitSlotKeys = Object.freeze([
  'combat05',
  'miniBoss01',
  'combat02',
  'combat11',
  'combat23',
  'combat09',
] as const);

export function nOccurrenceId(slotKey: string) {
  return createOccurrenceId(`editor-n-${slotKey}`);
}

export function requireNPlan(project: ProjectDocument): HubBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === nBiome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === nBiome.biomeKey);
  if (plan?.kind !== 'HubBiome') {
    throw new Error('N product fixture has no Hub plan');
  }
  return plan;
}

function replaceIncoming(
  project: ProjectDocument,
  slotKey: string,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId(slotKey)),
    value,
  });
}

function replaceLocal(
  project: ProjectDocument,
  parentSlotKey: string,
  sideSlotKey: string,
  rewardType: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
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

function configureSideRooms(project: ProjectDocument): ProjectDocument {
  let configured = project;
  for (const [parentSlotKey, sideSlotKeys] of Object.entries({
    combat05: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
    combat02: ['sideDoor1', 'sideDoor2'],
    combat11: ['sideDoor1'],
  })) {
    for (const sideSlotKey of sideSlotKeys) {
      configured = applyProjectCommand(configured, catalog, {
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
    configured = applyProjectCommand(configured, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId(parentSlotKey), 'sideRooms'),
      enteredSlotKeys,
    });
  }
  configured = replaceLocal(configured, 'combat05', 'sideDoor1', 'MaxManaDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor2', 'MaxHealthDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor3', 'EmptyMaxHealthSmallDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor1', 'RoomMoneyTinyDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor2', 'AirBoost');
  return replaceLocal(configured, 'combat11', 'sideDoor1', 'EarthBoost');
}

export function createEmptyNProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'n-product-loop',
    name: 'N Product Loop',
    configuredBiomeCounts: { Surface: 1 },
  });
}

export function createRepresentativeNProject(): ProjectDocument {
  let project = applyProjectCommand(createEmptyNProject(), catalog, {
    kind: 'CreateHubTopology',
    biome: nBiome,
    fixedOccurrenceIds: nFixedOccurrenceIds,
  });
  for (const hubSlotKey of nOpenSlotKeys) {
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, hubSlotKey),
      occurrenceId: nOccurrenceId(hubSlotKey),
    });
  }
  for (const [index, hubSlotKey] of nVisitSlotKeys.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(nBiome, index + 1),
      hubSlotKey,
    });
  }
  for (const [slotKey, offer] of Object.entries({
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat05: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
    combat10: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
    combat11: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    },
    combat23: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
    miniBoss01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HephaestusUpgrade' },
    },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    project = replaceIncoming(project, slotKey, offer);
  }
  project = configureSideRooms(project);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(nBiome, nFixedOccurrenceIds.preboss, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

function appendORoom(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  occurrenceId: OccurrenceId,
  gameName: string,
): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(oBiome, parentOccurrenceId),
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, parentOccurrenceId, 1),
    occurrenceId,
    gameName,
  });
  return applyProjectCommand(next, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(oBiome, parentOccurrenceId),
    exitIndex: 1,
  });
}

export function pOccurrenceId(
  gameName: string,
  batchIndex: number,
  exitIndex: number,
): OccurrenceId {
  return createOccurrenceId(`editor-p-${batchIndex}-${exitIndex}-${gameName.toLowerCase()}`);
}

function appendPBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  batchIndex: number,
  targets: readonly [string, string],
  storeKey: 'RunProgress' | 'MetaProgress',
): { readonly project: ProjectDocument; readonly pickedOccurrenceId: OccurrenceId } {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(pBiome, parentOccurrenceId),
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(pBiome, parentOccurrenceId),
    storeKey,
  });
  let pickedOccurrenceId: OccurrenceId | undefined;
  for (const [exitOffset, gameName] of targets.entries()) {
    const exitIndex = exitOffset + 1;
    const occurrenceId = pOccurrenceId(gameName, batchIndex, exitIndex);
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(pBiome, parentOccurrenceId, exitIndex),
      occurrenceId,
      gameName,
    });
    if (exitIndex === 1) {
      pickedOccurrenceId = occurrenceId;
    }
  }
  next = applyProjectCommand(next, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(pBiome, parentOccurrenceId),
    exitIndex: 1,
  });
  if (pickedOccurrenceId === undefined) {
    throw new Error(`P batch ${batchIndex} has no picked target`);
  }
  return { project: next, pickedOccurrenceId };
}

export function createRepresentativeNOProject(): ProjectDocument {
  let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Surface'),
    configuredBiomeCount: 2,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: oOccurrenceIds.intro,
    gameName: 'O_Intro',
  });
  for (const [parentOccurrenceId, occurrenceId, gameName] of [
    [oOccurrenceIds.intro, oOccurrenceIds.combat04, 'O_Combat04'],
    [oOccurrenceIds.combat04, oOccurrenceIds.combat07, 'O_Combat07'],
    [oOccurrenceIds.combat07, oOccurrenceIds.combat01, 'O_Combat01'],
    [oOccurrenceIds.combat01, oOccurrenceIds.devotion, 'O_Devotion01'],
    [oOccurrenceIds.devotion, oOccurrenceIds.story, 'O_Story01'],
    [oOccurrenceIds.story, oOccurrenceIds.combat02, 'O_Combat02'],
  ] as const) {
    project = appendORoom(project, parentOccurrenceId, occurrenceId, gameName);
  }
  for (const [occurrenceId, rewardType] of [
    [oOccurrenceIds.combat04, 'MaxHealthDrop'],
    [oOccurrenceIds.combat07, 'MaxManaDrop'],
    [oOccurrenceIds.combat01, 'RoomMoneyDrop'],
    [oOccurrenceIds.combat02, 'StackUpgrade'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, occurrenceId, 'wheel1', 'offer1'),
      value: { rewardType },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion),
    value: {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'AresUpgrade',
        spurnedSource: 'HephaestusUpgrade',
      },
    },
  });
  for (const parentOccurrenceId of [oOccurrenceIds.devotion, oOccurrenceIds.story]) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, parentOccurrenceId),
      storeKey: 'MetaProgress',
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(oBiome, oOccurrenceIds.combat02),
    targetOccurrenceIds: [oOccurrenceIds.preboss],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(oBiome, oOccurrenceIds.preboss, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

export function createRepresentativeNOPProject(): ProjectDocument {
  let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Surface'),
    configuredBiomeCount: 3,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: pBiome,
    occurrenceId: pOccurrenceIds.intro,
    gameName: 'P_Intro',
  });
  const batches = [
    { targets: ['P_Combat03', 'P_Combat05'], storeKey: 'RunProgress' },
    { targets: ['P_Combat02', 'P_Combat06'], storeKey: 'MetaProgress' },
    { targets: ['P_Combat04', 'P_Combat08'], storeKey: 'RunProgress' },
    { targets: ['P_Combat07', 'P_Combat11'], storeKey: 'RunProgress' },
    { targets: ['P_MiniBoss01', 'P_Combat09'], storeKey: 'RunProgress' },
    { targets: ['P_Combat10', 'P_Combat13'], storeKey: 'RunProgress' },
    { targets: ['P_Story01', 'P_Reprieve01'], storeKey: 'RunProgress' },
    { targets: ['P_Combat12', 'P_Shop01'], storeKey: 'RunProgress' },
    { targets: ['P_Combat15', 'P_Combat14'], storeKey: 'RunProgress' },
  ] as const;
  let parentOccurrenceId = pOccurrenceIds.intro;
  for (const [batchOffset, batch] of batches.entries()) {
    const result = appendPBatch(
      project,
      parentOccurrenceId,
      batchOffset + 1,
      batch.targets,
      batch.storeKey,
    );
    project = result.project;
    parentOccurrenceId = result.pickedOccurrenceId;
  }
  const offers = [
    [1, 1, 'P_Combat03', { rewardType: 'MaxHealthDrop' }],
    [1, 2, 'P_Combat05', { rewardType: 'MaxManaDrop' }],
    [2, 1, 'P_Combat02', { rewardType: 'MetaCurrencyBigDrop' }],
    [2, 2, 'P_Combat06', { rewardType: 'MetaCardPointsCommonBigDrop' }],
    [3, 1, 'P_Combat04', { rewardType: 'RoomMoneyDrop' }],
    [3, 2, 'P_Combat08', { rewardType: 'StackUpgrade' }],
    [
      5,
      1,
      'P_MiniBoss01',
      {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    ],
    [5, 2, 'P_Combat09', { rewardType: 'WeaponUpgrade' }],
    [4, 1, 'P_Combat07', { rewardType: 'HermesUpgrade' }],
    [
      4,
      2,
      'P_Combat11',
      {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
      },
    ],
    [6, 1, 'P_Combat10', { rewardType: 'RoomMoneyDrop' }],
    [6, 2, 'P_Combat13', { rewardType: 'MaxHealthDrop' }],
    [7, 2, 'P_Reprieve01', { rewardType: 'MaxManaDrop' }],
    [8, 1, 'P_Combat12', { rewardType: 'StackUpgrade' }],
    [9, 1, 'P_Combat15', { rewardType: 'RoomMoneyDrop' }],
    [9, 2, 'P_Combat14', { rewardType: 'MaxManaDrop' }],
  ] as const;
  for (const [batchIndex, exitIndex, gameName, value] of offers) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(pBiome, pOccurrenceId(gameName, batchIndex, exitIndex)),
      value,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(pBiome, parentOccurrenceId),
    targetOccurrenceIds: [pOccurrenceIds.prebossShop, pOccurrenceIds.prebossReward],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(pBiome, parentOccurrenceId),
    exitIndex: 1,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}
