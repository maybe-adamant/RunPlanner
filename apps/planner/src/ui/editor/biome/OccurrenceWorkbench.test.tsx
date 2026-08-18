// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createAcquisitionSiteAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRouteStartKeepsakeSelectionAddress,
  createRouteAddress,
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
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
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
  createCombat08ArtificerRegressionProject,
  createFConversionFrontierProject,
  createFMidshopPomFrontierProject,
  createFMidshopUnresolvedBlindBoxBeforePomProject,
  fMidshopPomShopId,
  authorLegalTraitOffers,
  authorSurfaceWorldShop,
  goldenFBiome,
  goldenFStartId,
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
  delete (document as unknown as { elementFromPoint?: Document['elementFromPoint'] })
    .elementFromPoint;
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

function decisionContainingOccurrence(occurrenceId: OccurrenceId) {
  return (biome: WorkspaceBiome) => {
    const node = biome.nodes.find(
      (candidate): candidate is WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode =>
        (candidate.kind === 'ordinaryBatch' || candidate.kind === 'mixedBatch') &&
        candidate.targets.some((target) => target.room.occurrenceId === occurrenceId),
    );
    return node === undefined ? undefined : { kind: 'node' as const, node };
  };
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
    ['exit2', late3Peer, 'GiftDrop'],
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
  return {
    project: authorLegalTraitOffers(authorSurfaceWorldShop(project, goldenFBiome, prebossId)),
    midshopId,
    prebossId,
  };
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
  it('authors the attached Combat08 Artificer replacement from an exact unresolved checkpoint', () => {
    const combat08 = goldenFOccurrenceId(3, 2);
    const source = createIncomingRewardAddress(goldenFBiome, combat08);
    const acquisition = createAcquisitionRoleAddress(source, 'self');
    const replacementAddress = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenFBiome, combat08),
        'roomRewardPickup',
      ),
      'artificer:self:self',
    );
    let unresolved: ProjectDocument | undefined;
    expect(() => {
      unresolved = applyProjectCommand(createCombat08ArtificerRegressionProject(), catalog, {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition,
        value: { kind: 'artificer', replacement: null },
      });
      simulateProjectAssembly(catalog, unresolved);
    }).not.toThrow();
    if (unresolved === undefined) throw new Error('Combat08 Artificer command did not apply');
    const view = renderOccurrenceWorkbench(unresolved, 'Underworld', 'F', occurrenceById(combat08));
    const workspace = workspaceProjection(view.application);
    const replacementFinding = view.application.store
      .getState()
      .projectWorkspace.assembly.evaluation.routes.flatMap((route) => route.findings)
      .filter(
        (finding) =>
          finding.code === 'rewardMissing' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(replacementAddress),
      );
    expect(replacementFinding).toHaveLength(1);
    expect(workspace.focusByOwner.has(semanticAddressKey(replacementAddress))).toBe(true);
    const replacementEditor = screen.getByText('Replacement reward').closest('fieldset');
    if (!(replacementEditor instanceof HTMLElement)) {
      throw new Error('Combat08 Artificer replacement editor is missing');
    }
    expect(within(replacementEditor).getByRole('button', { name: 'Reward' })).toBeTruthy();

    const conversion = workspace.interactions.acquisitionConversions.get(
      semanticAddressKey(acquisition),
    );
    const replacement = conversion?.artificerReplacementOptions.find(
      (option) => option.offer.rewardType === 'MaxHealthDrop',
    );
    const interaction = workspace.interactions.rewards.get(semanticAddressKey(replacementAddress));
    if (replacement === undefined || interaction === undefined) {
      throw new Error('Combat08 Artificer replacement command is missing');
    }
    expect(() =>
      act(() =>
        view.application.store.dispatch(
          authoredProjectCommandDispatched(interaction.intentFor(replacement.offer).command),
        ),
      ),
    ).not.toThrow();
    expect(
      view.application.store
        .getState()
        .projectWorkspace.assembly.evaluation.routes.flatMap((route) => route.findings)
        .some(
          (finding) =>
            finding.code === 'rewardMissing' &&
            semanticAddressKey(finding.origin) === semanticAddressKey(replacementAddress),
        ),
    ).toBe(false);
    const authored = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === combat08);
    expect(
      authored !== undefined &&
        'reward' in authored.state &&
        authored.state.reward?.dispositionByAcquisitionRole.self,
    ).toMatchObject({ kind: 'artificer', replacement: { offer: { rewardType: 'MaxHealthDrop' } } });
  });

  it('renders an enabled Artificer disposition for reached Nectar with no Pom target', () => {
    renderStaticOccurrenceWorkbench(
      createFConversionFrontierProject('GiftDrop').project,
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    const disposition = screen.getByRole('combobox', {
      name: /^Reward outcome for /,
    });
    expect(within(disposition).getByRole('option', { name: 'Pick up reward' })).toBeTruthy();
    expect(
      (
        within(disposition).getByRole('option', {
          name: 'Artificer · replace reward',
        }) as HTMLOptionElement
      ).disabled,
    ).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Edit Random Pom: No eligible traits' }),
    ).toBeTruthy();
  });

  it('authors an Artificer Boon trait offer after the opening Boon is consumed by Forfeit', async () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const source = createIncomingRewardAddress(goldenFBiome, occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'self');
    let project = applyProjectCommand(
      createFConversionFrontierProject('MetaCurrencyDrop').project,
      catalog,
      {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition,
        value: { kind: 'artificer', replacement: null },
      },
    );
    const openingView = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(goldenFStartId),
    );
    const openingReward = workspaceBiome(openingView.application, 'Underworld', 'F')
      .nodes.find(
        (node): node is WorkspaceOccurrenceWorkbenchNode =>
          node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === goldenFStartId,
      )
      ?.room.rewardControls.find(
        (control) =>
          semanticAddressKey(control.owner.address) ===
          semanticAddressKey(createIncomingRewardAddress(goldenFBiome, goldenFStartId)),
      );
    expect(openingReward?.acquisitionOutcome).toBe('forfeitedByVow');
    expect(screen.getByText('Removed by Vow of Forfeit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit Trait/ })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Reward outcome/ })).toBeNull();
    cleanup();
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const workspace = workspaceProjection(view.application);
    const conversion = workspace.interactions.acquisitionConversions.get(
      semanticAddressKey(acquisition),
    );
    const boon = conversion?.artificerReplacementOptions.find(
      (option) => option.offer.rewardType === 'Boon',
    );
    const replacement = conversion?.artificerReplacementControl;
    const rewardInteraction =
      replacement === undefined
        ? undefined
        : workspace.interactions.rewards.get(semanticAddressKey(replacement.owner.address));
    if (boon === undefined || rewardInteraction === undefined)
      throw new Error('Artificer Boon replacement interaction is missing');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched(rewardInteraction.intentFor(boon.offer).command),
      ),
    );
    expect(await screen.findByRole('button', { name: 'Edit Trait: Choose trait' })).toBeTruthy();
    const editedWorkspace = workspaceProjection(view.application);
    const editedConversion = editedWorkspace.interactions.acquisitionConversions.get(
      semanticAddressKey(acquisition),
    );
    const traitControl = editedConversion?.artificerReplacementControl?.traitOffers?.[0];
    const traitInteraction =
      traitControl === undefined
        ? undefined
        : editedWorkspace.interactions.traitOffers.get(semanticAddressKey(traitControl.address));
    const draft = traitInteraction?.traitsStartingDraft?.();
    if (traitInteraction === undefined || draft === undefined)
      throw new Error('Artificer Boon trait draft is missing');
    expect(draft.options).toHaveLength(3);
    expect(() =>
      act(() =>
        view.application.store.dispatch(
          authoredProjectCommandDispatched(traitInteraction.intentFor(draft).command),
        ),
      ),
    ).not.toThrow();
    project = view.application.store.getState().projectWorkspace.history.present;
    expect(occurrenceState(project, 'Underworld', 'F', occurrenceId)).toMatchObject({
      reward: {
        dispositionByAcquisitionRole: {
          self: {
            kind: 'artificer',
            replacement: {
              offer: { rewardType: 'Boon' },
              traitOffersByAcquisitionRole: {
                source: { kind: 'traits', rarificationActions: [] },
              },
            },
          },
        },
      },
    });
  });

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
      expect(screen.getByRole('button', { name: 'Edit Trait: Choose trait' })).toBeTruthy();
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
      kind: 'ReplaceGorgonAthenaOffer',
      trait: createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena'),
      value: {
        traitKeys: [
          'InvulnerabilityDashBoon',
          'RetaliateInvulnerabilityBoon',
          'FocusLastStandBoon',
        ],
        selectedOptionKey: 'option1',
      },
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
    expect(screen.getByRole('button', { name: 'Edit Trait: Divine Dash' })).toBeTruthy();
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

  it('authors a Narcissus Blind Box before pickup and acquires it only through undoable order', async () => {
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
    const mysteryBoon = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
        'roomExit',
      ),
      'mysteryBoon',
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    const pickedUp = screen.getByRole('checkbox', { name: 'Picked up mysteryBoon' });
    expect((pickedUp as HTMLInputElement).disabled).toBe(false);
    const acquisitions = screen.getByText('Acquisitions').closest('section');
    if (acquisitions === null) throw new Error('Narcissus acquisitions workbench is missing');
    const reward = within(acquisitions).getByRole('button', { name: 'Reward' });
    await view.user.click(reward);
    await view.user.click(await within(await screen.findByRole('listbox')).findByText('Hestia'));

    const authoredSite = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )?.acquisitionSites?.roomExit;
    await waitFor(() =>
      expect(authoredSite()?.pickupEntries?.mysteryBoon).toMatchObject({
        offer: { payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
        traitOffersByAcquisitionRole: { hiddenSource: null },
      }),
    );
    expect(authoredSite()?.order).toEqual([]);

    const hiddenSource = workspaceProjection(view.application).interactions.traitOffers.get(
      semanticAddressKey(createTraitOfferAddress(mysteryBoon, 'hiddenSource')),
    );
    const hiddenSourceDraft = hiddenSource?.traitsStartingDraft?.();
    if (hiddenSource === undefined)
      throw new Error('Narcissus Blind Box hidden-source editor is missing');
    if (hiddenSourceDraft === undefined)
      throw new Error('Narcissus Blind Box hidden-source starting draft is missing');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched(hiddenSource.intentFor(hiddenSourceDraft).command),
      ),
    );
    const hasAcquiredMysteryBoon = () => {
      const evaluated = simulateProject(
        catalog,
        view.application.store.getState().projectWorkspace.history.present,
      )
        .routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G');
      return (
        evaluated !== undefined &&
        'rewards' in evaluated &&
        evaluated.rewards.branches.some((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.settlement?.entry.entryKey === 'mysteryBoon',
          ),
        )
      );
    };
    expect(hasAcquiredMysteryBoon()).toBe(false);

    await view.user.click(pickedUp);
    expect(authoredSite()?.order).toEqual(['mysteryBoon']);
    expect(hasAcquiredMysteryBoon()).toBe(true);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredSite()?.order).toEqual([]);
    expect(hasAcquiredMysteryBoon()).toBe(false);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(authoredSite()?.order).toEqual(['mysteryBoon']);
    expect(hasAcquiredMysteryBoon()).toBe(true);
    expect(
      (
        within(acquisitions).getByRole('checkbox', {
          name: 'Picked up mysteryBoon',
        }) as HTMLInputElement
      ).disabled,
    ).toBe(false);
  });

  it('picks up and Time Piece-converts Psyche as one undoable Narcissus row edit', async () => {
    let project = createGoldenFGHIProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
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
          { traitKey: 'NarcissusD' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusE' },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
      },
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    const authoredSite = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )?.acquisitionSites?.roomExit;

    expect(screen.getByRole('checkbox', { name: 'Picked up psyche' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Picked up maxMana' })).toBeTruthy();
    await view.user.click(screen.getByRole('checkbox', { name: 'Picked up psyche' }));
    expect(authoredSite()?.order).toEqual(['psyche']);
    const psycheRow = screen.getByText('Psyche').closest('.acquisition-entry');
    if (!(psycheRow instanceof HTMLElement)) throw new Error('Psyche acquisition row is missing');
    await view.user.selectOptions(within(psycheRow).getByLabelText(/Reward outcome/), 'timePiece');
    expect(authoredSite()?.pickupEntries?.psyche?.dispositionByAcquisitionRole.self).toEqual({
      kind: 'timePiece',
    });

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredSite()?.pickupEntries?.psyche?.dispositionByAcquisitionRole.self).toEqual({
      kind: 'normal',
    });
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(authoredSite()?.pickupEntries?.psyche?.dispositionByAcquisitionRole.self).toEqual({
      kind: 'timePiece',
    });
  });

  it('adds a later Narcissus pickup while an earlier participant is context-invalid', async () => {
    let project = createGoldenFGHIProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
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
          { traitKey: 'NarcissusD' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusE' },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
      },
    });
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      'roomExit',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(
        createAcquisitionEntryAddress(site, 'psyche'),
        'self',
      ),
      value: { kind: 'timePiece' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site,
      entryKeys: ['psyche'],
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    const maxMana = screen.getByRole('checkbox', { name: 'Picked up maxMana' });
    expect((maxMana as HTMLInputElement).disabled).toBe(false);

    await view.user.click(maxMana);

    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )?.acquisitionSites?.roomExit?.order,
    ).toEqual(['psyche', 'maxMana']);
  });

  it('splits Anomaly room outcome from door map and revert controls as exact commands', async () => {
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
    const reward = screen.getByLabelText('Reward');
    const cleared = screen.getByRole('checkbox', { name: 'Cleared' });
    expect((cleared as HTMLInputElement).checked).toBe(true);
    expect(reward.compareDocumentPosition(cleared) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.queryByLabelText('Map')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore Combat 01' })).toBeNull();
    expect(screen.queryByLabelText('Customize')).toBeNull();
    await view.user.click(screen.getByRole('checkbox', { name: 'Cleared' }));
    cleanup();

    const door = renderDecisionWorkbench(
      project,
      'Underworld',
      'G',
      decisionContainingOccurrence(occurrenceId),
      application,
    );
    const map = screen.getByLabelText('Map');
    const restore = screen.getByRole('button', { name: 'Restore Combat 01' });
    expect((map as HTMLSelectElement).value).toBe('B_Combat01');
    expect(screen.queryByRole('checkbox', { name: 'Cleared' })).toBeNull();
    await door.user.selectOptions(map, 'B_Combat05');
    await door.user.click(restore);
    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([
      {
        kind: 'ReplaceAnomalySuccess',
        occurrence: createOccurrenceAddress(createBiomeAddress('Underworld', 'G'), occurrenceId),
        success: false,
      },
      {
        gameName: 'B_Combat05',
        kind: 'ReplaceAnomalyMap',
        occurrence: createOccurrenceAddress(createBiomeAddress('Underworld', 'G'), occurrenceId),
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
    expect(screen.getByRole('checkbox', { name: 'Cleared' })).toBeTruthy();
    expect(screen.queryByLabelText('Map')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore Combat 01' })).toBeNull();
    cleanup();
    renderDecisionWorkbench(invalid, 'Underworld', 'G', decisionContainingOccurrence(occurrenceId));
    expect(screen.getByLabelText('Map')).toBeTruthy();
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
      screen.queryByText(
        'Side rooms become available after this room is selected in the visit order.',
      ),
    ).toBeNull();
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

  it('authors Fields optional participation independently of context-invalid earlier chronology', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const source = createLocalRewardAddress(
      goldenHBiome,
      occurrenceId,
      'optionalRewards',
      'optional1',
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(source, 'self'),
      value: { kind: 'timePiece' },
    });
    const authored = occurrenceState(project, 'Underworld', 'H', occurrenceId);
    if (authored.kind !== 'fieldsCombat') throw new Error('Fields state is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsActionOrder',
      occurrence: createOccurrenceAddress(goldenHBiome, occurrenceId),
      actionOrder: Object.freeze([
        ...authored.actionOrder,
        Object.freeze({ kind: 'interactOptionalReward' as const, slotKey: 'optional1' }),
      ]),
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    const optionals = screen.getByLabelText('Fields optional rewards');
    const count = within(optionals).getByRole('combobox', {
      name: 'Optional pickups',
    }) as HTMLSelectElement;
    expect(count.value).toBe('2');
    expect(Array.from(count.options).map((option) => option.value)).toEqual(['0', '1', '2', '3']);
    expect(within(optionals).queryByLabelText('Optional 3')).toBeNull();
    const optional2 = within(optionals).getByLabelText('Optional 2');
    const interact = within(optional2).getByRole('checkbox', {
      name: 'Interact with Optional 2',
    }) as HTMLInputElement;
    expect(interact.checked).toBe(false);
    const initial = occurrenceState(
      view.application.store.getState().projectWorkspace.history.present,
      'Underworld',
      'H',
      occurrenceId,
    );
    if (initial.kind !== 'fieldsCombat') throw new Error('Fields state is missing');
    expect(initial.optionalRewards.optional1?.dispositionByAcquisitionRole.self).toEqual({
      kind: 'timePiece',
    });
    expect(initial.actionOrder).toContainEqual({
      kind: 'interactOptionalReward',
      slotKey: 'optional1',
    });

    await view.user.click(interact);
    await waitFor(() => expect(interact.checked).toBe(true));
    const interacted = occurrenceState(
      view.application.store.getState().projectWorkspace.history.present,
      'Underworld',
      'H',
      occurrenceId,
    );
    expect(interacted).toMatchObject({
      kind: 'fieldsCombat',
      actionOrder: expect.arrayContaining([
        { kind: 'interactOptionalReward', slotKey: 'optional2' },
      ]),
    });
    if (interacted.kind !== 'fieldsCombat') throw new Error('Fields state is missing');
    const retained = interacted.optionalRewards.optional2;

    await view.user.selectOptions(count, '1');
    await waitFor(() => expect(screen.queryByLabelText('Optional 2')).toBeNull());
    const lowered = occurrenceState(
      view.application.store.getState().projectWorkspace.history.present,
      'Underworld',
      'H',
      occurrenceId,
    );
    expect(lowered).toMatchObject({ kind: 'fieldsCombat', optionalRewardCount: 1 });
    if (lowered.kind !== 'fieldsCombat') throw new Error('lowered Fields state is missing');
    expect(lowered.optionalRewards.optional2).toEqual(retained);
    expect(lowered.actionOrder).not.toEqual(
      expect.arrayContaining([{ kind: 'interactOptionalReward', slotKey: 'optional2' }]),
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(screen.getByLabelText('Optional 2')).toBeTruthy());
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Interact with Optional 2',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('authors an optional Fields Artificer pickup, edits its complete child, and settles it later', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const source = createLocalRewardAddress(
      goldenHBiome,
      occurrenceId,
      'optionalRewards',
      'optional1',
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: source,
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(source, 'self'),
      value: {
        kind: 'artificer',
        replacement: Object.freeze({
          offer: Object.freeze({ rewardType: 'RoomMoneyDrop' }),
          traitOffersByAcquisitionRole: Object.freeze({}),
          dispositionByAcquisitionRole: Object.freeze({
            self: Object.freeze({ kind: 'normal' as const }),
          }),
        }),
      },
    });
    const authoredOccurrence = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    if (authoredOccurrence?.state.kind !== 'fieldsCombat')
      throw new Error('Fields state is missing');
    if (
      !authoredOccurrence.state.actionOrder.some(
        (action) => action.kind === 'interactOptionalReward' && action.slotKey === 'optional1',
      )
    ) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsActionOrder',
        occurrence: createOccurrenceAddress(goldenHBiome, occurrenceId),
        actionOrder: Object.freeze([
          ...authoredOccurrence.state.actionOrder,
          Object.freeze({ kind: 'interactOptionalReward' as const, slotKey: 'optional1' }),
        ]),
      });
    }
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Interact with Optional 1',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    const chronology = screen.getByLabelText('Fields action chronology');
    const replacementRow = await within(chronology).findByText(
      'Pick up Optional 1 Artificer replacement',
    );
    const replacementInteraction = within(replacementRow.closest('li')!).getByRole('checkbox', {
      name: 'Interact with Pick up Optional 1 Artificer replacement',
    });
    expect((replacementInteraction as HTMLInputElement).checked).toBe(false);
    const initialWorkspace = workspaceProjection(view.application);
    const chronologyInteraction = [
      ...initialWorkspace.interactions.fieldsActionOrders.values(),
    ].find((interaction) => interaction.owner.occurrenceId === occurrenceId);
    const participation = chronologyInteraction?.proposals.find(
      (proposal) =>
        proposal.actionKey === 'interactArtificer:optionalRewards:optional1:self' &&
        proposal.defaultParticipation === true,
    );
    if (chronologyInteraction === undefined || participation === undefined)
      throw new Error('optional Artificer participation proposal is missing');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched(
          chronologyInteraction.intentFor(participation.key).command,
        ),
      ),
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole('checkbox', {
            name: 'Interact with Pick up Optional 1 Artificer replacement',
          }) as HTMLInputElement
        ).checked,
      ).toBe(true),
    );

    const workspace = workspaceProjection(view.application);
    const conversion = workspace.interactions.acquisitionConversions.get(
      semanticAddressKey(createAcquisitionRoleAddress(source, 'self')),
    );
    const replacement = conversion?.artificerReplacementControl;
    if (replacement === undefined) throw new Error('complete Artificer child is missing');
    if (conversion === undefined) throw new Error('Artificer conversion is missing');
    expect(replacement.owner.address).toEqual(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(source, 'optionalRewards:optional1'),
        'artificer:optional1:self',
      ),
    );
    expect(workspace.focusByOwner.has(semanticAddressKey(replacement.owner.address))).toBe(true);
    const boon = conversion.artificerReplacementOptions.find(
      (option) => option.offer.rewardType === 'Boon' && option.offer.payload?.kind === 'BoonSource',
    );
    if (boon === undefined) throw new Error('BoonSource replacement option is missing');
    const rewardInteraction = workspace.interactions.rewards.get(
      semanticAddressKey(replacement.owner.address),
    );
    if (rewardInteraction === undefined) throw new Error('replacement reward interaction missing');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched(rewardInteraction.intentFor(boon.offer).command),
      ),
    );
    expect(
      occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      ),
    ).toMatchObject({
      kind: 'fieldsCombat',
      optionalRewards: {
        optional1: {
          dispositionByAcquisitionRole: {
            self: { kind: 'artificer', replacement: { offer: boon.offer } },
          },
        },
      },
    });
    const editedWorkspace = workspaceProjection(view.application);
    const editedConversion = editedWorkspace.interactions.acquisitionConversions.get(
      semanticAddressKey(createAcquisitionRoleAddress(source, 'self')),
    );
    const health = editedConversion?.artificerReplacementOptions.find(
      (option) => option.offer.rewardType === 'MaxHealthDrop',
    );
    const editedRewardInteraction =
      editedConversion?.artificerReplacementControl === undefined
        ? undefined
        : editedWorkspace.interactions.rewards.get(
            semanticAddressKey(editedConversion.artificerReplacementControl.owner.address),
          );
    if (health === undefined || editedRewardInteraction === undefined)
      throw new Error('valid Max Health replacement edit is missing');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched(editedRewardInteraction.intentFor(health.offer).command),
      ),
    );
    const edited = view.application.store.getState().projectWorkspace.history.present;
    const state = occurrenceState(edited, 'Underworld', 'H', occurrenceId);
    expect(state).toMatchObject({
      kind: 'fieldsCombat',
      actionOrder: expect.arrayContaining([
        { kind: 'interactOptionalReward', slotKey: 'optional1' },
        {
          kind: 'interactArtificerReplacement',
          sourceGroup: 'optionalRewards',
          slotKey: 'optional1',
          acquisitionRole: 'self',
        },
      ]),
    });
    expect(simulateProject(catalog, edited).findings).not.toContainEqual(
      expect.objectContaining({ code: 'artificerReplacementUnavailable' }),
    );
  });

  it('moves one Fields action through candidate-backed chronology and undo/redo', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    const chronology = screen.getByLabelText('Fields action chronology');
    const row = within(chronology).getByText('Interact with Cage 1 reward').closest('li');
    if (row === null) throw new Error('Cage 1 interaction row is missing');
    const select = within(row).getByRole('combobox', { name: 'Change order' });
    await view.user.click(select);
    const move = await within(select).findByRole('option', { name: /Move to position 3/ });
    await waitFor(() => expect(move.dataset.candidateSupport).toBe('possible'));
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.selectOptions(select, move);
    await waitFor(() => {
      const state = occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      );
      expect(state).toMatchObject({
        kind: 'fieldsCombat',
        actionOrder: [
          { kind: 'completeCage', phaseKey: 'Cage01' },
          { kind: 'completeCage', phaseKey: 'Cage02' },
          { kind: 'interactCageReward', slotKey: 'cage1' },
          { kind: 'interactCageReward', slotKey: 'cage2' },
        ],
      });
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength + 1,
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => {
      const state = occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      );
      expect(state).toMatchObject({
        kind: 'fieldsCombat',
        actionOrder: [
          { kind: 'completeCage', phaseKey: 'Cage01' },
          { kind: 'interactCageReward', slotKey: 'cage1' },
          { kind: 'completeCage', phaseKey: 'Cage02' },
          { kind: 'interactCageReward', slotKey: 'cage2' },
        ],
      });
    });

    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    await waitFor(() => {
      const state = occurrenceState(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      );
      expect(state).toMatchObject({
        kind: 'fieldsCombat',
        actionOrder: [
          { kind: 'completeCage', phaseKey: 'Cage01' },
          { kind: 'completeCage', phaseKey: 'Cage02' },
          { kind: 'interactCageReward', slotKey: 'cage1' },
          { kind: 'interactCageReward', slotKey: 'cage2' },
        ],
      });
    });
  });

  it('keeps retained inactive cage actions as repair rows while hiding their payload', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const decision = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: goldenHStartId,
    });
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'max',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsActionOrder',
      occurrence,
      actionOrder: [
        { kind: 'completeCage', phaseKey: 'Cage01' },
        { kind: 'interactCageReward', slotKey: 'cage1' },
        { kind: 'completeCage', phaseKey: 'Cage02' },
        { kind: 'interactCageReward', slotKey: 'cage2' },
        { kind: 'completeCage', phaseKey: 'Cage03' },
        { kind: 'interactCageReward', slotKey: 'cage3' },
      ],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'min',
    });

    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    expect(
      within(screen.getByLabelText('Fields cage rewards')).queryByLabelText('Cage 3'),
    ).toBeNull();
    const chronology = screen.getByLabelText('Fields action chronology');
    for (const label of ['Complete Cage 3', 'Interact with Cage 3 reward']) {
      const row = within(chronology).getByText(label).closest('li');
      if (row === null) throw new Error(`${label} repair row is missing`);
      expect(within(row).getByText('inactive')).toBeTruthy();
      expect(within(row).getByRole('option', { name: 'Remove inactive action' })).toBeTruthy();
    }
    const dormantCage = createLocalRewardAddress(goldenHBiome, occurrenceId, 'cages', 'cage3');
    const workspace = workspaceProjection(view.application);
    expect(workspace.interactions.rewards.has(semanticAddressKey(dormantCage))).toBe(false);
    expect(workspace.focusByOwner.has(semanticAddressKey(dormantCage))).toBe(false);
    const dormantTrait = createTraitOfferAddress(dormantCage, 'source');
    expect(workspace.interactions.traitOffers.has(semanticAddressKey(dormantTrait))).toBe(false);
    expect(workspace.focusByOwner.has(semanticAddressKey(dormantTrait))).toBe(false);
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

  it('omits the Fields payload section when no active cage controls are projected', () => {
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
            cages: [],
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
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
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
    expect(screen.getByRole('columnheader', { name: 'Buy' })).toBeTruthy();
    expect(screen.queryByText('Participation')).toBeNull();
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

    await view.user.click(screen.getByLabelText('Purchase Offer 2'));
    expect(order()).toEqual(['MajorNonBoon']);

    await view.user.click(screen.getByLabelText('Purchase Offer 3'));
    expect(order()).toEqual(['MajorNonBoon', 'Minor']);

    const pomCard = document.querySelector<HTMLElement>('[data-acquisition-entry-key="Minor"]');
    if (pomCard === null) throw new Error('Pom acquisition rank card is missing');
    expect(within(pomCard).getByText('Max Magick')).toBeTruthy();
    await view.user.click(within(pomCard).getByRole('button', { name: 'Move Max Magick earlier' }));
    expect(order()).toEqual(['Minor', 'MajorNonBoon']);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 3,
    );

    const board = screen.getByRole('group', { name: 'Ranked acquisition order' });
    const source = board.querySelector<HTMLElement>('[data-acquisition-entry-key="Minor"]');
    const target = board.querySelector<HTMLElement>('[data-acquisition-entry-key="MajorNonBoon"]');
    const handle = source?.querySelector<HTMLElement>('[data-acquisition-drag-handle]');
    if (source === null || target === null || handle === null || handle === undefined) {
      throw new Error('ranked acquisition drag surface is missing');
    }
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      bottom: 180,
      height: 120,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 60,
      width: 360,
      x: 0,
      y: 60,
    } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => target,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 41,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: 150,
      isPrimary: true,
      pointerId: 41,
      pointerType: 'mouse',
    });
    expect(source.dataset.dragging).toBe('true');
    fireEvent.pointerUp(board, {
      clientX: 24,
      clientY: 150,
      isPrimary: true,
      pointerId: 41,
      pointerType: 'mouse',
    });
    await waitFor(() => expect(order()).toEqual(['MajorNonBoon', 'Minor']));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 4,
    );
  }, 15_000);

  it('purchases a Pom while the earlier Mystery Box trait remains unresolved', async () => {
    const view = renderOccurrenceWorkbench(
      createFMidshopUnresolvedBlindBoxBeforePomProject(),
      'Underworld',
      'F',
      occurrenceById(fMidshopPomShopId),
    );
    const authoredShop = () => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fMidshopPomShopId);
      if (occurrence?.state.kind !== 'shop' || occurrence.state.shop === undefined) {
        throw new Error('reported F Midshop is missing');
      }
      return Object.freeze({ occurrence, shop: occurrence.state.shop });
    };
    expect(authoredShop().occurrence.acquisitionSites?.roomExit?.order).toEqual(['Boon']);
    expect(
      authoredShop().shop.offers.Boon?.reward?.traitOffersByAcquisitionRole.hiddenSource,
    ).toBeNull();
    const mysteryBoonAcquisition = document.querySelector<HTMLElement>(
      '[data-acquisition-entry-key="Boon"]',
    );
    if (mysteryBoonAcquisition === null) {
      throw new Error('purchased Mystery Boon acquisition row is missing');
    }
    expect(within(mysteryBoonAcquisition).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(
      within(screen.getByRole('table')).getAllByRole('button', { name: 'Reward' }).length,
    ).toBe(3);

    const before = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(screen.getByLabelText('Purchase Offer 3'));

    await waitFor(() =>
      expect(authoredShop().occurrence.acquisitionSites?.roomExit?.order).toEqual([
        'Boon',
        'Minor',
      ]),
    );
    expect(
      authoredShop().shop.offers.Boon?.reward?.traitOffersByAcquisitionRole.hiddenSource,
    ).toBeNull();
    const pomAcquisition = document.querySelector<HTMLElement>(
      '[data-acquisition-entry-key="Minor"]',
    );
    if (pomAcquisition === null) throw new Error('purchased Pom acquisition row is missing');
    expect(within(pomAcquisition).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
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

    expect(screen.queryByText(/opportunities$/)).toBeNull();
    expect(
      screen.getByText(
        'Purchase order needs one paid Shop offer before this refill can be edited.',
      ),
    ).toBeTruthy();
    await view.user.click(screen.getByLabelText('Purchase Offer 2'));
    const refill = await screen.findByRole('checkbox', {
      name: 'Purchase Travel Deal refill after Offer 2',
    });
    expect(screen.queryByText(/opportunities$/)).toBeNull();
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
    await view.user.click(
      within(refillEntry).getByRole('button', {
        name: 'Move Travel Deal refill after Offer 2 later',
      }),
    );
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
    const conversion = within(goldRewardRow).getByLabelText(/Reward outcome/) as HTMLSelectElement;
    await view.user.selectOptions(conversion, 'timePiece');
    expect(authoredSite()?.order).toEqual(['Minor']);
    expect(
      authoredSite()?.pickupEntries?.echoDoubleShopReward?.dispositionByAcquisitionRole.self,
    ).toEqual({ kind: 'timePiece' });

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredSite()?.order).toEqual(['Minor']);
    expect(authoredSite()?.pickupEntries?.echoDoubleShopReward).toBeUndefined();
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(
      authoredSite()?.pickupEntries?.echoDoubleShopReward?.dispositionByAcquisitionRole.self,
    ).toEqual({ kind: 'timePiece' });

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
    await view.user.click(
      within(goldAcquisition).getByRole('button', {
        name: 'Move Gold Gold Gold duplicate of Offer 3 later',
      }),
    );
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
    await view.user.click(refillReward);
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Heal'));

    const authored = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === prebossId)
      ?.acquisitionSites?.roomExit?.pickupEntries;
    expect(authored?.infernalContractReward?.offer).toEqual({ rewardType: 'StackUpgrade' });
    expect(authored?.travelDealRefill?.offer.rewardType).toBe('RoomRewardHealDrop');
  }, 15_000);

  it('renders an unpicked Shop as dormant without inventory controls', () => {
    const { project, shopId } = dormantShopProject();
    renderStaticOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));

    expect(screen.getByText('Shop inventory appears when you select this room.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });

  it('authors Shop participation independently of contextual purchase validity', async () => {
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
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(false);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === pOccurrenceIds.prebossShop,
        )?.acquisitionSites?.roomExit?.order,
    ).toEqual(['Boon']);

    await view.user.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 2,
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
    const boonCard = document.querySelector<HTMLElement>('[data-acquisition-entry-key="Boon"]');
    if (boonCard === null) throw new Error('Boon acquisition rank card is missing');
    const moveLater = within(boonCard).getByRole('button', {
      name: / later$/,
    }) as HTMLButtonElement;
    if (moveLater === undefined) throw new Error('first acquisition move button is missing');
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(moveLater);

    expect(moveLater.disabled).toBe(true);
    expect(moveLater.getAttribute('data-candidate-support')).toBe('impossible');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
  });
});
