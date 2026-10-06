import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAdditionalExitAddress,
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createFigurineArcanaAddress,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createJudgmentArcanaAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type AuthoredNemesisRandomEventOutcome,
  type NemesisRandomEventAddress,
  createRouteStartKeepsakeSelectionAddress,
  createRouteAddress,
  deriveRouteLoadout,
  createStartingRewardAddress,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  type AuthoredAnvilResult,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  authorLegalTraitOffers,
  replaceTestRoomActionOrder,
  replaceTestShopOfferActions,
} from '../shared';
import { authorTestArtificerReplacement } from '../room-actions';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
  loadUnderworldFMidshopPomFrontierCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldIxionChaosCheckpoint,
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

/** Test fixture convenience for the two-step phase-family and interaction contract. */
export function replaceNemesisRandomEventInteraction(
  project: ProjectDocument,
  event: NemesisRandomEventAddress,
  value: AuthoredNemesisRandomEventOutcome,
  reward: ResolvedRewardOffer | null,
): ProjectDocument {
  const selected = applyProjectCommand(project, catalog, {
    kind: 'SelectNemesisRandomEventFamily',
    event,
    family: value.kind,
  });
  return applyProjectCommand(selected, catalog, {
    kind: 'ReplaceNemesisRandomEventInteraction',
    event,
    value: Object.freeze({ ...value, reward }),
  });
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

function withUnstartedBiome(project: ProjectDocument, biomeKey: string): ProjectDocument {
  return decodeProjectDocument(
    {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((biome) =>
          biome.biomeKey === biomeKey ? { ...biome, topology: null } : biome,
        ),
      },
    },
    catalog,
  );
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

/** Purchased F World Shop Travel Deal with its acquired replacement reward. */
export function underworldWorldShopTravelDealProject(): ProjectDocument {
  const shopId = createOccurrenceId('golden-f-preboss-shop');
  const shop = createOccurrenceAddress(goldenFBiome, shopId);
  const refill = createShopOfferAddress(goldenFBiome, shopId, 'travelDealRefill');
  let project = applyProjectCommand(loadUnderworldFStygianWellCheckpoint(), catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(goldenFBiome, shopId, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
  project = replaceTestShopOfferActions(project, catalog, shop, ['MajorNonBoon']);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: refill,
    value: { rewardType: 'ArmorBoost' },
  });
  const reference = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: 'roomExit' as const,
    entryKey: 'travelDealRefill',
  };
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(goldenFBiome, shopId, roomActionKey(reference)),
    reference,
    index: 1,
  });
  return authorLegalTraitOffers(project);
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

/** Complete F/G route with a declaration-derived G Anomaly and hidden return. */
export function createCompleteFGAnomalyProject(success = true): ProjectDocument {
  const sourceOccurrenceId = goldenGOccurrenceId(2, 1);
  const anomalyOccurrenceId = goldenGOccurrenceId(3, 2);
  const source = { kind: 'occurrence' as const, occurrenceId: sourceOccurrenceId };
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, source),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(goldenGBiome, source, 'exit2'),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceAnomalySuccess',
    occurrence: createOccurrenceAddress(goldenGBiome, anomalyOccurrenceId),
    success,
  });
}

export const anomalyRosterPhase = createEncounterPhaseAddress(
  goldenGBiome,
  { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(3, 2) },
  'Encounter',
);
export const anomalyRosterTypeKeys = Object.freeze([
  'SpreadShotUnit_Elite',
  'SpreadShotUnit',
  'BloodlessPitcher',
]);

/** Successful G Anomaly with its native-realizable ordered infinite roster and return. */
export function anomalyRosterProject(
  typeKeys: readonly string[] = anomalyRosterTypeKeys,
): ProjectDocument {
  return applyProjectCommand(createCompleteFGAnomalyProject(), catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: anomalyRosterPhase,
    decisionKey: 'infiniteRoster',
    value: { kind: 'infiniteRoster', typeKeys },
  });
}

export const arachneCocoonPhases = Object.freeze({
  F: createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
    'Encounter',
  ),
  G: createEncounterPhaseAddress(
    goldenGBiome,
    { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(4, 1) },
    'Encounter',
  ),
});

/** Entered F/G Arachne combats: both choices in F, native count with a point in G. */
export function underworldArachneCocoonProject(): ProjectDocument {
  let project = createCompleteFGProject();
  for (const [biomeKey, encounterKey] of [
    ['F', 'ArachneCombatF'],
    ['G', 'ArachneCombatG'],
  ] as const)
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: arachneCocoonPhases[biomeKey],
      encounterKey,
    });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: arachneCocoonPhases.F,
    decisionKey: 'cocoonCount',
    value: { kind: 'cocoonCount', count: 11 },
  });
  for (const biomeKey of ['F', 'G'] as const) {
    const phase = arachneCocoonPhases[biomeKey];
    const host = project.route.biomes
      .find((biome) => biome.biomeKey === biomeKey)!
      .topology!.occurrences.find((room) => room.occurrenceId === phase.owner.occurrenceId)!;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'cocoonRewardPoint',
      value: {
        kind: 'cocoonRewardPoint',
        spawnPointId: catalog.rooms.byKey[host.gameName]!.cocoonRewardPointIds![0]!,
      },
    });
  }
  return project;
}

/** Reached Fateful Twist and rival Scylla choice on the settled F/G Ixion route. */
export function underworldTwistScyllaProject(): ProjectDocument {
  const well = createOccurrenceAddress(
    goldenFBiome,
    createOccurrenceId('golden-f-preboss-shop:postboss'),
  );
  let project = applyProjectCommand(loadUnderworldIxionChaosCheckpoint(), catalog, {
    kind: 'ReplaceStygianWellOffer',
    occurrence: well,
    slotKey: 'secondRight',
    itemKey: 'RandomStoreItem',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetStygianWellPurchase',
    occurrence: well,
    generationKey: 'initial:secondRight',
    purchased: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStygianWellTwistResult',
    occurrence: well,
    generationKey: 'initial:secondRight',
    itemKey: 'TemporaryBoonRarityTrait',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFearVowRank',
    route: createRouteAddress('Underworld'),
    vowKey: 'BossDifficultyShrineUpgrade',
    rank: 2,
  });
  const boss = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'G_Boss02');
  if (boss === undefined) throw new Error('Twist Scylla fixture lacks the rival G Boss');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: boss.occurrenceId },
      'Encounter',
    ),
    decisionKey: 'featuredPerformer',
    value: { kind: 'single', choiceKey: 'charybdis' },
  });
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
  project = withUnstartedBiome(project, 'G');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenGBiome,
    occurrenceId: goldenGStartId,
  });

  const batches = [
    // The run-wide ledger is saturated high entering G (12 entered /
    // 3 meta, selection 1.35), so the opening batch is a Meta batch.
    { sourceId: goldenGStartId, targets: ['G_Combat01'], store: 'MetaProgress' as const },
    {
      sourceId: goldenGOccurrenceId(1, 1),
      targets: ['G_Combat02', 'G_Combat18'],
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
      // Still saturated high at this point (15 entered / 4 meta, selection 1.18).
      store: 'MetaProgress' as const,
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
      // The opening batch's hardcoded Boon is gone with the run-scoped ratio:
      // a Meta bag carries no Boon, so every Meta batch draws Meta entries and
      // the fourth batch takes the two the earlier ones left.
      const value =
        batch.store === 'MetaProgress'
          ? batchIndex === 4
            ? targetOffset === 0
              ? { rewardType: 'MetaCardPointsCommonBigDrop' as const }
              : { rewardType: 'GiftDrop' as const }
            : targetOffset === 0
              ? { rewardType: 'MetaCurrencyBigDrop' as const }
              : { rewardType: 'MetaCardPointsCommonBigDrop' as const }
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
  // The rebuilt Preboss owns the authored boss-door store decision.
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBossDoorRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('ixion-chaos-g-preboss-shop'),
    }),
    storeKey: 'RunProgress',
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
 * A later G Midshop after an earlier Contract either entered or skipped. A
 * second G Midshop cannot follow the first, so the first Midshop's doors block
 * and the later Midshop stays unreached. Shared by the engine capability and
 * workspace-presence witnesses.
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

/** Complete selected G Zagreus return with the later acquired Preboss Contract item. */
export function underworldZagreusContractProject(): ProjectDocument {
  const midshop = goldenGOccurrenceId(5, 1);
  const contract = createOccurrenceId('zagreus-contract-showcase');
  const returned = createOccurrenceId('zagreus-contract-return');
  const prebossShop = createOccurrenceId('zagreus-contract-preboss-shop');
  const prebossPeer = createOccurrenceId('zagreus-contract-preboss-peer');
  const contractSource = { kind: 'occurrence' as const, occurrenceId: contract };
  const returnSource = { kind: 'occurrence' as const, occurrenceId: returned };
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional: createAdditionalExitAddress(goldenGBiome, midshop, 'zagreusContract'),
    occurrenceId: contract,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: midshop,
    }),
    value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(goldenGBiome, contractSource),
  });
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
    occurrenceId: returned,
    gameName: 'G_MiniBoss03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, returned),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(goldenGBiome, returnSource),
    gameName: 'G_PreBoss01',
    targetOccurrenceIds: { exit1: prebossShop, exit2: prebossPeer },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, prebossPeer),
    value: { rewardType: 'MaxManaDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, returnSource),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBossDoorRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: prebossShop,
    }),
    storeKey: 'RunProgress',
  });
  for (const [offerKey, value] of Object.entries({
    Boon: {
      rewardType: 'RandomLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' as const },
    },
    MajorNonBoon: { rewardType: 'MaxHealthDrop' as const },
    Minor: { rewardType: 'MaxManaDrop' as const },
    infernalContractReward: { rewardType: 'StackUpgrade' as const },
  }))
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenGBiome, prebossShop, offerKey),
      value,
    });
  project = replaceTestShopOfferActions(
    project,
    catalog,
    createOccurrenceAddress(goldenGBiome, prebossShop),
    ['infernalContractReward'],
  );
  return authorLegalTraitOffers(project);
}

/** Complete F/G route with reached Judgment and Crystal Figurine Boss outcomes. */
export function underworldAutomaticBossProject(): ProjectDocument {
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: createRouteAddress('Underworld'),
    arcanaKeys: ['ChanneledCast'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'BossMetaUpgradeKeepsake',
  });
  const active = deriveRouteLoadout(catalog, project.route.loadout).activeArcanaKeys;
  const judgmentKeys = catalog.arcanaCards.values
    .filter((card) => !active.includes(card.key))
    .slice(0, 5)
    .map((card) => card.key);
  const figurineKeys = catalog.arcanaCards.values
    .filter((card) => !active.includes(card.key) && !judgmentKeys.includes(card.key))
    .slice(0, 2)
    .map((card) => card.key);
  const boss = createOccurrenceAddress(
    goldenFBiome,
    createOccurrenceId('golden-f-preboss-shop:boss'),
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: createJudgmentArcanaAddress(boss, 'Encounter'),
    arcanaKeys: judgmentKeys,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFigurineArcana',
    figurine: createFigurineArcanaAddress(boss, 'Encounter'),
    arcanaKeys: figurineKeys,
  });
  const gJudgmentKeys = catalog.arcanaCards.values
    .filter(
      (card) =>
        !active.includes(card.key) &&
        !judgmentKeys.includes(card.key) &&
        !figurineKeys.includes(card.key),
    )
    .slice(0, 5)
    .map((card) => card.key);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: createJudgmentArcanaAddress(
      createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-preboss-shop:boss')),
      'Encounter',
    ),
    arcanaKeys: gJudgmentKeys,
  });
}

/** Complete F/G route with its first legal Fig Leaf Encounter skip selected. */
export function underworldFigLeafSkipProject(): ProjectDocument {
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(2, 1) },
    'Encounter',
  );
  const project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'SkipEncounterKeepsake',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceFigLeafSkip',
    phase,
    value: true,
  });
}

/** Complete F/G route with a reached Gorgon Athena child at the first G combat. */
export function underworldGorgonAthenaProject(): ProjectDocument {
  const occurrenceId = goldenGOccurrenceId(1, 1);
  const phase = createEncounterPhaseAddress(
    goldenGBiome,
    { kind: 'occurrence', occurrenceId },
    'Encounter',
  );
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'AthenaEncounterKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceGorgonDeathDefianceCondition',
    phase,
    value: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceGorgonAthenaOffer',
    trait: createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena'),
    value: {
      traitKeys: ['InvulnerabilityDashBoon', 'RetaliateInvulnerabilityBoon', 'FocusLastStandBoon'],
      selectedOptionKey: 'option1',
    },
  });
  return replaceTestRoomActionOrder(project, catalog, goldenGBiome, occurrenceId, [
    { kind: 'interactIncomingReward', producerPoint: 'roomRewardPickup', acquisitionRole: 'self' },
    { kind: 'interactGorgon', phaseKey: 'Encounter' },
  ]);
}

function withOpeningApolloOffer(
  project: ProjectDocument,
  option: { readonly persephoneLevelBonus?: number },
  rarificationActions: readonly ('option1' | 'option2' | 'option3')[] = [],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common', ...option },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common', ...option },
        { traitKey: 'ApolloCastBoon', rarity: 'Common', ...option },
      ],
      selectedOptionKey: 'option1',
      rarificationActions,
    },
  });
}

/** Complete F/G route with Aspect of Persephone and Calling Card's reached positive effects. */
export function underworldPersephoneCallingCardProject(): ProjectDocument {
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceRouteLoadout',
    route: createRouteAddress('Underworld'),
    weaponKey: 'WeaponLob',
    aspectKey: 'LobImpulseAspect',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'RarifyKeepsake',
  });
  return authorLegalTraitOffers(
    withOpeningApolloOffer(project, { persephoneLevelBonus: 5 }, ['option1']),
  );
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

/** Complete F/G/H/I route with positive Menace, Fangs, and an H Treant cage. */
export function underworldGeneratedCompositionProject(): ProjectDocument {
  let project = createGoldenFGHIProject();
  for (const [vowKey, rank] of [
    ['EnemyEliteShrineUpgrade', 1],
    ['NextBiomeEnemyShrineUpgrade', 2],
  ] as const)
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey,
      rank,
    });
  for (const [phase, value] of [
    [
      createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(3, 1) },
        'Encounter',
      ),
      {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 50 } }],
        menace: [{ waveIndex: 1, conversions: { Guard: { count: 2 } } }],
      },
    ],
    [
      createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
        'Encounter',
      ),
      {
        kind: 'generated',
        waveCount: 2,
        highlightKey: 'Guard',
        waves: [
          { waveIndex: 1, typeKeys: [] },
          { waveIndex: 2, typeKeys: ['Brawler'], allocations: { Guard: 30 } },
        ],
      },
    ],
    [
      createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(7, 1) },
        'Encounter',
      ),
      {
        kind: 'generated',
        waveCount: 1,
        waves: [
          {
            waveIndex: 1,
            typeKeys: ['Guard_Elite', 'Brawler'],
            allocations: { Guard_Elite: 100 },
          },
        ],
        fangs: { typeKey: 'Guard_Elite', perkKeys: ['Blink'] },
      },
    ],
    [
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat05') },
        'Cage01',
      ),
      {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
        fangs: { typeKey: 'Treant2', perkKeys: ['Blink'] },
      },
    ],
  ] as const) {
    if (phase.owner.occurrenceId === 'golden-h-combat05') {
      project = applyProjectCommand(project, catalog, {
        kind: 'SelectEncounter',
        phase,
        encounterKey: 'GeneratedH_Treant2',
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value,
    });
  }
  return project;
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
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Underworld'),
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
  project = replaceTestShopOfferActions(
    project,
    catalog,
    createOccurrenceAddress(goldenFBiome, fMidshopPomShopId),
    ['Boon'],
  );
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenFBiome, fMidshopPomShopId),
        'roomExit',
      ),
      'Boon',
    ),
    value: {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'HephaestusUpgrade' },
    },
  });
}

export { authorTestArtificerReplacement };
export {
  loadNemesisFieldsCheckpoint,
  loadNemesisTraitTradeCheckpoint,
} from '../checkpoints/underworld';
export type { BiomeAddress, ResolvedRewardOffer };

/** Bounded Golden H reauthoring that truthfully acquires Gold before its reached Preboss Shop. */
export function createEchoGoldHPrebossProject(): ProjectDocument {
  const combat09 = createOccurrenceId('golden-h-combat09');
  const bridge = createOccurrenceId('golden-h-bridge01');
  const forcedTarget = createOccurrenceId('golden-h-combat05');
  let project = createGoldenFGHIProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'GoldifyKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: combat09,
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  project = authorLegalTraitOffers(project);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridge },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Echo',
      options: [
        { traitKey: 'EchoDoubleShop' },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'DiminishingHealthAndManaBoon' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenHBiome, forcedTarget),
    gameName: 'H_MiniBoss02',
  });
  const forcedReward = createIncomingRewardAddress(goldenHBiome, forcedTarget);
  const rewardSession = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  );
  const replacement = catalog.traitGivers.values
    .filter((giver) => giver.providerKind === 'olympian')
    .map((giver) => ({
      giver,
      offer: {
        rewardType: 'Boon' as const,
        payload: { kind: 'BoonSource' as const, source: `${giver.key}Upgrade` },
      },
    }))
    .find(({ offer }) => {
      const evaluation = rewardSession.evaluate({
        kind: 'incomingReward',
        reward: forcedReward,
        value: offer,
      });
      return evaluation.kind === 'incomingReward' && evaluation.result.supported;
    });
  if (replacement === undefined) throw new Error('no candidate-supported H miniboss Boon');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: forcedReward,
    value: replacement.offer,
  });
  const forcedTrait = createTraitOfferAddress(forcedReward, 'source');
  const traitDraft = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).traitOfferStartingOutcome(forcedTrait, replacement.giver.key);
  if (traitDraft === undefined) throw new Error('no candidate-supported H miniboss trait offer');
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: forcedTrait,
    value: traitDraft,
  });
}

export const echoGoldIPrebossShopId = createOccurrenceId('golden-i-preboss');

/** A legal second Anvil after the I Preboss Shop's first Anvil. */
export const echoGoldIDuplicateAnvilResult = Object.freeze({
  kind: 'anvilOfFates' as const,
  removedTraitKey: 'StaffDashAttackTrait',
  addedTraitKeys: Object.freeze(['StaffJumpSpecialTrait', 'StaffExAoETrait'] as const),
});

/**
 * Gold held into the I Preboss Shop, whose first purchase is a resolved Anvil
 * and is duplicated; the duplicate's own result is authored only when given.
 */
export function createEchoGoldIAnvilDuplicateProject(
  duplicateResult?: AuthoredAnvilResult,
): ProjectDocument {
  const shop = createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId);
  const anvil = createShopOfferAddress(goldenIBiome, echoGoldIPrebossShopId, 'PremiumProgress');
  let project = applyProjectCommand(createEchoGoldHPrebossProject(), catalog, {
    kind: 'ReplaceShopOffer',
    offer: anvil,
    value: { rewardType: 'ChaosWeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAnvilResult',
    acquisition: createAcquisitionRoleAddress(anvil, 'self'),
    value: {
      kind: 'anvilOfFates',
      removedTraitKey: 'StaffDoubleAttackTrait',
      addedTraitKeys: ['StaffDashAttackTrait', 'StaffTripleShotTrait'],
    },
  });
  project = replaceTestShopOfferActions(project, catalog, shop, ['PremiumProgress']);
  const site = createAcquisitionSiteAddress(shop, 'roomExit');
  project = applyProjectCommand(project, catalog, {
    kind: 'PlaceEchoGoldPickup',
    site,
    entryKey: 'echoDoubleShopReward',
    sourceOfferKey: 'PremiumProgress',
  });
  return duplicateResult === undefined
    ? project
    : applyProjectCommand(project, catalog, {
        kind: 'ReplaceAnvilResult',
        acquisition: createAcquisitionRoleAddress(
          createAcquisitionEntryAddress(site, 'echoDoubleShopReward'),
          'self',
        ),
        value: duplicateResult,
      });
}
