// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createAcquisitionSiteAddress,
  createAcquisitionEntryAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRouteStartKeepsakeSelectionAddress,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import type {
  WorkspaceBiome,
  WorkspaceMixedBatchNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
} from '@planner/projections/structured-workspace';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected, semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import {
  createGoldenFGHIProject,
  createCompleteFGProject,
  createFMidshopPomFrontierProject,
  fMidshopPomShopId,
  authorLegalTraitOffers,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  goldenHStartId,
  goldenGBiome,
} from '@run-planner/test-fixtures';
import {
  createRepresentativeNProject,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  renderOccurrenceWorkbench,
  renderDecisionWorkbench,
  renderStaticOccurrenceWorkbench,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import { createEchoGoldHPrebossProject } from '@planner-test/fixtures/echoGoldShop';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function occurrenceById(
  occurrenceId: string,
): (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined {
  return (biome) =>
    biome.nodes.find(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
    );
}

function nHubOccurrence(application: PlannerApplication, hubSlotKey: string) {
  const plan = application.store
    .getState()
    .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'N');
  const topology = plan?.topology;
  if (topology === undefined || topology === null) throw new Error('N Hub topology is missing');
  const hub = topology.decisions.find((decision) => decision.kind === 'hub');
  if (hub?.kind !== 'hub') throw new Error('N Hub decision is missing');
  const target = hub.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === target?.occurrenceId,
  );
  if (occurrence === undefined) throw new Error(`${hubSlotKey} occurrence is missing`);
  return occurrence;
}

function orderedNHubSideEntries(application: PlannerApplication, hubSlotKey: string) {
  const occurrence = nHubOccurrence(application, hubSlotKey);
  if (occurrence.state.kind !== 'ephyraCombat') {
    throw new Error(`${hubSlotKey} is not an Ephyra combat occurrence`);
  }
  return Object.entries(occurrence.state.sideRooms)
    .filter(([, side]) => side.enteredOrdinal !== null)
    .sort(([, left], [, right]) => left.enteredOrdinal! - right.enteredOrdinal!)
    .map(([sideSlotKey]) => sideSlotKey);
}

function emptyFProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'occurrence-workbench-empty-f',
    name: 'Occurrence workbench empty F',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function travelDealGPrebossProject(): ProjectDocument {
  const sourceOccurrenceId = createOccurrenceId('golden-g-b1-e1');
  const incoming = createIncomingRewardAddress(goldenGBiome, sourceOccurrenceId);
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: incoming,
    value: { rewardType: 'HermesUpgrade' },
  });
  const result = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(incoming, 'self'),
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: [
        { traitKey: 'RestockBoon', rarity: 'Common' },
        { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
        { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  return result;
}

function contractTravelFShopsProject(): {
  readonly project: ProjectDocument;
  readonly midshopId: OccurrenceId;
  readonly prebossId: OccurrenceId;
} {
  const hermesId = createOccurrenceId('midshop-pom-b4-e1');
  const midshopId = fMidshopPomShopId;
  const contractId = createOccurrenceId('gate-b-ui-f-contract');
  const minibossId = createOccurrenceId('gate-b-ui-f-miniboss');
  const prebossId = createOccurrenceId('gate-b-ui-f-preboss');
  const source = (occurrenceId: OccurrenceId) => ({ kind: 'occurrence' as const, occurrenceId });
  let project = createFMidshopPomFrontierProject();
  const hermesReward = createIncomingRewardAddress(goldenFBiome, hermesId);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: hermesReward,
    value: { rewardType: 'HermesUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(hermesReward, 'self'),
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: [
        { traitKey: 'RestockBoon', rarity: 'Common' },
        { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
        { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional: createAdditionalExitAddress(goldenFBiome, midshopId, 'zagreusContract'),
    occurrenceId: contractId,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source(midshopId)),
    storeKey: 'RunProgress',
  });
  for (const [exitKey, occurrenceId, gameName, value] of [
    [
      'exit1',
      createOccurrenceId('gate-b-ui-f-normal-1'),
      'F_MiniBoss01',
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    ],
    [
      'exit2',
      createOccurrenceId('gate-b-ui-f-normal-2'),
      'F_MiniBoss02',
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    ],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, source(midshopId), exitKey),
      occurrenceId,
      gameName,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, occurrenceId),
      value,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, source(midshopId)),
    value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source(contractId)),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source(contractId)),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, source(contractId), 'exit1'),
    occurrenceId: minibossId,
    gameName: 'F_MiniBoss03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, minibossId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(goldenFBiome, minibossId), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Aphrodite',
      options: [
        { traitKey: 'AphroditeCastBoon', rarity: 'Rare' },
        { traitKey: 'AphroditeSprintBoon', rarity: 'Rare' },
        { traitKey: 'AphroditeManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source(minibossId)),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source(minibossId)),
    storeKey: 'RunProgress',
  });
  const late1 = createOccurrenceId('gate-b-ui-f-late-1');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, source(minibossId), 'exit1'),
    occurrenceId: late1,
    gameName: 'F_Combat11',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, late1),
    value: { rewardType: 'MaxManaDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source(late1)),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source(late1)),
    storeKey: 'RunProgress',
  });
  const late2 = createOccurrenceId('gate-b-ui-f-late-2');
  const late2Peer = createOccurrenceId('gate-b-ui-f-late-2-peer');
  for (const [exitKey, occurrenceId, value] of [
    ['exit1', late2, { rewardType: 'RoomMoneyDrop' }],
    ['exit2', late2Peer, { rewardType: 'WeaponUpgrade' }],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, source(late1), exitKey),
      occurrenceId,
      gameName: 'F_Combat12',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, occurrenceId),
      value,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, source(late1)),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source(late2)),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source(late2)),
    storeKey: 'MetaProgress',
  });
  const late3 = createOccurrenceId('gate-b-ui-f-late-3');
  const late3Peer = createOccurrenceId('gate-b-ui-f-late-3-peer');
  for (const [exitKey, occurrenceId, rewardType] of [
    ['exit1', late3, 'MetaCardPointsCommonDrop'],
    ['exit2', late3Peer, 'MetaCurrencyDrop'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, source(late2), exitKey),
      occurrenceId,
      gameName: 'F_Combat14',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, occurrenceId),
      value: { rewardType },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, source(late2)),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  const prebossFreeId = createOccurrenceId('gate-b-ui-f-preboss-free');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(goldenFBiome, source(late3)),
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: { exit1: prebossId, exit2: prebossFreeId },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, prebossFreeId),
    value: { rewardType: 'StackUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, source(late3)),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  return { project: authorLegalTraitOffers(project), midshopId, prebossId };
}

function authoredAnomalyProject(): {
  readonly occurrenceId: OccurrenceId;
  readonly project: ProjectDocument;
} {
  const biome = createBiomeAddress('Underworld', 'G');
  const start = createOccurrenceId('occurrence-workbench-g-intro');
  const target = createOccurrenceId('occurrence-workbench-g-anomaly');
  const source = { kind: 'occurrence' as const, occurrenceId: start };
  let project = createProjectDocument(catalog, {
    projectId: 'occurrence-workbench-anomaly',
    name: 'Occurrence workbench Anomaly',
    configuredBiomeCounts: { Underworld: 2 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(biome, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source, 'exit1'),
    occurrenceId: target,
    gameName: 'G_Combat01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(biome, source, 'exit1'),
  });
  return { occurrenceId: target, project };
}

function occurrenceState(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: string,
) {
  const state = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)?.state;
  if (state === undefined) throw new Error(`${occurrenceId} state is missing`);
  return state;
}

function occurrenceEncounterSelections(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: string,
) {
  const selections = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.encounters.encounterKeyByPhase;
  if (selections === undefined) throw new Error(`${occurrenceId} encounter selections are missing`);
  return selections;
}

function hCages(project: ProjectDocument) {
  const state = occurrenceState(
    project,
    'Underworld',
    'H',
    createOccurrenceId('golden-h-combat02'),
  );
  if (state.kind !== 'fieldsCombat') throw new Error('H Fields state is missing');
  return state.cages;
}

function shipWheel(project: ProjectDocument, wheelKey: 'wheel1' | 'wheel2') {
  const state = occurrenceState(project, 'Surface', 'O', oOccurrenceIds.combat07);
  if (state.kind !== 'shipCombat') throw new Error('O Ship state is missing');
  const wheel = state.wheels[wheelKey];
  if (wheel === undefined) throw new Error(`O Ship ${wheelKey} is missing`);
  return wheel;
}

function shipWheel2(project: ProjectDocument) {
  return shipWheel(project, 'wheel2');
}

function dormantShopProject(): { readonly project: ProjectDocument; readonly shopId: string } {
  const start = createOccurrenceId('occurrence-workbench-f-start');
  const combat = createOccurrenceId('occurrence-workbench-f-combat');
  const shop = createOccurrenceId('occurrence-workbench-dormant-shop');
  const source = { kind: 'occurrence' as const, occurrenceId: start };
  let project = applyProjectCommand(emptyFProject(), catalog, {
    kind: 'CreateStart',
    biome: goldenFBiome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, source, 'exit1'),
    occurrenceId: combat,
    gameName: 'F_Combat03',
  });
  const secondSource = { kind: 'occurrence' as const, occurrenceId: combat };
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, secondSource),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, secondSource),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, secondSource, 'exit1'),
    occurrenceId: createOccurrenceId('occurrence-workbench-shop-sibling'),
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, secondSource, 'exit2'),
    occurrenceId: shop,
    gameName: 'F_Shop01',
  });
  return { project, shopId: shop };
}

describe('OccurrenceWorkbench', () => {
  it('renders the additive Gorgon condition and Athena child for a pending phase', async () => {
    const occurrenceId = pOccurrenceId('P_Combat12', 8, 1);
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const view = renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    const condition = screen.getByRole('checkbox', {
      name: 'Death Defiance condition met (Gorgon Amulet)',
    }) as HTMLInputElement;
    expect(condition.disabled).toBe(false);
    await view.user.click(condition);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit Trait: Divine Dash/ })).toBeTruthy();
    });
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
        ?.encounters.gorgonResultByPhase?.Combat?.deathDefianceConditionMet,
    ).toBe(true);
  });

  it('keeps a context-invalid Gorgon child visible as a repair surface', () => {
    const occurrenceId = pOccurrenceId('P_Combat12', 8, 1);
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId },
      'Combat',
    );
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'AthenaCombatP',
    });
    renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    const condition = screen.getByRole('checkbox', {
      name: 'Death Defiance condition met (Gorgon Amulet)',
    }) as HTMLInputElement;
    expect(condition.checked).toBe(true);
    expect(condition.disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Edit Trait: Divine Dash · Epic/ })).toBeTruthy();
  });

  it('renders and dispatches the phase-local Fig Leaf checkbox on a supported fixed phase', async () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'N',
      occurrenceById(nOccurrenceIds.preHub),
    );
    const skip = screen.getByRole('checkbox', { name: 'Skip combat with Fig Leaf' });
    expect((skip as HTMLInputElement).disabled).toBe(false);
    await view.user.click(skip);
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history.present.routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === nOccurrenceIds.preHub,
        );
      expect(occurrence?.encounters.figLeafSkipByPhase).toMatchObject({ Encounter: true });
    });
  });

  it('activates a context-invalid dormant Blind Box, then repairs its source on the pickup row', async () => {
    let project = createCompleteFGProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    const decision = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.normal.targets.some(
            (target) => target.occurrenceId === occurrence.occurrenceId,
          ),
      );
    if (decision === undefined || decision.kind !== 'exit') {
      throw new Error('Narcissus story has no owning door decision');
    }
    const target = decision.normal.targets.find(
      (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
    );
    if (target === undefined) throw new Error('Narcissus target is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, decision.source),
      value: { kind: 'normal', exitKey: target.exitKey },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusI' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusC' },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
      },
    });
    expect(
      project.routes
        .flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )?.acquisitionSites?.roomExit?.pickupEntries?.mysteryBoon,
    ).toBeDefined();
    const view = renderDecisionWorkbench(project, 'Underworld', 'G', (biome) => {
      const node = biome.nodes.find(
        (candidate): candidate is WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode =>
          (candidate.kind === 'ordinaryBatch' || candidate.kind === 'mixedBatch') &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === occurrence.occurrenceId,
      );
      return node === undefined ? undefined : { kind: 'node', node };
    });
    const pickedUp = screen.getByRole('checkbox', { name: 'Picked up mysteryBoon' });
    expect((pickedUp as HTMLInputElement).disabled).toBe(false);
    const acquisitions = screen.getByText('Acquisitions').closest('section');
    if (acquisitions === null) throw new Error('Narcissus acquisitions workbench is missing');
    expect(within(acquisitions).queryByRole('button', { name: 'Reward' })).toBeNull();

    await view.user.click(pickedUp);
    const reward = await within(acquisitions).findByRole('button', { name: 'Reward' });
    await view.user.click(reward);
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Hestia'));

    const entry = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      )?.acquisitionSites?.roomExit?.pickupEntries?.mysteryBoon;
    expect(entry).toMatchObject({
      offer: { payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
      traitOffersByAcquisitionRole: { hiddenSource: { giverKey: 'Hestia' } },
    });
    expect(
      (
        within(acquisitions).getByRole('checkbox', {
          name: 'Picked up mysteryBoon',
        }) as HTMLInputElement
      ).disabled,
    ).toBe(false);
  });

  it('renders retained Anomaly map, outcome, and revert controls as exact commands', async () => {
    const { occurrenceId, project } = authoredAnomalyProject();
    const application = createApplication();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrenceId),
      application,
    );
    const map = screen.getByLabelText('Map');
    const reward = screen.getByLabelText('Reward');
    const cleared = screen.getByRole('checkbox', { name: 'Cleared' });
    const restore = screen.getByRole('button', { name: 'Restore Combat 01' });
    expect((map as HTMLSelectElement).value).toBe('B_Combat01');
    expect((cleared as HTMLInputElement).checked).toBe(true);
    expect(map.compareDocumentPosition(reward) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(reward.compareDocumentPosition(cleared) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(cleared.compareDocumentPosition(restore) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.queryByLabelText('Customize')).toBeNull();
    await view.user.selectOptions(screen.getByLabelText('Map'), 'B_Combat05');
    await view.user.click(screen.getByRole('checkbox', { name: 'Cleared' }));
    await view.user.click(screen.getByRole('button', { name: 'Restore Combat 01' }));
    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([
      {
        gameName: 'B_Combat05',
        kind: 'ReplaceAnomalyMap',
        occurrence: createOccurrenceAddress(createBiomeAddress('Underworld', 'G'), occurrenceId),
      },
      {
        kind: 'ReplaceAnomalySuccess',
        occurrence: createOccurrenceAddress(createBiomeAddress('Underworld', 'G'), occurrenceId),
        success: false,
      },
      {
        kind: 'RevertAnomaly',
        occurrence: createOccurrenceAddress(createBiomeAddress('Underworld', 'G'), occurrenceId),
      },
    ]);
  });

  it('keeps Anomaly controls available for a retained invalid reward state', () => {
    const { occurrenceId, project } = authoredAnomalyProject();
    const invalid = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(createBiomeAddress('Underworld', 'G'), occurrenceId),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'AphroditeUpgrade',
        },
      },
    });
    renderOccurrenceWorkbench(invalid, 'Underworld', 'G', occurrenceById(occurrenceId));
    expect(screen.getByLabelText('Map')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Cleared' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore Combat 01' })).toBeTruthy();
  });
  it('shows a Hub room main reward read-only and focuses its board owner without authoring', async () => {
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const context = screen.getByLabelText('Hub reward');
    expect(within(context).getByText('Big Max Magick')).toBeTruthy();
    expect(within(context).queryByRole('button', { name: 'Reward' })).toBeNull();
    const edit = within(context).getByRole('button', { name: 'Edit Hub reward' });
    expect(edit.classList.contains('quiet-action')).toBe(true);
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(edit);

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createIncomingRewardAddress(nBiome, nOccurrenceId('combat02')),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
  });

  it('shows a fixed Hub reward context without an edit action', () => {
    const project = createRepresentativeNProject({
      openSlotKeys: [
        'combat11',
        'combat10',
        'combat09',
        'combat05',
        'combat03',
        'combat02',
        'combat01',
        'miniBoss01',
        'story',
      ],
      visitSlotKeys: ['story', 'combat05', 'miniBoss01', 'combat02', 'combat11', 'combat09'],
    });
    renderStaticOccurrenceWorkbench(
      project,
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('story')),
    );

    const context = screen.getByLabelText('Hub reward');
    expect(within(context).getByText('Story')).toBeTruthy();
    expect(within(context).queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
    expect(within(context).queryByRole('button', { name: 'Reward' })).toBeNull();
  });

  it('withholds dormant Ephyra side controls and leaves rooms without local detail compact', () => {
    renderStaticOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat10')),
    );
    expect(
      screen.getByText(
        'Side rooms become available after this room is selected in the visit order.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Side rooms' })).toBeNull();
    expect(screen.queryByLabelText('Side Room 01 generation')).toBeNull();
    cleanup();

    renderStaticOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('miniBoss01')),
    );
    expect(screen.queryByText('No additional room details.')).toBeNull();
    expect(screen.queryByLabelText('Customize')).toBeNull();
    expect(screen.queryByText('Fixed reward:')).toBeNull();
  });

  it('exposes Encounter customization when the F default set becomes meaningful', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const node = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
    );
    if (node === undefined) throw new Error('F occurrence workbench is missing');

    expect(node.room.encounterPhases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ address: phase, customizable: true, resettable: false }),
      ]),
    );
    expect(workspaceProjection(view.application).focusByOwner.has(semanticAddressKey(phase))).toBe(
      true,
    );
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(phase),
      ),
    ).toBe(true);
    expect(screen.getByLabelText('Customize')).toBeTruthy();
    expect(screen.getByLabelText('Encounter encounter phase')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
  });

  it('withholds and restores the P Combat suffix after a terminating Heracles Intro selection', async () => {
    const occurrenceId = pOccurrenceId('P_Combat02', 2, 1);
    const owner = { kind: 'occurrence' as const, occurrenceId };
    const intro = createEncounterPhaseAddress(pBiome, owner, 'Intro');
    const combat = createEncounterPhaseAddress(pBiome, owner, 'Combat');
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'P',
      occurrenceById(occurrenceId),
    );
    const retainedCombat = occurrenceEncounterSelections(
      view.application.store.getState().projectWorkspace.history.present,
      'Surface',
      'P',
      occurrenceId,
    ).Combat;

    if (retainedCombat === undefined)
      throw new Error('P Combat 02 has no retained Combat selection');

    const introControl = screen.getByLabelText('Intro encounter phase');
    expect(screen.getByLabelText('Combat encounter phase')).toBeTruthy();
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(combat),
      ),
    ).toBe(true);

    await view.user.click(within(introControl).getByRole('button', { name: 'Encounter' }));
    await view.user.click(screen.getByRole('option', { name: /Heracles combat/ }));

    await waitFor(() => expect(screen.queryByLabelText('Combat encounter phase')).toBeNull());
    expect(
      occurrenceEncounterSelections(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'P',
        occurrenceId,
      ),
    ).toMatchObject({ Combat: retainedCombat, Intro: 'HeraclesCombatP' });
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(combat),
      ),
    ).toBe(false);
    expect(workspaceProjection(view.application).focusByOwner.has(semanticAddressKey(combat))).toBe(
      false,
    );

    await view.user.click(within(introControl).getByRole('button', { name: 'Encounter' }));
    await view.user.click(screen.getByRole('option', { name: /Pre-combat/ }));

    await waitFor(() => expect(screen.getByLabelText('Combat encounter phase')).toBeTruthy());
    expect(
      occurrenceEncounterSelections(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'P',
        occurrenceId,
      ),
    ).toMatchObject({ Combat: retainedCombat, Intro: 'GeneratedP_PreCombat' });
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.get(
        semanticAddressKey(combat),
      ),
    ).toMatchObject({
      owner: combat,
      selected: retainedCombat,
    });
    expect(workspaceProjection(view.application).focusByOwner.has(semanticAddressKey(intro))).toBe(
      true,
    );
  });

  it('keeps P Combat interactive when the selected Heracles Intro is invalid', async () => {
    const occurrenceId = pOccurrenceId('P_Combat02', 2, 1);
    const owner = { kind: 'occurrence' as const, occurrenceId };
    const intro = createEncounterPhaseAddress(pBiome, owner, 'Intro');
    const combat = createEncounterPhaseAddress(pBiome, owner, 'Combat');
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      encounterKey: 'HeraclesCombatP',
      kind: 'SelectEncounter',
      phase: intro,
    });
    project = applyProjectCommand(project, catalog, {
      encounterKey: 'HeraclesCombatN',
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: nOccurrenceId('combat05') },
        'Encounter',
      ),
    });
    const view = renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));

    const introControl = screen.getByLabelText('Intro encounter phase');
    const combatControl = screen.getByLabelText('Combat encounter phase');
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(combat),
      ),
    ).toBe(true);
    await view.user.click(within(introControl).getByRole('button', { name: 'Encounter' }));
    await waitFor(() =>
      expect(
        within(introControl)
          .getByRole('button', { name: 'Encounter' })
          .getAttribute('data-candidate-state'),
      ).toBe('impossible'),
    );

    const combatPicker = within(combatControl).getByRole('button', { name: 'Encounter' });
    expect((combatPicker as HTMLButtonElement).disabled).toBe(false);
    await view.user.click(combatPicker);
    await waitFor(() =>
      expect(combatPicker.getAttribute('data-candidate-state')).toBe('unassessed'),
    );
  });

  it('keeps impossible side-room positions visible and disabled when not generated', async () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat02'),
        'sideRooms',
        'sideDoor2',
      ),
      generation: 'notGenerated',
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const entryOrder = screen.getByRole('combobox', {
      name: 'Side Room 03 visit order',
    }) as HTMLSelectElement;
    await view.user.click(entryOrder);
    await waitFor(() => {
      expect(Array.from(entryOrder.options).map((option) => option.textContent)).toEqual([
        'Not visited',
        '1st — unavailable',
        '2nd — unavailable',
      ]);
      expect(entryOrder.value).toBe('notEntered');
      expect(entryOrder.options[0]?.disabled).toBe(false);
      expect(
        Array.from(entryOrder.options)
          .slice(1)
          .every((option) => option.disabled),
      ).toBe(true);
    });
    expect(nHubOccurrence(view.application, 'combat02').state).toMatchObject({
      sideRooms: { sideDoor2: { generation: 'notGenerated', enteredOrdinal: null } },
    });
  });

  it('orders side rooms by priority and exposes rewards only while generated', async () => {
    const sideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    const reward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom,
      generation: 'generated',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward,
      value: { rewardType: 'AirBoost' },
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const table = screen.getByRole('table', {
      name: 'Ephyra side-room generation and visit order',
    });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Room', 'Priority', 'Generated', 'Visit order']);
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map(
          (row) => row.querySelector('.ephyra-side-room-heading .owner-markers span')?.textContent,
        ),
    ).toEqual(['Side Room 03', 'Side Room 01']);

    const sideRow = () => {
      const row = screen.getByText('Side Room 03').closest('tr');
      if (row === null) throw new Error('Side Room 03 row is missing');
      return row;
    };
    expect(within(sideRow()).getByRole('button', { name: 'Reward' })).toBeTruthy();
    expect(sideRow().querySelector('.encounter-phase-control')).toBeNull();

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceSideRoomGeneration',
          sideRoom,
          generation: 'notGenerated',
        }),
      ),
    );
    await waitFor(() => {
      expect(within(sideRow()).queryByRole('button', { name: 'Reward' })).toBeNull();
      expect(within(sideRow()).getByLabelText('Side Room 03 generation')).toBeTruthy();
      expect(within(sideRow()).getByLabelText('Side Room 03 visit order')).toBeTruthy();
    });

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceSideRoomGeneration',
          sideRoom,
          generation: 'generated',
        }),
      ),
    );
    await waitFor(() =>
      expect(within(sideRow()).getByRole('button', { name: 'Reward' })).toBeTruthy(),
    );
  });

  it('applies a direct side-room insertion as one undoable complete order', async () => {
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const table = screen.getByRole('table', {
      name: 'Ephyra side-room generation and visit order',
    });
    expect(within(table).getByRole('columnheader', { name: 'Room' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enter last|Earlier|Later/ })).toBeNull();
    const entryOrder = within(table).getByRole('combobox', {
      name: 'Side Room 03 visit order',
    }) as HTMLSelectElement;
    await view.user.click(entryOrder);
    await waitFor(() =>
      expect(
        Array.from(entryOrder.options).find((option) => option.value === 'position:1')?.dataset
          .candidateSupport,
      ).not.toBe('unavailable'),
    );
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.selectOptions(entryOrder, 'position:1');
    await waitFor(() =>
      expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
        'sideDoor3',
        'sideDoor2',
        'sideDoor1',
      ]),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength + 1,
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
        'sideDoor2',
        'sideDoor1',
      ]),
    );
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    await waitFor(() =>
      expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
        'sideDoor3',
        'sideDoor2',
        'sideDoor1',
      ]),
    );
  });

  it('edits an entered local-child encounter through its exact phase and restores its default', async () => {
    const parent = nOccurrenceId('combat05');
    const phase = createEncounterPhaseAddress(
      nBiome,
      {
        kind: 'localChild',
        occurrenceId: parent,
        groupKey: 'sideRooms',
        slotKey: 'sideDoor2',
      },
      'Encounter',
    );
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(parent),
    );
    const sideRoom = screen.getByText('Side Room 07').closest('tr');
    if (sideRoom === null) throw new Error('entered Side Room 07 is missing');
    const encounter = sideRoom.querySelector<HTMLElement>('.encounter-phase-control');
    if (encounter === null) throw new Error('entered Side Room 07 encounter is missing');
    expect(
      encounter.querySelector('.semantic-owner-marker')?.getAttribute('data-semantic-owner'),
    ).toBe(semanticAddressKey(phase));
    const picker = within(encounter).getByRole('button', { name: 'Encounter' });
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(picker);
    await view.user.click(screen.getByText('Large side-room combat'));
    await waitFor(() => {
      const state = occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'N',
        parent,
      );
      expect(state).toMatchObject({
        kind: 'ephyraCombat',
        sideRooms: {
          sideDoor2: {
            encounters: { encounterKeyByPhase: { Encounter: 'GeneratedNSubRoom_Bigger' } },
          },
        },
      });
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength + 1,
    );

    await view.user.click(within(encounter).getByRole('button', { name: 'Reset to default' }));
    await waitFor(() => {
      const state = occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'N',
        parent,
      );
      expect(state).toMatchObject({
        kind: 'ephyraCombat',
        sideRooms: {
          sideDoor2: {
            encounters: { encounterKeyByPhase: { Encounter: 'GeneratedNSubRoom' } },
          },
        },
      });
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength + 2,
    );
  });

  it('retains an activation-invalid multi-choice Ship phase as an unavailable encounter selector', async () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      encounterCount: 3,
      kind: 'ReplaceShipEncounterCount',
      occurrence,
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    const count = screen.getByRole('combobox', { name: /Combat phases/ }) as HTMLSelectElement;
    const phase = screen.getByLabelText('Combat2 encounter phase');
    const customize = screen.getByLabelText('Customize') as HTMLDetailsElement;
    const phaseAddress = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Combat2',
    );
    const finding = simulateProject(catalog, project).findings.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(phaseAddress),
    );
    if (finding === undefined) throw new Error('invalid Ship Combat2 finding is missing');
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;

    expect(customize.open).toBe(false);
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(customize.open).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
    await view.user.click(count);
    await waitFor(() => {
      expect(count.dataset.candidateSupport).toBe('impossible');
      expect(Array.from(count.options).map((option) => option.value)).toEqual(['2', '3']);
      expect(count.options[0]?.disabled).toBe(false);
      expect(count.options[1]?.disabled).toBe(true);
    });
    expect(phase.dataset.readOnly).toBeUndefined();
    const encounter = within(phase).getByRole('button', { name: 'Encounter' });
    await view.user.click(encounter);
    await waitFor(() => {
      expect(encounter.getAttribute('data-candidate-state')).toBe('impossible');
      expect(
        screen.getAllByText('This encounter phase is not active for the selected room setup.'),
      ).not.toHaveLength(0);
    });
    expect(within(phase).queryByRole('button', { name: 'Reset to default' })).toBeNull();
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(phaseAddress),
      ),
    ).toBe(true);
  });

  it('keeps an invalid I default selected while exposing only its exact Goal correction', async () => {
    const occurrenceId = createOccurrenceId('golden-i-combat01');
    const phase = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'I'),
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const initial = createGoldenFGHIProject();
    const reset = applyProjectCommand(initial, catalog, { kind: 'ResetEncounter', phase });
    const view = renderOccurrenceWorkbench(reset, 'Underworld', 'I', occurrenceById(occurrenceId));
    const finding = simulateProject(catalog, reset).findings.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(phase),
    );
    if (finding === undefined) throw new Error('invalid I encounter finding is missing');
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;
    const customize = screen.getByLabelText('Customize') as HTMLDetailsElement;

    expect(customize.open).toBe(false);
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(customize.open).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
    await view.user.click(screen.getByText('Customize'));
    await waitFor(() => expect(customize.open).toBe(false));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(customize.open).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
    const encounter = screen.getByLabelText('Encounter encounter phase');
    const picker = within(encounter).getByRole('button', { name: 'Encounter' });

    await view.user.click(picker);
    await waitFor(() => {
      expect(picker.getAttribute('data-candidate-state')).toBe('impossible');
      expect(screen.getByText('Current selection')).toBeTruthy();
      expect(
        screen.getAllByText('This encounter does not meet the current encounter requirements.'),
      ).not.toHaveLength(0);
      expect(screen.getByText('Goal combat')).toBeTruthy();
    });

    await view.user.click(screen.getByText('Goal combat'));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'I')
          ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
          ?.encounters.encounterKeyByPhase,
      ).toEqual({ Encounter: 'GeneratedI_GoalReward' }),
    );
    expect(
      simulateProject(catalog, view.application.store.getState().projectWorkspace.history.present)
        .status,
    ).toBe('valid');
  });

  it('withholds an unavailable opening Ship Combat2 count from new authoring', async () => {
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    const count = screen.getByRole('combobox', { name: /Combat phases/ }) as HTMLSelectElement;
    const ship = screen.getByLabelText('Ship combat structure');
    const customize = screen.getByLabelText('Customize') as HTMLDetailsElement;

    expect(customize.open).toBe(false);
    expect(ship.closest('.room-customization')).toBeNull();
    expect(count.closest('.room-customization')).toBeNull();
    act(() =>
      view.application.store.dispatch(
        semanticOwnerNavigated(createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1')),
      ),
    );
    await waitFor(() => expect(customize.open).toBe(false));

    await view.user.click(count);
    await waitFor(() => {
      expect(count.dataset.candidateSupport).toBe('forced');
      expect(Array.from(count.options).map((option) => option.value)).toEqual(['2']);
    });
  });

  it('renders only active Fields cages and restores the retained third cage', () => {
    const decision = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: goldenHStartId,
    });
    const max = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'max',
    });
    const min = applyProjectCommand(max, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'min',
    });
    const restored = applyProjectCommand(min, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'max',
    });

    expect(hCages(restored).cage3).toEqual(hCages(max).cage3);

    renderStaticOccurrenceWorkbench(
      min,
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    const minCages = screen.getByLabelText('Fields cage rewards');
    expect(within(minCages).getByLabelText('Cage 1')).toBeTruthy();
    expect(within(minCages).getByLabelText('Cage 2')).toBeTruthy();
    expect(within(minCages).queryByLabelText('Cage 3')).toBeNull();
    expect(minCages.querySelectorAll('.local-reward-slot')).toHaveLength(2);
    cleanup();

    renderStaticOccurrenceWorkbench(
      restored,
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    const restoredCages = screen.getByLabelText('Fields cage rewards');
    expect(within(restoredCages).getByLabelText('Cage 1')).toBeTruthy();
    expect(within(restoredCages).getByLabelText('Cage 2')).toBeTruthy();
    const restoredCage = within(restoredCages).getByLabelText('Cage 3');
    expect(restoredCages.querySelectorAll('.local-reward-slot')).toHaveLength(3);
    expect(within(restoredCage).getByRole('button', { name: 'Reward' }).textContent).toContain(
      'Hestia',
    );
  });

  it('keeps unpicked Fields cage rewards on the main room surface', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat03')),
    );

    const cages = screen.getByLabelText('Fields cage rewards');
    expect(within(cages).getByLabelText('Cage 1')).toBeTruthy();
    expect(within(cages).getByLabelText('Cage 2')).toBeTruthy();
    expect(cages.closest('.room-customization')).toBeNull();
    expect(screen.queryByLabelText('Customize')).toBeNull();
  });

  it('omits the Fields section when its retained cages are all inactive', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    renderOccurrenceWorkbench(createGoldenFGHIProject(), 'Underworld', 'H', (biome) => {
      const node = occurrenceById(occurrenceId)(biome);
      if (node?.room.roomLocal.kind !== 'fields') return node;
      return {
        ...node,
        room: {
          ...node.room,
          roomLocal: {
            ...node.room.roomLocal,
            cages: node.room.roomLocal.cages.map((cage) => ({ ...cage, active: false })),
          },
        },
      };
    });

    expect(screen.queryByLabelText('Fields cage rewards')).toBeNull();
    expect(screen.queryByLabelText('Cage 1')).toBeNull();
  });

  it('hides dormant Ship wheels and restores their authored configuration', async () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelPicked',
      wheel,
      pickedOfferIndex: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'GiftDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer2'),
      value: { rewardType: 'MetaCurrencyDrop' },
    });

    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    const initialWheel = screen.getByLabelText('Combat 2 reward');
    const ship = screen.getByLabelText('Ship combat structure');
    expect(
      Array.from(ship.querySelectorAll('.reward-wheel h4')).map((heading) => heading.textContent),
    ).toEqual(['Combat 1 reward', 'Combat 2 reward']);
    expect(within(screen.getByLabelText('Combat 1 reward')).queryByLabelText('Offer 2')).toBeNull();
    expect(
      (within(initialWheel).getByRole('combobox', { name: 'Reward pool' }) as HTMLSelectElement)
        .value,
    ).toBe('MetaProgress');
    expect(
      (within(initialWheel).getByRole('combobox', { name: 'Offers' }) as HTMLSelectElement).value,
    ).toBe('2');
    expect(
      (within(initialWheel).getByRole('combobox', { name: 'Picked offer' }) as HTMLSelectElement)
        .value,
    ).toBe('2');

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceShipEncounterCount',
          occurrence,
          encounterCount: 2,
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByLabelText('Combat 2 reward')).toBeNull());
    expect(
      Array.from(ship.querySelectorAll('.reward-wheel h4')).map((heading) => heading.textContent),
    ).toEqual(['Combat 1 reward']);

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceShipEncounterCount',
          occurrence,
          encounterCount: 3,
        }),
      ),
    );
    await waitFor(() => expect(screen.getByLabelText('Combat 2 reward')).toBeTruthy());
    expect(
      Array.from(ship.querySelectorAll('.reward-wheel h4')).map((heading) => heading.textContent),
    ).toEqual(['Combat 1 reward', 'Combat 2 reward']);

    const restoredWheel = screen.getByLabelText('Combat 2 reward');
    expect(
      (within(restoredWheel).getByRole('combobox', { name: 'Reward pool' }) as HTMLSelectElement)
        .value,
    ).toBe('MetaProgress');
    expect(
      (within(restoredWheel).getByRole('combobox', { name: 'Offers' }) as HTMLSelectElement).value,
    ).toBe('2');
    expect(
      (within(restoredWheel).getByRole('combobox', { name: 'Picked offer' }) as HTMLSelectElement)
        .value,
    ).toBe('2');
    expect(
      within(within(restoredWheel).getByLabelText('Offer 1')).getByRole('button', {
        name: 'Reward',
      }).textContent,
    ).toContain('Nectar');
    expect(
      within(within(restoredWheel).getByLabelText('Offer 2')).getByRole('button', {
        name: 'Reward',
      }).textContent,
    ).toContain('Bones');
    expect(shipWheel2(view.application.store.getState().projectWorkspace.history.present)).toEqual(
      shipWheel2(project),
    );
  });

  it('keeps a supported Ship phase count authorable when its dormant rewards need repair', async () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer2'),
      value: { rewardType: 'SpellDrop' },
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    const count = screen.getByRole('combobox', { name: /Combat phases/ }) as HTMLSelectElement;

    await view.user.click(count);
    await waitFor(() => {
      expect(Array.from(count.options).map((option) => option.value)).toEqual(['2', '3']);
      expect(count.options[1]?.disabled).toBe(false);
      expect(count.options[1]?.dataset.candidateSupport).toBe('possible');
    });

    await view.user.selectOptions(count, '3');
    await waitFor(() => expect(screen.getByLabelText('Combat 2 reward')).toBeTruthy());
    expect(
      occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'O',
        occurrence.occurrenceId,
      ),
    ).toMatchObject({ kind: 'shipCombat', encounterCount: 3 });
  });

  it('hides dormant Ship wheel offers while retaining their authored reward', async () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    const offer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat07,
      'wheel1',
      'offer2',
    );
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );

    const rewardWheel = screen.getByLabelText('Combat 1 reward');
    expect(within(rewardWheel).queryByLabelText('Offer 2')).toBeNull();

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRewardWheelOfferCount',
          wheel,
          offerCount: 2,
        }),
      ),
    );
    await waitFor(() => expect(within(rewardWheel).getByLabelText('Offer 2')).toBeTruthy());

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRewardWheelOffer',
          offer,
          value: { rewardType: 'MetaCurrencyDrop' },
        }),
      ),
    );
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRewardWheelPicked',
          wheel,
          pickedOfferIndex: 2,
        }),
      ),
    );

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRewardWheelOfferCount',
          wheel,
          offerCount: 1,
        }),
      ),
    );
    await waitFor(() => expect(within(rewardWheel).queryByLabelText('Offer 2')).toBeNull());
    expect(
      (within(rewardWheel).getByRole('combobox', { name: 'Picked offer' }) as HTMLSelectElement)
        .value,
    ).toBe('1');
    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history.present, 'wheel1').offers
        .offer2,
    ).toEqual({
      offer: { rewardType: 'MetaCurrencyDrop' },
      conversionByAcquisitionRole: { self: 'normal' },
      traitOffersByAcquisitionRole: {},
    });

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRewardWheelOfferCount',
          wheel,
          offerCount: 2,
        }),
      ),
    );
    const restoredOffer = await within(rewardWheel).findByLabelText('Offer 2');
    expect(within(restoredOffer).getByRole('button', { name: 'Reward' }).textContent).toContain(
      'Bones',
    );
    expect(
      (within(rewardWheel).getByRole('combobox', { name: 'Picked offer' }) as HTMLSelectElement)
        .value,
    ).toBe('1');
  });

  it('renders materialized Shop descriptors directly', () => {
    const surface = createRepresentativeNOPQProject();
    renderStaticOccurrenceWorkbench(
      surface,
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );
    expect(screen.getAllByText('Participation')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Preboss' })).toBeTruthy();
    expect(screen.queryByLabelText('Customize')).toBeNull();
  });

  it('renders and binds the applicable Shop Death Defiance repair control', async () => {
    const project = createGoldenFGHIProject();
    const shop = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.gameName === 'I_PreBoss02');
    if (shop === undefined) throw new Error('missing I Shop fixture');
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'I',
      occurrenceById(shop.occurrenceId),
    );
    const control = screen.getByLabelText('Death Defiance condition met') as HTMLInputElement;
    expect(control.checked).toBe(false);
    const before = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(control);
    expect(control.checked).toBe(true);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
  });

  it('authors Shop membership and order through the settlement site per row action', async () => {
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );
    const order = () => {
      const state = occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'P',
        pOccurrenceIds.prebossShop,
      );
      if (state.kind !== 'shop' || state.shop === undefined) {
        throw new Error('P Preboss Shop state is missing');
      }
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === pOccurrenceIds.prebossShop,
        );
      if (occurrence === undefined) throw new Error('P Preboss Shop occurrence is missing');
      return occurrence.acquisitionSites?.roomExit?.order;
    };
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByLabelText('Purchase Offer 1'));
    expect(order()).toEqual(['Boon']);

    await view.user.click(screen.getByLabelText('Purchase Offer 2'));
    expect(order()).toEqual(['Boon', 'MajorNonBoon']);

    await view.user.click(screen.getAllByRole('button', { name: 'Move earlier' })[1]!);
    expect(order()).toEqual(['MajorNonBoon', 'Boon']);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 3,
    );
  }, 15_000);

  it('authors the Travel Deal refill through the Shop checkbox and one acquisition chronology', async () => {
    const shopId = createOccurrenceId('golden-g-preboss-shop');
    const project = travelDealGPrebossProject();
    const view = renderOccurrenceWorkbench(project, 'Underworld', 'G', occurrenceById(shopId));
    const order = () => {
      const state = occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'G',
        shopId,
      );
      if (state.kind !== 'shop') throw new Error('F Preboss Shop state is missing');
      return view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)
        ?.acquisitionSites?.roomExit?.order;
    };

    expect(screen.getByText('3 opportunities')).toBeTruthy();
    expect(
      screen.getByText(
        'Purchase order needs one paid Shop offer before this refill can be edited.',
      ),
    ).toBeTruthy();
    await view.user.click(screen.getByLabelText('Purchase Offer 2'));
    const refill = await screen.findByRole('checkbox', {
      name: 'Purchase Travel Deal refill after Offer 2',
    });
    expect(screen.getByText('4 opportunities')).toBeTruthy();
    expect((refill as HTMLInputElement).checked).toBe(false);
    expect(order()).toEqual(['MajorNonBoon']);
    const refillShopRow = screen.getByText('Travel Deal refill after Offer 2').closest('tr');
    const refillRewardRow = refillShopRow?.nextElementSibling;
    if (!(refillRewardRow instanceof HTMLElement))
      throw new Error('Travel Deal refill reward row is missing');
    const refillReward = within(refillRewardRow).getByRole('button', { name: 'Reward' });
    await view.user.click(refillReward);
    const refillChoices = await screen.findByRole('listbox');
    await view.user.click(within(refillChoices).getByText('Max Health'));
    expect(order()).toEqual(['MajorNonBoon']);
    const materializedRefill =
      occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'G',
        shopId,
      ).kind === 'shop'
        ? view.application.store
            .getState()
            .projectWorkspace.history.present.routes.find(
              (route) => route.routeKey === 'Underworld',
            )
            ?.biomes.find((biome) => biome.biomeKey === 'G')
            ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)
            ?.acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill
        : undefined;
    expect(materializedRefill?.offer).toEqual({ rewardType: 'MaxHealthDrop' });

    await view.user.click(refill);
    expect(order()).toEqual(['MajorNonBoon', 'travelDealRefill']);
    await view.user.click(screen.getByLabelText('Purchase Offer 3'));
    expect(order()).toEqual(['MajorNonBoon', 'travelDealRefill', 'Minor']);

    const refillEntry = screen
      .getAllByText('Travel Deal refill after Offer 2')
      .map((label) => label.closest('.acquisition-entry'))
      .find((entry): entry is HTMLElement => entry !== null);
    if (refillEntry === undefined) throw new Error('Travel Deal acquisition entry is missing');
    await view.user.click(within(refillEntry).getByRole('button', { name: 'Move later' }));
    expect(order()).toEqual(['MajorNonBoon', 'Minor', 'travelDealRefill']);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(order()).toEqual(['MajorNonBoon', 'travelDealRefill', 'Minor']);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(order()).toEqual(['MajorNonBoon', 'Minor', 'travelDealRefill']);
  }, 15_000);

  it('edits, picks up, and weaves Gold through the shared Shop product with undo and redo', async () => {
    const shopId = createOccurrenceId('golden-h-preboss-shop');
    const project = createEchoGoldHPrebossProject();
    const view = renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(shopId));
    const authoredSite = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shopId)
        ?.acquisitionSites?.roomExit;

    expect(
      screen.getByText(
        'Purchase order needs one paid non-Spell Shop offer before this duplicate can be edited.',
      ),
    ).toBeTruthy();
    await view.user.click(screen.getByLabelText('Purchase Offer 3'));
    const pickedUp = await screen.findByRole('checkbox', {
      name: 'Pick up Gold Gold Gold duplicate of Offer 3',
    });
    expect((pickedUp as HTMLInputElement).checked).toBe(false);
    expect(authoredSite()?.order).toEqual(['Minor']);
    expect(authoredSite()?.pickupEntries?.echoDoubleShopReward).toBeUndefined();

    const goldShopRow = screen.getByText('Gold Gold Gold duplicate of Offer 3').closest('tr');
    const goldRewardRow = goldShopRow?.nextElementSibling;
    if (!(goldRewardRow instanceof HTMLElement)) throw new Error('Gold reward row is missing');
    const conversion = within(goldRewardRow).getByLabelText(/Time Piece/) as HTMLSelectElement;
    await view.user.selectOptions(conversion, 'gold');
    expect(authoredSite()?.order).toEqual(['Minor']);
    expect(
      authoredSite()?.pickupEntries?.echoDoubleShopReward?.conversionByAcquisitionRole.self,
    ).toBe('gold');

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredSite()?.order).toEqual(['Minor']);
    expect(authoredSite()?.pickupEntries?.echoDoubleShopReward).toBeUndefined();
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(
      authoredSite()?.pickupEntries?.echoDoubleShopReward?.conversionByAcquisitionRole.self,
    ).toBe('gold');

    await view.user.click(pickedUp);
    expect(authoredSite()?.order).toEqual(['Minor', 'echoDoubleShopReward']);
    expect(authoredSite()?.pickupEntries?.echoDoubleShopReward).toBeDefined();
    expect(screen.getAllByText('Gold Gold Gold duplicate of Offer 3')).not.toHaveLength(0);

    await view.user.click(screen.getByLabelText('Purchase Offer 2'));
    expect(authoredSite()?.order).toEqual(['Minor', 'echoDoubleShopReward', 'MajorNonBoon']);
    const goldAcquisition = screen
      .getAllByText('Gold Gold Gold duplicate of Offer 3')
      .map((label) => label.closest('.acquisition-entry'))
      .find((entry): entry is HTMLElement => entry !== null);
    if (goldAcquisition === undefined) throw new Error('Gold chronology entry is missing');
    expect(within(goldAcquisition).queryByRole('button', { name: 'Reward' })).toBeNull();
    await view.user.click(within(goldAcquisition).getByRole('button', { name: 'Move later' }));
    expect(authoredSite()?.order).toEqual(['Minor', 'MajorNonBoon', 'echoDoubleShopReward']);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredSite()?.order).toEqual(['Minor', 'echoDoubleShopReward', 'MajorNonBoon']);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(authoredSite()?.order).toEqual(['Minor', 'MajorNonBoon', 'echoDoubleShopReward']);
  }, 15_000);

  it('edits both supplemental rewards in their rendered Preboss order', async () => {
    const { project, midshopId, prebossId } = contractTravelFShopsProject();
    const entryKinds = (candidate: ProjectDocument, occurrenceId: OccurrenceId) =>
      derivedAcquisitionEntriesForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, candidate),
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenFBiome, occurrenceId),
          'roomExit',
        ),
      ).map((entry) => entry.kind);
    expect(entryKinds(project, midshopId)).toEqual(['travelDealPlaceholder']);
    expect(entryKinds(project, prebossId)).toEqual([
      'infernalContractReward',
      'travelDealPlaceholder',
    ]);
    const view = renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(prebossId));
    const shopRowLabels = () =>
      [...document.querySelectorAll<HTMLTableCellElement>('tr.shop-offer > th')].map(
        (cell) => cell.textContent,
      );
    expect(shopRowLabels()).toEqual([
      'Offer 1',
      'Offer 2',
      'Offer 3',
      'Travel Deal refill',
      'Infernal Contract reward',
    ]);

    const contractRow = screen.getByText('Infernal Contract reward').closest('tr');
    const contractRewardRow = contractRow?.nextElementSibling;
    if (!(contractRewardRow instanceof HTMLElement))
      throw new Error('Infernal Contract reward editor is missing');
    await view.user.click(within(contractRewardRow).getByRole('button', { name: 'Reward' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Pom of Power'));

    await view.user.click(screen.getByLabelText('Purchase Offer 2'));
    const refillLabel = await screen.findByText('Travel Deal refill after Offer 2');
    expect(shopRowLabels()).toEqual([
      'Offer 1',
      'Offer 2',
      'Offer 3',
      'Travel Deal refill after Offer 2',
      'Infernal Contract reward',
    ]);
    const refillRewardRow = refillLabel.closest('tr')?.nextElementSibling;
    if (!(refillRewardRow instanceof HTMLElement))
      throw new Error('Travel Deal reward editor is missing');
    const refillReward = within(refillRewardRow).getByRole('button', { name: 'Reward' });
    const replacementLabel = refillReward.textContent?.includes('Max Health')
      ? 'Max Magick'
      : 'Max Health';
    await view.user.click(refillReward);
    await view.user.click(within(await screen.findByRole('listbox')).getByText(replacementLabel));

    const authored = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === prebossId)
      ?.acquisitionSites?.roomExit?.pickupEntries;
    expect(authored?.infernalContractReward?.offer).toEqual({ rewardType: 'StackUpgrade' });
    expect(authored?.travelDealRefill?.offer.rewardType).toBe(
      replacementLabel === 'Max Health' ? 'MaxHealthDrop' : 'MaxManaDrop',
    );
  }, 15_000);

  it('renders an unpicked Shop as dormant without inventory controls', () => {
    const { project, shopId } = dormantShopProject();
    renderStaticOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));

    expect(screen.getByText('Shop inventory appears when you select this room.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });

  it('keeps an impossible Shop purchase disabled while allowing its selected repair', async () => {
    const offer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
    const purchase = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
        'roomExit',
      ),
      'Boon',
    );
    const unsupportedOffer = {
      rewardType: 'BlindBoxLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'DemeterUpgrade' as const },
    };
    const invalidOfferProject = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: unsupportedOffer,
    });
    const view = renderOccurrenceWorkbench(
      invalidOfferProject,
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );
    const before = view.application.store.getState().projectWorkspace.history.past.length;
    const checkbox = document.getElementById(
      `shop-${semanticAddressKey(purchase)}-purchased`,
    ) as HTMLInputElement | null;
    if (checkbox === null) throw new Error('Boon Shop purchase control is missing');
    await view.user.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
    cleanup();

    const selectedInvalidProject = applyProjectCommand(invalidOfferProject, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: createAcquisitionSiteAddress(
        createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
        'roomExit',
      ),
      entryKeys: ['Boon'],
    });
    const repair = renderOccurrenceWorkbench(
      selectedInvalidProject,
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );
    const repairBefore = repair.application.store.getState().projectWorkspace.history.past.length;
    const repairCheckbox = document.getElementById(
      `shop-${semanticAddressKey(purchase)}-purchased`,
    ) as HTMLInputElement | null;
    if (repairCheckbox === null) throw new Error('selected Boon Shop purchase control is missing');
    await repair.user.click(repairCheckbox);
    expect(repairCheckbox.checked).toBe(false);
    expect(repair.application.store.getState().projectWorkspace.history.past).toHaveLength(
      repairBefore + 1,
    );
  });

  it('keeps a context-invalid acquisition reorder visibly unavailable without dispatching it', async () => {
    const offer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
      'roomExit',
    );
    const invalidOfferProject = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
      },
    });
    const project = applyProjectCommand(invalidOfferProject, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site,
      entryKeys: ['Boon', 'MajorNonBoon'],
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );
    const moveLater = screen.getAllByRole('button', { name: 'Move later' })[0] as
      HTMLButtonElement | undefined;
    if (moveLater === undefined) throw new Error('first acquisition move button is missing');
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(moveLater);

    expect(moveLater.disabled).toBe(true);
    expect(moveLater.getAttribute('data-candidate-support')).toBe('impossible');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
  });
});
