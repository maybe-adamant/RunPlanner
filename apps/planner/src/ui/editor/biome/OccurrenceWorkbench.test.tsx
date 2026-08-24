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
  createNemesisRandomEventAddress,
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
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  semanticAddressKey,
  roomActionKey,
  selectedPickupProducers,
  type OccurrenceId,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type {
  WorkspaceBiome,
  WorkspaceMixedBatchNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected, semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import {
  OccurrenceWorkbench,
  SteadyGrowthEffectRow,
} from '@planner/ui/editor/biome/OccurrenceWorkbench';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  createCompleteFGProject,
  createFConversionFrontierProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  loadUnderworldFGProject,
  loadNemesisFieldsCheckpoint,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNProject,
  loadSurfaceNStoryBoardProject,
  loadSurfaceNOPQProject,
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
import { replaceTestRoomActionOrder } from '@run-planner/test-fixtures/shared';

let immutableRepresentativeNOPQProject: ProjectDocument;

beforeAll(function prepareImmutableRepresentativeProjects() {
  createGoldenFGHIProject();
  immutableRepresentativeNOPQProject = loadSurfaceNOPQProject();
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

function completionOccurrenceById(
  occurrenceId: string,
): (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined {
  return (biome) => biome.completionOutline.find((node) => node.room.occurrenceId === occurrenceId);
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

function selectedNarcissusPickupSite(project: ProjectDocument, occurrenceId: OccurrenceId): string {
  const occurrence = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error('Narcissus occurrence is missing');
  const producer = selectedPickupProducers(catalog, goldenGBiome, occurrence).find(
    (candidate) => candidate.traitKey?.startsWith('Narcissus') === true,
  );
  if (producer === undefined) throw new Error('selected Narcissus pickup producer is missing');
  return producer.siteKey;
}

function threeCageFieldsProject(): ProjectDocument {
  const occurrenceId = createOccurrenceId('golden-h-combat02');
  const expanded = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'ReplaceFieldsCageOutcome',
    decision: createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-h-intro'),
    }),
    cageOutcome: 'max',
  });
  return replaceTestRoomActionOrder(expanded, catalog, goldenHBiome, occurrenceId, [
    { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage03' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage3' },
  ]);
}

function fieldsGorgonBarrierProject(): ProjectDocument {
  const occurrenceId = createOccurrenceId('golden-h-combat02');
  const phase = createEncounterPhaseAddress(
    goldenHBiome,
    { kind: 'occurrence', occurrenceId },
    'Cage01',
  );
  let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
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
  return replaceTestRoomActionOrder(project, catalog, goldenHBiome, occurrenceId, [
    { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional2' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
    { kind: 'interactGorgon', phaseKey: 'Cage01' },
    { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional1' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
  ]);
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
  it('reopens the shared Steady Growth target picker on exact finding navigation', async () => {
    const application = createApplication();
    const outcome = createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      'Encounter',
    );
    const control = {
      address: outcome,
      marker: Object.freeze({
        address: outcome,
        assessment: 'assessed' as const,
        findingCount: 1,
        focusKey: 'test-steady-growth-row',
      }),
      phaseKey: 'Encounter',
    };
    const interaction = {
      key: semanticAddressKey(outcome),
      owner: outcome,
      intentFor: () => ({
        command: {
          kind: 'ReplaceSteadyGrowthTarget' as const,
          outcome,
          targetTraitKey: 'ApolloWeaponBoon',
        },
      }),
      forTarget: () => ({
        load: () => ({
          emptyNoOp: false,
          picker: {
            sections: [
              {
                key: 'eligible',
                kind: 'category' as const,
                label: 'Eligible traits',
                collapsible: false,
                items: [
                  {
                    key: 'ApolloWeaponBoon',
                    label: 'Apollo Attack',
                    value: 'ApolloWeaponBoon',
                    state: 'possible' as const,
                    selected: false,
                    disabled: false,
                  },
                ],
              },
            ],
          },
          selectedPossible: true,
        }),
      }),
      traitLabel: (traitKey: string) => traitKey,
    };
    application.store.dispatch(semanticOwnerNavigated(outcome));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interactions = {
      ...workspace.interactions,
      steadyGrowth: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <SteadyGrowthEffectRow control={control} interactions={interactions} />
      </Provider>,
    );
    const picker = await screen.findByLabelText('Steady Growth target');
    await waitFor(() => expect(picker.getAttribute('aria-expanded')).toBe('true'));
    expect(picker.id).toBe(semanticOwnerControlElementId(outcome));
    application.dispose();
  });

  it('keeps a stale Steady Growth target visible and exposes its exact clear command', async () => {
    const application = createApplication();
    vi.spyOn(application.store, 'dispatch').mockImplementation(() => undefined as never);
    const outcome = createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(nBiome, nOccurrenceIds.opening),
      'Encounter',
    );
    const clearIntent = vi.fn(() => ({
      command: {
        kind: 'ReplaceSteadyGrowthTarget' as const,
        outcome,
        targetTraitKey: null,
      },
    }));
    const control = {
      address: outcome,
      marker: Object.freeze({
        address: outcome,
        assessment: 'assessed' as const,
        findingCount: 1,
        focusKey: 'test-steady-growth-retained-row',
      }),
      phaseKey: 'Encounter',
      targetTraitKey: 'HestiaWeaponBoon',
    };
    const interaction = {
      key: semanticAddressKey(outcome),
      owner: outcome,
      intentFor: clearIntent,
      forTarget: () => ({
        load: () => ({
          emptyNoOp: true,
          picker: {
            selected: {
              key: 'HestiaWeaponBoon',
              label: 'Hestia Attack',
              value: 'HestiaWeaponBoon',
              state: 'impossible' as const,
              selected: true,
              disabled: true,
            },
            sections: [
              {
                key: 'selected-invalid',
                kind: 'selectedInvalid' as const,
                label: 'Current target',
                collapsible: false,
                items: [
                  {
                    key: 'HestiaWeaponBoon',
                    label: 'Hestia Attack',
                    value: 'HestiaWeaponBoon',
                    state: 'impossible' as const,
                    selected: true,
                    disabled: true,
                  },
                ],
              },
            ],
          },
          selectedPossible: false,
        }),
      }),
      traitLabel: (traitKey: string) => traitKey,
    };
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interactions = {
      ...workspace.interactions,
      steadyGrowth: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <SteadyGrowthEffectRow control={control} interactions={interactions} />
      </Provider>,
    );
    expect(await screen.findByLabelText('Steady Growth target')).toBeTruthy();
    expect(screen.queryByText('No eligible trait (no-op)')).toBeNull();
    await screen.findByRole('button', { name: 'Clear recorded target' }).then((button) =>
      act(() => {
        button.click();
      }),
    );
    expect(clearIntent).toHaveBeenCalledWith(null);
    application.dispose();
  });

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
    const overviewRunState = screen.getByRole('button', { name: 'Run State' });
    const entryOwner = overviewRunState.getAttribute('data-run-state-launcher');
    expect(overviewRunState.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Room Timeline');
    const standardActions = screen.getByRole('region', { name: 'Room Timeline' });
    const standardStart = within(standardActions).getByLabelText('Start encounter');
    const standardEncounter = within(standardActions).getByLabelText('Encounter encounter phase');
    const standardEnd = within(standardActions).getByLabelText('End encounter');
    const roomEntered = within(standardActions).getByLabelText('Room entered');
    const entryRunState = screen.getByRole('button', { name: 'Run State' });
    expect(entryRunState.getAttribute('data-run-state-launcher')).toBe(entryOwner);
    expect(entryRunState.closest('.room-tab-utility-bar')).not.toBeNull();
    expectBefore(entryRunState, roomEntered);
    expectBefore(standardStart, standardEncounter);
    expectBefore(standardEncounter, standardEnd);
    openRoomTab('Room Doors');
    expect(
      within(screen.getByRole('tabpanel', { name: 'Room Doors' })).getByRole('button', {
        name: 'Run State',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Run State' }).closest('.room-tab-utility-bar'),
    ).not.toBeNull();
  });

  it.each([
    ['F', () => createGoldenFGHIProject(), 'Underworld', 'F', goldenFStartId],
    ['N', () => loadSurfaceNProject(), 'Surface', 'N', nOccurrenceIds.opening],
  ] as const)(
    'renders the %s Opening pickup before Start encounter and End encounter',
    (_name, project, routeKey, biomeKey, occurrenceId) => {
      renderStaticOccurrenceWorkbench(project(), routeKey, biomeKey, occurrenceById(occurrenceId));
      openRoomTab('Room Timeline');
      const actions = screen.getByRole('region', { name: 'Room Timeline' });
      const pickup = within(actions).getByText(/^Interact with .* pickup/);
      const start = within(actions).getByLabelText('Start encounter');
      const end = within(actions).getByLabelText('End encounter');
      expectBefore(pickup, start);
      expectBefore(start, end);
      expect(within(actions).queryByText('Outgoing generation')).toBeNull();
    },
  );

  it('places Ship Run State in one consistent tab utility slot', () => {
    renderStaticOccurrenceWorkbench(
      immutableRepresentativeNOPQProject,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    const overview = screen.getByRole('button', { name: 'Run State' });
    const introOwner = overview.getAttribute('data-run-state-launcher');
    expect(overview.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Intro Timeline');
    const intro = screen.getByRole('button', { name: 'Run State' });
    expect(intro.getAttribute('data-run-state-launcher')).toBe(introOwner);
    expect(intro.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Combat 1 Timeline');
    const combat1 = screen.getByRole('button', { name: 'Run State' });
    expect(combat1.getAttribute('data-run-state-launcher')).not.toBe(introOwner);
    expect(combat1.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Room Doors');
    const doors = screen.getByRole('button', { name: 'Run State' });
    expect(doors.getAttribute('data-run-state-launcher')).not.toBe(introOwner);
    expect(doors.closest('.room-tab-utility-bar')).not.toBeNull();
  });

  it('supports roving keyboard activation across the room workbench tabs', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    const overview = screen.getByRole('tab', { name: 'Room Overview' });
    const actions = screen.getByRole('tab', { name: 'Room Timeline' });
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
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    openRoomTab('Combat 1 Timeline');
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

  it('keeps N side-room generation in Overview and Room Timeline in its own tab', () => {
    renderStaticOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const sideRooms = screen.getByLabelText('Ephyra side rooms');
    expect(sideRooms).toBeTruthy();
    openRoomTab('Room Timeline');
    const nActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(nActions).toBeTruthy();
    expect(within(nActions).getByLabelText('Encounter encounter phase')).toBeTruthy();
  }, 10_000);

  it('renders Fields setup before its one Room Timeline board', () => {
    renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    const fieldsSetup = screen.getByLabelText('Fields setup');
    expect(fieldsSetup).toBeTruthy();
    expect(within(fieldsSetup).getByLabelText('Optional 1')).toBeTruthy();
    openRoomTab('Room Timeline');
    const fieldsActions = screen.getByRole('region', { name: 'Room Timeline' });
    const fieldsEntered = within(fieldsActions).getByLabelText('Room entered');
    const passiveEncounter = within(fieldsActions).getByLabelText('Passive encounter phase');
    expectBefore(fieldsEntered, passiveEncounter);
    expect(
      fieldsActions.querySelector('[data-lifecycle-boundary="encounterStart:Passive"]'),
    ).toBeNull();
    const fieldsEncounter = screen.queryByLabelText('Encounter encounter phase');
    if (fieldsEncounter !== null) expectBefore(fieldsEncounter, fieldsActions);
    const timeline = within(fieldsActions).getByRole('list', { name: 'Room timeline' });
    const optionalPool = within(fieldsActions).getByRole('region', { name: 'Optional actions' });
    expect(within(timeline).queryByText(/^Interact with Optional 1 pickup · .+/)).toBeNull();
    const optionalAction = within(optionalPool)
      .getByText(/^Interact with Optional 1 pickup · .+/)
      .closest('li');
    if (optionalAction === null) throw new Error('Optional reward action is missing');
    expect(within(optionalAction).queryByLabelText('Optional 1')).toBeNull();
    expect(within(optionalAction).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(fieldsActions).toBeTruthy();
  });

  it('projects three fixed Fields cycles with cage selectors and movable pickups', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      threeCageFieldsProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const timeline = within(actions).getByRole('list', { name: 'Room timeline' });
    const starts = [1, 2, 3].map((ordinal) =>
      within(timeline).getByLabelText(`Start encounter ${ordinal}`),
    );
    const ends = Array.from(
      timeline.querySelectorAll<HTMLElement>('[data-lifecycle-boundary^="encounterEnd:"]'),
    );
    expect(ends).toHaveLength(3);
    expect(
      [1, 2, 3].map(
        (ordinal) =>
          (
            within(starts[ordinal - 1]!).getByRole('combobox', {
              name: `Cage for encounter ${ordinal}`,
            }) as HTMLSelectElement
          ).value,
      ),
    ).toEqual(['Cage01', 'Cage02', 'Cage03']);
    for (const [index, start] of starts.entries()) {
      const selector = within(start).getByRole('combobox', {
        name: `Cage for encounter ${index + 1}`,
      });
      const options = within(selector).getAllByRole('option') as HTMLOptionElement[];
      expect(options.find((option) => option.value === `Cage0${index + 1}`)?.disabled).toBe(true);
      expect(
        options
          .filter((option) => option.value !== `Cage0${index + 1}`)
          .every((option) => !option.disabled),
      ).toBe(true);
    }
    expect(within(timeline).queryByText(/^Complete Cage/)).toBeNull();
    for (const row of timeline.querySelectorAll('[data-in-order="true"]')) {
      expect(row.querySelectorAll('.hub-rank-action')).toHaveLength(2);
    }

    const dropTargetSelector =
      '[data-room-action-drop-index], [data-room-action-key][data-in-order="true"]';
    const timelineChildren = Array.from(timeline.children);
    for (const [index, start] of starts.entries()) {
      const end = ends[index]!;
      expectBefore(start, end);
      const startIndex = timelineChildren.indexOf(start);
      const endIndex = timelineChildren.indexOf(end);
      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(endIndex).toBeGreaterThan(startIndex);
      const insertionTargets = timelineChildren
        .slice(startIndex + 1, endIndex)
        .flatMap((candidate) => [
          ...(candidate.matches(dropTargetSelector) ? [candidate] : []),
          ...candidate.querySelectorAll(dropTargetSelector),
        ]);
      expect(insertionTargets).toEqual([]);
    }

    const cagePickup = within(timeline)
      .getByText(/^Interact with Cage 1 pickup · /)
      .closest<HTMLElement>('[data-room-action-key]');
    if (cagePickup === null) throw new Error('Cage 1 pickup row is missing');
    expectBefore(ends[0]!, cagePickup);
    expect(cagePickup.querySelector('[data-room-action-drag-handle]')).not.toBeNull();
    const movePickupEarlier = within(cagePickup).getByRole('button', {
      name: /^Move Interact with Cage 1 pickup · .* earlier$/,
    }) as HTMLButtonElement;
    expect(movePickupEarlier.disabled).toBe(false);
    await view.user.click(movePickupEarlier);
    await waitFor(() => {
      const order = occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      );
      expect(
        order?.flatMap((reference) =>
          reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
        ),
      ).toEqual(['Cage01', 'Cage02', 'Cage03']);
      expect(order?.[2]).toEqual({
        groupKey: 'cages',
        kind: 'interactLocalReward',
        slotKey: 'cage1',
      });
    });
    expect(within(actions).getByRole('region', { name: 'Optional actions' })).toBeTruthy();

    const cageOneAction = createRoomActionAddress(
      goldenHBiome,
      occurrenceId,
      roomActionKey({ kind: 'completeFieldsCage', phaseKey: 'Cage01' }),
    );
    expect(starts[0]?.getAttribute('id')).toBe(semanticOwnerControlElementId(cageOneAction));
  });

  it('moves a selected Fields cage into its fixed cycle as one undoable history step', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      threeCageFieldsProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.selectOptions(
      screen.getByRole('combobox', { name: 'Cage for encounter 1' }),
      'Cage01',
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    await view.user.selectOptions(
      screen.getByRole('combobox', { name: 'Cage for encounter 1' }),
      'Cage03',
    );

    const cagePermutation = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      )?.flatMap((reference) =>
        reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
      );
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage03', 'Cage01', 'Cage02']));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      [1, 2, 3].map(
        (ordinal) =>
          (
            screen.getByRole('combobox', {
              name: `Cage for encounter ${ordinal}`,
            }) as HTMLSelectElement
          ).value,
      ),
    ).toEqual(['Cage03', 'Cage01', 'Cage02']);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage01', 'Cage02', 'Cage03']));
    expect(
      (
        screen.getByRole('combobox', {
          name: 'Cage for encounter 1',
        }) as HTMLSelectElement
      ).value,
    ).toBe('Cage01');
  });

  it('keeps a cage selectable across a retained cage-local Gorgon barrier', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      fieldsGorgonBarrierProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const selector = screen.getByRole('combobox', {
      name: 'Cage for encounter 1',
    }) as HTMLSelectElement;
    const cageTwoOption = within(selector).getByRole('option', {
      name: 'Cage02',
    }) as HTMLOptionElement;
    expect(cageTwoOption.disabled).toBe(false);

    const projected = workspaceProjection(view.application)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (projected?.kind !== 'occurrenceWorkbench') {
      throw new Error('Fields Gorgon occurrence workbench is missing');
    }
    const roomActions = projected.room.roomActions;
    const slot = roomActions?.timeline.entries.find(
      (entry) => entry.kind === 'boundary' && entry.fieldsCageSlot?.slotOrdinal === 1,
    );
    const cageTwoChoice =
      slot?.kind === 'boundary'
        ? slot.fieldsCageSlot?.choices.find((choice) => choice.value === 'Cage02')
        : undefined;
    const genericProposal = roomActions?.proposals.find(
      (proposal) => proposal.key === cageTwoChoice?.proposalKey,
    );
    expect(genericProposal).toMatchObject({ kind: 'move', structurallyAuthorable: false });

    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.selectOptions(selector, 'Cage02');
    await waitFor(() => {
      const order = occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      );
      expect(
        order?.flatMap((reference) =>
          reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
        ),
      ).toEqual(['Cage02', 'Cage01']);
      expect(order).toContainEqual({ kind: 'interactGorgon', phaseKey: 'Cage01' });
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );

    const edited = workspaceProjection(view.application)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (edited?.kind !== 'occurrenceWorkbench') {
      throw new Error('Edited Fields Gorgon occurrence workbench is missing');
    }
    const gorgon = edited.room.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactGorgon' && row.reference.phaseKey === 'Cage01',
    );
    expect(gorgon).toMatchObject({ executable: true, issues: [], stale: false });
  });

  it('keeps a missing active Fields cage anchor in Timeline repairs', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const authored = threeCageFieldsProject();
    const malformed = decodeProjectDocument(
      {
        ...authored,
        routes: authored.routes.map((route) => ({
          ...route,
          biomes: route.biomes.map((biome) =>
            biome.biomeKey !== 'H' || biome.topology === null
              ? biome
              : {
                  ...biome,
                  topology: {
                    ...biome.topology,
                    occurrences: biome.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId !== occurrenceId
                        ? occurrence
                        : {
                            ...occurrence,
                            roomActions: {
                              order: occurrence.roomActions.order.filter(
                                (reference) =>
                                  reference.kind !== 'completeFieldsCage' ||
                                  reference.phaseKey !== 'Cage03',
                              ),
                            },
                          },
                    ),
                  },
                },
          ),
        })),
      },
      catalog,
    );
    renderOccurrenceWorkbench(malformed, 'Underworld', 'H', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const timeline = within(actions).getByRole('list', { name: 'Room timeline' });
    const repairs = within(actions).getByRole('region', { name: 'Timeline repairs' });
    expect(within(timeline).queryByText('Complete Cage03')).toBeNull();
    expect(within(repairs).getByText('Complete Cage03')).toBeTruthy();
    expect(within(repairs).getByText('This required action has not been placed.')).toBeTruthy();
  });

  it('accepts a Fields optional reward directly on the Room entered checkpoint', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const optionalPool = within(actions).getByRole('region', { name: 'Optional actions' });
    const initialOptional = within(optionalPool)
      .getByText(/^Interact with Optional 1 pickup · .+/)
      .closest<HTMLElement>('[data-room-action-key]');
    if (initialOptional === null) throw new Error('Optional 1 action is missing');
    const insertion = within(initialOptional).getByRole('combobox', {
      name: /^Insert Interact with Optional 1 pickup/,
    }) as HTMLSelectElement;
    expect(insertion.closest('label')?.classList.contains('field-control-inline')).toBe(true);
    const lastAvailable = Array.from(insertion.options).findLast(
      (option) => option.value !== '' && !option.disabled,
    );
    if (lastAvailable === undefined) throw new Error('Optional 1 has no insertion proposal');
    await view.user.selectOptions(insertion, lastAvailable.value);

    expect(within(optionalPool).queryByText(/^Interact with Optional 1 pickup · .+/)).toBeNull();
    const orderedOptional = within(actions)
      .getByText(/^Interact with Optional 1 pickup · .+/)
      .closest<HTMLElement>('[data-room-action-key]');
    const roomEntered = within(actions).getByLabelText('Room entered');
    const board = within(actions).getByRole('list', { name: 'Room timeline' });
    const handle = orderedOptional?.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    if (orderedOptional === null || handle === null || handle === undefined)
      throw new Error('Ordered Optional 1 drag handle is missing');
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => roomEntered,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: 80,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });
    expect(roomEntered.dataset.dropPosition).toBe('available');
    fireEvent.pointerUp(board, {
      clientX: 24,
      clientY: 80,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(
        occurrenceRoomActionOrder(
          view.application.store.getState().projectWorkspace.history.present,
          'Underworld',
          'H',
          occurrenceId,
        )?.[0],
      ).toEqual({
        groupKey: 'optionalRewards',
        kind: 'interactLocalReward',
        slotKey: 'optional1',
      }),
    );
  });

  it('renders Shop inventory before Room features and Room Timeline', () => {
    const shop = enteredShopProject();
    renderStaticOccurrenceWorkbench(shop.project, 'Underworld', 'F', occurrenceById(shop.shopId));
    const inventory = screen.getByLabelText('Shop inventory and conditions');
    const shopFeatures = screen.getByLabelText('Room features');
    expectBefore(inventory, shopFeatures);
    openRoomTab('Room Timeline');
    const shopActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(shopActions).toBeTruthy();
  });

  it('edits, reorders, repairs, and focuses fixed Pool sales through the shared timeline', async () => {
    const postbossId = createOccurrenceId('completion:F:postboss');
    const view = renderOccurrenceWorkbench(
      authorLegalTraitOffers(loadUnderworldFGProject()),
      'Underworld',
      'F',
      completionOccurrenceById(postbossId),
    );
    expect(screen.queryByRole('combobox', { name: 'Pool of Purging Left slot' })).toBeNull();
    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Pool of Purging' }));
    const left = screen.getByRole('combobox', { name: 'Pool of Purging Left slot' });
    const firstTrait = Array.from((left as HTMLSelectElement).options).find(
      (option) => option.value !== '',
    );
    if (firstTrait === undefined) throw new Error('F Pool has no eligible trait candidate');
    const leftTraitLabel = firstTrait.text;
    await view.user.selectOptions(left, firstTrait.value);
    for (const label of ['Middle slot', 'Right slot'] as const) {
      const slot = screen.getByRole('combobox', { name: `Pool of Purging ${label}` });
      const trait = Array.from((slot as HTMLSelectElement).options).find(
        (option) => option.value !== '',
      );
      if (trait === undefined) throw new Error(`F Pool ${label} has no eligible trait candidate`);
      await view.user.selectOptions(slot, trait.value);
    }
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.purgingPool
          ?.traitKeyBySlot.left,
      ).toBe(firstTrait.value),
    );

    await view.user.click(screen.getByRole('checkbox', { name: 'Sell Left slot' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.roomActions
          .order,
      ).toContainEqual({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );

    await view.user.click(screen.getByRole('checkbox', { name: 'Sell Middle slot' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.roomActions
          .order,
      ).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'useFountain' },
      ]),
    );

    openRoomTab('Room Timeline');
    await view.user.click(
      screen.getByRole('button', { name: `Move Sell ${leftTraitLabel} earlier` }),
    );
    const poolActionOrder = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.roomActions.order;
    await waitFor(() =>
      expect(poolActionOrder()).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'useFountain' },
      ]),
    );

    view.application.store.dispatch(authoredProjectUndoRequested());
    await waitFor(() =>
      expect(poolActionOrder()).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'useFountain' },
      ]),
    );
    view.application.store.dispatch(authoredProjectRedoRequested());
    await waitFor(() =>
      expect(poolActionOrder()).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'useFountain' },
      ]),
    );

    openRoomTab('Room Overview');
    await view.user.selectOptions(
      screen.getByRole('combobox', { name: 'Pool of Purging Left slot' }),
      '',
    );
    await waitFor(() =>
      expect(poolActionOrder()).toContainEqual({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );

    const leftSale = createRoomActionAddress(
      goldenFBiome,
      postbossId,
      roomActionKey({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );
    act(() => view.application.store.dispatch(semanticOwnerNavigated(leftSale)));
    openRoomTab('Room Timeline');
    const repairs = await screen.findByRole('region', { name: 'Timeline repairs' });
    const stale = within(repairs).getByText('Sell left Pool trait').closest('li');
    if (stale === null) throw new Error('Retained Pool sale is missing');
    expect(document.getElementById(semanticOwnerControlElementId(leftSale))).toBe(stale);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(leftSale);
    await view.user.click(
      within(stale).getByRole('button', { name: 'Remove Sell left Pool trait from timeline' }),
    );
    await waitFor(() =>
      expect(poolActionOrder()).not.toContainEqual({
        kind: 'sellPurgingPoolTrait',
        slotKey: 'left',
      }),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Pool of Purging' }));
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: 'Pool of Purging Middle slot' })).toBeNull(),
    );
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.purgingPool
        ?.traitKeyBySlot.middle,
    ).not.toBeNull();
  });

  it('keeps Nectar trait editing on its pickup line and hides it after Artificer conversion', async () => {
    const view = renderOccurrenceWorkbench(
      createFConversionFrontierProject('GiftDrop').project,
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    openRoomTab('Room Timeline');
    const disposition = screen.getByRole('combobox', {
      name: /^Pickup outcome for /,
    });
    const outcomeControl = disposition.closest('label');
    if (outcomeControl === null) throw new Error('Pickup outcome control is missing');
    expect(outcomeControl.classList.contains('pickup-outcome-control')).toBe(true);
    expect(within(outcomeControl).getByText('Pickup outcome')).toBeTruthy();
    expect(within(disposition).getByRole('option', { name: 'Pick up reward' })).toBeTruthy();
    expect(
      (
        within(disposition).getByRole('option', {
          name: 'Artificer · replace reward',
        }) as HTMLOptionElement
      ).disabled,
    ).toBe(false);
    expect(
      within(outcomeControl).queryByRole('button', {
        name: 'Edit Pom: No eligible traits',
      }),
    ).toBeNull();
    const pomLauncher = screen.getByRole('button', {
      name: /Edit Pom: No eligible traits/,
    });
    expect(pomLauncher.getAttribute('data-trait-status')).toBe('valid');
    const pickupRow = pomLauncher.closest<HTMLElement>('[data-room-action-key]');
    if (pickupRow === null) throw new Error('Nectar pickup row is missing');
    expect(
      pickupRow
        .querySelector(':scope > .room-action-controls > .room-action-inline-editors')
        ?.contains(pomLauncher),
    ).toBe(true);

    await view.user.selectOptions(disposition, 'artificer');
    await waitFor(() => {
      const sourceAction = screen
        .getByText(/^Interact with Reward pickup · /)
        .closest<HTMLElement>('[data-room-action-key]');
      if (sourceAction === null) throw new Error('Artificer source action is missing');
      expect(
        within(sourceAction).queryByRole('button', {
          name: 'Edit Pom: No eligible traits',
        }),
      ).toBeNull();
      expect(within(sourceAction).getByRole('button', { name: 'Artificer item' })).toBeTruthy();
    });
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
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const sourceAction = within(actions)
      .getByText(/^Interact with Reward pickup · /)
      .closest<HTMLElement>('[data-room-action-key]');
    const replacementAction = within(actions)
      .getByText(/^Interact with Artificer pickup/)
      .closest<HTMLElement>('[data-room-action-key]');
    if (sourceAction === null || replacementAction === null)
      throw new Error('Artificer source/replacement actions are missing');
    expectBefore(sourceAction, replacementAction);
    expect(
      within(sourceAction).getByRole('combobox', { name: /^Pickup outcome for / }),
    ).toBeTruthy();
    expect(within(sourceAction).getByRole('button', { name: 'Artificer item' })).toBeTruthy();
    expect(
      within(replacementAction).queryByRole('combobox', { name: /^Pickup outcome for / }),
    ).toBeNull();
    expect(within(replacementAction).queryByRole('button', { name: 'Artificer item' })).toBeNull();

    const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const site = artificerAcquisitionSite(occurrence, source);
    const entry = createAcquisitionEntryAddress(site, artificerReplacementEntryKey(source, 'self'));
    const interaction = workspaceProjection(view.application).interactions.rewards.get(
      semanticAddressKey(entry),
    );
    if (interaction === undefined) throw new Error('Artificer replacement interaction is missing');
    const outputEditor = document.getElementById(semanticOwnerControlElementId(entry));
    if (outputEditor === null) throw new Error('Artificer output editor is missing');
    expect(sourceAction.contains(outputEditor)).toBe(true);
    expect(replacementAction.contains(outputEditor)).toBe(false);
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

  it('restores an unranked required action once without exposing remove or free insertion UI', async () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const authored = createFConversionFrontierProject('MetaCurrencyDrop').project;
    const reference = occurrenceRoomActionOrder(authored, 'Underworld', 'F', occurrenceId)?.[0];
    if (reference === undefined) throw new Error('Required incoming action is missing');
    const project = decodeProjectDocument(
      {
        ...authored,
        routes: authored.routes.map((route) => ({
          ...route,
          biomes: route.biomes.map((biome) =>
            biome.biomeKey !== 'F' || biome.topology === null
              ? biome
              : {
                  ...biome,
                  topology: {
                    ...biome.topology,
                    occurrences: biome.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId === occurrenceId
                        ? { ...occurrence, roomActions: { order: [] } }
                        : occurrence,
                    ),
                  },
                },
          ),
        })),
      },
      catalog,
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );

    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).getByText('This required action has not been placed.')).toBeTruthy();
    expect(within(actions).getByRole('region', { name: 'Timeline repairs' })).toBeTruthy();
    expect(actions.querySelector('[data-room-action-drag-handle]')).toBeNull();
    const repairRow = within(actions)
      .getByText('This required action has not been placed.')
      .closest<HTMLElement>('[data-room-action-key]');
    if (repairRow === null) throw new Error('Required repair row is missing');
    expect(within(repairRow).queryByText('Position')).toBeNull();
    const missingRequiredDelete = within(repairRow).getByRole('button', {
      name: /Remove .* from timeline/,
    });
    expect((missingRequiredDelete as HTMLButtonElement).disabled).toBe(true);
    expect(missingRequiredDelete.classList.contains('quiet-action')).toBe(true);

    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(
      within(repairRow).getByRole('button', { name: 'Restore required action' }),
    );
    await waitFor(() =>
      expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
        historyBefore + 1,
      ),
    );
    await waitFor(() => {
      const restored = screen
        .getByText(/^Interact with Reward pickup/)
        .closest<HTMLElement>('[data-room-action-key]');
      if (restored === null) throw new Error('Restored required row is missing');
      expect(within(restored).queryByText('Position')).toBeNull();
      const requiredDelete = within(restored).getByRole('button', {
        name: /Remove .* from timeline/,
      });
      expect((requiredDelete as HTMLButtonElement).disabled).toBe(true);
      expect(requiredDelete.classList.contains('quiet-action')).toBe(true);
    });

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Restore required action' })).toBeTruthy(),
    );
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
    openRoomTab('Room Timeline');
    const repairs = await screen.findByRole('region', { name: 'Timeline repairs' });
    const stale = within(repairs).getByText('Interact with Combat').closest('li');
    if (stale === null) throw new Error('Stale Standard encounter action is missing');
    expect(within(stale).getByText('This action no longer belongs to the room.')).toBeTruthy();
    expect(document.getElementById(semanticOwnerControlElementId(action))).toBe(stale);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(action);

    const remove = within(stale).getByRole('button', {
      name: 'Remove Interact with Combat from timeline',
    });
    expect((remove as HTMLButtonElement).disabled).toBe(false);
    expect(remove.classList.contains('danger-action')).toBe(true);
    await view.user.click(remove);
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
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const view = renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const condition = screen.getByRole('checkbox', {
      name: 'Death Defiance condition',
    }) as HTMLInputElement;
    expect(condition.disabled).toBe(false);
    await view.user.click(condition);
    await waitFor(() => {
      const launcher = screen.getByRole('button', {
        name: /Choose Trait; trait is not selected/,
      });
      expect(launcher.getAttribute('data-trait-status')).toBe('unspecified');
    });
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
        ?.encounters.gorgonResultByPhase?.Combat?.athenaTriggerConditionMet,
    ).toBe(true);
  });

  it('keeps a context-invalid Gorgon child visible as a repair surface', () => {
    const occurrenceId = pOccurrenceId('P_Combat12', 8, 1);
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId },
      'Combat',
    );
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
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
    openRoomTab('Room Timeline');
    const condition = screen.getByRole('checkbox', {
      name: 'Death Defiance condition',
    }) as HTMLInputElement;
    expect(condition.checked).toBe(true);
    expect(condition.disabled).toBe(false);
    const launcher = screen.getByRole('button', {
      name: /Edit Trait · Divine Dash; trait configuration has no findings/,
    });
    expect(launcher.getAttribute('data-trait-status')).toBe('valid');
  });

  it('renders and dispatches the phase-local Fig Leaf checkbox on a supported fixed phase', async () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
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
    openRoomTab('Room Timeline');
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
      },
    });
    project = insertRoomAction(
      project,
      goldenGBiome,
      occurrence.occurrenceId,
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      0,
    );
    const narcissusSite = selectedNarcissusPickupSite(project, occurrence.occurrenceId);
    const mysteryBoon = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
        narcissusSite,
      ),
      'mysteryBoon',
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    openRoomTab('Room Timeline');
    const actionRow = screen.getByText(/^Interact with Mystery Boon pickup/).closest('li');
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
        authoredOccurrence()?.acquisitionSites?.[narcissusSite]?.pickupEntries?.mysteryBoon,
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
      name: 'Insert Interact with Mystery Boon pickup · Hestia',
    });
    const insertion = Array.from((insert as HTMLSelectElement).options).find(
      (option) => option.value !== '' && !option.disabled,
    );
    if (insertion === undefined) throw new Error('Narcissus pickup has no legal insertion');
    await view.user.selectOptions(insert, insertion.value);
    expect(authoredOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      { kind: 'interactAcquisitionEntry', siteKey: narcissusSite, entryKey: 'mysteryBoon' },
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
      siteKey: narcissusSite,
      entryKey: 'mysteryBoon',
    });
    expect(hasAcquiredMysteryBoon()).toBe(true);
    expect(screen.getByText('Interact with Mystery Boon pickup · Hestia')).toBeTruthy();
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
      },
    });
    project = insertRoomAction(
      project,
      goldenGBiome,
      occurrence.occurrenceId,
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      0,
    );
    const narcissusSite = selectedNarcissusPickupSite(project, occurrence.occurrenceId);
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    openRoomTab('Room Timeline');
    const authoredOccurrence = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        );

    const psycheRow = screen.getByText(/^Interact with Psyche pickup/).closest('li');
    if (!(psycheRow instanceof HTMLElement)) throw new Error('Psyche acquisition row is missing');
    expect(within(psycheRow).queryByRole('button', { name: 'Reward' })).toBeNull();
    const insert = within(psycheRow).getByRole('combobox', {
      name: /^Insert Interact with Psyche pickup/,
    });
    const insertion = Array.from((insert as HTMLSelectElement).options).find(
      (option) => option.value !== '' && !option.disabled,
    );
    if (insertion === undefined) throw new Error('Psyche has no legal insertion');
    await view.user.selectOptions(insert, insertion.value);
    expect(authoredOccurrence()?.roomActions.order.at(-1)).toEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: narcissusSite,
      entryKey: 'psyche',
    });
    const orderedPsycheRow = screen.getByText(/^Interact with Psyche pickup/).closest('li');
    if (!(orderedPsycheRow instanceof HTMLElement))
      throw new Error('Ordered Psyche acquisition row is missing');
    expect(within(orderedPsycheRow).queryByRole('button', { name: 'Reward' })).toBeNull();
    await view.user.selectOptions(
      within(orderedPsycheRow).getByLabelText(/Pickup outcome/),
      'timePiece',
    );
    expect(
      authoredOccurrence()?.acquisitionSites?.[narcissusSite]?.pickupEntries?.psyche
        ?.dispositionByAcquisitionRole.self,
    ).toEqual({
      kind: 'timePiece',
    });

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      authoredOccurrence()?.acquisitionSites?.[narcissusSite]?.pickupEntries?.psyche
        ?.dispositionByAcquisitionRole.self,
    ).toEqual({ kind: 'normal' });
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(
      authoredOccurrence()?.acquisitionSites?.[narcissusSite]?.pickupEntries?.psyche
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
      },
    });
    const narcissusSite = selectedNarcissusPickupSite(project, occurrence.occurrenceId);
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      narcissusSite,
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
      { kind: 'interactAcquisitionEntry', siteKey: narcissusSite, entryKey: 'psyche' },
      1,
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    openRoomTab('Room Timeline');
    const maxManaRow = screen.getByText(/^Interact with Max Magick pickup/).closest('li');
    if (maxManaRow === null) throw new Error('Max Magick action row is missing');
    const maxMana = within(maxManaRow).getByRole('combobox', {
      name: /^Insert Interact with Max Magick pickup/,
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
      siteKey: narcissusSite,
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
    expect(screen.getByRole('heading', { level: 3, name: /^Entering / })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' })).toBeTruthy();
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
  it('summarizes a Hub room main reward in Overview without another editor', () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;
    expect(screen.getByRole('heading', { level: 3, name: 'Entering Combat 02' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' }).textContent).toContain(
      'Big Max Magick',
    );
    expect(screen.queryByLabelText('Hub reward')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
  });

  it('summarizes a fixed Hub reward in Overview', () => {
    const project = loadSurfaceNStoryBoardProject();
    renderStaticOccurrenceWorkbench(
      project,
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('story')),
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Entering Medea' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' }).textContent).toContain('Story');
    expect(screen.queryByLabelText('Hub reward')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
  });

  it('withholds dormant Ephyra side controls and leaves rooms without local detail compact', () => {
    renderStaticOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
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
      loadSurfaceNOPQProject(),
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
    openRoomTab('Room Timeline');
    expect(screen.getByLabelText('Encounter encounter phase')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
  });

  it('withholds and restores the P Combat suffix after a terminating Heracles Intro selection', async () => {
    const occurrenceId = pOccurrenceId('P_Combat02', 2, 1);
    const owner = { kind: 'occurrence' as const, occurrenceId };
    const intro = createEncounterPhaseAddress(pBiome, owner, 'Intro');
    const combat = createEncounterPhaseAddress(pBiome, owner, 'Combat');
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const retainedCombat = occurrenceEncounterSelections(
      view.application.store.getState().projectWorkspace.history.present,
      'Surface',
      'P',
      occurrenceId,
    ).Combat;

    if (retainedCombat === undefined)
      throw new Error('P Combat 02 has no retained Combat selection');

    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const introControl = screen.getByLabelText('Opening encounter phase');
    expect(screen.getByLabelText('Follow-up encounter phase')).toBeTruthy();
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(combat),
      ),
    ).toBe(true);

    await view.user.click(within(introControl).getByRole('button', { name: 'Encounter' }));
    await view.user.click(screen.getByRole('option', { name: /Heracles combat/ }));

    await waitFor(() => expect(screen.queryByLabelText('Follow-up encounter phase')).toBeNull());
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
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

    await waitFor(() => expect(screen.getByLabelText('Follow-up encounter phase')).toBeTruthy());
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 2,
    );
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
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
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
    openRoomTab('Room Timeline');

    const introControl = screen.getByLabelText('Opening encounter phase');
    const combatControl = screen.getByLabelText('Follow-up encounter phase');
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
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
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
    openRoomTab('Combat 2 Timeline');
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
    openRoomTab('Room Timeline');
    expect(
      within(screen.getByRole('region', { name: 'Room Timeline' })).queryByText(
        'Outgoing generation',
      ),
    ).toBeNull();
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
      loadSurfaceNOPQProject(),
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
    openRoomTab('Intro Timeline');
    expect(screen.getByLabelText('Intro ship phase')).toBeTruthy();
    expect(
      within(screen.getByLabelText('Intro ship phase')).getByLabelText('Combat 1 reward'),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText('Intro ship phase')).queryByText('Cleanup · Doors open'),
    ).toBeNull();
    openRoomTab('Combat 1 Timeline');
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    expect(combatOne).toBeTruthy();
    expect(within(combatOne).queryByLabelText('Combat 1 reward')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Combat 2 Timeline' })).toBeNull();
    expect(within(combatOne).getByText('Cleanup · Doors open')).toBeTruthy();
    expect(within(combatOne).queryByText('Outgoing generation')).toBeNull();
    act(() =>
      view.application.store.dispatch(
        semanticOwnerNavigated(createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1')),
      ),
    );
    openRoomTab('Intro Timeline');
    expect(screen.getByLabelText('Combat 1 reward')).toBeTruthy();
  });

  it('keeps Ship offer identity on the wheel and acquisition children on its Room Action row', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
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
    openRoomTab('Intro Timeline');
    const ship = screen.getByLabelText('Ship combat structure');

    expect(within(ship).getAllByRole('button', { name: 'Reward' }).length).toBeGreaterThan(0);
    expect(
      within(screen.getByLabelText('Combat 1 reward')).queryByRole('button', {
        name: /Edit Trait/,
      }),
    ).toBeNull();
    openRoomTab('Combat 1 Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const traitLauncher = within(actions).getByRole('button', { name: /Edit Trait/ });
    const actionRow = traitLauncher.closest<HTMLElement>('[data-room-action-key]');
    if (actionRow === null) throw new Error('Wheel reward action row is missing');
    expect(
      actionRow
        .querySelector(':scope > .room-action-controls > .room-action-inline-editors')
        ?.contains(traitLauncher),
    ).toBe(true);
    expect(
      actionRow.querySelector(':scope > .acquisition-entry-resolution')?.getAttribute('data-empty'),
    ).toBe('true');
  });

  it('hides dormant Ship wheels and restores their authored configuration', async () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
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
    openRoomTab('Combat 1 Timeline');
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
    openRoomTab('Combat 2 Timeline');
    const combatTwo = screen.getByLabelText('Combat 2 ship phase');
    expect(within(combatTwo).getByText(/^Interact with Combat 2 reward pickup/)).toBeTruthy();
    expect(within(combatTwo).getByText('Cleanup · Doors open')).toBeTruthy();
    expect(within(combatTwo).queryByText('Outgoing generation')).toBeNull();

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
    expect(within(repairs).getByText(/^Interact with Combat 2 reward pickup/)).toBeTruthy();
    expect(screen.getAllByText('Choose Combat 2 reward')).toHaveLength(1);
    expect(screen.getAllByText(/^Interact with Combat 2 reward pickup/)).toHaveLength(1);

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
    openRoomTab('Combat 2 Timeline');
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
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'IcarusCombatO',
    });
    project = authorLegalTraitOffers(project);
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

    await view.user.click(
      within(staleNpc).getByRole('button', {
        name: 'Remove Interact with Combat2 encounter from timeline',
      }),
    );
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
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'IcarusCombatO',
    });
    project = authorLegalTraitOffers(project);
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
    openRoomTab('Combat 1 Timeline');
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    expect(within(combatOne).queryByText('Interact with Ship combat')).toBeNull();
  });

  it('keeps Ship arrow, pointer, fixed-window, and Undo behavior on one global action order', async () => {
    const occurrenceId = oOccurrenceIds.combat01;
    const occurrence = createOccurrenceAddress(oBiome, occurrenceId);
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(oBiome, occurrence, 'Combat1'),
      encounterKey: 'IcarusCombatO',
    });
    project = authorLegalTraitOffers(project);

    const view = renderOccurrenceWorkbench(project, 'Surface', 'O', occurrenceById(occurrenceId));
    openRoomTab('Combat 1 Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    const actionOrder = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'O',
        occurrenceId,
      );
    const rowFor = (label: string) => {
      const row = within(combatOne)
        .getByText((text) => text === label || text.startsWith(`${label} ·`))
        .closest<HTMLElement>('li');
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
    const wheelPick = rowFor('Interact with Combat 1 reward pickup');
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
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
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
    openRoomTab('Combat 2 Timeline');
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
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );

    openRoomTab('Intro Timeline');
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
    expect(screen.getByRole('region', { name: 'Room Timeline' })).toBeTruthy();
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
    const surface = loadSurfaceNOPQProject();
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
    openRoomTab('Room Timeline');
    const timeline = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(timeline).queryByText('Interact with infernalContractReward pickup')).toBeNull();
    expect(within(timeline).queryByRole('region', { name: 'Timeline repairs' })).toBeNull();
  });

  it('removes the Shop Death Defiance repair control while retaining purchase authoring', async () => {
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
    expect(screen.queryByLabelText('Death Defiance condition met')).toBeNull();
    const control = screen.getByRole('checkbox', { name: 'Purchased Offer 3' }) as HTMLInputElement;
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

    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).getByText('Cleanup · Doors open')).toBeTruthy();
    expect(within(actions).queryByText('Outgoing generation')).toBeNull();
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
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).queryByRole('region', { name: 'Timeline repairs' })).toBeNull();
    const board = within(actions).getByRole('list', { name: 'Room timeline' });
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
    openRoomTab('Room Timeline');
    const repairs = screen.getByRole('region', { name: 'Timeline repairs' });
    expect(within(repairs).getByText('Buy MajorNonBoon')).toBeTruthy();
    const remove = within(repairs).getByRole('button', {
      name: 'Remove Buy MajorNonBoon from timeline',
    });
    expect((remove as HTMLButtonElement).disabled).toBe(false);
    expect(remove.classList.contains('danger-action')).toBe(true);
    await view.user.click(remove);
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

  it('edits a selected Nemesis event through the engine-published family and result controls', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const family = screen.getByRole('combobox', { name: 'Nemesis family' });
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const eventOwner = createNemesisRandomEventAddress(phase);
    const finding = simulateProject(catalog, project).findings.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(eventOwner),
    );
    if (finding === undefined) throw new Error('missing Nemesis outcome finding');
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    const eventEditor = screen.getByRole('region', { name: 'Nemesis event' });
    await waitFor(() => expect(eventEditor.contains(document.activeElement)).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );

    await view.user.click(family);
    await waitFor(() =>
      expect(within(family).getByRole('option', { name: 'gold Trade' })).toBeTruthy(),
    );
    await view.user.selectOptions(family, 'goldTrade');
    expect(screen.getByRole('combobox', { name: 'Nemesis response' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Nemesis reward' })).toBeTruthy();

    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((family as HTMLSelectElement).value).toBe('');

    await view.user.selectOptions(family, 'goldTrade');
    await view.user.click(screen.getByRole('button', { name: 'Save event' }));
    const authoredEvent = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    await waitFor(() =>
      expect(authoredEvent()?.encounters.nemesisRandomEventByPhase?.Encounter).toEqual({
        kind: 'goldTrade',
        response: 'accept',
      }),
    );
    expect(
      authoredEvent()?.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result
        ?.offer.rewardType,
    ).toBeTruthy();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    const requiredActionKey = roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'nemesisGenerated:Encounter',
      entryKey: 'result',
    });
    const requiredRow = [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (row) => row.dataset.roomActionKey === requiredActionKey,
    );
    if (requiredRow === undefined) throw new Error('required Nemesis result row is missing');
    expect(
      (
        within(requiredRow).getByRole('button', {
          name: /Remove .* from timeline/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(authoredEvent()?.encounters.nemesisRandomEventByPhase?.Encounter).toBeNull(),
    );
    expect(authoredEvent()?.acquisitionSites?.['nemesisGenerated:Encounter']).toBeUndefined();

    const restoredFamily = screen.getByRole('combobox', { name: 'Nemesis family' });
    await view.user.click(restoredFamily);
    await waitFor(() =>
      expect(within(restoredFamily).getByRole('option', { name: 'gold Trade' })).toBeTruthy(),
    );
    await view.user.selectOptions(restoredFamily, 'goldTrade');
    await view.user.selectOptions(
      screen.getByRole('combobox', { name: 'Nemesis response' }),
      'decline',
    );
    await view.user.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() =>
      expect(authoredEvent()?.encounters.nemesisRandomEventByPhase?.Encounter).toEqual({
        kind: 'goldTrade',
        response: 'decline',
      }),
    );
    expect(
      authoredEvent()?.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result
        ?.offer.rewardType,
    ).toBeTruthy();
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].some(
        (row) => row.dataset.roomActionKey === requiredActionKey,
      ),
    ).toBe(false);
  });

  it('uses one H feature control and preserves an over-cap count through repair and Undo', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const project = applyProjectCommand(loadNemesisFieldsCheckpoint(), catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence,
      optionalRewardCount: 4,
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    const workspace = view.application.selectStructuredWorkspace(view.application.store.getState());
    const passive = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId },
      'Passive',
    );
    expect(workspace.interactions.encounterPhases.has(semanticAddressKey(passive))).toBe(false);
    expect(workspace.interactions.nemesisFeatures.has(semanticAddressKey(passive))).toBe(true);
    const authoredFields = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);

    expect(screen.getByRole('button', { name: 'Remove Nemesis event' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /Passive encounter/i })).toBeNull();
    const count = screen.getByRole('combobox', { name: 'Optional pickups' });
    expect((count as HTMLSelectElement).value).toBe('4');
    expect(within(count).getByRole('option', { name: '4' })).toBeTruthy();

    await view.user.selectOptions(count, '3');
    await waitFor(() => expect(authoredFields()?.state).toMatchObject({ optionalRewardCount: 3 }));
    openRoomTab('Room Timeline');
    const eventActionKey = roomActionKey({ kind: 'interactEncounter', phaseKey: 'Passive' });
    const eventRow = [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (row) => row.dataset.roomActionKey === eventActionKey,
    );
    if (eventRow === undefined) throw new Error('Nemesis interaction row is missing');
    expect(within(eventRow).getByRole('region', { name: 'Nemesis event' })).toBeTruthy();
    expect(screen.getAllByRole('region', { name: 'Nemesis event' })).toHaveLength(1);
    const optionalActionKey = roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'nemesisGenerated:Passive',
      entryKey: 'result',
    });
    const optionalRow = [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (row) => row.dataset.roomActionKey === optionalActionKey,
    );
    if (optionalRow === undefined) throw new Error('optional Nemesis result row is missing');
    expect(
      (
        within(optionalRow).getByRole('button', {
          name: /Remove .* from timeline/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    const orderBeforeMove = authoredFields()?.roomActions.order;
    const move = within(optionalRow)
      .getAllByRole('button', { name: /Move .* (earlier|later)/ })
      .find((button) => !(button as HTMLButtonElement).disabled);
    if (move === undefined) throw new Error('optional Nemesis result has no legal move');
    await view.user.click(move);
    await waitFor(() => expect(authoredFields()?.roomActions.order).not.toEqual(orderBeforeMove));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(authoredFields()?.roomActions.order).toEqual(orderBeforeMove));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(authoredFields()?.state).toMatchObject({ optionalRewardCount: 4 }));

    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Remove Nemesis event' }));
    await waitFor(() =>
      expect(authoredFields()?.encounters.encounterKeyByPhase.Passive).not.toBe(
        'NemesisRandomEvent',
      ),
    );
    expect(screen.getByRole('button', { name: 'Add Nemesis event' })).toBeTruthy();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(authoredFields()?.encounters.encounterKeyByPhase.Passive).toBe('NemesisRandomEvent'),
    );
  });
});
