import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
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
import { authorLegalTraitOffers, replaceTestShopOfferActions } from '../shared';
import { authorTestArtificerReplacement } from '../room-actions';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
  loadUnderworldFMidshopPomFrontierCheckpoint,
} from '../checkpoints/underworld';

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

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

export function loadUnderworldFGProject(): ProjectDocument {
  return loadUnderworldFGCheckpoint();
}

/** Short F-only witness: Travel Deal refills a consequential forced Postboss Well. */
export function createUnderworldFWellCheckpoint(configuredTail = true): ProjectDocument {
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(8, 2)),
    value: { rewardType: 'WeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(8, 2)),
      'self',
    ),
    value: {
      kind: 'traits',
      giverKey: 'WeaponUpgrade',
      options: Object.freeze([
        { traitKey: 'StaffDoubleAttackTrait' },
        { traitKey: 'StaffLongAttackTrait' },
        { traitKey: 'StaffDashAttackTrait' },
      ]),
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(8, 1)),
    value: { rewardType: 'HermesUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(8, 1)),
      'self',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: Object.freeze([
        { traitKey: 'RestockBoon', rarity: 'Epic' },
        { traitKey: 'HermesWeaponBoon', rarity: 'Rare' as const },
        { traitKey: 'SprintShieldBoon', rarity: 'Common' as const },
      ]),
      selectedOptionKey: 'option1',
    },
  });
  const occurrence = createOccurrenceAddress(
    goldenFBiome,
    createOccurrenceId('golden-f-preboss-shop:postboss'),
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'SetStygianWellInteraction',
    occurrence,
    interacted: true,
  });
  for (const [slotKey, itemKey] of [
    ['healing', 'ArmorBoostStore'],
    ['secondLeft', 'TemporaryBoonRarityTrait'],
    ['secondRight', 'LimitedSwapTraitDrop'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence,
      slotKey,
      itemKey,
    });
  }
  for (const generationKey of ['initial:secondLeft', 'initial:secondRight'] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence,
      generationKey,
      purchased: true,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStygianWellTravelDealRefill',
    occurrence,
    itemKey: 'ExtendedShopTrait',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetStygianWellPurchase',
    occurrence,
    generationKey: 'travelDealRefill',
    purchased: true,
  });
  return !configuredTail
    ? project
    : Object.freeze({
        ...project,
        route: Object.freeze({
          ...project.route,
          biomes: Object.freeze(project.route.biomes.filter((biome) => biome.biomeKey === 'F')),
        }),
      });
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
  return authorLegalTraitOffers(project);
}

/**
 * Canonical F/G closure witness: the F Postboss Well buys Spark of Ixion, then
 * G takes the generated Chaos sibling and completes its newly-authored G spine.
 *
 * The G topology is authored from the F-only checkpoint rather than repaired
 * from the ordinary golden G route: Chaos changes the later G eligibility
 * frontier, so retaining that old spine would not be evidence for this route.
 */
export function createCompleteFGIxionChaosProject(): ProjectDocument {
  const well = createOccurrenceAddress(
    goldenFBiome,
    createOccurrenceId('golden-f-preboss-shop:postboss'),
  );
  let project = createUnderworldFWellCheckpoint(false);
  for (const generationKey of [
    'initial:secondLeft',
    'initial:secondRight',
    'travelDealRefill',
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey,
      purchased: false,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStygianWellOffer',
    occurrence: well,
    slotKey: 'secondLeft',
    itemKey: 'TemporaryForcedSecretDoorTrait',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetStygianWellPurchase',
    occurrence: well,
    generationKey: 'initial:secondLeft',
    purchased: true,
  });

  // Seed F remains the already-complete checkpoint. G is deliberately fresh:
  // commands below are the same authoring surface a user exercises.
  project = applyProjectCommand(project, catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 2,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenGBiome,
    occurrenceId: goldenGStartId,
  });

  const batches = [
    { sourceId: goldenGStartId, targets: ['G_Combat01'], store: 'RunProgress' as const },
    {
      sourceId: goldenGOccurrenceId(1, 1),
      targets: ['G_Combat02', 'G_Combat03'],
      store: 'MetaProgress' as const,
    },
    {
      sourceId: goldenGOccurrenceId(2, 1),
      targets: ['G_Combat04', 'G_Combat05', 'G_Combat06'],
      store: 'RunProgress' as const,
    },
    {
      sourceId: goldenGOccurrenceId(3, 1),
      targets: ['G_Combat06', 'G_Combat07'],
      store: 'RunProgress' as const,
    },
    {
      sourceId: goldenGOccurrenceId(4, 1),
      targets: ['G_Shop01', 'G_Combat09'],
      store: 'RunProgress' as const,
    },
    {
      sourceId: goldenGOccurrenceId(5, 1),
      targets: ['G_MiniBoss01', 'G_MiniBoss02'],
      store: 'MetaProgress' as const,
    },
    {
      sourceId: goldenGOccurrenceId(6, 1),
      targets: ['G_Combat12', 'G_Combat13'],
      store: 'MetaProgress' as const,
    },
  ];
  for (const [offset, batch] of batches.entries()) {
    const source = { kind: 'occurrence' as const, occurrenceId: batch.sourceId };
    const batchIndex = offset + 1;
    if (offset > 0) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateBatch',
        decision: createExitDecisionAddress(goldenGBiome, source),
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenGBiome, source),
      storeKey: batch.store,
    });
    for (const [targetOffset, gameName] of batch.targets.entries()) {
      const exitIndex = targetOffset + 1;
      const occurrenceId = goldenGOccurrenceId(batchIndex, exitIndex);
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(goldenGBiome, source, `exit${exitIndex}`),
        occurrenceId,
        gameName,
      });
      const value =
        batchIndex === 1
          ? {
              rewardType: 'Boon' as const,
              payload: { kind: 'BoonSource' as const, source: 'HeraUpgrade' as const },
            }
          : batch.store === 'MetaProgress'
            ? targetOffset === 0
              ? { rewardType: 'MetaCurrencyBigDrop' as const }
              : { rewardType: 'MetaCardPointsCommonBigDrop' as const }
            : batchIndex === 4
              ? targetOffset === 0
                ? { rewardType: 'SpellDrop' as const }
                : { rewardType: 'StackUpgrade' as const }
              : targetOffset === 0
                ? { rewardType: 'MaxManaDrop' as const }
                : targetOffset === 1
                  ? { rewardType: 'RoomMoneyDrop' as const }
                  : { rewardType: 'MaxHealthDrop' as const };
      if (gameName.startsWith('G_MiniBoss')) {
        const source = gameName === 'G_MiniBoss01' ? 'HestiaUpgrade' : 'ZeusUpgrade';
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(goldenGBiome, occurrenceId),
          value: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source },
          },
        });
      } else if (gameName !== 'G_Shop01') {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(goldenGBiome, occurrenceId),
          value,
        });
      }
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
  }
  const finalSource = { kind: 'occurrence' as const, occurrenceId: goldenGOccurrenceId(7, 1) };
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenGBiome, finalSource),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceWithTakeoverBatch',
    decision: createExitDecisionAddress(goldenGBiome, finalSource),
    gameName: 'G_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('ixion-chaos-g-preboss-shop'),
      exit2: createOccurrenceId('ixion-chaos-g-preboss-free-2'),
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      goldenGBiome,
      createOccurrenceId('ixion-chaos-g-preboss-free-2'),
    ),
    value: { rewardType: 'MaxManaDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, finalSource),
    value: { kind: 'normal', exitKey: 'exit1' },
  });

  for (const shop of [
    goldenGOccurrenceId(5, 1),
    createOccurrenceId('ixion-chaos-g-preboss-shop'),
  ]) {
    for (const [offerKey, value] of Object.entries({
      Boon: {
        rewardType: 'RandomLoot' as const,
        payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' as const },
      },
      MajorNonBoon: { rewardType: 'WeaponUpgradeDrop' as const },
      Minor: { rewardType: 'MaxManaDrop' as const },
    })) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(goldenGBiome, shop, offerKey),
        value,
      });
    }
  }

  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: goldenGStartId,
    }),
    value: { kind: 'additional', additionalExitKey: 'chaos' },
  });
  const chaosOccurrenceId = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((occurrence) =>
      occurrence.gameName.startsWith('Chaos_'),
    )?.occurrenceId;
  if (chaosOccurrenceId === undefined)
    throw new Error('Ixion did not create the G Chaos occurrence');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenGBiome, chaosOccurrenceId),
      'self',
    ),
    value: {
      kind: 'chaos',
      giverKey: 'Chaos',
      curseOptions: [
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosHealthCurse', requirementCount: 3 },
        { curseKey: 'ChaosDamageCurse', requirementCount: 3 },
      ],
      selectedOptionKey: 'option1',
      selectedCurseValues: {},
      blessingKey: 'ChaosWeaponBlessing',
      rarity: 'Common',
      blessingValues: { damageBonus: 0.2 },
    },
  });
  return authorLegalTraitOffers(project);
}

export interface GContractAvailabilityFixture {
  readonly project: ProjectDocument;
  readonly laterShop: OccurrenceId;
}

/**
 * Two reached G Midshops with an earlier Contract either entered or skipped.
 * Shared by the engine capability and workspace-presence witnesses.
 */
export function createGContractAvailabilityProject(
  enterEarlierContract: boolean,
): GContractAvailabilityFixture {
  const firstShop = goldenGOccurrenceId(5, 1);
  const firstContract = createOccurrenceId(
    `contract-availability-first-${enterEarlierContract ? 'entered' : 'skipped'}`,
  );
  const laterShop = createOccurrenceId(
    `contract-availability-later-${enterEarlierContract ? 'entered' : 'skipped'}`,
  );
  const firstNormalTarget = enterEarlierContract
    ? createOccurrenceId('contract-availability-normal-entered')
    : laterShop;
  const firstSibling = createOccurrenceId(
    `contract-availability-sibling-${enterEarlierContract ? 'entered' : 'skipped'}`,
  );
  const firstSource = source(firstShop);
  const contractSource = source(firstContract);
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(goldenGBiome, firstSource),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional: createAdditionalExitAddress(goldenGBiome, firstShop, 'zagreusContract'),
    occurrenceId: firstContract,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenGBiome, firstSource),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenGBiome, firstSource, 'exit1'),
    occurrenceId: firstNormalTarget,
    gameName: enterEarlierContract ? 'G_Combat12' : 'G_Shop01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenGBiome, firstSource, 'exit2'),
    occurrenceId: firstSibling,
    gameName: 'G_Combat12',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, firstSource),
    value: enterEarlierContract
      ? { kind: 'additional', additionalExitKey: 'zagreusContract' }
      : { kind: 'normal', exitKey: 'exit1' },
  });
  if (enterEarlierContract) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(goldenGBiome, contractSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenGBiome, contractSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenGBiome, contractSource, 'exit1'),
      occurrenceId: laterShop,
      gameName: 'G_Shop01',
    });
  }
  for (const [offerKey, value] of Object.entries({
    Boon: {
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    MajorNonBoon: { rewardType: 'WeaponUpgradeDrop' },
    Minor: { rewardType: 'MaxManaDrop' },
  })) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenGBiome, laterShop, offerKey),
      value,
    });
  }
  return Object.freeze({ project, laterShop });
}

/** Short F/G witness: the F Postboss Pool sells one of its realized traits. */
export function createUnderworldFPoolCheckpoint(): ProjectDocument {
  let project = createCompleteFGProject();
  const occurrenceId = createOccurrenceId('golden-f-preboss-shop:postboss');
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPurgingPoolInteraction',
    occurrence: createOccurrenceAddress(goldenFBiome, occurrenceId),
    interacted: true,
  });
  const pool = project.route.biomes
    .find((biome) => biome.biomeKey === 'F')
    ?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === occurrenceId,
    )?.purgingPool;
  const traitKey = pool?.traitKeyBySlot.left;
  if (traitKey === null || traitKey === undefined)
    throw new Error('complete F Pool fixture requires a resolved left slot');
  const reference = Object.freeze({
    kind: 'sellPurgingPoolTrait' as const,
    slotKey: 'left' as const,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(goldenFBiome, occurrenceId, roomActionKey(reference)),
    reference,
    index: 1,
  });
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

function createFConversionLoadoutProject(): ProjectDocument {
  let project = applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Underworld' },
    arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: { ...createRouteStartKeepsakeSelectionAddress('Underworld') },
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
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, goldenFStartId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
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
    project,
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
    project,
    acquisition: createAcquisitionRoleAddress(reachedReward, 'self'),
    unreachedAcquisition: createAcquisitionRoleAddress(blockedReward, 'self'),
  });
}

export function loadUnderworldFMidshopPomFrontierProject(): ProjectDocument {
  return loadUnderworldFMidshopPomFrontierCheckpoint();
}

export function createFMidshopUnresolvedBlindBoxBeforePomProject(): ProjectDocument {
  let project = loadUnderworldFMidshopPomFrontierCheckpoint();
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
export {
  loadNemesisFieldsCheckpoint,
  loadNemesisTraitTradeCheckpoint,
} from '../checkpoints/underworld';
export type { BiomeAddress, ResolvedRewardOffer };
