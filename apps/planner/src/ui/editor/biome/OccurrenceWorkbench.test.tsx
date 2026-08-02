// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createLocalChildAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlannerApplication } from '@planner/composition/createApplication';
import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenHBiome,
  goldenHStartId,
} from '@run-planner/test-fixtures';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  renderOccurrenceWorkbench,
  renderStaticOccurrenceWorkbench,
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

function shipWheel2(project: ProjectDocument) {
  const state = occurrenceState(project, 'Surface', 'O', oOccurrenceIds.combat07);
  if (state.kind !== 'shipCombat') throw new Error('O Ship state is missing');
  const wheel = state.wheels.wheel2;
  if (wheel === undefined) throw new Error('O Ship wheel 2 is missing');
  return wheel;
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
  it('withholds dormant Ephyra side controls and renders rooms without local detail plainly', () => {
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
    expect(screen.getByText('No additional room details.')).toBeTruthy();
    expect(screen.queryByText('Fixed reward:')).toBeNull();
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
      name: 'Side Room 03 entry order',
    }) as HTMLSelectElement;
    await view.user.click(entryOrder);
    await waitFor(() => {
      expect(Array.from(entryOrder.options).map((option) => option.textContent)).toEqual([
        'Not entered',
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

  it('applies a direct side-room insertion as one undoable complete order', async () => {
    const view = renderOccurrenceWorkbench(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const table = screen.getByRole('table', {
      name: 'Ephyra side-room generation and entry order',
    });
    expect(within(table).getByRole('columnheader', { name: 'Side room' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enter last|Earlier|Later/ })).toBeNull();
    const entryOrder = within(table).getByRole('combobox', {
      name: 'Side Room 03 entry order',
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
    const ship = screen.getByLabelText('Ship combat encounters');
    expect(
      Array.from(ship.querySelectorAll('.reward-wheel h4')).map((heading) => heading.textContent),
    ).toEqual(['Reward wheel 1', 'Reward wheel 2']);
    expect(
      within(within(screen.getByLabelText('Reward wheel 1')).getByLabelText('Offer 2')).getByText(
        'Dormant',
      ),
    ).toBeTruthy();
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
      kind: 'SetShopPurchase',
      purchase,
      purchased: true,
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
    if (repairCheckbox.checked) await repair.user.click(repairCheckbox);
    expect(repairCheckbox.checked).toBe(false);
    expect(repair.application.store.getState().projectWorkspace.history.past).toHaveLength(
      repairBefore + 1,
    );
  });
});
