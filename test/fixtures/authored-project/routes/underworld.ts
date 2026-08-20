import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createTargetAddress,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  authorRequiredTestRoomActions,
  authorLegalTraitOffers,
  replaceTestShopOfferActions,
} from '../shared';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
} from '../checkpoints/underworld';
import { authorTestArtificerReplacement } from '../room-actions';

export const goldenFBiome = createBiomeAddress('Underworld', 'F');
export const goldenGBiome = createBiomeAddress('Underworld', 'G');
export const goldenHBiome = createBiomeAddress('Underworld', 'H');
export const goldenIBiome = createBiomeAddress('Underworld', 'I');
export const goldenFStartId = createOccurrenceId('golden-f-start');
export const fMidshopPomShopId = createOccurrenceId('midshop-pom-b5-e1');
export const goldenGStartId = createOccurrenceId('golden-g-intro');
export const goldenHStartId = createOccurrenceId('golden-h-intro');
export const goldenIStartId = createOccurrenceId('golden-i-intro');

export interface GoldenGProjectOptions {
  readonly pickedMiniboss?: 'G_MiniBoss01' | 'G_MiniBoss02';
  readonly prebossSource?: 'G_Combat12' | 'G_Combat14';
}

interface BatchSpec {
  readonly storeKey: 'MetaProgress' | 'RunProgress';
  readonly targets: readonly { readonly gameName: string; readonly offer?: ResolvedRewardOffer }[];
}

const fBatches: readonly BatchSpec[] = [
  {
    storeKey: 'MetaProgress',
    targets: [{ gameName: 'F_Combat02', offer: { rewardType: 'MetaCurrencyDrop' } }],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      {
        gameName: 'F_Combat03',
        offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      },
      { gameName: 'F_Combat03', offer: { rewardType: 'MaxHealthDrop' } },
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      { gameName: 'F_Combat04', offer: { rewardType: 'MaxHealthDrop' } },
      { gameName: 'F_Combat04', offer: { rewardType: 'MaxManaDrop' } },
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      { gameName: 'F_Combat05', offer: { rewardType: 'StackUpgrade' } },
      { gameName: 'F_Combat11', offer: { rewardType: 'RoomMoneyDrop' } },
    ],
  },
];

export function goldenFOccurrenceId(batchIndex: number, exitIndex: number): OccurrenceId {
  return createOccurrenceId(`golden-f-b${batchIndex}-e${exitIndex}`);
}

export function goldenGOccurrenceId(batchIndex: number, exitIndex: number): OccurrenceId {
  return createOccurrenceId(`golden-g-b${batchIndex}-e${exitIndex}`);
}

export function targetOccurrenceId(
  biomeKey: 'F' | 'G',
  batchIndex: number,
  exitIndex: number,
): OccurrenceId {
  return biomeKey === 'F'
    ? goldenFOccurrenceId(batchIndex, exitIndex)
    : goldenGOccurrenceId(batchIndex, exitIndex);
}

export function createCompleteFGProject(options: GoldenGProjectOptions = {}): ProjectDocument {
  if (options.pickedMiniboss === undefined && options.prebossSource === undefined) {
    return loadUnderworldFGCheckpoint();
  }
  let project = loadUnderworldFGCheckpoint();
  if (options.pickedMiniboss !== undefined) {
    const first = goldenGOccurrenceId(6, 1);
    const second = goldenGOccurrenceId(6, 2);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, first),
      gameName: options.pickedMiniboss,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, second),
      gameName: options.pickedMiniboss === 'G_MiniBoss02' ? 'G_MiniBoss01' : 'G_MiniBoss02',
    });
    if (options.pickedMiniboss === 'G_MiniBoss02') {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReconcileBatchExitCapacity',
        decision: createExitDecisionAddress(goldenGBiome, source(first)),
      });
    }
  }
  if (options.prebossSource !== undefined) {
    const sourceOccurrence = goldenGOccurrenceId(7, 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, sourceOccurrence),
      gameName: options.prebossSource,
    });
    if (options.prebossSource === 'G_Combat14') {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceWithTakeoverBatch',
        decision: createExitDecisionAddress(goldenGBiome, source(sourceOccurrence)),
        gameName: 'G_PreBoss01',
        targetOccurrenceIds: {
          exit1: createOccurrenceId('golden-g-preboss-shop'),
          exit2: createOccurrenceId('golden-g-preboss-free-2'),
          exit3: createOccurrenceId('golden-g-preboss-free-3'),
        },
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(
          goldenGBiome,
          createOccurrenceId('golden-g-preboss-free-3'),
        ),
        value: { rewardType: 'HermesUpgrade' },
      });
    }
  }
  return authorRequiredTestRoomActions(authorLegalTraitOffers(project), catalog);
}

export function createGoldenFGHProject(): ProjectDocument {
  return loadUnderworldFGHCheckpoint();
}

export function createGoldenFGHIProject(): ProjectDocument {
  return loadUnderworldFGHICheckpoint();
}

interface FConversionFrontierFixture {
  readonly project: ProjectDocument;
  readonly acquisition: ReturnType<typeof createAcquisitionRoleAddress>;
  readonly unreachedAcquisition: ReturnType<typeof createAcquisitionRoleAddress>;
}

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function authorWorldShop(
  project: ProjectDocument,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): ProjectDocument {
  let next = project;
  for (const [offerKey, value] of Object.entries({
    Boon: {
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    MajorNonBoon: { rewardType: 'RoomRewardHealDrop' },
    Minor: { rewardType: 'MaxManaDrop' },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, occurrenceId, offerKey),
      value,
    });
  }
  return next;
}

function appendBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId,
  targets: readonly { readonly gameName: string; readonly offer?: ResolvedRewardOffer }[],
  occurrenceId: (exitIndex: number) => OccurrenceId,
  storeKey: 'MetaProgress' | 'RunProgress',
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, source(parentOccurrenceId));
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, decision.source),
    storeKey,
  });
  for (const [offset, target] of targets.entries()) {
    const id = occurrenceId(offset + 1);
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${offset + 1}`),
      occurrenceId: id,
      gameName: target.gameName,
    });
    if (target.offer !== undefined) {
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, id),
        value: target.offer,
      });
    }
  }
  return targets.length === 1
    ? next
    : applyProjectCommand(next, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, decision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      });
}

function createFConversionLoadoutProject(): ProjectDocument {
  let project = applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Underworld' },
    arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: {
      ...createRouteStartKeepsakeSelectionAddress('Underworld'),
    },
    keepsakeKey: 'GoldifyKeepsake',
  });
  for (const vowKey of ['BoonSkipShrineUpgrade', 'BanUnpickedBoonsShrineUpgrade'] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey,
      rank: 1,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  return project;
}

export function createFConversionFrontierProject(
  rewardType: 'GiftDrop' | 'MetaCurrencyDrop' | 'MetaCardPointsCommonDrop',
): FConversionFrontierFixture {
  const occurrenceId = goldenFOccurrenceId(1, 1);
  const reward = createIncomingRewardAddress(goldenFBiome, occurrenceId);
  let project = applyProjectCommand(createFConversionLoadoutProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType },
  });
  if (rewardType === 'GiftDrop') {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(reward, 'self'),
      value: { kind: 'random', targetTraitKey: null },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(goldenFBiome, source(occurrenceId)),
  });
  return Object.freeze({
    project: authorRequiredTestRoomActions(project, catalog),
    acquisition: createAcquisitionRoleAddress(reward, 'self'),
    unreachedAcquisition: createAcquisitionRoleAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1)),
      'self',
    ),
  });
}

export function createFInvalidLaterConversionProject(): FConversionFrontierFixture {
  const reachedReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
  const blockedReward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1));
  let project = applyProjectCommand(createFConversionLoadoutProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: reachedReward,
    value: { rewardType: 'MetaCurrencyDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: blockedReward,
    value: { rewardType: 'MetaCurrencyDrop' },
  });
  return Object.freeze({
    project: authorRequiredTestRoomActions(project, catalog),
    acquisition: createAcquisitionRoleAddress(reachedReward, 'self'),
    unreachedAcquisition: createAcquisitionRoleAddress(blockedReward, 'self'),
  });
}

export function createFMidshopPomFrontierProject(): ProjectDocument {
  const start = createOccurrenceId('midshop-pom-start');
  const batches: readonly {
    readonly storeKey: 'MetaProgress' | 'RunProgress';
    readonly targets: readonly {
      readonly gameName: string;
      readonly offer?: ResolvedRewardOffer;
    }[];
  }[] = [
    ...fBatches.slice(0, 4),
    {
      storeKey: 'MetaProgress',
      targets: [
        { gameName: 'F_Shop01' },
        { gameName: 'F_Combat11', offer: { rewardType: 'MetaCurrencyDrop' } },
      ],
    },
  ];
  let project = createProjectDocument(catalog, {
    projectId: 'midshop-pom-frontier',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenFBiome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, start),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  let parent = start;
  for (const [offset, batch] of batches.entries()) {
    const batchIndex = offset + 1;
    const occurrenceId = (exitIndex: number) =>
      batchIndex === 5 && exitIndex === 1
        ? fMidshopPomShopId
        : createOccurrenceId(`midshop-pom-b${batchIndex}-e${exitIndex}`);
    project = appendBatch(
      project,
      goldenFBiome,
      parent,
      batch.targets,
      occurrenceId,
      batch.storeKey,
    );
    parent = batchIndex === 5 ? fMidshopPomShopId : occurrenceId(1);
  }
  project = authorWorldShop(project, goldenFBiome, fMidshopPomShopId);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(goldenFBiome, fMidshopPomShopId, 'Minor'),
    value: { rewardType: 'StoreRewardRandomStack' },
  });
  project = authorRequiredTestRoomActions(authorLegalTraitOffers(project), catalog);
  return replaceTestShopOfferActions(
    project,
    catalog,
    createOccurrenceAddress(goldenFBiome, fMidshopPomShopId),
    ['Minor'],
  );
}

export function createFMidshopUnresolvedBlindBoxBeforePomProject(): ProjectDocument {
  let project = createFMidshopPomFrontierProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(goldenFBiome, fMidshopPomShopId, 'Boon'),
    value: {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'HephaestusUpgrade' },
    },
  });
  return replaceTestShopOfferActions(
    project,
    catalog,
    createOccurrenceAddress(goldenFBiome, fMidshopPomShopId),
    ['Boon'],
  );
}

export { authorTestArtificerReplacement };
export type { BiomeAddress };
