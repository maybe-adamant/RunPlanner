import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

export const detourFBiome = createBiomeAddress('Underworld', 'F');
export const detourGBiome = createBiomeAddress('Underworld', 'G');

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function projectFor(configuredBiomeCounts: { readonly Underworld: number }): ProjectDocument {
  return createProjectDocument(catalog, { projectId: 'generation-detour', configuredBiomeCounts });
}

function createBatch(project: ProjectDocument, parent: OccurrenceId): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(detourGBiome, source(parent)),
  });
}

function addTarget(
  project: ProjectDocument,
  parent: OccurrenceId,
  exitKey: string,
  occurrenceId: OccurrenceId,
  gameName: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(detourGBiome, source(parent), exitKey),
    occurrenceId,
    gameName,
  });
}

function select(project: ProjectDocument, parent: OccurrenceId, exitKey: string): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(detourGBiome, source(parent)),
    value: { kind: 'normal', exitKey },
  });
}

function store(
  project: ProjectDocument,
  parent: OccurrenceId,
  storeKey: 'MetaProgress' | 'RunProgress',
) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(detourGBiome, source(parent)),
    storeKey,
  });
}

function reward(
  project: ProjectDocument,
  occurrenceId: OccurrenceId,
  rewardType:
    | 'MaxHealthDrop'
    | 'MaxManaDrop'
    | 'MetaCurrencyDrop'
    | 'MetaCardPointsCommonDrop'
    | 'RoomMoneyDrop',
) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(detourGBiome, occurrenceId),
    value: { rewardType },
  });
}

function anomaly(project: ProjectDocument, parent: OccurrenceId, exitKey: string): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(detourGBiome, source(parent), exitKey),
  });
}

/** Builds only authored inputs; generation policy remains solely under test. */
export function buildBelowDepthAnomalyProject() {
  const start = createOccurrenceId('generation-detour-below-depth-start');
  const first = createOccurrenceId('generation-detour-below-depth-first');
  const second = createOccurrenceId('generation-detour-below-depth-second');
  let project = projectFor({ Underworld: 2 });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: detourGBiome,
    occurrenceId: start,
  });
  project = createBatch(project, start);
  project = store(project, start, 'RunProgress');
  project = addTarget(project, start, 'exit1', first, 'G_Combat01');
  project = reward(project, first, 'MaxHealthDrop');
  project = createBatch(project, first);
  project = store(project, first, 'RunProgress');
  project = addTarget(project, first, 'exit1', second, 'G_Combat02');
  project = reward(project, second, 'MaxManaDrop');
  project = anomaly(project, first, 'exit1');
  return { project, earlyTarget: createTargetAddress(detourGBiome, source(first), 'exit1') };
}

export function buildAnomalyCapProject(firstAnomalySelected: boolean) {
  const suffix = firstAnomalySelected ? 'entered' : 'unentered';
  const intro = createOccurrenceId(`generation-detour-cap-${suffix}-intro`);
  const combat01 = createOccurrenceId(`generation-detour-cap-${suffix}-combat01`);
  const combat01Peer = createOccurrenceId(`generation-detour-cap-${suffix}-combat01-peer`);
  const combat02 = createOccurrenceId(`generation-detour-cap-${suffix}-combat02`);
  const firstAnomaly = createOccurrenceId(`generation-detour-cap-${suffix}-first-anomaly`);
  const continuingCombat = createOccurrenceId(`generation-detour-cap-${suffix}-continuing-combat`);
  const combat02Peer = createOccurrenceId(`generation-detour-cap-${suffix}-combat02-peer`);
  const returnedCombat = createOccurrenceId(`generation-detour-cap-${suffix}-returned-combat`);
  const laterAnomaly = createOccurrenceId(`generation-detour-cap-${suffix}-later-anomaly`);
  const laterPeer1 = createOccurrenceId(`generation-detour-cap-${suffix}-later-peer1`);
  const laterPeer2 = createOccurrenceId(`generation-detour-cap-${suffix}-later-peer2`);
  let project = projectFor({ Underworld: 2 });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: detourGBiome,
    occurrenceId: intro,
  });
  project = createBatch(project, intro);
  project = store(project, intro, 'RunProgress');
  project = addTarget(project, intro, 'exit1', combat01, 'G_Combat01');
  project = reward(project, combat01, 'MaxHealthDrop');
  project = createBatch(project, combat01);
  project = store(project, combat01, 'MetaProgress');
  project = addTarget(project, combat01, 'exit1', combat02, 'G_Combat02');
  project = addTarget(project, combat01, 'exit2', combat01Peer, 'G_Combat03');
  project = reward(project, combat02, 'MetaCurrencyDrop');
  project = reward(project, combat01Peer, 'MetaCardPointsCommonDrop');
  project = select(project, combat01, 'exit1');
  project = createBatch(project, combat02);
  project = store(project, combat02, 'RunProgress');
  project = addTarget(project, combat02, 'exit1', firstAnomaly, 'G_Combat04');
  project = addTarget(project, combat02, 'exit2', continuingCombat, 'G_Combat05');
  project = addTarget(project, combat02, 'exit3', combat02Peer, 'G_Combat06');
  project = reward(project, firstAnomaly, 'RoomMoneyDrop');
  project = reward(project, continuingCombat, 'MaxHealthDrop');
  project = reward(project, combat02Peer, 'MaxManaDrop');
  project = select(project, combat02, firstAnomalySelected ? 'exit1' : 'exit2');
  project = anomaly(project, combat02, 'exit1');
  let laterSource: OccurrenceId;
  if (firstAnomalySelected) {
    project = createBatch(project, firstAnomaly);
    project = store(project, firstAnomaly, 'RunProgress');
    project = addTarget(project, firstAnomaly, 'exit1', returnedCombat, 'G_Combat07');
    project = reward(project, returnedCombat, 'MaxHealthDrop');
    laterSource = returnedCombat;
    project = createBatch(project, laterSource);
    project = store(project, laterSource, 'RunProgress');
    project = addTarget(project, laterSource, 'exit1', laterAnomaly, 'G_Combat08');
    project = addTarget(project, laterSource, 'exit2', laterPeer1, 'G_Combat09');
    project = reward(project, laterAnomaly, 'RoomMoneyDrop');
    project = reward(project, laterPeer1, 'MaxManaDrop');
  } else {
    laterSource = continuingCombat;
    project = createBatch(project, laterSource);
    project = store(project, laterSource, 'RunProgress');
    project = addTarget(project, laterSource, 'exit1', laterAnomaly, 'G_Combat07');
    project = addTarget(project, laterSource, 'exit2', laterPeer1, 'G_Combat08');
    project = addTarget(project, laterSource, 'exit3', laterPeer2, 'G_Combat09');
    project = reward(project, laterAnomaly, 'RoomMoneyDrop');
    project = reward(project, laterPeer1, 'MaxHealthDrop');
    project = reward(project, laterPeer2, 'MaxManaDrop');
  }
  project = select(project, laterSource, 'exit1');
  project = anomaly(project, laterSource, 'exit1');
  return { project, laterTarget: createTargetAddress(detourGBiome, source(laterSource), 'exit1') };
}

export function buildShopSourceAnomalyProject() {
  const intro = createOccurrenceId('generation-detour-shop-intro');
  const shop = createOccurrenceId('generation-detour-shop');
  const target = createOccurrenceId('generation-detour-shop-target');
  const peer = createOccurrenceId('generation-detour-shop-peer');
  let project = projectFor({ Underworld: 2 });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: detourGBiome,
    occurrenceId: intro,
  });
  project = createBatch(project, intro);
  project = store(project, intro, 'RunProgress');
  project = addTarget(project, intro, 'exit1', shop, 'G_Shop01');
  project = createBatch(project, shop);
  project = store(project, shop, 'RunProgress');
  project = addTarget(project, shop, 'exit1', target, 'G_Combat01');
  project = addTarget(project, shop, 'exit2', peer, 'G_Combat02');
  project = select(project, shop, 'exit1');
  project = anomaly(project, shop, 'exit1');
  return { project, target: createTargetAddress(detourGBiome, source(shop), 'exit1') };
}

export function buildArtemisSourceAnomalyProject() {
  const sourceCombat = goldenGOccurrenceId(4, 1);
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'SelectEncounter',
    phase: createEncounterPhaseAddress(goldenGBiome, source(sourceCombat), 'Encounter'),
    encounterKey: 'ArtemisCombatG',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(goldenGBiome, source(sourceCombat), 'exit2'),
  });
  return { project, target: createTargetAddress(goldenGBiome, source(sourceCombat), 'exit2') };
}

/** Builds the authored selected-Contract frontier; materialization remains under test. */
export function createSelectedContractContinuationProject() {
  const opening = createOccurrenceId('batch-materialization-contract-opening');
  const shop = createOccurrenceId('batch-materialization-contract-shop');
  const contract = createOccurrenceId('batch-materialization-contract');
  let project = createProjectDocument(catalog, {
    projectId: 'batch-materialization-contract',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: detourFBiome,
    occurrenceId: opening,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(detourFBiome, opening),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(detourFBiome, opening), 'source'),
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
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(detourFBiome, source(opening)),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(detourFBiome, source(opening)),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(detourFBiome, source(opening), 'exit1'),
    occurrenceId: shop,
    gameName: 'F_Shop01',
  });
  for (const [offerKey, value] of Object.entries({
    Boon: {
      rewardType: 'RandomLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    MajorNonBoon: { rewardType: 'WeaponUpgradeDrop' as const },
    Minor: { rewardType: 'MaxManaDrop' as const },
  })) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(detourFBiome, shop, offerKey),
      value,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createShopOfferAddress(detourFBiome, shop, 'Boon'), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
        { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const additional = createAdditionalExitAddress(detourFBiome, shop, 'zagreusContract');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional,
    occurrenceId: contract,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(detourFBiome, source(shop)),
    value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
  });
  return { project, shop, contract, additional };
}
