import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeBiomeHistoryPrefix,
  createEncounterCommandAuthorization,
  evaluateBiomeRewards,
  evaluateBiomeRoomGeneration,
  materializeBiomePrefix,
  simulateProject,
  simulateProjectAssembly,
  type BiomeHistoryPrefix,
  type CanonicalAuthoredRoom,
  type HistoryEvent,
  type HistoryStateView,
  type MaterializedBiomePrefix,
} from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenGStartId,
} from '@run-planner/test-fixtures';

const fBiome = createBiomeAddress('Underworld', 'F');
const gBiome = createBiomeAddress('Underworld', 'G');
const oBiome = createBiomeAddress('Surface', 'O');
const pBiome = createBiomeAddress('Surface', 'P');
const nBiome = createBiomeAddress('Surface', 'N');

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function plan(project: ProjectDocument, biome: BiomeAddress) {
  const route = project.routes.find((candidate) => candidate.routeKey === biome.routeKey);
  const result = route?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (result === undefined) throw new Error(`missing ${biome.biomeKey} plan`);
  return result;
}

function traitContext(project: ProjectDocument, biome: BiomeAddress) {
  const route = project.routes.find((candidate) => candidate.routeKey === biome.routeKey);
  if (route === undefined) throw new Error(`missing ${biome.routeKey} route`);
  return route.loadout;
}

function prefix(
  project: ProjectDocument,
  biome: BiomeAddress,
  seed?: HistoryStateView,
): {
  readonly snapshot: MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom };
  readonly history: BiomeHistoryPrefix;
} {
  const snapshot = materializeBiomePrefix(
    catalog,
    biome,
    plan(project, biome),
    traitContext(project, biome),
  );
  if (snapshot === null || snapshot.entryRoom === undefined) {
    throw new Error(`${biome.biomeKey} did not materialize an entry prefix`);
  }
  const history = composeBiomeHistoryPrefix(catalog, snapshot, seed);
  if (history === null) throw new Error(`${biome.biomeKey} did not compose prefix history`);
  return { snapshot: { ...snapshot, entryRoom: snapshot.entryRoom }, history };
}

function projectFor(
  routeKey: 'Underworld' | 'Surface',
  configuredBiomeCount: number,
): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `route-detour-${routeKey}-${configuredBiomeCount}`,
    name: 'Route detour simulation',
    configuredBiomeCounts: { [routeKey]: configuredBiomeCount },
  });
}

function createBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  parent: OccurrenceId,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(biome, source(parent)),
  });
}

function addTarget(
  project: ProjectDocument,
  biome: BiomeAddress,
  parent: OccurrenceId,
  exitKey: string,
  occurrenceId: OccurrenceId,
  gameName: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source(parent), exitKey),
    occurrenceId,
    gameName,
  });
}

function setNormalSelection(
  project: ProjectDocument,
  biome: BiomeAddress,
  parent: OccurrenceId,
  exitKey: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, source(parent)),
    value: { kind: 'normal', exitKey },
  });
}

function setAdditionalSelection(
  project: ProjectDocument,
  biome: BiomeAddress,
  parent: OccurrenceId,
  additionalExitKey = 'zagreusContract',
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, source(parent)),
    value: { kind: 'additional', additionalExitKey },
  });
}

function replaceBatchStore(
  project: ProjectDocument,
  biome: BiomeAddress,
  parent: OccurrenceId,
  storeKey: 'MetaProgress' | 'RunProgress',
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, source(parent)),
    storeKey,
  });
}

function replaceIncomingReward(
  project: ProjectDocument,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  rewardType: 'MaxHealthDrop' | 'MaxManaDrop' | 'MetaCurrencyDrop' | 'RoomMoneyDrop',
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId),
    value: { rewardType },
  });
}

function selectEncounter(
  project: ProjectDocument,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  encounterKey: string,
): ProjectDocument {
  const phase = createEncounterPhaseAddress(biome, source(occurrenceId), 'Encounter');
  const assembly = simulateProjectAssembly(catalog, project);
  return applyProjectCommand(
    project,
    catalog,
    { kind: 'SelectEncounter', phase, encounterKey },
    { encounterAuthorization: createEncounterCommandAuthorization(catalog, assembly) },
  );
}

function appendSingleTargetBatch(
  project: ProjectDocument,
  biome: BiomeAddress,
  parent: OccurrenceId,
  target: OccurrenceId,
  gameName: string,
  storeKey?: 'MetaProgress' | 'RunProgress',
): ProjectDocument {
  let next = createBatch(project, biome, parent);
  if (storeKey !== undefined) next = replaceBatchStore(next, biome, parent, storeKey);
  return addTarget(next, biome, parent, 'exit1', target, gameName);
}

function indexOfEvent(
  events: readonly HistoryEvent[],
  predicate: (event: HistoryEvent) => boolean,
): number {
  const index = events.findIndex(predicate);
  if (index < 0) throw new Error('expected history event was absent');
  return index;
}

function branchHasEvent(
  branches: ReturnType<typeof evaluateBiomeRewards>['branches'],
  kind: 'concreteAcquisition' | 'rewardOffered',
  origin: ReturnType<typeof createIncomingRewardAddress>,
): boolean {
  return branches.some((branch) =>
    branch.events.some(
      (event) =>
        event.kind === kind && semanticAddressKey(event.origin) === semanticAddressKey(origin),
    ),
  );
}

function buildAnomalyProject(success: boolean) {
  const intro = createOccurrenceId(`detour-g-intro-${success}`);
  const combat01 = createOccurrenceId(`detour-g-combat01-${success}`);
  const combat01Peer = createOccurrenceId(`detour-g-combat01-peer-${success}`);
  const combat02 = createOccurrenceId(`detour-g-combat02-${success}`);
  const anomaly = createOccurrenceId(`detour-g-anomaly-${success}`);
  const combat02Peer1 = createOccurrenceId(`detour-g-combat02-peer1-${success}`);
  const combat02Peer2 = createOccurrenceId(`detour-g-combat02-peer2-${success}`);
  const returned = createOccurrenceId(`detour-g-return-${success}`);
  let project = projectFor('Underworld', 2);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: intro,
  });
  project = appendSingleTargetBatch(project, gBiome, intro, combat01, 'G_Combat01', 'RunProgress');
  project = createBatch(project, gBiome, combat01);
  project = replaceBatchStore(project, gBiome, combat01, 'MetaProgress');
  project = addTarget(project, gBiome, combat01, 'exit1', combat02, 'G_Combat02');
  project = addTarget(project, gBiome, combat01, 'exit2', combat01Peer, 'G_Combat03');
  project = replaceIncomingReward(project, gBiome, combat01Peer, 'MetaCurrencyDrop');
  project = setNormalSelection(project, gBiome, combat01, 'exit1');
  project = createBatch(project, gBiome, combat02);
  project = replaceBatchStore(project, gBiome, combat02, 'RunProgress');
  project = addTarget(project, gBiome, combat02, 'exit1', anomaly, 'G_Combat04');
  project = addTarget(project, gBiome, combat02, 'exit2', combat02Peer1, 'G_Combat05');
  project = addTarget(project, gBiome, combat02, 'exit3', combat02Peer2, 'G_Combat06');
  project = replaceIncomingReward(project, gBiome, combat02Peer1, 'MaxHealthDrop');
  project = replaceIncomingReward(project, gBiome, combat02Peer2, 'MaxManaDrop');
  project = setNormalSelection(project, gBiome, combat02, 'exit1');
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(gBiome, source(combat02), 'exit1'),
  });
  project = replaceIncomingReward(project, gBiome, anomaly, 'RoomMoneyDrop');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAnomalySuccess',
    occurrence: createOccurrenceAddress(gBiome, anomaly),
    success,
  });
  project = appendSingleTargetBatch(
    project,
    gBiome,
    anomaly,
    returned,
    'G_Combat07',
    'RunProgress',
  );
  return {
    project,
    anomaly,
    returned,
    earlyTarget: createTargetAddress(gBiome, source(combat01), 'exit1'),
  };
}

function buildMidshopProject(options: {
  readonly normalTargets: boolean;
  readonly selectContract?: boolean;
}) {
  const opening = createOccurrenceId(`detour-f-opening-${options.normalTargets}`);
  const shop = createOccurrenceId(`detour-f-shop-${options.normalTargets}`);
  const contract = createOccurrenceId(`detour-f-contract-${options.normalTargets}`);
  const normal1 = createOccurrenceId(`detour-f-normal1-${options.normalTargets}`);
  const normal2 = createOccurrenceId(`detour-f-normal2-${options.normalTargets}`);
  const returned = createOccurrenceId(`detour-f-return-${options.normalTargets}`);
  let project = projectFor('Underworld', 1);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: opening,
    gameName: 'F_Opening01',
  });
  project = appendSingleTargetBatch(project, fBiome, opening, shop, 'F_Shop01', 'MetaProgress');
  const additional = createAdditionalExitAddress(fBiome, shop, 'zagreusContract');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional,
    occurrenceId: contract,
  });
  if (options.normalTargets) {
    project = replaceBatchStore(project, fBiome, shop, 'RunProgress');
    project = addTarget(project, fBiome, shop, 'exit1', normal1, 'F_Combat01');
    project = addTarget(project, fBiome, shop, 'exit2', normal2, 'F_Combat02');
    project = replaceIncomingReward(project, fBiome, normal1, 'MaxHealthDrop');
    project = replaceIncomingReward(project, fBiome, normal2, 'MaxManaDrop');
  }
  if (options.selectContract ?? true) {
    project = setAdditionalSelection(project, fBiome, shop);
  } else if (options.normalTargets) {
    project = setNormalSelection(project, fBiome, shop, 'exit1');
  }
  if (options.normalTargets && (options.selectContract ?? true)) {
    project = appendSingleTargetBatch(
      project,
      fBiome,
      contract,
      returned,
      'F_Combat03',
      'RunProgress',
    );
  }
  return { project, shop, contract, normal1, normal2, returned, additional };
}

function buildUnpickedGContractProject() {
  const intro = createOccurrenceId('detour-g-later-intro');
  const shop = createOccurrenceId('detour-g-later-shop');
  const contract = createOccurrenceId('detour-g-later-contract');
  let project = projectFor('Underworld', 2);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: intro,
  });
  project = appendSingleTargetBatch(project, gBiome, intro, shop, 'G_Shop01', 'RunProgress');
  const additional = createAdditionalExitAddress(gBiome, shop, 'zagreusContract');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional,
    occurrenceId: contract,
  });
  return { project, shop, contract, additional };
}

function buildNaturalChaosProject() {
  const opening = createOccurrenceId('natural-chaos-f-opening');
  const chaos = createOccurrenceId('natural-chaos-f-room');
  const returned = createOccurrenceId('natural-chaos-f-return');
  let project = projectFor('Underworld', 1);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: opening,
    gameName: 'F_Opening01',
  });
  const additional = createAdditionalExitAddress(fBiome, opening, 'naturalChaos');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddNaturalChaos',
    additional,
    occurrenceId: chaos,
  });
  project = setAdditionalSelection(project, fBiome, opening, 'naturalChaos');
  project = appendSingleTargetBatch(project, fBiome, chaos, returned, 'F_Combat01', 'RunProgress');
  return { project, opening, chaos, returned, additional };
}

function buildAnomalyCapProject(firstAnomalySelected: boolean) {
  const suffix = firstAnomalySelected ? 'entered' : 'unentered';
  const intro = createOccurrenceId(`detour-g-cap-${suffix}-intro`);
  const combat01 = createOccurrenceId(`detour-g-cap-${suffix}-combat01`);
  const combat01Peer = createOccurrenceId(`detour-g-cap-${suffix}-combat01-peer`);
  const combat02 = createOccurrenceId(`detour-g-cap-${suffix}-combat02`);
  const firstAnomaly = createOccurrenceId(`detour-g-cap-${suffix}-first-anomaly`);
  const continuingCombat = createOccurrenceId(`detour-g-cap-${suffix}-continuing-combat`);
  const combat02Peer = createOccurrenceId(`detour-g-cap-${suffix}-combat02-peer`);
  const returnedCombat = createOccurrenceId(`detour-g-cap-${suffix}-returned-combat`);
  const laterAnomaly = createOccurrenceId(`detour-g-cap-${suffix}-later-anomaly`);
  const laterPeer1 = createOccurrenceId(`detour-g-cap-${suffix}-later-peer1`);
  const laterPeer2 = createOccurrenceId(`detour-g-cap-${suffix}-later-peer2`);
  let project = projectFor('Underworld', 2);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: intro,
  });
  project = appendSingleTargetBatch(project, gBiome, intro, combat01, 'G_Combat01', 'RunProgress');
  project = createBatch(project, gBiome, combat01);
  project = replaceBatchStore(project, gBiome, combat01, 'MetaProgress');
  project = addTarget(project, gBiome, combat01, 'exit1', combat02, 'G_Combat02');
  project = addTarget(project, gBiome, combat01, 'exit2', combat01Peer, 'G_Combat03');
  project = setNormalSelection(project, gBiome, combat01, 'exit1');
  project = createBatch(project, gBiome, combat02);
  project = replaceBatchStore(project, gBiome, combat02, 'RunProgress');
  project = addTarget(project, gBiome, combat02, 'exit1', firstAnomaly, 'G_Combat04');
  project = addTarget(project, gBiome, combat02, 'exit2', continuingCombat, 'G_Combat05');
  project = addTarget(project, gBiome, combat02, 'exit3', combat02Peer, 'G_Combat06');
  project = setNormalSelection(project, gBiome, combat02, firstAnomalySelected ? 'exit1' : 'exit2');
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(gBiome, source(combat02), 'exit1'),
  });

  let laterSource: OccurrenceId;
  if (firstAnomalySelected) {
    project = appendSingleTargetBatch(
      project,
      gBiome,
      firstAnomaly,
      returnedCombat,
      'G_Combat07',
      'RunProgress',
    );
    laterSource = returnedCombat;
    project = createBatch(project, gBiome, laterSource);
    project = replaceBatchStore(project, gBiome, laterSource, 'RunProgress');
    project = addTarget(project, gBiome, laterSource, 'exit1', laterAnomaly, 'G_Combat08');
    project = addTarget(project, gBiome, laterSource, 'exit2', laterPeer1, 'G_Combat09');
  } else {
    laterSource = continuingCombat;
    project = createBatch(project, gBiome, laterSource);
    project = replaceBatchStore(project, gBiome, laterSource, 'RunProgress');
    project = addTarget(project, gBiome, laterSource, 'exit1', laterAnomaly, 'G_Combat07');
    project = addTarget(project, gBiome, laterSource, 'exit2', laterPeer1, 'G_Combat08');
    project = addTarget(project, gBiome, laterSource, 'exit3', laterPeer2, 'G_Combat09');
  }
  project = setNormalSelection(project, gBiome, laterSource, 'exit1');
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(gBiome, source(laterSource), 'exit1'),
  });
  return {
    project,
    laterTarget: createTargetAddress(gBiome, source(laterSource), 'exit1'),
  };
}

function buildShopSourceAnomalyProject() {
  const intro = createOccurrenceId('detour-g-shop-source-intro');
  const shop = createOccurrenceId('detour-g-shop-source-shop');
  const anomaly = createOccurrenceId('detour-g-shop-source-anomaly');
  const peer = createOccurrenceId('detour-g-shop-source-peer');
  let project = projectFor('Underworld', 2);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: intro,
  });
  project = appendSingleTargetBatch(project, gBiome, intro, shop, 'G_Shop01', 'RunProgress');
  project = createBatch(project, gBiome, shop);
  project = replaceBatchStore(project, gBiome, shop, 'RunProgress');
  project = addTarget(project, gBiome, shop, 'exit1', anomaly, 'G_Combat01');
  project = addTarget(project, gBiome, shop, 'exit2', peer, 'G_Combat02');
  project = setNormalSelection(project, gBiome, shop, 'exit1');
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(gBiome, source(shop), 'exit1'),
  });
  return { project, target: createTargetAddress(gBiome, source(shop), 'exit1') };
}

function buildArtemisSourceAnomalyProject() {
  const sourceCombat = goldenGOccurrenceId(4, 1);
  let project = createCompleteFGProject();
  project = selectEncounter(project, goldenGBiome, sourceCombat, 'ArtemisCombatG');
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(goldenGBiome, source(sourceCombat), 'exit2'),
  });
  return { project, target: createTargetAddress(goldenGBiome, source(sourceCombat), 'exit2') };
}

interface ContractReturnHost {
  readonly biome: BiomeAddress;
  readonly label: 'G' | 'P';
  readonly normalTargetGameNames: readonly [string, string];
  readonly returnGameName: string;
  readonly routeKey: 'Underworld' | 'Surface';
  readonly routeBiomeCount: number;
  readonly shopGameName: string;
  readonly startPeerGameName?: string;
}

const contractReturnHosts: readonly ContractReturnHost[] = Object.freeze([
  {
    label: 'G',
    biome: gBiome,
    routeKey: 'Underworld',
    routeBiomeCount: 2,
    shopGameName: 'G_Shop01',
    normalTargetGameNames: ['G_Combat02', 'G_Combat03'],
    returnGameName: 'G_Combat04',
  },
  {
    label: 'P',
    biome: pBiome,
    routeKey: 'Surface',
    routeBiomeCount: 3,
    shopGameName: 'P_Shop01',
    startPeerGameName: 'P_Combat01',
    normalTargetGameNames: ['P_Combat02', 'P_Combat03'],
    returnGameName: 'P_Combat04',
  },
]);

function buildContractReturnProject(host: ContractReturnHost) {
  const start = createOccurrenceId(`detour-${host.label.toLowerCase()}-return-start`);
  const shop = createOccurrenceId(`detour-${host.label.toLowerCase()}-return-shop`);
  const contract = createOccurrenceId(`detour-${host.label.toLowerCase()}-return-contract`);
  const normal1 = createOccurrenceId(`detour-${host.label.toLowerCase()}-return-normal1`);
  const normal2 = createOccurrenceId(`detour-${host.label.toLowerCase()}-return-normal2`);
  const returned = createOccurrenceId(`detour-${host.label.toLowerCase()}-return-host`);
  let project = projectFor(host.routeKey, host.routeBiomeCount);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: host.biome,
    occurrenceId: start,
  });
  project = createBatch(project, host.biome, start);
  project = replaceBatchStore(project, host.biome, start, 'RunProgress');
  project = addTarget(project, host.biome, start, 'exit1', shop, host.shopGameName);
  if (host.startPeerGameName !== undefined) {
    const peer = createOccurrenceId(`detour-${host.label.toLowerCase()}-return-start-peer`);
    project = addTarget(project, host.biome, start, 'exit2', peer, host.startPeerGameName);
    project = setNormalSelection(project, host.biome, start, 'exit1');
  }
  const additional = createAdditionalExitAddress(host.biome, shop, 'zagreusContract');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional,
    occurrenceId: contract,
  });
  project = replaceBatchStore(project, host.biome, shop, 'RunProgress');
  project = addTarget(project, host.biome, shop, 'exit1', normal1, host.normalTargetGameNames[0]);
  project = addTarget(project, host.biome, shop, 'exit2', normal2, host.normalTargetGameNames[1]);
  project = setAdditionalSelection(project, host.biome, shop);
  project = appendSingleTargetBatch(
    project,
    host.biome,
    contract,
    returned,
    host.returnGameName,
    'RunProgress',
  );
  return { project, contract, returned };
}

function buildDepthFiveOContractProject() {
  const intro = createOccurrenceId('detour-o-intro');
  const combat04 = createOccurrenceId('detour-o-combat04');
  const combat07 = createOccurrenceId('detour-o-combat07');
  const combat01 = createOccurrenceId('detour-o-combat01');
  const shop = createOccurrenceId('detour-o-shop');
  const normalFifth = createOccurrenceId('detour-o-normal-fifth');
  const contract = createOccurrenceId('detour-o-contract');
  const returnedSixth = createOccurrenceId('detour-o-returned-sixth');
  const preboss = createOccurrenceId('detour-o-preboss');
  let project = projectFor('Surface', 2);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: intro,
  });
  project = appendSingleTargetBatch(project, oBiome, intro, combat04, 'O_Combat04', 'RunProgress');
  project = appendSingleTargetBatch(project, oBiome, combat04, combat07, 'O_Combat07');
  project = appendSingleTargetBatch(project, oBiome, combat07, combat01, 'O_Combat01');
  project = appendSingleTargetBatch(project, oBiome, combat01, shop, 'O_Shop01');
  const additional = createAdditionalExitAddress(oBiome, shop, 'zagreusContract');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional,
    occurrenceId: contract,
  });
  project = replaceBatchStore(project, oBiome, shop, 'RunProgress');
  project = addTarget(project, oBiome, shop, 'exit1', normalFifth, 'O_Combat02');
  project = setAdditionalSelection(project, oBiome, shop);
  project = appendSingleTargetBatch(
    project,
    oBiome,
    contract,
    returnedSixth,
    'O_Combat03',
    'RunProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(oBiome, source(returnedSixth)),
    gameName: 'O_PreBoss01',
    targetOccurrenceIds: { exit1: preboss },
  });
  return { project, shop, normalFifth, contract, returnedSixth, preboss };
}

describe('route-detour simulation', () => {
  it('keeps an authored N Chaos map outside the host domain materialized and finding-backed', () => {
    const opening = createOccurrenceId('natural-chaos-n-opening');
    const chaos = createOccurrenceId('natural-chaos-n-room');
    let project = projectFor('Surface', 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: opening,
    });
    const additional = createAdditionalExitAddress(nBiome, opening, 'naturalChaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaos,
    });
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        biomes: Array<{
          topology: { occurrences: Array<{ occurrenceId: string; gameName: string }> } | null;
        }>;
      }>;
    };
    const encodedChaos = encoded.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === chaos);
    if (encodedChaos === undefined) throw new Error('encoded Chaos occurrence is missing');
    encodedChaos.gameName = 'Chaos_01';
    const retained = decodeProjectDocument(encoded, catalog);
    const { snapshot, history } = prefix(retained, nBiome);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 1);

    expect(
      snapshot.frontier?.kind === 'exitDecision'
        ? snapshot.frontier.additional[0]?.room.gameName
        : undefined,
    ).toBe('Chaos_01');
    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: additional,
        evidence: expect.objectContaining({
          kind: 'naturalChaos',
          failedConditions: expect.arrayContaining(['targetDomain']),
        }),
      }),
    );
  });

  it('takes selected N Chaos directly to the fresh depth-two Hub takeover without PreHub', () => {
    const opening = createOccurrenceId('natural-chaos-n-selected-opening');
    const chaos = createOccurrenceId('natural-chaos-n-selected-room');
    let project = projectFor('Surface', 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: opening,
    });
    const additional = createAdditionalExitAddress(nBiome, opening, 'naturalChaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaos,
    });
    project = setAdditionalSelection(project, nBiome, opening, 'naturalChaos');
    project = createBatch(project, nBiome, chaos);
    const { snapshot, history } = prefix(project, nBiome);

    expect(history.ledgers.roomAppearances.map((room) => room.gameName)).toEqual([
      'N_Opening01',
      'Chaos_03',
    ]);
    expect(history.ledgers.roomAppearances.some((room) => room.gameName === 'N_PreHub01')).toBe(
      false,
    );
    expect(snapshot.frontier).toMatchObject({
      kind: 'exitDecision',
      hubContinuation: { kind: 'terminalTakeover' },
    });
  });

  it('consumes a skipped Chaos offer for the preceding-ten-room spacing rule', () => {
    const opening = createOccurrenceId('natural-chaos-spacing-opening');
    const firstCombat = createOccurrenceId('natural-chaos-spacing-first-combat');
    const secondCombat = createOccurrenceId('natural-chaos-spacing-second-combat');
    const firstChaos = createOccurrenceId('natural-chaos-spacing-first-gate');
    const secondChaos = createOccurrenceId('natural-chaos-spacing-second-gate');
    let project = projectFor('Underworld', 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: opening,
      gameName: 'F_Opening01',
    });
    const firstAdditional = createAdditionalExitAddress(fBiome, opening, 'naturalChaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional: firstAdditional,
      occurrenceId: firstChaos,
    });
    project = replaceBatchStore(project, fBiome, opening, 'RunProgress');
    project = addTarget(project, fBiome, opening, 'exit1', firstCombat, 'F_Combat01');
    project = setNormalSelection(project, fBiome, opening, 'exit1');
    const secondAdditional = createAdditionalExitAddress(fBiome, firstCombat, 'naturalChaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional: secondAdditional,
      occurrenceId: secondChaos,
    });
    project = replaceBatchStore(project, fBiome, firstCombat, 'RunProgress');
    project = addTarget(project, fBiome, firstCombat, 'exit1', secondCombat, 'F_Combat02');
    const { snapshot, history } = prefix(project, fBiome);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 1);

    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: secondAdditional,
        evidence: expect.objectContaining({
          kind: 'naturalChaos',
          failedConditions: expect.arrayContaining(['offerSpacing']),
        }),
      }),
    );
  });

  it.each([
    { blocked: true, fBatchIndex: 4, position: 'tenth' },
    { blocked: false, fBatchIndex: 3, position: 'eleventh' },
  ] as const)(
    'treats a skipped cross-biome Chaos offer at the $position predecessor as blocked=$blocked',
    ({ blocked, fBatchIndex }) => {
      const firstSource = goldenFOccurrenceId(fBatchIndex, 1);
      const firstAdditional = createAdditionalExitAddress(
        goldenFBiome,
        firstSource,
        'naturalChaos',
      );
      const secondAdditional = createAdditionalExitAddress(
        goldenGBiome,
        goldenGStartId,
        'naturalChaos',
      );
      let project = createCompleteFGProject();
      project = applyProjectCommand(project, catalog, {
        kind: 'AddNaturalChaos',
        additional: firstAdditional,
        occurrenceId: createOccurrenceId(`cross-biome-chaos-f-${fBatchIndex}`),
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'AddNaturalChaos',
        additional: secondAdditional,
        occurrenceId: createOccurrenceId(`cross-biome-chaos-g-${fBatchIndex}`),
      });

      const g = simulateProject(catalog, project)
        .routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G');
      const spacingFinding = g?.findings.find(
        (finding) =>
          semanticAddressKey(finding.origin) === semanticAddressKey(secondAdditional) &&
          finding.evidence.kind === 'naturalChaos' &&
          Array.isArray(finding.evidence.failedConditions) &&
          finding.evidence.failedConditions.includes('offerSpacing'),
      );
      expect(spacingFinding !== undefined).toBe(blocked);
    },
  );

  it('records the Chaos offer at source entry, then enters Chaos and generates a fresh host target', () => {
    const { project, opening, chaos, returned, additional } = buildNaturalChaosProject();
    const { history } = prefix(project, fBiome);
    expect(
      history.events.find(
        (event) =>
          event.kind === 'roomCreated' &&
          event.source === 'additionalExit' &&
          semanticAddressKey(event.additionalOrigin) === semanticAddressKey(additional),
      ),
    ).toMatchObject({ gameName: 'Chaos_01', picked: true });
    expect(history.rooms.map((room) => semanticAddressKey(room.origin))).toEqual(
      expect.arrayContaining([
        semanticAddressKey(createOccurrenceAddress(fBiome, opening)),
        semanticAddressKey(createOccurrenceAddress(fBiome, chaos)),
        semanticAddressKey(createOccurrenceAddress(fBiome, returned)),
      ]),
    );
    expect(history.ledgers.roomAppearances.map((appearance) => appearance.gameName)).toEqual(
      expect.arrayContaining(['Chaos_01']),
    );
    expect(
      history.events.some(
        (event) =>
          event.kind === 'producerRoleAdvanced' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(createOccurrenceAddress(fBiome, chaos)) &&
          event.rewardType === 'TrialUpgrade',
      ),
    ).toBe(true);
  });

  it.each([true, false])(
    'consumes the same Anomaly offer while acquisition follows success=%s and returns before commit',
    (success) => {
      const { project, anomaly, returned } = buildAnomalyProject(success);
      const { snapshot, history } = prefix(project, gBiome);
      const rewards = evaluateBiomeRewards(catalog, snapshot, history, 1);
      const incoming = createIncomingRewardAddress(gBiome, anomaly);
      const anomalyRoom = snapshot.decisions
        .filter((decision) => decision.kind === 'batch')
        .flatMap((decision) => decision.targets)
        .find((target) => target.room.occurrenceId === anomaly)?.room;
      if (anomalyRoom === undefined) throw new Error('Anomaly room was not materialized');

      expect(anomalyRoom).toMatchObject({
        gameName: 'B_Combat01',
        anomalyReplacement: { replacedRoomGameName: 'G_Combat04' },
        incomingReward: { offer: { rewardType: 'RoomMoneyDrop' }, acquisitionEnabled: success },
      });
      expect(branchHasEvent(rewards.branches, 'rewardOffered', incoming)).toBe(true);
      expect(branchHasEvent(rewards.branches, 'concreteAcquisition', incoming)).toBe(success);
      expect(
        branchHasEvent(
          rewards.branches,
          'rewardOffered',
          createIncomingRewardAddress(gBiome, returned),
        ),
      ).toBe(true);

      const returnCreated = indexOfEvent(
        history.events,
        (event) =>
          event.kind === 'roomCreated' &&
          event.source === 'generatedTarget' &&
          semanticAddressKey(event.parentOrigin) === semanticAddressKey(anomalyRoom.origin) &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(createOccurrenceAddress(gBiome, returned)),
      );
      const anomalyCommit = indexOfEvent(
        history.events,
        (event) =>
          event.kind === 'roomCountersAdvanced' &&
          semanticAddressKey(event.origin) === semanticAddressKey(anomalyRoom.origin),
      );
      expect(returnCreated).toBeLessThan(anomalyCommit);
      expect(
        history.ledgers.encounterCompletions.some(
          (entry) =>
            semanticAddressKey(entry.origin) === semanticAddressKey(anomalyRoom.origin) &&
            entry.encounterKey === 'GeneratedAnomalyB',
        ),
      ).toBe(true);

      const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 1);
      const anomalyTarget = snapshot.decisions
        .filter((decision) => decision.kind === 'batch')
        .flatMap((decision) => decision.targets)
        .find((target) => target.room.occurrenceId === anomaly);
      if (anomalyTarget === undefined) throw new Error('Anomaly target was not materialized');
      expect(
        generation.findings.some(
          (finding) =>
            finding.code === 'targetRoomUnavailable' &&
            semanticAddressKey(finding.origin) === semanticAddressKey(anomalyTarget.origin),
        ),
      ).toBe(false);
    },
  );

  it('retains an incompatible Anomaly reward as an editable finding rather than rerolling it', () => {
    const { anomaly, project: initial } = buildAnomalyProject(true);
    const incoming = createIncomingRewardAddress(gBiome, anomaly);
    const project = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: incoming,
      value: {
        rewardType: 'SpellDrop',
      },
    });
    const { snapshot, history } = prefix(project, gBiome);
    const rewards = evaluateBiomeRewards(catalog, snapshot, history, 1);

    const anomalyRoom = snapshot.decisions
      .filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets)
      .find((target) => target.room.occurrenceId === anomaly)?.room;
    expect(anomalyRoom?.incomingReward?.offer).toMatchObject({ rewardType: 'SpellDrop' });
    expect(rewards.findings).toContainEqual(
      expect.objectContaining({
        origin: incoming,
      }),
    );
  });

  it.each([
    [
      'PlantHealthBoon',
      'DemeterUpgrade',
      'Demeter',
      'DemeterWeaponBoon',
      'DemeterSpecialBoon',
      'source',
    ],
    [
      'RoomRewardBonusBoon',
      'PoseidonUpgrade',
      'Poseidon',
      'PoseidonWeaponBoon',
      'PoseidonSpecialBoon',
      'source',
    ],
    [
      'MoneyMultiplierBoon',
      'HermesUpgrade',
      'Hermes',
      'HermesWeaponBoon',
      'HermesSpecialBoon',
      'self',
    ],
  ] as const)(
    'blocks and does not equip %s on an Anomaly offer',
    (traitKey, source, giverKey, companion1, companion2, acquisitionRole) => {
      const { anomaly, project: initial } = buildAnomalyProject(true);
      const incoming = createIncomingRewardAddress(gBiome, anomaly);
      let project = applyProjectCommand(initial, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: incoming,
        value:
          source === 'HermesUpgrade'
            ? { rewardType: 'HermesUpgrade' }
            : { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(incoming, acquisitionRole),
        value: {
          giverKey,
          options: [
            { traitKey, rarity: 'Common' },
            { traitKey: companion1, rarity: 'Common' },
            { traitKey: companion2, rarity: 'Common' },
          ],
          selectedOptionKey: 'option1',
        },
      });
      const { snapshot, history } = prefix(project, gBiome);
      const rewards = evaluateBiomeRewards(catalog, snapshot, history, 1);
      const traces = rewards.branches
        .flatMap((branch) => branch.traitEvaluations ?? [])
        .filter((trace) => semanticAddressKey(trace.address) === semanticAddressKey(incoming));
      const trace = traces?.[0];
      expect(trace?.assessments[0]).toMatchObject({
        legal: false,
        findings: [{ code: 'offerContext', detail: 'blockGiftBoons', traitKey }],
      });
      expect(
        rewards.branches.every(
          (branch) => branch.traitHistory?.equippedTraits[traitKey] === undefined,
        ),
      ).toBe(true);
    },
  );

  it.each([false, true])(
    'treats an earlier Anomaly as cap-consuming only when it has entered (entered=%s)',
    (firstAnomalySelected) => {
      const { project, laterTarget } = buildAnomalyCapProject(firstAnomalySelected);
      const { snapshot, history } = prefix(project, gBiome);
      const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);
      const unavailable = generation.findings.find(
        (finding) =>
          finding.code === 'targetRoomUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(laterTarget),
      );
      const takeover = generation.anomalyTakeovers.find(
        (support) => semanticAddressKey(support.origin) === semanticAddressKey(laterTarget),
      );
      expect(takeover).toBeDefined();

      if (!firstAnomalySelected) {
        expect(takeover).toMatchObject({ selectedPossible: true, failedConditions: [] });
        expect(unavailable).not.toMatchObject({
          evidence: expect.objectContaining({
            anomalyReplacement: expect.objectContaining({
              failedConditions: expect.arrayContaining(['enteredReplacementCap']),
            }),
          }),
        });
        return;
      }
      expect(takeover).toMatchObject({
        selectedPossible: false,
        priorEnteredReplacementCount: 1,
        maximumEnteredReplacementsThisRoute: 0,
        failedConditions: expect.arrayContaining(['enteredReplacementCap']),
      });
      expect(unavailable).toMatchObject({
        evidence: expect.objectContaining({
          anomalyReplacement: expect.objectContaining({
            priorEnteredReplacementCount: 1,
            maximumEnteredReplacementsThisRoute: 0,
            failedConditions: expect.arrayContaining(['enteredReplacementCap']),
          }),
        }),
      });
    },
  );

  it('publishes a below-depth normal target takeover as unavailable before it is authored', () => {
    const { project, earlyTarget } = buildAnomalyProject(true);
    const { snapshot, history } = prefix(project, gBiome);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);

    expect(generation.anomalyTakeovers).toContainEqual(
      expect.objectContaining({
        origin: earlyTarget,
        selectedPossible: false,
        failedConditions: expect.arrayContaining(['minimumBiomeDepthCache']),
      }),
    );
  });

  it('keeps an Anomaly authored and finding-backed when its G_Shop source is excluded', () => {
    const { project, target } = buildShopSourceAnomalyProject();
    const { snapshot, history } = prefix(project, gBiome);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);

    expect(generation.anomalyTakeovers).toContainEqual(
      expect.objectContaining({
        origin: target,
        selectedPossible: false,
        failedConditions: expect.arrayContaining(['sourceRoomExcluded']),
      }),
    );

    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: target,
        evidence: expect.objectContaining({
          anomalyReplacement: expect.objectContaining({
            failedConditions: expect.arrayContaining(['sourceRoomExcluded']),
          }),
        }),
      }),
    );
  });

  it('keeps an Anomaly authored and finding-backed when its source selected Artemis', () => {
    const { project, target } = buildArtemisSourceAnomalyProject();
    const { snapshot, history } = prefix(project, gBiome);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);

    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: target,
        evidence: expect.objectContaining({
          anomalyReplacement: expect.objectContaining({
            excludedSourceEncounterKeys: ['ArtemisCombatG'],
            failedConditions: expect.arrayContaining(['sourceEncounterExcluded']),
          }),
        }),
      }),
    );
  });

  it('creates selected C_Boss at Midshop room start even when its normal lane is still empty', () => {
    const { project, shop, contract, additional } = buildMidshopProject({ normalTargets: false });
    const { snapshot, history } = prefix(project, fBiome);
    if (snapshot.frontier?.kind !== 'exitDecision')
      throw new Error('Midshop should remain frontier');

    expect(snapshot.frontier.additional).toMatchObject([
      {
        origin: additional,
        picked: true,
        room: { occurrenceId: contract, gameName: 'C_Boss01' },
      },
    ]);
    expect(
      history.events.some(
        (event) =>
          event.kind === 'roomCreated' &&
          event.source === 'additionalExit' &&
          semanticAddressKey(event.parentOrigin) ===
            semanticAddressKey(createOccurrenceAddress(fBiome, shop)) &&
          semanticAddressKey(event.additionalOrigin) === semanticAddressKey(additional),
      ),
    ).toBe(true);
    expect(
      history.events.some(
        (event) =>
          event.kind === 'roomEntered' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(createOccurrenceAddress(fBiome, contract)),
      ),
    ).toBe(false);
  });

  it('keeps a later unpicked contract authored but invalidates it from the earlier entered route contract', () => {
    const earlier = buildMidshopProject({ normalTargets: true });
    const first = prefix(earlier.project, fBiome);
    expect(
      first.history.events.some(
        (event) =>
          event.kind === 'roomEntered' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(createOccurrenceAddress(fBiome, earlier.contract)),
      ),
    ).toBe(true);

    const later = buildUnpickedGContractProject();
    const second = prefix(later.project, gBiome, first.history.current);
    if (second.snapshot.frontier?.kind !== 'exitDecision') {
      throw new Error('later Midshop should remain an exit-decision frontier');
    }
    expect(second.snapshot.frontier.additional).toMatchObject([
      {
        origin: later.additional,
        picked: false,
        room: { occurrenceId: later.contract, gameName: 'C_Boss01' },
      },
    ]);

    const generation = evaluateBiomeRoomGeneration(catalog, second.snapshot, second.history, 2);
    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: later.additional,
        evidence: expect.objectContaining({
          kind: 'zagreusContract',
          priorEnteredContractCount: 1,
          maximumEnteredThisRoute: 0,
        }),
      }),
    );
  });

  it('leaves a later contract valid after an earlier authored contract was skipped', () => {
    const skipped = buildMidshopProject({ normalTargets: true, selectContract: false });
    const first = prefix(skipped.project, fBiome);
    expect(
      first.history.events.some(
        (event) =>
          event.kind === 'roomEntered' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(createOccurrenceAddress(fBiome, skipped.contract)),
      ),
    ).toBe(false);

    const later = buildUnpickedGContractProject();
    const second = prefix(later.project, gBiome, first.history.current);
    const generation = evaluateBiomeRoomGeneration(catalog, second.snapshot, second.history, 2);
    expect(
      generation.findings.some(
        (finding) =>
          finding.code === 'targetRoomUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(later.additional) &&
          finding.evidence.kind === 'zagreusContract',
      ),
    ).toBe(false);
  });

  it.each(contractReturnHosts)(
    'keeps C_Boss as a hidden automatic host return in $label',
    (host) => {
      const { project, contract, returned } = buildContractReturnProject(host);
      const { snapshot, history } = prefix(project, host.biome);
      const contractBatch = snapshot.decisions.find(
        (decision) =>
          decision.kind === 'batch' &&
          decision.parent.origin.kind === 'occurrence' &&
          decision.parent.origin.occurrenceId === contract,
      );
      if (contractBatch === undefined || contractBatch.kind !== 'batch') {
        throw new Error(`${host.label} contract return did not materialize`);
      }

      expect(contractBatch.targets).toMatchObject([
        { room: { occurrenceId: returned, gameName: host.returnGameName }, picked: true },
      ]);
      expect(history.events).toContainEqual(
        expect.objectContaining({
          kind: 'roomCreated',
          source: 'generatedTarget',
          parentOrigin: createOccurrenceAddress(host.biome, contract),
          origin: createOccurrenceAddress(host.biome, returned),
          gameName: host.returnGameName,
        }),
      );
    },
  );

  it('keeps the Midshop normal offer lane independent from selected C_Boss traversal', () => {
    const { project, shop, contract, normal1, normal2, returned, additional } = buildMidshopProject(
      { normalTargets: true },
    );
    const { snapshot, history } = prefix(project, fBiome);
    const rewards = evaluateBiomeRewards(catalog, snapshot, history, 1);
    const shopBatch = snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.parent.origin.kind === 'occurrence' &&
        decision.parent.origin.occurrenceId === shop,
    );
    if (shopBatch?.kind !== 'batch') throw new Error('Midshop batch was not materialized');

    expect(shopBatch.additional).toMatchObject([
      { origin: additional, picked: true, room: { occurrenceId: contract, gameName: 'C_Boss01' } },
    ]);
    expect(shopBatch.targets.map((target) => [target.room.occurrenceId, target.picked])).toEqual([
      [normal1, false],
      [normal2, false],
    ]);
    expect(
      branchHasEvent(
        rewards.branches,
        'rewardOffered',
        createIncomingRewardAddress(fBiome, normal1),
      ),
    ).toBe(true);
    expect(
      branchHasEvent(
        rewards.branches,
        'concreteAcquisition',
        createIncomingRewardAddress(fBiome, contract),
      ),
    ).toBe(true);

    const shopEntry = indexOfEvent(
      history.events,
      (event) =>
        event.kind === 'roomEntered' &&
        semanticAddressKey(event.origin) ===
          semanticAddressKey(createOccurrenceAddress(fBiome, shop)),
    );
    const contractCreated = indexOfEvent(
      history.events,
      (event) =>
        event.kind === 'roomCreated' &&
        event.source === 'additionalExit' &&
        semanticAddressKey(event.additionalOrigin) === semanticAddressKey(additional),
    );
    const normalCreated = indexOfEvent(
      history.events,
      (event) =>
        event.kind === 'roomCreated' &&
        event.source === 'generatedTarget' &&
        semanticAddressKey(event.parentOrigin) ===
          semanticAddressKey(createOccurrenceAddress(fBiome, shop)),
    );
    const returnCreated = indexOfEvent(
      history.events,
      (event) =>
        event.kind === 'roomCreated' &&
        event.source === 'generatedTarget' &&
        semanticAddressKey(event.parentOrigin) ===
          semanticAddressKey(createOccurrenceAddress(fBiome, contract)) &&
        semanticAddressKey(event.origin) ===
          semanticAddressKey(createOccurrenceAddress(fBiome, returned)),
    );
    const contractCommit = indexOfEvent(
      history.events,
      (event) =>
        event.kind === 'roomCountersAdvanced' &&
        semanticAddressKey(event.origin) ===
          semanticAddressKey(createOccurrenceAddress(fBiome, contract)),
    );
    expect(shopEntry).toBeLessThan(contractCreated);
    expect(contractCreated).toBeLessThan(normalCreated);
    expect(returnCreated).toBeLessThan(contractCommit);
  });

  it('keeps the O depth-five normal target, bridges through C_Boss, then creates a distinct sixth host target before O_PreBoss', () => {
    const { project, shop, normalFifth, contract, returnedSixth, preboss } =
      buildDepthFiveOContractProject();
    const { snapshot, history } = prefix(project, oBiome);
    const batches = snapshot.decisions.filter((decision) => decision.kind === 'batch');
    const shopBatch = batches.find(
      (batch) =>
        batch.parent.origin.kind === 'occurrence' && batch.parent.origin.occurrenceId === shop,
    );
    const contractBatch = batches.find(
      (batch) =>
        batch.parent.origin.kind === 'occurrence' && batch.parent.origin.occurrenceId === contract,
    );
    const prebossBatch = batches.find(
      (batch) =>
        batch.parent.origin.kind === 'occurrence' &&
        batch.parent.origin.occurrenceId === returnedSixth,
    );
    if (shopBatch === undefined || contractBatch === undefined || prebossBatch === undefined) {
      throw new Error('O contract bridge lost a required normal batch');
    }

    expect(shopBatch.targets).toMatchObject([
      { room: { occurrenceId: normalFifth, gameName: 'O_Combat02' }, picked: false },
    ]);
    expect(shopBatch.additional).toMatchObject([
      { picked: true, room: { occurrenceId: contract, gameName: 'C_Boss01' } },
    ]);
    expect(contractBatch.targets).toMatchObject([
      { room: { occurrenceId: returnedSixth, gameName: 'O_Combat03' }, picked: true },
    ]);
    expect(prebossBatch.targets).toMatchObject([
      {
        room: { occurrenceId: preboss, gameName: 'O_PreBoss01' },
        continuation: 'startsCompletion',
        picked: true,
      },
    ]);

    const contractHistory = history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(oBiome, contract)),
    );
    const returnedHistory = history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(oBiome, returnedSixth)),
    );
    if (contractHistory === undefined || returnedHistory === undefined) {
      throw new Error('O contract bridge lost C_Boss or return lifecycle history');
    }
    expect(contractHistory.preOutgoing?.ledgers.counters.biomeDepthCache).toBe(6);
    expect(returnedHistory.entry.ledgers.counters.biomeDepthCache).toBe(7);
    expect(contractHistory.preOutgoing?.ledgers.counters.biomeEncounterDepth).toBe(
      contractHistory.entry.ledgers.counters.biomeEncounterDepth,
    );
    expect(
      history.events.some(
        (event) =>
          event.kind === 'encounterDepthAdvanced' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(createOccurrenceAddress(oBiome, contract)),
      ),
    ).toBe(false);
    expect(
      history.ledgers.encounterCompletions.some(
        (entry) =>
          semanticAddressKey(entry.origin) ===
            semanticAddressKey(createOccurrenceAddress(oBiome, contract)) &&
          entry.encounterKey === 'BossZagreus01',
      ),
    ).toBe(true);
  });
});
