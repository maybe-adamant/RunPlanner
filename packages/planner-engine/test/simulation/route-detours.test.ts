import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  forcedChaosOccurrenceKeys,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeBiomeHistoryPrefix,
  evaluateBiomeRewards,
  evaluateBiomeRoomGeneration,
  materializeBiomePrefix,
  chaosCandidateForProjectEvaluationAssembly,
  zagreusContractCandidateForProjectEvaluationAssembly,
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
  createGContractAvailabilityProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGStartId,
} from '@run-planner/test-fixtures/underworld';

const fBiome = createBiomeAddress('Underworld', 'F');
const gBiome = createBiomeAddress('Underworld', 'G');
const oBiome = createBiomeAddress('Surface', 'O');
const pBiome = createBiomeAddress('Surface', 'P');
const nBiome = createBiomeAddress('Surface', 'N');

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

function plan(project: ProjectDocument, biome: BiomeAddress) {
  const route = project.route;
  const result = route?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (result === undefined) throw new Error(`missing ${biome.biomeKey} plan`);
  return result;
}

function traitContext(project: ProjectDocument, biome: BiomeAddress) {
  const route = project.route;
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
  const authored = project;
  const snapshot = materializeBiomePrefix(
    catalog,
    biome,
    plan(authored, biome),
    traitContext(authored, biome),
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
    routeKey,
    configuredBiomeCount,
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
  rewardType:
    | 'MaxHealthDrop'
    | 'MaxManaDrop'
    | 'MetaCurrencyDrop'
    | 'MetaCardPointsCommonDrop'
    | 'RoomMoneyDrop',
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId),
    value: { rewardType },
  });
}

function replaceApolloReward(
  project: ProjectDocument,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
): ProjectDocument {
  const reward = createIncomingRewardAddress(biome, occurrenceId);
  let next = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(reward, 'source'),
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
  return next;
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
    MajorNonBoon: { rewardType: 'WeaponUpgradeDrop' },
    Minor: { rewardType: 'MaxManaDrop' },
  })) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, occurrenceId, offerKey),
      value,
    });
  }
  return next;
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
  const returnedPeer = createOccurrenceId(`detour-g-return-peer-${success}`);
  let project = projectFor('Underworld', 2);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: intro,
  });
  project = appendSingleTargetBatch(project, gBiome, intro, combat01, 'G_Combat01', 'RunProgress');
  project = replaceIncomingReward(project, gBiome, combat01, 'MaxHealthDrop');
  project = createBatch(project, gBiome, combat01);
  project = replaceBatchStore(project, gBiome, combat01, 'MetaProgress');
  project = addTarget(project, gBiome, combat01, 'exit1', combat02, 'G_Combat02');
  project = addTarget(project, gBiome, combat01, 'exit2', combat01Peer, 'G_Combat03');
  project = replaceIncomingReward(project, gBiome, combat02, 'MetaCurrencyDrop');
  project = replaceIncomingReward(project, gBiome, combat01Peer, 'MetaCardPointsCommonDrop');
  project = setNormalSelection(project, gBiome, combat01, 'exit1');
  project = createBatch(project, gBiome, combat02);
  project = replaceBatchStore(project, gBiome, combat02, 'RunProgress');
  project = addTarget(project, gBiome, combat02, 'exit1', anomaly, 'G_Combat04');
  project = addTarget(project, gBiome, combat02, 'exit2', combat02Peer1, 'G_Combat05');
  project = addTarget(project, gBiome, combat02, 'exit3', combat02Peer2, 'G_Combat06');
  project = replaceIncomingReward(project, gBiome, combat02Peer1, 'MaxManaDrop');
  project = replaceApolloReward(project, gBiome, combat02Peer2);
  project = setNormalSelection(project, gBiome, combat02, 'exit1');
  project = createBatch(project, gBiome, anomaly);
  project = replaceBatchStore(project, gBiome, anomaly, 'RunProgress');
  project = addTarget(project, gBiome, anomaly, 'exit1', returned, 'G_Combat07');
  project = addTarget(project, gBiome, anomaly, 'exit2', returnedPeer, 'G_Combat08');
  project = setNormalSelection(project, gBiome, anomaly, 'exit1');
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
  project = replaceApolloReward(project, gBiome, returned);
  return {
    project,
    anomaly,
    returned,
    returnedPeer,
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
  project = replaceApolloReward(project, fBiome, opening);
  project = appendSingleTargetBatch(project, fBiome, opening, shop, 'F_Shop01', 'MetaProgress');
  project = authorWorldShop(project, fBiome, shop);
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
    project = replaceIncomingReward(project, fBiome, returned, 'RoomMoneyDrop');
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
  const returnedPeer = createOccurrenceId('natural-chaos-f-return-peer');
  let project = projectFor('Underworld', 1);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: opening,
    gameName: 'F_Opening01',
  });
  project = replaceApolloReward(project, fBiome, opening);
  const additional = createAdditionalExitAddress(fBiome, opening, 'chaos');
  project = applyProjectCommand(project, catalog, {
    kind: 'AddChaos',
    additional,
    occurrenceId: chaos,
  });
  project = setAdditionalSelection(project, fBiome, opening, 'chaos');
  project = createBatch(project, fBiome, chaos);
  project = replaceBatchStore(project, fBiome, chaos, 'RunProgress');
  project = addTarget(project, fBiome, chaos, 'exit1', returned, 'F_Combat01');
  project = addTarget(project, fBiome, chaos, 'exit2', returnedPeer, 'F_Combat02');
  project = setNormalSelection(project, fBiome, chaos, 'exit1');
  project = replaceIncomingReward(project, fBiome, returned, 'MaxHealthDrop');
  project = replaceIncomingReward(project, fBiome, returnedPeer, 'MaxManaDrop');
  return { project, opening, chaos, returned, returnedPeer, additional };
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
    project = replaceApolloReward(project, nBiome, opening);
    const additional = createAdditionalExitAddress(nBiome, opening, 'chaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaos,
    });
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: {
        biomes: Array<{
          topology: { occurrences: Array<{ occurrenceId: string; gameName: string }> } | null;
        }>;
      };
    };
    const encodedChaos = encoded.route.biomes
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
          kind: 'chaos',
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
    project = replaceApolloReward(project, nBiome, opening);
    const additional = createAdditionalExitAddress(nBiome, opening, 'chaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaos,
    });
    project = setAdditionalSelection(project, nBiome, opening, 'chaos');
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
    project = replaceApolloReward(project, fBiome, opening);
    const firstAdditional = createAdditionalExitAddress(fBiome, opening, 'chaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional: firstAdditional,
      occurrenceId: firstChaos,
    });
    project = replaceBatchStore(project, fBiome, opening, 'RunProgress');
    project = addTarget(project, fBiome, opening, 'exit1', firstCombat, 'F_Combat01');
    project = replaceIncomingReward(project, fBiome, firstCombat, 'MaxHealthDrop');
    project = setNormalSelection(project, fBiome, opening, 'exit1');
    const secondAdditional = createAdditionalExitAddress(fBiome, firstCombat, 'chaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional: secondAdditional,
      occurrenceId: secondChaos,
    });
    project = replaceBatchStore(project, fBiome, firstCombat, 'RunProgress');
    project = addTarget(project, fBiome, firstCombat, 'exit1', secondCombat, 'F_Combat02');
    project = replaceIncomingReward(project, fBiome, secondCombat, 'MaxManaDrop');
    const { snapshot, history } = prefix(project, fBiome);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 1);
    const generationAssembly = simulateProjectAssembly(catalog, project);

    expect(
      chaosCandidateForProjectEvaluationAssembly(
        generationAssembly,
        createOccurrenceAddress(fBiome, firstCombat),
      ),
    ).toMatchObject({ placementEligible: false, failedConditions: ['offerSpacing'] });

    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: secondAdditional,
        evidence: expect.objectContaining({
          kind: 'chaos',
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
      const firstAdditional = createAdditionalExitAddress(goldenFBiome, firstSource, 'chaos');
      const secondAdditional = createAdditionalExitAddress(goldenGBiome, goldenGStartId, 'chaos');
      let project = createCompleteFGProject();
      project = applyProjectCommand(project, catalog, {
        kind: 'AddChaos',
        additional: firstAdditional,
        occurrenceId: createOccurrenceId(`cross-biome-chaos-f-${fBatchIndex}`),
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'AddChaos',
        additional: secondAdditional,
        occurrenceId: createOccurrenceId(`cross-biome-chaos-g-${fBatchIndex}`),
      });

      const g = simulateProject(catalog, project).route?.biomes.find(
        (biome) => biome.biomeKey === 'G',
      );
      const spacingFinding = g?.findings.find(
        (finding) =>
          semanticAddressKey(finding.origin) === semanticAddressKey(secondAdditional) &&
          finding.evidence.kind === 'chaos' &&
          Array.isArray(finding.evidence.failedConditions) &&
          finding.evidence.failedConditions.includes('offerSpacing'),
      );
      expect(spacingFinding !== undefined).toBe(blocked);
    },
  );

  it('validates a same-host natural gate as forced while a pending Spark overrides spacing', () => {
    const priorSource = goldenFOccurrenceId(4, 1);
    const priorAdditional = createAdditionalExitAddress(goldenFBiome, priorSource, 'chaos');
    const forcedAdditional = createAdditionalExitAddress(goldenGBiome, goldenGStartId, 'chaos');
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createCompleteFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional: priorAdditional,
      occurrenceId: createOccurrenceId('cross-biome-chaos-before-spark'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional: forcedAdditional,
      occurrenceId: createOccurrenceId('natural-overlaid-by-spark'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellInteraction',
      occurrence: well,
      interacted: true,
    });
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

    const first = prefix(project, goldenFBiome);
    const second = prefix(project, goldenGBiome, first.history.current);
    expect(
      evaluateBiomeRoomGeneration(catalog, second.snapshot, second.history, 2).findings,
    ).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: forcedAdditional,
        evidence: expect.objectContaining({
          kind: 'chaos',
          failedConditions: expect.arrayContaining(['offerSpacing']),
        }),
      }),
    );

    const forcedHosts = forcedChaosOccurrenceKeys(project, catalog);
    expect(forcedHosts).toContain(
      semanticAddressKey(createOccurrenceAddress(goldenGBiome, goldenGStartId)),
    );
    expect(
      evaluateBiomeRoomGeneration(
        catalog,
        second.snapshot,
        second.history,
        2,
        undefined,
        forcedHosts,
      ).findings,
    ).not.toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: forcedAdditional,
      }),
    );
  });

  it('settles a real Hermes room reward with effective Denial bans', () => {
    const { anomaly, project: initial } = buildAnomalyProject(true);
    const incoming = createIncomingRewardAddress(gBiome, anomaly);
    let project = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BanUnpickedBoonsShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: incoming,
      value: { rewardType: 'HermesUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(incoming, 'self'),
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
          { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
          { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const { snapshot, history } = prefix(project, gBiome);
    const rewards = evaluateBiomeRewards(
      catalog,
      snapshot,
      history,
      1,
      traitContext(project, gBiome),
    );
    expect(rewards.branches[0]?.traitHistory?.events).toContainEqual(
      expect.objectContaining({
        giverKey: 'Hermes',
        bannedTraitKeys: ['HermesSpecialBoon', 'HermesCastDiscountBoon'],
      }),
    );
  });

  it('records the Chaos offer at source entry, then enters Chaos and generates a fresh host target', () => {
    const { project, opening, chaos, returned, additional } = buildNaturalChaosProject();
    const { snapshot, history } = prefix(project, fBiome);
    const rewards = evaluateBiomeRewards(
      catalog,
      snapshot,
      history,
      1,
      traitContext(project, fBiome),
    );
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
    const returnedOrigin = createIncomingRewardAddress(fBiome, returned);
    for (const branch of rewards.branches) {
      const acquisitions = branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(returnedOrigin),
      );
      expect(acquisitions).toHaveLength(1);
      expect(acquisitions[0]).toMatchObject({
        settlement: { site: { pointKey: 'roomRewardPickup' } },
      });
    }
  });

  it.each([true, false])(
    'consumes the same Anomaly offer while acquisition follows success=%s and returns before commit',
    (success) => {
      const { project, anomaly, returned, returnedPeer } = buildAnomalyProject(success);
      const { snapshot, history } = prefix(project, gBiome);
      const rewards = evaluateBiomeRewards(
        catalog,
        snapshot,
        history,
        1,
        traitContext(project, gBiome),
      );
      expect(rewards.findings).toEqual([]);
      const incoming = createIncomingRewardAddress(gBiome, anomaly);
      const anomalyRoom = snapshot.decisions
        .filter((decision) => decision.kind === 'batch')
        .flatMap((decision) => decision.targets)
        .find((target) => target.room.occurrenceId === anomaly)?.room;
      if (anomalyRoom === undefined) throw new Error('Anomaly room was not materialized');
      const anomalyReturn = snapshot.decisions
        .filter((decision) => decision.kind === 'batch')
        .find(
          (decision) =>
            decision.source.kind === 'occurrence' && decision.source.occurrenceId === anomaly,
        );

      expect(anomalyRoom).toMatchObject({
        gameName: 'B_Combat01',
        anomalyReplacement: { replacedRoomGameName: 'G_Combat04' },
        incomingReward: { offer: { rewardType: 'RoomMoneyDrop' }, acquisitionEnabled: success },
      });
      expect(anomalyReturn?.targets.map((target) => target.room.occurrenceId)).toEqual([returned]);
      expect(anomalyReturn?.targets.map((target) => target.room.occurrenceId)).not.toContain(
        returnedPeer,
      );
      expect(branchHasEvent(rewards.branches, 'rewardOffered', incoming)).toBe(true);
      expect(branchHasEvent(rewards.branches, 'concreteAcquisition', incoming)).toBe(success);
      const anomalyAcquisitions = rewards.branches.flatMap((branch) =>
        branch.events.filter(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) === semanticAddressKey(incoming),
        ),
      );
      expect(anomalyAcquisitions.length > 0).toBe(success);
      if (success) {
        for (const acquisition of anomalyAcquisitions) {
          expect(acquisition).toMatchObject({
            settlement: {
              site: { kind: 'acquisitionSite', pointKey: 'roomRewardPickup' },
              entry: { kind: 'acquisitionEntry', entryKey: 'self' },
            },
          });
        }
      }
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
    const rewards = evaluateBiomeRewards(
      catalog,
      snapshot,
      history,
      1,
      traitContext(project, gBiome),
    );

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
          kind: 'traits',
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
      const rewards = evaluateBiomeRewards(
        catalog,
        snapshot,
        history,
        1,
        traitContext(project, gBiome),
      );
      const traces = rewards.selectedTraitOffers.filter(
        (trace) => semanticAddressKey(trace.address.owner) === semanticAddressKey(incoming),
      );
      const trace = traces?.[0];
      expect(trace?.branches[0]?.assessments[0]).toMatchObject({
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

  it('creates selected C_Boss at Midshop room start even when its normal lane is still empty', () => {
    const { project, shop, contract, additional } = buildMidshopProject({ normalTargets: false });
    const { snapshot, history } = prefix(project, fBiome);
    if (snapshot.frontier?.kind !== 'exitDecision')
      throw new Error('Midshop should remain frontier');

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

  it('acquires the genuine C_Boss01 fixed reward as one rarityless Infernal Contract', () => {
    const { project, contract } = buildMidshopProject({ normalTargets: true });
    const { snapshot, history } = prefix(project, fBiome);
    const rewards = evaluateBiomeRewards(
      catalog,
      snapshot,
      history,
      1,
      traitContext(project, fBiome),
    );
    expect(
      rewards.branches.some(
        (branch) =>
          branch.traitHistory?.equippedTraits.InfernalContractBoon?.traitKey ===
          'InfernalContractBoon',
      ),
    ).toBe(true);
    expect(
      history.events.some(
        (event) =>
          event.kind === 'roomEntered' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(createOccurrenceAddress(fBiome, contract)),
      ),
    ).toBe(true);
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

  it('publishes entry-consumed Contract capabilities at a later Midshop', () => {
    const entered = createGContractAvailabilityProject(true);
    const enteredAssembly = simulateProjectAssembly(catalog, entered.project);
    expect(
      zagreusContractCandidateForProjectEvaluationAssembly(
        enteredAssembly,
        createOccurrenceAddress(gBiome, entered.laterShop),
      ),
    ).toMatchObject({
      placementEligible: false,
      enteredContractCount: 1,
      maximumEnteredThisRoute: 0,
    });

    const skipped = createGContractAvailabilityProject(false);
    const skippedAssembly = simulateProjectAssembly(catalog, skipped.project);
    expect(
      zagreusContractCandidateForProjectEvaluationAssembly(
        skippedAssembly,
        createOccurrenceAddress(gBiome, skipped.laterShop),
      ),
    ).toMatchObject({
      placementEligible: true,
      enteredContractCount: 0,
      maximumEnteredThisRoute: 0,
    });
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
    const rewards = evaluateBiomeRewards(
      catalog,
      snapshot,
      history,
      1,
      traitContext(project, fBiome),
    );
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
    const returnedOrigin = createIncomingRewardAddress(fBiome, returned);
    for (const branch of rewards.branches) {
      const acquisitions = branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(returnedOrigin),
      );
      expect(acquisitions).toHaveLength(1);
      expect(acquisitions[0]).toMatchObject({
        settlement: { site: { pointKey: 'roomRewardPickup' } },
      });
    }
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
        continuation: 'continuesSpine',
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
