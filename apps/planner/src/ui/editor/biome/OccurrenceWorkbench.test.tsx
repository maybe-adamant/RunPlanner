// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createLocalChildAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlannerApplication } from '../../../composition/createApplication';
import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '../../../projections/structured-workspace';
import {
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '../../../state/projectWorkspaceSlice';
import {
  createGoldenFGHIProject,
  goldenFBiome,
} from '../../../../../../test/fixtures/authored-project';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oOccurrenceIds,
  pBiome,
  pOccurrenceIds,
} from '../../../../../../test/fixtures/authored-project';
import { renderOccurrenceWorkbench, renderStaticOccurrenceWorkbench } from './workbenchTestHarness';

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

  it('renders Fields, Ship, and materialized Shop descriptors directly', () => {
    const underworld = createGoldenFGHIProject();
    renderStaticOccurrenceWorkbench(
      underworld,
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    expect(screen.getByLabelText('Fields cage rewards')).toBeTruthy();
    expect(screen.getByText('Cage 1')).toBeTruthy();
    cleanup();

    const surface = createRepresentativeNOPQProject();
    renderStaticOccurrenceWorkbench(
      surface,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    expect(screen.getByLabelText('Ship combat encounters')).toBeTruthy();
    expect(screen.getByText('Reward wheel 1')).toBeTruthy();
    cleanup();

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

    expect(screen.getByText('Shop inventory materializes when this room is picked.')).toBeTruthy();
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
