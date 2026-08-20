// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
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
  createOccurrenceId,
  createOccurrenceAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  createRouteStartKeepsakeSelectionAddress,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createTraitOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  roomActionKey,
  type OccurrenceId,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';
import {
  authorLegalTraitOffers,
  authorRequiredTestRoomActions,
} from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
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
} from '@run-planner/test-fixtures/surface';
import {
  renderOccurrenceWorkbench,
  renderDecisionWorkbench,
  renderStaticOccurrenceWorkbench,
  renderWorkspace,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';

let immutableRepresentativeNOPQProject: ProjectDocument;

beforeAll(function prepareImmutableRepresentativeProjects() {
  createGoldenFGHIProject();
  immutableRepresentativeNOPQProject = createRepresentativeNOPQProject();
});

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

function expectBefore(first: Element, second: Element): void {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
}

function openRoomTab(name: string): void {
  fireEvent.click(screen.getByRole('tab', { name }));
}

function emptyFProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'occurrence-workbench-empty-f',
    configuredBiomeCounts: { Underworld: 1 },
  });
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

function insertRoomAction(
  project: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: OccurrenceId,
  reference: RoomActionReference,
  index: number,
): ProjectDocument {
  const alreadyOrdered = project.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.roomActions.order.some((candidate) => roomActionKey(candidate) === roomActionKey(reference));
  if (alreadyOrdered === true) return project;
  return applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
    reference,
    index,
  });
}

function occurrenceRoomActionOrder(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: OccurrenceId,
) {
  return project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.roomActions.order;
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

function dormantShopProject(): {
  readonly project: ProjectDocument;
  readonly shopId: OccurrenceId;
} {
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
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, start),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, source, 'exit1'),
    occurrenceId: combat,
    gameName: 'F_Combat03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, combat),
    value: { rewardType: 'GiftDrop' },
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

function enteredShopProject(): {
  readonly project: ProjectDocument;
  readonly shopId: OccurrenceId;
} {
  const dormant = dormantShopProject();
  const combat = createOccurrenceId('occurrence-workbench-f-combat');
  let project = applyProjectCommand(dormant.project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: combat,
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  for (const [offerKey, value] of [
    [
      'Boon',
      {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
      },
    ],
    ['MajorNonBoon', { rewardType: 'RoomRewardHealDrop' }],
    ['Minor', { rewardType: 'MaxManaDrop' }],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenFBiome, dormant.shopId, offerKey),
      value,
    });
  }
  return { project: authorLegalTraitOffers(project), shopId: dormant.shopId };
}

describe('OccurrenceWorkbench', () => {
  it('presents an incoming ordinary room identity read-only under its target-owned door control', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
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
    if (node === undefined) throw new Error('ordinary entered occurrence is missing');

    expect(node.inspectorPresentation).toBe('doorTarget');
    expect(node.room.roomPicker).toMatchObject({
      address: expect.objectContaining({ kind: 'target' }),
      kind: 'targetRoomPicker',
    });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: new RegExp(`^Entering ${node.room.label}`),
      }),
    ).toBeTruthy();
    expect(document.querySelector('.room-card-heading .room-kind')).toBeNull();
    expect(screen.queryByLabelText('Room')).toBeNull();
  });

  it('renders Standard workbench tabs and places encounter/actions in the Actions tab', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    const standardFeatures = screen.getByLabelText('Room features');
    expect(standardFeatures).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Room Doors' })).toBeTruthy();
    openRoomTab('Room Actions');
    const standardActions = screen.getByRole('region', { name: 'Room Actions' });
    const standardStart = within(standardActions).getByLabelText('Start encounter');
    const standardEncounter = within(standardActions).getByLabelText('Encounter encounter phase');
    const standardEnd = within(standardActions).getByLabelText('End encounter');
    const roomEntered = within(standardActions).getByLabelText('Room entered');
    const entryRunState = within(standardActions).getByRole('button', { name: 'Run State' });
    expectBefore(roomEntered, entryRunState);
    expectBefore(entryRunState, standardStart);
    expectBefore(standardStart, standardEncounter);
    expectBefore(standardEncounter, standardEnd);
    openRoomTab('Room Doors');
    expect(
      within(screen.getByRole('tabpanel', { name: 'Room Doors' })).getByRole('button', {
        name: 'Run State',
      }),
    ).toBeTruthy();
  });

  it('places Ship Run State only at phase starts and the final pre-exit seam', () => {
    renderStaticOccurrenceWorkbench(
      immutableRepresentativeNOPQProject,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    expect(screen.queryByRole('button', { name: 'Run State' })).toBeNull();
    openRoomTab('Intro Actions');
    expect(
      within(screen.getByRole('region', { name: 'Room Actions' })).getByRole('button', {
        name: 'Run State',
      }),
    ).toBeTruthy();
    openRoomTab('Combat 1 Actions');
    expect(
      within(screen.getByRole('region', { name: 'Room Actions' })).getByRole('button', {
        name: 'Run State',
      }),
    ).toBeTruthy();
    openRoomTab('Room Doors');
    expect(
      within(screen.getByRole('tabpanel', { name: 'Room Doors' })).getByRole('button', {
        name: 'Run State',
      }),
    ).toBeTruthy();
  });

  it('supports roving keyboard activation across the room workbench tabs', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    const overview = screen.getByRole('tab', { name: 'Room Overview' });
    const actions = screen.getByRole('tab', { name: 'Room Actions' });
    const doors = screen.getByRole('tab', { name: 'Room Doors' });
    const panelId = overview.getAttribute('aria-controls');
    expect(panelId).not.toBeNull();
    const panel = panelId === null ? null : document.getElementById(panelId);
    expect(panel).not.toBeNull();
    for (const tab of [overview, actions, doors]) {
      expect(tab.getAttribute('aria-controls')).toBe(panelId);
    }
    expect(overview.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(actions.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(actions);
    expect(document.getElementById(panelId!)).toBe(panel);
    fireEvent.keyDown(actions, { key: 'End' });
    expect(doors.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(doors);
    expect(doors.getAttribute('aria-controls')).toBe(panelId);
    expect(document.getElementById(panelId!)).toBe(panel);
    fireEvent.keyDown(doors, { key: 'ArrowLeft' });
    expect(actions.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(actions);
    expect(document.getElementById(panelId!)).toBe(panel);
  });

  it('resets the active room tab when the occurrence identity changes', () => {
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    openRoomTab('Combat 1 Actions');
    const workspace = workspaceProjection(view.application);
    const biome = workspace.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (biome === undefined) throw new Error('O workspace is missing');
    const nextNode = occurrenceById(oOccurrenceIds.combat04)(biome);
    if (nextNode === undefined) throw new Error('second O occurrence is missing');
    view.rerender(
      <Provider store={view.application.store}>
        <OccurrenceWorkbench room={nextNode.room} interactions={workspace.interactions} />
      </Provider>,
    );
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('keeps N side-room generation in Overview and Room Actions in its own tab', () => {
    renderStaticOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const sideRooms = screen.getByLabelText('Ephyra side rooms');
    expect(sideRooms).toBeTruthy();
    openRoomTab('Room Actions');
    const nActions = screen.getByRole('region', { name: 'Room Actions' });
    expect(nActions).toBeTruthy();
    expect(within(nActions).getByLabelText('Encounter encounter phase')).toBeTruthy();
  }, 10_000);

  it('renders Fields setup before its one Room Actions board', () => {
    renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    const fieldsSetup = screen.getByLabelText('Fields setup');
    expect(fieldsSetup).toBeTruthy();
    expect(within(fieldsSetup).getByLabelText('Optional 1')).toBeTruthy();
    openRoomTab('Room Actions');
    const fieldsActions = screen.getByRole('region', { name: 'Room Actions' });
    const fieldsEntered = within(fieldsActions).getByLabelText('Room entered');
    const passiveEncounter = within(fieldsActions).getByLabelText('Passive encounter phase');
    expectBefore(fieldsEntered, passiveEncounter);
    expect(
      fieldsActions.querySelector('[data-lifecycle-boundary="encounterStart:Passive"]'),
    ).toBeNull();
    const fieldsEncounter = screen.queryByLabelText('Encounter encounter phase');
    if (fieldsEncounter !== null) expectBefore(fieldsEncounter, fieldsActions);
    const optionalAction = within(fieldsActions).getByText('Pick up Optional 1').closest('li');
    if (optionalAction === null) throw new Error('Optional reward action is missing');
    expect(within(optionalAction).queryByLabelText('Optional 1')).toBeNull();
    expect(within(optionalAction).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(fieldsActions).toBeTruthy();
  });

  it('renders Shop inventory before Room features and Room Actions', () => {
    const shop = enteredShopProject();
    renderStaticOccurrenceWorkbench(shop.project, 'Underworld', 'F', occurrenceById(shop.shopId));
    const inventory = screen.getByLabelText('Shop inventory and conditions');
    const shopFeatures = screen.getByLabelText('Room features');
    expectBefore(inventory, shopFeatures);
    openRoomTab('Room Actions');
    const shopActions = screen.getByRole('region', { name: 'Room Actions' });
    expect(shopActions).toBeTruthy();
  });

  it('renders an enabled Artificer disposition for reached Nectar with no Pom target', () => {
    renderStaticOccurrenceWorkbench(
      createFConversionFrontierProject('GiftDrop').project,
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    openRoomTab('Room Actions');
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

  it('authors an Artificer replacement through its exact Room Action acquisition site', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const source = createIncomingRewardAddress(goldenFBiome, occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'self');
    const project = applyProjectCommand(
      createFConversionFrontierProject('MetaCurrencyDrop').project,
      catalog,
      {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition,
        value: { kind: 'artificer' },
      },
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Actions');
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    expect(within(actions).getByText('Pick up Artificer replacement')).toBeTruthy();

    const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const site = artificerAcquisitionSite(occurrence, source);
    const entry = createAcquisitionEntryAddress(site, artificerReplacementEntryKey(source, 'self'));
    const interaction = workspaceProjection(view.application).interactions.rewards.get(
      semanticAddressKey(entry),
    );
    if (interaction === undefined) throw new Error('Artificer replacement interaction is missing');
    expect(document.getElementById(semanticOwnerControlElementId(entry))).not.toBeNull();
    expect(interaction.owner).toEqual(entry);
    expect(interaction.authoredRewardTypes).toContain('MaxHealthDrop');
    expect(interaction.intentFor({ rewardType: 'MaxHealthDrop' })).toEqual({
      command: {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry,
        value: { rewardType: 'MaxHealthDrop' },
      },
    });
  });

  it('keeps an unranked required action visible with its engine-owned repair explanation', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const authored = createFConversionFrontierProject('MetaCurrencyDrop').project;
    const reference = occurrenceRoomActionOrder(authored, 'Underworld', 'F', occurrenceId)?.[0];
    if (reference === undefined) throw new Error('Required incoming action is missing');
    const project = applyProjectCommand(authored, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, occurrenceId, roomActionKey(reference)),
    });
    renderStaticOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(occurrenceId));

    openRoomTab('Room Actions');
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    expect(within(actions).getByText('This required action has not been placed.')).toBeTruthy();
    expect(within(actions).getByRole('region', { name: 'Room action repairs' })).toBeTruthy();
    expect(actions.querySelector('[data-room-action-drag-handle]')).toBeNull();
  });

  it('focuses and removes a stale Standard encounter action after encounter replacement', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const reference = { kind: 'interactEncounter' as const, phaseKey: 'Encounter' };
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    });
    project = authorLegalTraitOffers(project);
    project = insertRoomAction(project, goldenFBiome, occurrenceId, reference, 0);
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedF',
    });
    const action = createRoomActionAddress(goldenFBiome, occurrenceId, roomActionKey(reference));
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    act(() => view.application.store.dispatch(semanticOwnerNavigated(action)));
    openRoomTab('Room Actions');
    const repairs = await screen.findByRole('region', { name: 'Room action repairs' });
    const stale = within(repairs).getByText('Interact with Combat').closest('li');
    if (stale === null) throw new Error('Stale Standard encounter action is missing');
    expect(within(stale).getByText('This action no longer belongs to the room.')).toBeTruthy();
    expect(document.getElementById(semanticOwnerControlElementId(action))).toBe(stale);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(action);

    await view.user.click(within(stale).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('Interact with Combat')).toBeNull());
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'F',
        occurrenceId,
      )?.some((candidate) => roomActionKey(candidate) === roomActionKey(reference)),
    ).toBe(false);
  });

  it('renders the additive Gorgon condition and Athena child for a pending phase', async () => {
    const occurrenceId = pOccurrenceId('P_Combat12', 8, 1);
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const view = renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    openRoomTab('Room Actions');
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
    openRoomTab('Room Actions');
    const condition = screen.getByRole('checkbox', {
      name: 'Death Defiance condition met (Gorgon Amulet)',
    }) as HTMLInputElement;
    expect(condition.checked).toBe(true);
    expect(condition.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Edit Trait: Divine Dash · Epic' })).toBeTruthy();
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
    openRoomTab('Room Actions');
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
    project = insertRoomAction(
      project,
      goldenGBiome,
      occurrence.occurrenceId,
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      0,
    );
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
    openRoomTab('Room Actions');
    const actionRow = screen.getByText('Pick up mysteryBoon').closest('li');
    if (actionRow === null) throw new Error('Narcissus pickup action is missing');
    const reward = within(actionRow).getByRole('button', { name: 'Reward' });
    await view.user.click(reward);
    await view.user.click(await within(await screen.findByRole('listbox')).findByText('Hestia'));

    const authoredOccurrence = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        );
    await waitFor(() =>
      expect(
        authoredOccurrence()?.acquisitionSites?.roomExit?.pickupEntries?.mysteryBoon,
      ).toMatchObject({
        offer: { payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
        traitOffersByAcquisitionRole: { hiddenSource: null },
      }),
    );
    expect(authoredOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
    ]);

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

    const insert = within(actionRow).getByRole('combobox', {
      name: 'Insert Pick up Mystery Boon · Hestia',
    });
    const insertion = Array.from((insert as HTMLSelectElement).options).find(
      (option) => option.value !== '' && !option.disabled,
    );
    if (insertion === undefined) throw new Error('Narcissus pickup has no legal insertion');
    await view.user.selectOptions(insert, insertion.value);
    expect(authoredOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: 'mysteryBoon' },
    ]);
    expect(hasAcquiredMysteryBoon()).toBe(true);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
    ]);
    expect(hasAcquiredMysteryBoon()).toBe(false);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(authoredOccurrence()?.roomActions.order.at(-1)).toEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'mysteryBoon',
    });
    expect(hasAcquiredMysteryBoon()).toBe(true);
    expect(screen.getByText('Pick up Mystery Boon · Hestia')).toBeTruthy();
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
    project = insertRoomAction(
      project,
      goldenGBiome,
      occurrence.occurrenceId,
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      0,
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    openRoomTab('Room Actions');
    const authoredOccurrence = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        );

    const psycheRow = screen.getByText('Pick up Psyche').closest('li');
    if (!(psycheRow instanceof HTMLElement)) throw new Error('Psyche acquisition row is missing');
    const insert = within(psycheRow).getByRole('combobox', { name: 'Insert Pick up Psyche' });
    const insertion = Array.from((insert as HTMLSelectElement).options).find(
      (option) => option.value !== '' && !option.disabled,
    );
    if (insertion === undefined) throw new Error('Psyche has no legal insertion');
    await view.user.selectOptions(insert, insertion.value);
    expect(authoredOccurrence()?.roomActions.order.at(-1)).toEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'psyche',
    });
    const orderedPsycheRow = screen.getByText('Pick up Psyche').closest('li');
    if (!(orderedPsycheRow instanceof HTMLElement))
      throw new Error('Ordered Psyche acquisition row is missing');
    await view.user.selectOptions(
      within(orderedPsycheRow).getByLabelText(/Reward outcome/),
      'timePiece',
    );
    expect(
      authoredOccurrence()?.acquisitionSites?.roomExit?.pickupEntries?.psyche
        ?.dispositionByAcquisitionRole.self,
    ).toEqual({
      kind: 'timePiece',
    });

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      authoredOccurrence()?.acquisitionSites?.roomExit?.pickupEntries?.psyche
        ?.dispositionByAcquisitionRole.self,
    ).toEqual({ kind: 'normal' });
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(
      authoredOccurrence()?.acquisitionSites?.roomExit?.pickupEntries?.psyche
        ?.dispositionByAcquisitionRole.self,
    ).toEqual({ kind: 'timePiece' });
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
    project = insertRoomAction(
      project,
      goldenGBiome,
      occurrence.occurrenceId,
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      0,
    );
    project = insertRoomAction(
      project,
      goldenGBiome,
      occurrence.occurrenceId,
      { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: 'psyche' },
      1,
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    openRoomTab('Room Actions');
    const maxManaRow = screen.getByText('Pick up Max Magick').closest('li');
    if (maxManaRow === null) throw new Error('Max Magick action row is missing');
    const maxMana = within(maxManaRow).getByRole('combobox', {
      name: 'Insert Pick up Max Magick',
    });
    const insertion = Array.from((maxMana as HTMLSelectElement).options).find(
      (option) => option.textContent === 'Insert to position 3' && !option.disabled,
    );
    if (insertion === undefined) throw new Error('Max Magick has no legal insertion');
    await view.user.selectOptions(maxMana, insertion.value);

    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )
        ?.roomActions.order.at(-1),
    ).toEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'maxMana',
    });
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
    const cleared = screen.getByRole('checkbox', { name: 'Cleared' });
    expect((cleared as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText('Reward')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: /^Entering .* · Incoming Reward:/ }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Map')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore Combat 01' })).toBeNull();
    await view.user.click(screen.getByRole('checkbox', { name: 'Cleared' }));
    cleanup();

    const door = renderDecisionWorkbench(
      project,
      'Underworld',
      'G',
      decisionContainingOccurrence(occurrenceId),
      application,
    );
    expect(screen.getByLabelText('Reward')).toBeTruthy();
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
  it('summarizes a Hub room main reward in the room heading without another editor', () => {
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Entering Combat 02 · Incoming Reward: Big Max Magick',
      }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Hub reward')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
  });

  it('summarizes a fixed Hub reward in the room heading', () => {
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

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Entering Medea · Incoming Reward: Story',
      }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Hub reward')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
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
    expect(screen.queryByText('Fixed reward:')).toBeNull();
  });

  it('exposes the direct Encounter section when the F default set becomes meaningful', () => {
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
    openRoomTab('Room Actions');
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
    openRoomTab('Room Actions');
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
    openRoomTab('Room Actions');

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
    await view.user.click(count);
    await waitFor(() => expect(count.dataset.candidateSupport).toBe('impossible'));
    openRoomTab('Combat 2 Actions');
    const phase = screen.getByLabelText('Combat2 encounter phase');
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

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(phase.contains(document.activeElement)).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
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
    openRoomTab('Room Actions');
    const finding = simulateProject(catalog, reset).findings.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(phase),
    );
    if (finding === undefined) throw new Error('invalid I encounter finding is missing');
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;
    const encounter = screen.getByLabelText('Encounter encounter phase');
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(encounter.contains(document.activeElement)).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
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
    await view.user.click(count);
    await waitFor(() => {
      expect(count.dataset.candidateSupport).toBe('forced');
      expect(Array.from(count.options).map((option) => option.value)).toEqual(['2']);
    });
    expect(screen.getByRole('tab', { name: 'Room Overview' })).toBeTruthy();
    openRoomTab('Intro Actions');
    expect(screen.getByLabelText('Intro ship phase')).toBeTruthy();
    expect(
      within(screen.getByLabelText('Intro ship phase')).getByLabelText('Combat 1 reward'),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText('Intro ship phase')).queryByText('Outgoing generation'),
    ).toBeNull();
    openRoomTab('Combat 1 Actions');
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    expect(combatOne).toBeTruthy();
    expect(within(combatOne).queryByLabelText('Combat 1 reward')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Combat 2 Actions' })).toBeNull();
    expect(within(combatOne).getByText('Outgoing generation')).toBeTruthy();
    act(() =>
      view.application.store.dispatch(
        semanticOwnerNavigated(createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1')),
      ),
    );
    openRoomTab('Intro Actions');
    expect(screen.getByLabelText('Combat 1 reward')).toBeTruthy();
  });

  it('keeps Ship offer identity on the wheel and acquisition children on its Room Action row', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel1', 'offer1'),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelPicked',
      wheel,
      pickedOfferIndex: 1,
    });
    project = authorLegalTraitOffers(project);

    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    const focusByOwner = workspaceProjection(view.application).focusByOwner;
    const wheel2 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    expect(focusByOwner.get(semanticAddressKey(wheel))?.roomTab).toBe('shipIntroActions');
    expect(focusByOwner.get(semanticAddressKey(wheel2))?.roomTab).toBe('shipCombat1Actions');
    expect(
      focusByOwner.get(
        semanticAddressKey(
          createRoomActionAddress(
            oBiome,
            oOccurrenceIds.combat07,
            roomActionKey({ kind: 'chooseRewardWheel', wheelKey: 'wheel1' }),
          ),
        ),
      )?.roomTab,
    ).toBe('shipIntroActions');
    expect(
      focusByOwner.get(
        semanticAddressKey(
          createRoomActionAddress(
            oBiome,
            oOccurrenceIds.combat07,
            roomActionKey({ kind: 'interactWheelReward', wheelKey: 'wheel1' }),
          ),
        ),
      )?.roomTab,
    ).toBe('shipCombat1Actions');
    openRoomTab('Intro Actions');
    const ship = screen.getByLabelText('Ship combat structure');

    expect(within(ship).getAllByRole('button', { name: 'Reward' }).length).toBeGreaterThan(0);
    expect(
      within(screen.getByLabelText('Combat 1 reward')).queryByRole('button', {
        name: /Edit Trait/,
      }),
    ).toBeNull();
    openRoomTab('Combat 1 Actions');
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    expect(within(actions).getByRole('button', { name: /Edit Trait/ })).toBeTruthy();
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
    project = authorRequiredTestRoomActions(project, catalog);

    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    openRoomTab('Combat 1 Actions');
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    expect(within(combatOne).getByLabelText('Combat 2 reward')).toBeTruthy();
    expect(within(combatOne).getByText('Choose Combat 2 reward')).toBeTruthy();
    const restoredWheel = within(combatOne).getByLabelText('Combat 2 reward');
    expect(
      (within(restoredWheel).getByRole('combobox', { name: 'Reward pool' }) as HTMLSelectElement)
        .value,
    ).toBe('MetaProgress');
    expect(
      (within(restoredWheel).getByRole('combobox', { name: 'Offers' }) as HTMLSelectElement).value,
    ).toBe('2');
    openRoomTab('Combat 2 Actions');
    const combatTwo = screen.getByLabelText('Combat 2 ship phase');
    expect(within(combatTwo).getByText('Pick up Combat 2 reward')).toBeTruthy();
    expect(within(combatTwo).getByText('Outgoing generation')).toBeTruthy();

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceShipEncounterCount',
          occurrence,
          encounterCount: 2,
        }),
      ),
    );
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Inactive Actions' })).toBeTruthy());
    openRoomTab('Inactive Actions');
    const repairs = screen.getByLabelText('Ship action repairs');
    expect(within(repairs).getByText('Choose Combat 2 reward')).toBeTruthy();
    expect(within(repairs).getByText('Pick up Combat 2 reward')).toBeTruthy();
    expect(screen.getAllByText('Choose Combat 2 reward')).toHaveLength(1);
    expect(screen.getAllByText('Pick up Combat 2 reward')).toHaveLength(1);

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceShipEncounterCount',
          occurrence,
          encounterCount: 3,
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Inactive Actions' })).toBeNull());
    openRoomTab('Combat 2 Actions');
    expect(screen.getByLabelText('Combat 2 ship phase')).toBeTruthy();
    expect(screen.queryByLabelText('Ship action repairs')).toBeNull();
    expect(shipWheel2(view.application.store.getState().projectWorkspace.history.present)).toEqual(
      shipWheel2(project),
    );
  });

  it('focuses and removes a retained Combat2 NPC row outside the active two-phase groups', async () => {
    const occurrenceId = oOccurrenceIds.combat07;
    const occurrence = createOccurrenceAddress(oBiome, occurrenceId);
    const phase = createEncounterPhaseAddress(oBiome, occurrence, 'Combat2');
    const reference = { kind: 'interactEncounter' as const, phaseKey: 'Combat2' };
    const action = createRoomActionAddress(oBiome, occurrenceId, roomActionKey(reference));
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'IcarusCombatO',
    });
    project = authorRequiredTestRoomActions(authorLegalTraitOffers(project), catalog);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 2,
    });

    const view = renderWorkspace(project, 'Surface', 'O');
    act(() => view.application.store.dispatch(semanticOwnerNavigated(action)));
    const repairs = await screen.findByLabelText('Ship action repairs');
    expect(screen.queryByLabelText('Combat 2 ship phase')).toBeNull();
    const staleNpc = within(repairs).getByText('Interact with Combat2 encounter').closest('li');
    if (staleNpc === null) throw new Error('Dormant Combat2 NPC action is missing');
    expect(screen.getAllByText('Interact with Combat2 encounter')).toHaveLength(1);
    expect(within(staleNpc).getByText('This action no longer belongs to the room.')).toBeTruthy();
    expect(document.getElementById(semanticOwnerControlElementId(action))).toBe(staleNpc);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(action);

    await view.user.click(within(staleNpc).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('Interact with Combat2 encounter')).toBeNull());
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'O',
        occurrenceId,
      )?.some((candidate) => roomActionKey(candidate) === roomActionKey(reference)),
    ).toBe(false);
  });

  it('shows a stale NPC row from an active Ship phase only in the repair surface', () => {
    const occurrenceId = oOccurrenceIds.combat01;
    const occurrence = createOccurrenceAddress(oBiome, occurrenceId);
    const phase = createEncounterPhaseAddress(oBiome, occurrence, 'Combat1');
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'IcarusCombatO',
    });
    project = authorRequiredTestRoomActions(authorLegalTraitOffers(project), catalog);
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedO',
    });

    renderStaticOccurrenceWorkbench(project, 'Surface', 'O', occurrenceById(occurrenceId));
    openRoomTab('Inactive Actions');
    const repairs = screen.getByLabelText('Ship action repairs');
    expect(within(repairs).getByText('Interact with Ship combat')).toBeTruthy();
    expect(screen.getAllByText('Interact with Ship combat')).toHaveLength(1);
    openRoomTab('Combat 1 Actions');
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    expect(within(combatOne).queryByText('Interact with Ship combat')).toBeNull();
  });

  it('keeps Ship arrow, pointer, fixed-window, and Undo behavior on one global action order', async () => {
    const occurrenceId = oOccurrenceIds.combat01;
    const occurrence = createOccurrenceAddress(oBiome, occurrenceId);
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(oBiome, occurrence, 'Combat1'),
      encounterKey: 'IcarusCombatO',
    });
    project = authorRequiredTestRoomActions(authorLegalTraitOffers(project), catalog);

    const view = renderOccurrenceWorkbench(project, 'Surface', 'O', occurrenceById(occurrenceId));
    openRoomTab('Combat 1 Actions');
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    const actionOrder = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'O',
        occurrenceId,
      );
    const rowFor = (label: string) => {
      const row = within(combatOne).getByText(label).closest<HTMLElement>('li');
      if (row === null) throw new Error(`${label} action row is missing`);
      return row;
    };

    const icarus = rowFor('Interact with Icarus combat');
    const legalArrow = within(icarus)
      .getAllByRole('button', { name: /Move Interact with Icarus combat (earlier|later)/ })
      .find((button) => !(button as HTMLButtonElement).disabled);
    if (legalArrow === undefined) throw new Error('Icarus has no legal same-window arrow move');
    const wheelTwoChoice = rowFor('Choose Combat 2 reward');
    expect(
      within(wheelTwoChoice)
        .getAllByRole('button', { name: /Move Choose Combat 2 reward (earlier|later)/ })
        .some((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);

    const initialOrder = actionOrder();
    await view.user.click(legalArrow);
    expect(actionOrder()).not.toEqual(initialOrder);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(actionOrder()).toEqual(initialOrder);

    const restoredIcarus = rowFor('Interact with Icarus combat');
    const wheelPick = rowFor('Pick up Combat 1 reward');
    const handle = restoredIcarus.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    const board = actions.querySelector<HTMLElement>('.ship-phase-list');
    if (handle === null || board === null) throw new Error('Ship pointer board is missing');
    const initialKeys = initialOrder?.map(roomActionKey) ?? [];
    const icarusKey = restoredIcarus.dataset.roomActionKey;
    const wheelPickKey = wheelPick.dataset.roomActionKey;
    const dragAfter =
      icarusKey !== undefined &&
      wheelPickKey !== undefined &&
      initialKeys.indexOf(icarusKey) < initialKeys.indexOf(wheelPickKey);
    vi.spyOn(wheelPick, 'getBoundingClientRect').mockReturnValue({
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
      value: () => wheelPick,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 73,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: dragAfter ? 150 : 70,
      isPrimary: true,
      pointerId: 73,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(board, {
      clientX: 24,
      clientY: dragAfter ? 150 : 70,
      isPrimary: true,
      pointerId: 73,
      pointerType: 'mouse',
    });
    await waitFor(() => expect(actionOrder()).not.toEqual(initialOrder));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(actionOrder()).toEqual(initialOrder);
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
    openRoomTab('Combat 2 Actions');
    await waitFor(() => expect(screen.getByLabelText('Combat 2 ship phase')).toBeTruthy());
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

    openRoomTab('Intro Actions');
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
    expect(screen.getByRole('region', { name: 'Room Actions' })).toBeTruthy();
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
  });

  it('renders materialized Shop descriptors directly', () => {
    const surface = createRepresentativeNOPQProject();
    renderStaticOccurrenceWorkbench(
      surface,
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );
    expect(screen.getByRole('columnheader', { name: 'Offer' })).toBeTruthy();
    expect(screen.queryByText('Participation')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Entering Preboss' })).toBeTruthy();
    cleanup();

    const goldenView = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(createOccurrenceId('golden-f-preboss-shop')),
    );
    const goldenNode = workspaceBiome(goldenView.application, 'Underworld', 'F').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' &&
        candidate.room.occurrenceId === createOccurrenceId('golden-f-preboss-shop'),
    );
    if (goldenNode === undefined) throw new Error('golden preboss workbench is missing');
    expect(goldenNode.room.roomLocal).toMatchObject({ kind: 'shop', supplementalOffers: [] });
    expect(screen.queryByText('Pick up infernalContractReward')).toBeNull();
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

  it('marks Shop purchases in Overview, reorders them in Actions, and restores membership through undo', async () => {
    const { project, shopId: occurrenceId } = enteredShopProject();
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const heal = screen.getByRole('checkbox', { name: 'Purchased Offer 2' });
    const mana = screen.getByRole('checkbox', { name: 'Purchased Offer 3' });
    expect(
      (screen.getByRole('checkbox', { name: 'Purchased Offer 1' }) as HTMLInputElement).checked,
    ).toBe(false);
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(heal);
    await view.user.click(mana);
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'F',
        occurrenceId,
      ),
    ).toEqual([
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      { kind: 'interactShopOffer', offerKey: 'Minor' },
    ]);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 2,
    );

    openRoomTab('Room Actions');
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    expect(within(actions).getByText('Outgoing generation')).toBeTruthy();
    expect(within(actions).queryByText('Exit usable')).toBeNull();
    expect(within(actions).queryByText('Buy Boon · Zeus')).toBeNull();

    const minor = within(actions).getByText('Buy Max Magick').closest('li');
    if (minor === null) throw new Error('Minor Shop action is missing');
    await view.user.click(
      within(minor).getByRole('button', { name: 'Move Buy Max Magick earlier' }),
    );
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'F',
        occurrenceId,
      ),
    ).toEqual([
      { kind: 'interactShopOffer', offerKey: 'Minor' },
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
    ]);
    openRoomTab('Room Overview');
    const reorderedHeal = screen.getByRole('checkbox', { name: 'Purchased Offer 2' });
    await view.user.click(reorderedHeal);
    expect((reorderedHeal as HTMLInputElement).checked).toBe(false);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      (screen.getByRole('checkbox', { name: 'Purchased Offer 2' }) as HTMLInputElement).checked,
    ).toBe(true);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(
      (screen.getByRole('checkbox', { name: 'Purchased Offer 2' }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('reuses the ranked pointer language for Room Action peers and keeps unranked actions below a boundary', async () => {
    const { project, shopId: occurrenceId } = enteredShopProject();
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Offer 2' }));
    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Offer 3' }));
    openRoomTab('Room Actions');
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    expect(within(actions).queryByRole('region', { name: 'Room action repairs' })).toBeNull();
    const board = within(actions).getByRole('list', { name: 'Ranked room action order' });
    const major = within(actions).getByText('Buy Heal').closest<HTMLElement>('li');
    const minor = within(actions).getByText('Buy Max Magick').closest<HTMLElement>('li');
    if (major === null || minor === null) throw new Error('Ranked Shop action rows are missing');
    const handle = major.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    if (handle === null) throw new Error('Ranked Room Action drag handle is missing');
    vi.spyOn(minor, 'getBoundingClientRect').mockReturnValue({
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
      value: () => minor,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: 150,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });
    expect(major.dataset.dragging).toBe('true');
    expect(document.querySelector('.hub-roster-drag-preview')).not.toBeNull();
    fireEvent.pointerUp(board, {
      clientX: 24,
      clientY: 150,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(
        occurrenceRoomActionOrder(
          view.application.store.getState().projectWorkspace.history.present,
          'Underworld',
          'F',
          occurrenceId,
        ),
      ).toEqual([
        { kind: 'interactShopOffer', offerKey: 'Minor' },
        { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      ]),
    );
    expect(document.querySelector('.hub-roster-drag-preview')).toBeNull();
  });

  it('repairs a retained Shop purchase after its occurrence is no longer a Shop', async () => {
    const entered = enteredShopProject();
    const offer = createShopOfferAddress(goldenFBiome, entered.shopId, 'MajorNonBoon');
    let project = applyProjectCommand(entered.project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer,
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, entered.shopId),
      gameName: 'F_Combat04',
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(entered.shopId),
    );
    openRoomTab('Room Actions');
    const repairs = screen.getByRole('region', { name: 'Room action repairs' });
    expect(within(repairs).getByText('Buy MajorNonBoon')).toBeTruthy();
    expect(within(repairs).queryByRole('button', { name: 'Remove' })).toBeNull();
    await view.user.click(within(repairs).getByRole('button', { name: 'Unmark Purchased' }));
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'F',
        entered.shopId,
      ),
    ).toEqual([]);
  });

  it('renders an unpicked Shop as dormant without inventory controls', () => {
    const { project, shopId } = dormantShopProject();
    renderStaticOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));

    expect(screen.getByText('Shop inventory appears when you select this room.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });
});
