import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionRoleAddress,
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
  createRouteAddress,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { authorLegalTraitOffers } from './trait-offers';

export const goldenFBiome = createBiomeAddress('Underworld', 'F');
export const goldenGBiome = createBiomeAddress('Underworld', 'G');
export const goldenHBiome = createBiomeAddress('Underworld', 'H');
export const goldenIBiome = createBiomeAddress('Underworld', 'I');
export const goldenFStartId = createOccurrenceId('golden-f-start');
export const fMidshopPomShopId = createOccurrenceId('midshop-pom-b5-e1');
export const goldenGStartId = createOccurrenceId('golden-g-intro');
export const goldenHStartId = createOccurrenceId('golden-h-intro');
export const goldenIStartId = createOccurrenceId('golden-i-intro');

interface TargetSpec {
  readonly gameName: string;
  readonly offer?: ResolvedRewardOffer;
}

interface BatchSpec {
  readonly storeKey: 'MetaProgress' | 'RunProgress';
  readonly targets: readonly TargetSpec[];
}

export interface GoldenGProjectOptions {
  readonly pickedMiniboss?: 'G_MiniBoss01' | 'G_MiniBoss02';
  readonly prebossSource?: 'G_Combat12' | 'G_Combat14';
}

const completeFGCache = new Map<string, ProjectDocument>();
let goldenFGHCache: ProjectDocument | undefined;
let goldenFGHICache: ProjectDocument | undefined;

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
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'F_Combat06', offer: { rewardType: 'MetaCardPointsCommonDrop' } },
      { gameName: 'F_Combat06', offer: { rewardType: 'MetaCurrencyDrop' } },
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      {
        gameName: 'F_MiniBoss01',
        offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
      },
      {
        gameName: 'F_MiniBoss02',
        offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
      },
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [{ gameName: 'F_Combat11', offer: { rewardType: 'MaxManaDrop' } }],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      { gameName: 'F_Combat12', offer: { rewardType: 'WeaponUpgrade' } },
      { gameName: 'F_Combat12', offer: { rewardType: 'HermesUpgrade' } },
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'F_Combat14', offer: { rewardType: 'MetaCardPointsCommonDrop' } },
      { gameName: 'F_Combat14', offer: { rewardType: 'GiftDrop' } },
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      { gameName: 'F_Combat15', offer: { rewardType: 'RoomMoneyDrop' } },
      { gameName: 'F_Combat15', offer: { rewardType: 'SpellDrop' } },
    ],
  },
];

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function authorWorldShop(
  project: ProjectDocument,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  profileKey: 'WorldShop' | 'I_WorldShop' = 'WorldShop',
): ProjectDocument {
  const offers: Readonly<Record<string, ResolvedRewardOffer>> =
    profileKey === 'WorldShop'
      ? {
          Boon: {
            rewardType: 'RandomLoot',
            payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
          },
          MajorNonBoon: { rewardType: 'RoomRewardHealDrop' },
          Minor: { rewardType: 'MaxManaDrop' },
        }
      : {
          BoostedBoon: { rewardType: 'StackUpgradeBig' },
          MixedProgress: { rewardType: 'MaxHealthDrop' },
          Survival: { rewardType: 'HealBigDrop' },
          PremiumProgress: { rewardType: 'MaxHealthDropBig' },
          MetaProgress: { rewardType: 'CardUpgradePointsDrop' },
        };
  let next = project;
  for (const [offerKey, value] of Object.entries(offers)) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, occurrenceId, offerKey),
      value,
    });
  }
  return next;
}

function applyBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  occurrenceId: (exitIndex: number) => OccurrenceId,
  batch: BatchSpec,
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, source(sourceOccurrenceId));
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, decision.source),
    storeKey: batch.storeKey,
  });
  for (const [offset, target] of batch.targets.entries()) {
    const exitIndex = offset + 1;
    const id = occurrenceId(exitIndex);
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${exitIndex}`),
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
  return batch.targets.length === 1
    ? next
    : applyProjectCommand(next, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, decision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      });
}

export function goldenFOccurrenceId(batchIndex: number, exitIndex: number): OccurrenceId {
  return createOccurrenceId(`golden-f-b${batchIndex}-e${exitIndex}`);
}

export function goldenGOccurrenceId(batchIndex: number, exitIndex: number): OccurrenceId {
  return createOccurrenceId(`golden-g-b${batchIndex}-e${exitIndex}`);
}

interface FConversionFrontierFixture {
  readonly project: ProjectDocument;
  readonly acquisition: ReturnType<typeof createAcquisitionRoleAddress>;
  readonly unreachedAcquisition: ReturnType<typeof createAcquisitionRoleAddress>;
}

function createFConversionLoadoutProject(): ProjectDocument {
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: createRouteAddress('Underworld'),
    arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'GoldifyKeepsake',
  });
  for (const vowKey of ['BoonSkipShrineUpgrade', 'BanUnpickedBoonsShrineUpgrade'] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey,
      rank: 1,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  return project;
}

/** Reached F metaprogression pickup followed by an unresolved outgoing frontier. */
export function createFConversionFrontierProject(
  rewardType: 'GiftDrop' | 'MetaCurrencyDrop' | 'MetaCardPointsCommonDrop',
): FConversionFrontierFixture {
  const occurrenceId = goldenFOccurrenceId(1, 1);
  const reward = createIncomingRewardAddress(goldenFBiome, occurrenceId);
  let project = createFConversionLoadoutProject();
  project = applyProjectCommand(project, catalog, {
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
    project,
    acquisition: createAcquisitionRoleAddress(reward, 'self'),
    unreachedAcquisition: createAcquisitionRoleAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1)),
      'self',
    ),
  });
}

/** Reached Bones conversion contact followed by an invalid RunProgress Bones offer. */
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
    project,
    acquisition: createAcquisitionRoleAddress(reachedReward, 'self'),
    unreachedAcquisition: createAcquisitionRoleAddress(blockedReward, 'self'),
  });
}

/** Retained test-only identity helper for the F/G progressive fixture. */
export function targetOccurrenceId(
  biomeKey: 'F' | 'G',
  batchIndex: number,
  exitIndex: number,
): OccurrenceId {
  return biomeKey === 'F'
    ? goldenFOccurrenceId(batchIndex, exitIndex)
    : goldenGOccurrenceId(batchIndex, exitIndex);
}

function createCompleteFProject(): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'golden-fg',
    name: 'Golden F/G route',
    configuredBiomeCounts: { Underworld: 2 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenFBiome,
    occurrenceId: goldenFStartId,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  let parent = goldenFStartId;
  for (const [offset, batch] of fBatches.entries()) {
    const batchIndex = offset + 1;
    project = applyBatch(
      project,
      goldenFBiome,
      parent,
      (exitIndex) => goldenFOccurrenceId(batchIndex, exitIndex),
      batch,
    );
    parent = goldenFOccurrenceId(batchIndex, 1);
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(goldenFBiome, source(parent)),
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('golden-f-preboss-shop'),
      exit2: createOccurrenceId('golden-f-preboss-free'),
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-preboss-free')),
    value: { rewardType: 'StackUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, source(parent)),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  return authorWorldShop(project, goldenFBiome, createOccurrenceId('golden-f-preboss-shop'));
}

/** Selected F Midshop with a purchased-Pom-ready inventory and no outgoing decision yet. */
export function createFMidshopPomFrontierProject(): ProjectDocument {
  const start = createOccurrenceId('midshop-pom-start');
  const batches: readonly BatchSpec[] = Object.freeze([
    ...fBatches.slice(0, 4),
    {
      storeKey: 'MetaProgress',
      targets: [
        { gameName: 'F_Shop01' },
        { gameName: 'F_Combat11', offer: { rewardType: 'MetaCurrencyDrop' } },
      ],
    },
  ]);
  let project = createProjectDocument(catalog, {
    projectId: 'midshop-pom-frontier',
    name: 'Midshop Pom frontier',
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
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  let parent = start;
  for (const [offset, batch] of batches.entries()) {
    const batchIndex = offset + 1;
    project = applyBatch(
      project,
      goldenFBiome,
      parent,
      (exitIndex) =>
        batchIndex === 5 && exitIndex === 1
          ? fMidshopPomShopId
          : createOccurrenceId(`midshop-pom-b${batchIndex}-e${exitIndex}`),
      batch,
    );
    parent =
      batchIndex === 5 ? fMidshopPomShopId : createOccurrenceId(`midshop-pom-b${batchIndex}-e1`);
  }
  project = authorWorldShop(project, goldenFBiome, fMidshopPomShopId);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(goldenFBiome, fMidshopPomShopId, 'Minor'),
    value: { rewardType: 'StoreRewardRandomStack' },
  });
  return authorLegalTraitOffers(project);
}

function gBatches(options: GoldenGProjectOptions): readonly BatchSpec[] {
  const pickedMiniboss = options.pickedMiniboss ?? 'G_MiniBoss01';
  const prebossSource = options.prebossSource ?? 'G_Combat12';
  return [
    {
      storeKey: 'RunProgress',
      targets: [
        {
          gameName: 'G_Combat01',
          offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
        },
      ],
    },
    {
      storeKey: 'MetaProgress',
      targets: [
        { gameName: 'G_Combat02', offer: { rewardType: 'MetaCurrencyBigDrop' } },
        { gameName: 'G_Combat02', offer: { rewardType: 'MetaCardPointsCommonBigDrop' } },
      ],
    },
    {
      storeKey: 'RunProgress',
      targets: [
        { gameName: 'G_Story01' },
        { gameName: 'G_Combat03', offer: { rewardType: 'MaxManaDrop' } },
        { gameName: 'G_Combat03', offer: { rewardType: 'RoomMoneyDrop' } },
      ],
    },
    {
      storeKey: 'MetaProgress',
      targets: [{ gameName: 'G_Combat10', offer: { rewardType: 'MetaCardPointsCommonBigDrop' } }],
    },
    {
      storeKey: 'RunProgress',
      targets: [
        { gameName: 'G_Shop01' },
        { gameName: 'G_Combat12', offer: { rewardType: 'StackUpgrade' } },
      ],
    },
    {
      storeKey: 'RunProgress',
      targets:
        pickedMiniboss === 'G_MiniBoss02'
          ? [
              {
                gameName: 'G_MiniBoss02',
                offer: {
                  rewardType: 'Boon',
                  payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
                },
              },
              {
                gameName: 'G_MiniBoss01',
                offer: {
                  rewardType: 'Boon',
                  payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
                },
              },
            ]
          : [
              {
                gameName: 'G_MiniBoss01',
                offer: {
                  rewardType: 'Boon',
                  payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
                },
              },
              {
                gameName: 'G_MiniBoss02',
                offer: {
                  rewardType: 'Boon',
                  payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
                },
              },
            ],
    },
    {
      storeKey: 'RunProgress',
      targets:
        pickedMiniboss === 'G_MiniBoss02'
          ? [
              {
                gameName: prebossSource,
                offer: {
                  rewardType: 'Boon',
                  payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
                },
              },
            ]
          : [
              {
                gameName: prebossSource,
                offer: {
                  rewardType: 'Boon',
                  payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
                },
              },
              { gameName: 'G_Combat13', offer: { rewardType: 'RoomMoneyDrop' } },
            ],
    },
  ];
}

function createCompleteFGProjectRaw(options: GoldenGProjectOptions = {}): ProjectDocument {
  let project = createCompleteFProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenGBiome,
    occurrenceId: goldenGStartId,
  });
  let parent = goldenGStartId;
  const batches = gBatches(options);
  for (const [offset, batch] of batches.entries()) {
    const batchIndex = offset + 1;
    project = applyBatch(
      project,
      goldenGBiome,
      parent,
      (exitIndex) => goldenGOccurrenceId(batchIndex, exitIndex),
      batch,
    );
    if (batch.targets[0]?.gameName === 'G_Shop01') {
      project = authorWorldShop(project, goldenGBiome, goldenGOccurrenceId(batchIndex, 1));
    }
    parent = goldenGOccurrenceId(batchIndex, 1);
  }
  const prebossSourceRoom = catalog.rooms.byKey[batches.at(-1)?.targets[0]?.gameName ?? ''];
  if (prebossSourceRoom === undefined)
    throw new Error('Golden G fixture has no Preboss source room');
  const targetOccurrenceIds = Object.fromEntries(
    prebossSourceRoom.exits.map((exit) => [
      `exit${exit.index}`,
      createOccurrenceId(
        exit.index === 1 ? 'golden-g-preboss-shop' : `golden-g-preboss-free-${exit.index}`,
      ),
    ]),
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(goldenGBiome, source(parent)),
    gameName: 'G_PreBoss01',
    targetOccurrenceIds,
  });
  for (const exit of prebossSourceRoom.exits.filter((candidate) => candidate.index > 1)) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(
        goldenGBiome,
        createOccurrenceId(`golden-g-preboss-free-${exit.index}`),
      ),
      value: { rewardType: exit.index === 2 ? 'StackUpgrade' : 'HermesUpgrade' },
    });
  }
  if (prebossSourceRoom.exits.length > 1) {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, source(parent)),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
  }
  return authorWorldShop(project, goldenGBiome, createOccurrenceId('golden-g-preboss-shop'));
}

export function createCompleteFGProject(options: GoldenGProjectOptions = {}): ProjectDocument {
  const key = JSON.stringify(options);
  const cached = completeFGCache.get(key);
  if (cached !== undefined) return cached;
  const normalized = authorLegalTraitOffers(createCompleteFGProjectRaw(options));
  completeFGCache.set(key, normalized);
  return normalized;
}

interface UnstoredTargetSpec {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
}

function appendUnstoredBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  targets: readonly UnstoredTargetSpec[],
  options: { readonly fieldsCageOutcome?: 'min' | 'max'; readonly selectedExitKey?: string } = {},
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, source(sourceOccurrenceId));
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (options.fieldsCageOutcome !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: options.fieldsCageOutcome,
    });
  }
  for (const [offset, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${offset + 1}`),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  if (targets.length === 1) return next;
  return applyProjectCommand(next, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, decision.source),
    value: { kind: 'normal', exitKey: options.selectedExitKey ?? 'exit1' },
  });
}

function extendUnderworldPrefix(
  project: ProjectDocument,
  configuredBiomeCount: number,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount,
  });
}

function appendCompleteH(project: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(extendUnderworldPrefix(project, 3), catalog, {
    kind: 'CreateStart',
    biome: goldenHBiome,
    occurrenceId: goldenHStartId,
  });
  const combat02 = createOccurrenceId('golden-h-combat02');
  const combat09 = createOccurrenceId('golden-h-combat09');
  const miniBoss = createOccurrenceId('golden-h-miniboss01');
  const bridge = createOccurrenceId('golden-h-bridge01');
  const combat05 = createOccurrenceId('golden-h-combat05');
  next = appendUnstoredBatch(
    next,
    goldenHBiome,
    goldenHStartId,
    [{ occurrenceId: combat02, gameName: 'H_Combat02' }],
    { fieldsCageOutcome: 'min' },
  );
  next = appendUnstoredBatch(
    next,
    goldenHBiome,
    combat02,
    [
      { occurrenceId: combat09, gameName: 'H_Combat09' },
      { occurrenceId: createOccurrenceId('golden-h-combat03'), gameName: 'H_Combat03' },
    ],
    { fieldsCageOutcome: 'min' },
  );
  next = appendUnstoredBatch(
    next,
    goldenHBiome,
    combat09,
    [
      { occurrenceId: miniBoss, gameName: 'H_MiniBoss01' },
      { occurrenceId: bridge, gameName: 'H_Bridge01' },
    ],
    { fieldsCageOutcome: 'max' },
  );
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenHBiome, miniBoss),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
    },
  });
  next = appendUnstoredBatch(
    next,
    goldenHBiome,
    miniBoss,
    [
      { occurrenceId: combat05, gameName: 'H_Combat05' },
      { occurrenceId: createOccurrenceId('golden-h-combat04'), gameName: 'H_Combat04' },
    ],
    { fieldsCageOutcome: 'max' },
  );
  const cageOffers: readonly (readonly [OccurrenceId, readonly ResolvedRewardOffer[]])[] = [
    [
      combat02,
      [
        { rewardType: 'MaxHealthDrop' },
        { rewardType: 'MaxManaDrop' },
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
      ],
    ],
    [
      combat09,
      [
        { rewardType: 'HermesUpgrade' },
        { rewardType: 'WeaponUpgrade' },
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
      ],
    ],
    [
      createOccurrenceId('golden-h-combat03'),
      [
        { rewardType: 'MaxHealthDrop' },
        { rewardType: 'SpellDrop' },
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
      ],
    ],
    [
      combat05,
      [
        { rewardType: 'StackUpgrade' },
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
      ],
    ],
    [
      createOccurrenceId('golden-h-combat04'),
      [
        { rewardType: 'MaxManaDrop' },
        { rewardType: 'RoomMoneyDrop' },
        { rewardType: 'MaxHealthDrop' },
      ],
    ],
  ];
  for (const [occurrenceId, offers] of cageOffers) {
    for (const [index, value] of offers.entries()) {
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(goldenHBiome, occurrenceId, 'cages', `cage${index + 1}`),
        value,
      });
    }
  }
  const optionalOffers: readonly (readonly [OccurrenceId, readonly ResolvedRewardOffer[]])[] = [
    [combat02, [{ rewardType: 'MaxManaDropSmall' }, { rewardType: 'MaxManaDropSmall' }]],
    [combat09, [{ rewardType: 'MaxHealthDropSmall' }, { rewardType: 'MaxHealthDropSmall' }]],
    [combat05, [{ rewardType: 'RoomMoneyTinyDrop' }, { rewardType: 'RoomMoneyTinyDrop' }]],
  ];
  for (const [occurrenceId, offers] of optionalOffers) {
    for (const [index, value] of offers.entries()) {
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          goldenHBiome,
          occurrenceId,
          'optionalRewards',
          `optional${index + 1}`,
        ),
        value,
      });
    }
  }
  const prebossDecision = createExitDecisionAddress(goldenHBiome, source(combat05));
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: prebossDecision,
    gameName: 'H_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('golden-h-preboss-shop'),
      exit2: createOccurrenceId('golden-h-preboss-free'),
    },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenHBiome, createOccurrenceId('golden-h-preboss-free')),
    value: { rewardType: 'StackUpgrade' },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenHBiome, prebossDecision.source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  return authorWorldShop(next, goldenHBiome, createOccurrenceId('golden-h-preboss-shop'));
}

function appendCompleteI(project: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(extendUnderworldPrefix(project, 4), catalog, {
    kind: 'CreateStart',
    biome: goldenIBiome,
    occurrenceId: goldenIStartId,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBiomeField',
    field: createBiomeFieldAddress(goldenIBiome, 'maxNonGoalRewards'),
    value: 3,
  });
  const combat01 = createOccurrenceId('golden-i-combat01');
  const combat03 = createOccurrenceId('golden-i-combat03');
  const combat05 = createOccurrenceId('golden-i-combat05');
  const combat06 = createOccurrenceId('golden-i-combat06');
  const combat09 = createOccurrenceId('golden-i-combat09');
  next = appendUnstoredBatch(next, goldenIBiome, goldenIStartId, [
    { occurrenceId: combat01, gameName: 'I_Combat01' },
  ]);
  next = appendUnstoredBatch(next, goldenIBiome, combat01, [
    { occurrenceId: combat03, gameName: 'I_Combat03' },
    { occurrenceId: createOccurrenceId('golden-i-story01'), gameName: 'I_Story01' },
  ]);
  next = appendUnstoredBatch(next, goldenIBiome, combat03, [
    { occurrenceId: combat05, gameName: 'I_Combat05' },
    { occurrenceId: createOccurrenceId('golden-i-combat02'), gameName: 'I_Combat02' },
  ]);
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenIBiome, createOccurrenceId('golden-i-combat02')),
    value: { rewardType: 'RoomMoneyTripleDrop' },
  });
  next = appendUnstoredBatch(next, goldenIBiome, combat05, [
    { occurrenceId: combat06, gameName: 'I_Combat06' },
  ]);
  next = appendUnstoredBatch(next, goldenIBiome, combat06, [
    { occurrenceId: combat09, gameName: 'I_Combat09' },
  ]);
  next = appendUnstoredBatch(next, goldenIBiome, combat09, [
    { occurrenceId: createOccurrenceId('golden-i-preboss'), gameName: 'I_PreBoss02' },
    { occurrenceId: createOccurrenceId('golden-i-miniboss01'), gameName: 'I_MiniBoss01' },
  ]);
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenIBiome, createOccurrenceId('golden-i-miniboss01')),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  for (const [occurrenceId, encounterKey] of [
    [combat01, 'GeneratedI_GoalReward'],
    [combat03, 'GeneratedI_Small_GoalReward'],
    [combat05, 'GeneratedI_Small_GoalReward'],
    [combat06, 'GeneratedI_GoalReward'],
    [combat09, 'GeneratedI_GoalReward'],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenIBiome,
        { kind: 'occurrence', occurrenceId },
        'Encounter',
      ),
      encounterKey,
    });
  }
  return authorWorldShop(next, goldenIBiome, createOccurrenceId('golden-i-preboss'), 'I_WorldShop');
}

/** Complete F-through-H authored-project fixture. */
export function createGoldenFGHProject(): ProjectDocument {
  if (goldenFGHCache !== undefined) return goldenFGHCache;
  goldenFGHCache = authorLegalTraitOffers(appendCompleteH(createCompleteFGProjectRaw()));
  return goldenFGHCache;
}

/** Complete Underworld authored-project fixture. */
export function createGoldenFGHIProject(): ProjectDocument {
  if (goldenFGHICache !== undefined) return goldenFGHICache;
  goldenFGHICache = authorLegalTraitOffers(appendCompleteI(createGoldenFGHProject()));
  return goldenFGHICache;
}
