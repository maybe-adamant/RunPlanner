// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected } from '@planner/state/editorSessionSlice';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  goldenHStartId,
} from '@run-planner/test-fixtures';
import {
  createRepresentativeNProject,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  renderOccurrenceWorkbench,
  renderStaticOccurrenceWorkbench,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';

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
    const initialWheel = screen.getByLabelText('Reward wheel 2');
    const ship = screen.getByLabelText('Ship combat details');
    expect(
      Array.from(ship.querySelectorAll('.reward-wheel h4')).map((heading) => heading.textContent),
    ).toEqual(['Reward wheel 1', 'Reward wheel 2']);
    expect(within(screen.getByLabelText('Reward wheel 1')).queryByLabelText('Offer 2')).toBeNull();
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
    await waitFor(() => expect(screen.queryByLabelText('Reward wheel 2')).toBeNull());
    expect(
      Array.from(ship.querySelectorAll('.reward-wheel h4')).map((heading) => heading.textContent),
    ).toEqual(['Reward wheel 1']);

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceShipEncounterCount',
          occurrence,
          encounterCount: 3,
        }),
      ),
    );
    await waitFor(() => expect(screen.getByLabelText('Reward wheel 2')).toBeTruthy());
    expect(
      Array.from(ship.querySelectorAll('.reward-wheel h4')).map((heading) => heading.textContent),
    ).toEqual(['Reward wheel 1', 'Reward wheel 2']);

    const restoredWheel = screen.getByLabelText('Reward wheel 2');
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

    const rewardWheel = screen.getByLabelText('Reward wheel 1');
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
    ).toEqual({ offer: { rewardType: 'MetaCurrencyDrop' }, traitOffersByAcquisitionRole: {} });

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
    expect(screen.getAllByText('Purchased')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Preboss' })).toBeTruthy();
    expect(screen.queryByLabelText('Customize')).toBeNull();
  });

  it('authors Shop membership and ordinal as one complete purchase order per row action', async () => {
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
      return state.shop.purchaseOrder;
    };
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByLabelText('Purchase Offer 1'));
    expect(order()).toEqual(['Boon']);

    await view.user.click(screen.getByLabelText('Purchase Offer 2'));
    expect(order()).toEqual(['Boon', 'MajorNonBoon']);

    await view.user.selectOptions(screen.getByLabelText('Purchase order for Offer 2'), '1');
    expect(order()).toEqual(['MajorNonBoon', 'Boon']);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 3,
    );
  });

  it('renders an unpicked Shop as dormant without inventory controls', () => {
    const { project, shopId } = dormantShopProject();
    renderStaticOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));

    expect(screen.getByText('Shop inventory appears when you select this room.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });

  it('keeps an impossible Shop purchase disabled while allowing its selected repair', async () => {
    const offer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
    const purchase = createShopPurchaseAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
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
      kind: 'ReplaceShopPurchaseOrder',
      shop: createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
      offerKeys: ['Boon'],
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
});
