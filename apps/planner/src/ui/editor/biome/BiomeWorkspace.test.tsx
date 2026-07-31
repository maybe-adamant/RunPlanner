// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '../../../composition/createApplication';
import { semanticFindingKey } from '../../../projections/evaluationProjection';
import type {
  WorkspaceBiome,
  WorkspaceNode,
  WorkspaceOccurrenceWorkbenchNode,
} from '../../../projections/structured-workspace';
import { findingSelected, semanticOwnerFocused } from '../../../state/editorSessionSlice';
import {
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '../../../state/projectWorkspaceSlice';
import { useAppSelector } from '../../../state/store';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  qBiome,
  qOccurrenceIds,
} from '../../../../test/fixtures/surfaceProject';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
} from '../../../../test/fixtures/underworldProject';
import { BiomeWorkspace } from './BiomeWorkspace';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface WorkspaceHarnessProps {
  readonly application: PlannerApplication;
  readonly biomeKey: string;
  readonly routeKey: string;
}

function WorkspaceHarness({ application, biomeKey, routeKey }: WorkspaceHarnessProps) {
  const state = useAppSelector((value) => value.projectWorkspace);
  const workspace = application.structuredWorkspace.project(
    state.history.present,
    state.evaluation,
  );
  const route = workspace.routes.find((candidate) => candidate.routeKey === routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} has no workspace biome`);
  return (
    <BiomeWorkspace
      biome={biome}
      focusByOwner={workspace.focusByOwner}
      interactions={workspace.interactions}
    />
  );
}

function renderWorkspace(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  application: PlannerApplication = createApplication(),
) {
  application.store.dispatch(authoredProjectReplaced(project));
  const user = userEvent.setup();
  const view = render(
    <Provider store={application.store}>
      <WorkspaceHarness application={application} biomeKey={biomeKey} routeKey={routeKey} />
    </Provider>,
  );
  return { application, user, ...view };
}

function workspaceProjection(application: PlannerApplication) {
  const state = application.store.getState().projectWorkspace;
  return application.structuredWorkspace.project(state.history.present, state.evaluation);
}

function workspaceBiome(application: PlannerApplication, routeKey: string, biomeKey: string) {
  const biome = workspaceProjection(application)
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined)
    throw new Error(`${routeKey}/${biomeKey} has no projected workspace biome`);
  return biome;
}

function renderProjectedBiome(application: PlannerApplication, biome: WorkspaceBiome) {
  const workspace = workspaceProjection(application);
  return render(
    <Provider store={application.store}>
      <BiomeWorkspace
        biome={biome}
        focusByOwner={workspace.focusByOwner}
        interactions={workspace.interactions}
      />
    </Provider>,
  );
}

function nHubState(application: PlannerApplication) {
  const plan = application.store
    .getState()
    .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.biomeKey === 'N');
  const topology = plan?.topology;
  if (topology === undefined || topology === null) {
    throw new Error('N Hub test project has no authored topology');
  }
  const decision = topology.decisions.find((candidate) => candidate.kind === 'hub');
  if (decision?.kind !== 'hub') throw new Error('N Hub test project has no Hub decision');
  return { decision, topology };
}

function nHubOccurrence(application: PlannerApplication, hubSlotKey: string) {
  const { decision, topology } = nHubState(application);
  const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  if (target === undefined) throw new Error(`N Hub slot ${hubSlotKey} is not open`);
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === target.occurrenceId,
  );
  if (occurrence === undefined) throw new Error(`N Hub slot ${hubSlotKey} has no occurrence`);
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

function railMarkerKeys(container: HTMLElement): readonly string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-workspace-node]')).map(
    (element) => element.dataset.workspaceNode ?? '',
  );
}

function selectedRailMarkerKeys(container: ParentNode): readonly string[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-workspace-node][data-selected="true"]'),
  ).map((element) => element.dataset.workspaceNode ?? '');
}

function expectDefaultRailSelection(
  application: PlannerApplication,
  container: ParentNode,
  expectedMarker: string,
): void {
  expect(application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
  expect(selectedRailMarkerKeys(container)).toEqual([expectedMarker]);
}

function railButtonForMarker(container: ParentNode, marker: string): HTMLButtonElement {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
  ).find((candidate) => candidate.dataset.workspaceNode === marker);
  if (button === undefined) throw new Error(`rail button ${marker} is missing`);
  return button;
}

function hubRailButton(container: ParentNode = document): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('[data-kind="hubDecision"] > button');
  if (button === null) throw new Error('N Hub rail button is missing');
  return button;
}

function emptyProject(routeKey: 'Surface' | 'Underworld', count: number): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `empty-${routeKey}-${count}`,
    name: `Empty ${routeKey}`,
    configuredBiomeCounts: { [routeKey]: count },
  });
}

function fTwoDoorBatchProject(): {
  readonly owner: ReturnType<typeof createExitDecisionAddress>;
  readonly project: ProjectDocument;
  readonly start: ReturnType<typeof createOccurrenceId>;
} {
  const biome = createBiomeAddress('Underworld', 'F');
  const start = createOccurrenceId('biome-workspace-f-start');
  const combat = createOccurrenceId('biome-workspace-f-combat');
  const source = { kind: 'occurrence' as const, occurrenceId: start };
  let project = emptyProject('Underworld', 1);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  const first = createExitDecisionAddress(biome, source);
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: first });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source, 'exit1'),
    occurrenceId: combat,
    gameName: 'F_Combat03',
  });
  const owner = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: combat });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: owner });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, owner.source),
    storeKey: 'RunProgress',
  });
  return { owner, project, start };
}

function nOpeningPreHubProject(): ProjectDocument {
  let project = emptyProject('Surface', 1);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: nOccurrenceIds.opening,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateLinkedExit',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    }),
    occurrenceId: nOccurrenceIds.preHub,
  });
}

function withUnresolvedFSelections(
  project: ProjectDocument,
  sourceOccurrenceIds: readonly string[],
): ProjectDocument {
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        decision.source.kind === 'occurrence' &&
                        sourceOccurrenceIds.includes(decision.source.occurrenceId)
                          ? { ...decision, selection: { kind: 'unresolved' as const } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

function inactiveOccurrenceDetails(node: WorkspaceNode): WorkspaceNode {
  if (node.kind !== 'occurrenceWorkbench') return node;
  return { ...node, room: { ...node.room, detailsActive: false } };
}

function withoutWorkspaceEntry({ entry, ...biome }: WorkspaceBiome): Omit<WorkspaceBiome, 'entry'> {
  void entry;
  return biome;
}

describe('BiomeWorkspace', () => {
  it('renders a declaration-owned Hub board with every physical slot and visit row', async () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());

    expect(screen.getByRole('heading', { name: 'Open Ephyra rooms' })).toBeTruthy();
    expect(screen.getAllByLabelText(/Hub slot$/)).toHaveLength(26);
    expect(document.querySelectorAll('.hub-visit-row')).toHaveLength(6);
    expect(screen.getByText('Pylon visit order')).toBeTruthy();
  });

  it('routes a keyboard-selected Hub rail visit to its occurrence-owned local detail workbench', async () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    const boardCard = screen.getByRole('article', { name: 'Combat 02 Hub slot' });
    expect(within(boardCard).getByRole('button', { name: 'Reward' })).toBeTruthy();

    const visit = screen.getByRole('button', { name: /Visit 3 · Combat 02/ });
    act(() => visit.focus());
    await view.user.keyboard('{Enter}');

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, nOccurrenceId('combat02')),
    );

    expect(screen.getAllByRole('heading', { name: 'Combat 02' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Side rooms' })).toBeTruthy();
    expect(screen.getByText('Door 558353')).toBeTruthy();
    expect(screen.getByLabelText('Side Room 01 generation')).toBeTruthy();
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).getAllByRole('button', { name: 'Reward' })).toHaveLength(2);
  });

  it('keeps Hub timeline and board focus represented by the nested rail', async () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    const railVisit = screen.getByRole('button', { name: /Visit 3 · Combat 02/ });
    const timeline = document.querySelector<HTMLElement>('.hub-visit-timeline');
    if (timeline === null) throw new Error('N Hub visit timeline is missing');

    await view.user.click(within(timeline).getByRole('button', { name: 'Combat 02' }));
    expect(railVisit.dataset.selected).toBe('true');
    expect(hubRailButton().dataset.selected).toBe('false');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubSlotAddress(nBiome, 'hub', 'combat02')),
      ),
    );
    expect(hubRailButton().dataset.selected).toBe('true');
    expect(screen.getByRole('button', { name: /Visit 3 · Combat 02/ }).dataset.selected).toBe(
      'false',
    );

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createIncomingRewardAddress(nBiome, nOccurrenceId('combat02'))),
      ),
    );
    expect(hubRailButton().dataset.selected).toBe('true');
    expect(screen.getByRole('button', { name: /Visit 3 · Combat 02/ }).dataset.selected).toBe(
      'false',
    );
  });

  it('states when a Hub visit has no room-local detail', async () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    await view.user.click(screen.getByRole('button', { name: /Visit 2 · Satyr Champion/ }));

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).getByText('No additional room details.')).toBeTruthy();
    expect(within(inspector).queryByText('Fixed reward:')).toBeNull();
  });

  it('opens, edits, focuses, and closes an unvisited Hub room through its compact board card', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-compact-unvisited-room',
        name: 'Hub compact unvisited room',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderWorkspace(project, 'Surface', 'N');
    await view.user.click(hubRailButton());

    const closedCard = screen.getByRole('article', { name: 'Combat 04 Hub slot' });
    const open = within(closedCard).getByRole('checkbox', { name: 'Combat 04 open' });
    expect(closedCard.querySelector('[data-assessment]')?.getAttribute('data-assessment')).toBe(
      'assessed',
    );

    await view.user.pointer({ keys: '[MouseLeft]', target: open });
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub slot' });
    expect(openedCard.querySelector('[data-assessment]')?.getAttribute('data-assessment')).toBe(
      'assessed',
    );
    expect(within(openedCard).queryByText(/Closing this slot removes/)).toBeNull();
    const beforeReward = nHubOccurrence(view.application, 'combat04').state;
    await view.user.click(within(openedCard).getByLabelText('Reward'));
    const rewardTypes = within(await screen.findByRole('listbox')).getAllByRole('option');
    const replacementType = rewardTypes.find(
      (option) =>
        option.getAttribute('aria-disabled') !== 'true' &&
        option.getAttribute('data-selected-value') !== 'true',
    );
    if (replacementType === undefined) {
      throw new Error('Combat 04 has no editable alternative reward type');
    }
    await view.user.click(replacementType);
    if (replacementType.textContent === 'Boon') {
      const boonSources = within(await screen.findByRole('listbox')).getAllByRole('option');
      const replacementSource = boonSources.find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      );
      if (replacementSource === undefined) {
        throw new Error('Combat 04 has no editable alternative Boon source');
      }
      await view.user.click(replacementSource);
    }
    await waitFor(() =>
      expect(nHubOccurrence(view.application, 'combat04').state).not.toEqual(beforeReward),
    );

    await view.user.click(within(openedCard).getByRole('button', { name: 'Inspect Combat 04' }));
    expect(screen.getAllByRole('heading', { name: 'Combat 04' })).toHaveLength(2);

    await view.user.click(hubRailButton());
    const close = within(screen.getByRole('article', { name: 'Combat 04 Hub slot' })).getByRole(
      'checkbox',
      { name: 'Combat 04 open' },
    );
    act(() => close.focus());
    const historyBeforeClose =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(false),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeClose + 1,
    );
  });

  it('edits, appends, replaces, and removes Hub visits while preserving a visited room’s side order', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-visit-commands',
        name: 'Hub visit commands',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: ['combat05', 'miniBoss01'] },
    );
    const view = renderWorkspace(project, 'Surface', 'N');
    await view.user.click(hubRailButton());

    const hubVisitControl = (visitIndex: number): HTMLSelectElement => {
      const timeline = document.querySelector<HTMLElement>('.hub-visit-timeline');
      const row = timeline?.querySelectorAll<HTMLElement>('.hub-visit-row')[visitIndex - 1];
      if (row === undefined) throw new Error(`N Hub visit ${visitIndex} row is missing`);
      return within(row).getByRole('combobox') as HTMLSelectElement;
    };

    const chooseAvailableVisit = async (
      control: HTMLSelectElement,
      excludedSlotKeys: readonly string[],
    ): Promise<string> => {
      await view.user.click(control);
      await waitFor(() => {
        const available = Array.from(control.options).find(
          (option) =>
            option.value !== control.value &&
            !excludedSlotKeys.includes(option.value) &&
            option.disabled === false &&
            option.dataset.candidateSupport !== 'unavailable',
        );
        expect(available).toBeDefined();
      });
      const choice = Array.from(control.options).find(
        (option) =>
          option.value !== control.value &&
          !excludedSlotKeys.includes(option.value) &&
          option.disabled === false &&
          option.dataset.candidateSupport !== 'unavailable',
      );
      if (choice === undefined) throw new Error('Hub visit has no available replacement room');
      await view.user.selectOptions(control, choice.value);
      return choice.value;
    };

    const appended = await chooseAvailableVisit(
      hubVisitControl(3),
      nHubState(view.application).decision.visitOrder,
    );
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        appended,
      ]),
    );

    const replacement = await chooseAvailableVisit(
      hubVisitControl(2),
      nHubState(view.application).decision.visitOrder.filter((slotKey) => slotKey !== 'miniBoss01'),
    );
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        replacement,
        appended,
      ]),
    );

    const timeline = document.querySelector<HTMLElement>('.hub-visit-timeline');
    if (timeline === null) throw new Error('N Hub visit timeline is missing');
    await view.user.click(within(timeline).getByRole('button', { name: 'Combat 05' }));
    expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
      'sideDoor2',
      'sideDoor1',
    ]);

    const entryOrder = async (label: string): Promise<HTMLSelectElement> => {
      const control = screen.getByRole('combobox', { name: label }) as HTMLSelectElement;
      await view.user.click(control);
      await waitFor(() =>
        expect(
          Array.from(control.options).some(
            (option) =>
              option.value === 'position:1' && option.dataset.candidateSupport !== 'unavailable',
          ),
        ).toBe(true),
      );
      return control;
    };

    await view.user.selectOptions(await entryOrder('Side Room 07 entry order'), 'position:2');
    await waitFor(() =>
      expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
        'sideDoor1',
        'sideDoor2',
      ]),
    );
    await view.user.selectOptions(await entryOrder('Side Room 03 entry order'), 'position:1');
    await waitFor(() =>
      expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
        'sideDoor3',
        'sideDoor1',
        'sideDoor2',
      ]),
    );
    await view.user.selectOptions(await entryOrder('Side Room 03 entry order'), 'notEntered');
    await waitFor(() =>
      expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
        'sideDoor1',
        'sideDoor2',
      ]),
    );

    await view.user.click(hubRailButton());

    const confirmation = vi.spyOn(globalThis, 'confirm');
    await view.user.click(screen.getByRole('button', { name: 'Remove visits from Visit 2' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(['combat05']),
    );
    expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual([
      'sideDoor1',
      'sideDoor2',
    ]);
  });

  it('removes the completed-Hub Preboss handoff when a visit is truncated', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-handoff-truncation',
        name: 'Hub handoff truncation',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderWorkspace(project, 'Surface', 'N');
    await view.user.click(hubRailButton());

    const confirmation = vi.spyOn(globalThis, 'confirm');
    await view.user.click(screen.getByRole('button', { name: 'Remove visits from Visit 6' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toHaveLength(5));

    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
  });

  it('keeps every impossible side-room position visible and disabled when not generated', async () => {
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
    const view = renderWorkspace(project, 'Surface', 'N');
    await view.user.click(hubRailButton());
    const timeline = document.querySelector<HTMLElement>('.hub-visit-timeline');
    if (timeline === null) throw new Error('N Hub visit timeline is missing');
    await view.user.click(within(timeline).getByRole('button', { name: 'Combat 02' }));

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
    const historyLength = view.application.store.getState().projectWorkspace.history.past.length;

    const occurrence = nHubOccurrence(view.application, 'combat02');
    if (occurrence.state.kind !== 'ephyraCombat') {
      throw new Error('Combat 02 must retain its Ephyra state');
    }
    expect(occurrence.state.sideRooms.sideDoor2).toMatchObject({
      generation: 'notGenerated',
      enteredOrdinal: null,
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );
  });

  it('applies a direct side-room insertion as one undoable complete order', async () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    await view.user.click(screen.getByRole('button', { name: /Visit 1 · Combat 05/ }));

    const table = screen.getByRole('table', {
      name: 'Ephyra side-room generation and entry order',
    });
    expect(within(table).getByRole('columnheader', { name: 'Side room' })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'Generated' })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'Entry order' })).toBeTruthy();
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
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyLength,
    );

    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
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
  });

  it('keeps the Hub board and its exact next visit visible at an invalid local boundary', async () => {
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 4),
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    await view.user.click(hubRailButton());

    expect(screen.getAllByLabelText(/Hub slot$/)).toHaveLength(26);
    const timeline = document.querySelector<HTMLElement>('.hub-visit-timeline');
    if (timeline === null) throw new Error('N Hub visit timeline is missing');
    const rows = timeline.querySelectorAll<HTMLElement>('.hub-visit-row');
    expect(rows).toHaveLength(6);
    expect(rows[3]?.dataset.authoring).toBe('next');
    const retainedVisits = within(screen.getByRole('list', { name: 'Hub visits' })).getAllByRole(
      'button',
    );
    expect(retainedVisits.map((visit) => visit.dataset.assessment)).toEqual([
      'unassessed',
      'unassessed',
      'unassessed',
    ]);
    const visitControl = within(rows[3]!).getByRole('combobox', {
      name: /^Visit 4 room/,
    }) as HTMLSelectElement;
    expect(visitControl.dataset.candidateSupport).toBe('unavailable');
    const { decision } = nHubState(view.application);
    expect(
      Array.from(visitControl.options)
        .map((option) => option.value)
        .filter(Boolean)
        .sort(),
    ).toEqual(
      decision.openTargets
        .filter((target) => !decision.visitOrder.includes(target.hubSlotKey))
        .map((target) => target.hubSlotKey)
        .sort(),
    );
  });

  it('renders ordinary rails in semantic decision order and defaults to a decision inspector', () => {
    const underworld = createGoldenFGHIProject(catalog);
    const surface = createRepresentativeNOPQProject();
    const cases = [
      [underworld, 'Underworld', 'F'],
      [underworld, 'Underworld', 'G'],
      [underworld, 'Underworld', 'H'],
      [underworld, 'Underworld', 'I'],
      [surface, 'Surface', 'O'],
      [surface, 'Surface', 'P'],
      [surface, 'Surface', 'Q'],
    ] as const;

    for (const [project, routeKey, biomeKey] of cases) {
      const view = renderWorkspace(project, routeKey, biomeKey);
      const projected = workspaceBiome(view.application, routeKey, biomeKey);
      expect(view.container.querySelector('.biome-workspace')).not.toBeNull();
      expect(screen.getByRole('region', { name: /structure$/ })).toBeTruthy();
      expect(railMarkerKeys(view.container)).toEqual(
        projected.rail.map((entry) => entry.marker.focusKey),
      );
      const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
      expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
      expect(inspector.querySelector('.biome-occurrence-workbench')).toBeNull();
      cleanup();
    }
  });

  it('defaults an untouched incomplete batch to its current decision workbench', () => {
    const { owner, project } = fTwoDoorBatchProject();
    const view = renderWorkspace(project, 'Underworld', 'F');
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    const projected = workspaceBiome(view.application, 'Underworld', 'F');
    const partial = projected.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(owner),
    );
    if (partial === undefined) throw new Error('F current partial decision is missing');

    expect(partial.missingTargets).not.toHaveLength(0);
    expect(projected.frontier).toBeNull();
    expectDefaultRailSelection(view.application, view.container, semanticAddressKey(owner));
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
    expect(
      within(inspector).getByRole('heading', { level: 3, name: 'Configure room offers' }),
    ).toBeTruthy();
    expect(within(inspector).getByRole('button', { name: 'Exit 1 room' })).toBeTruthy();
  });

  it('characterizes active start and bare exit-frontier defaults', () => {
    const empty = renderWorkspace(emptyProject('Underworld', 1), 'Underworld', 'F');
    const emptyBiome = workspaceBiome(empty.application, 'Underworld', 'F');
    if (emptyBiome.frontier?.kind !== 'start') throw new Error('empty F start frontier is missing');

    const emptyInspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expectDefaultRailSelection(
      empty.application,
      empty.container,
      emptyBiome.frontier.marker.focusKey,
    );
    expect(
      within(emptyInspector).getByRole('heading', { level: 2, name: 'Active frontier' }),
    ).toBeTruthy();
    expect(
      within(emptyInspector).getByRole('heading', { level: 3, name: 'Choose starting room' }),
    ).toBeTruthy();
    cleanup();

    const start = createOccurrenceId('default-inspector-f-start');
    const started = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    const exit = renderWorkspace(started, 'Underworld', 'F');
    const exitBiome = workspaceBiome(exit.application, 'Underworld', 'F');
    if (exitBiome.frontier?.kind !== 'exitDecision') {
      throw new Error('F start-only exit frontier is missing');
    }
    const exitFrontier = exitBiome.frontier;

    const exitInspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(
      exitBiome.nodes.some(
        (node) =>
          (node.kind === 'ordinaryBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'takeoverBatch') &&
          semanticAddressKey(node.owner) === semanticAddressKey(exitFrontier.owner),
      ),
    ).toBe(false);
    expectDefaultRailSelection(exit.application, exit.container, exitFrontier.marker.focusKey);
    expect(
      within(exitInspector).getByRole('heading', { level: 2, name: 'Active frontier' }),
    ).toBeTruthy();
    expect(
      within(exitInspector).getByRole('heading', { level: 3, name: 'Continue from this room' }),
    ).toBeTruthy();
    expect(within(exitInspector).getByRole('button', { name: 'Add normal exits' })).toBeTruthy();
  });

  it('uses the last incomplete decision and the last active ordinary detail by projection order', () => {
    const multiIncomplete = withUnresolvedFSelections(createGoldenFGHIProject(catalog), [
      goldenFOccurrenceId(1, 1),
      goldenFOccurrenceId(2, 1),
    ]);
    const incomplete = renderWorkspace(multiIncomplete, 'Underworld', 'F');
    const incompleteBiome = workspaceBiome(incomplete.application, 'Underworld', 'F');
    const firstOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    const latestOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(2, 1),
    });
    const incompleteOwners = incompleteBiome.nodes
      .filter(
        (
          node,
        ): node is Extract<
          WorkspaceNode,
          { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
        > =>
          (node.kind === 'ordinaryBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'takeoverBatch') &&
          node.targets.length > 0 &&
          !node.targets.some((target) => target.selected),
      )
      .map((node) => semanticAddressKey(node.owner));
    if (incompleteBiome.frontier !== null) {
      throw new Error('retained F decisions must not publish a frontier');
    }

    expect(incompleteOwners).toEqual([
      semanticAddressKey(firstOwner),
      semanticAddressKey(latestOwner),
    ]);
    expectDefaultRailSelection(
      incomplete.application,
      incomplete.container,
      semanticAddressKey(latestOwner),
    );
    expect(
      screen
        .getByRole('complementary', { name: 'Focused inspector' })
        .querySelector('.biome-batch-workbench'),
    ).not.toBeNull();
    cleanup();

    const complete = renderWorkspace(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    const completeBiome = workspaceBiome(complete.application, 'Underworld', 'F');
    const finalTakeover = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    if (completeBiome.frontier !== null) throw new Error('complete F must not have a frontier');
    const finalTarget = completeBiome.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(finalTakeover),
    );
    if (finalTarget === undefined || !finalTarget.targets.some((target) => target.selected)) {
      throw new Error('complete F final active takeover target is missing');
    }

    expectDefaultRailSelection(
      complete.application,
      complete.container,
      semanticAddressKey(finalTakeover),
    );
    expect(
      screen
        .getByRole('complementary', { name: 'Focused inspector' })
        .querySelector('.biome-batch-workbench'),
    ).not.toBeNull();
  });

  it('keeps default ordinary destinations stable through retained-invalid and blocked suffixes', () => {
    const retainedProject = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    const retained = renderWorkspace(retainedProject, 'Underworld', 'F');
    const retainedBiome = workspaceBiome(retained.application, 'Underworld', 'F');
    const fFinalTakeover = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });

    expect(retainedBiome.status).toBe('invalid');
    expect(
      retainedBiome.nodes.some(
        (node) =>
          node.kind === 'ordinaryBatch' &&
          node.topologyState === 'retained' &&
          semanticAddressKey(node.owner) ===
            semanticAddressKey(
              createExitDecisionAddress(goldenFBiome, {
                kind: 'occurrence',
                occurrenceId: goldenFOccurrenceId(1, 1),
              }),
            ),
      ),
    ).toBe(true);
    expectDefaultRailSelection(
      retained.application,
      retained.container,
      semanticAddressKey(fFinalTakeover),
    );
    expect(
      screen
        .getByRole('complementary', { name: 'Focused inspector' })
        .querySelector('.biome-batch-workbench'),
    ).not.toBeNull();
    cleanup();

    const blockedProject = withUnresolvedFSelections(createGoldenFGHIProject(catalog), [
      goldenFOccurrenceId(1, 1),
    ]);
    const blocked = renderWorkspace(blockedProject, 'Underworld', 'G');
    const blockedBiome = workspaceBiome(blocked.application, 'Underworld', 'G');
    const gFinalTakeover = createExitDecisionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: goldenGOccurrenceId(7, 1),
    });
    const selectedRetained = blockedBiome.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(gFinalTakeover),
    );
    if (
      selectedRetained === undefined ||
      !selectedRetained.targets.some((target) => target.selected && !target.room.entered)
    ) {
      throw new Error('blocked G selected retained Preboss target is missing');
    }

    expect(blockedBiome.status).toBe('blocked');
    expect(selectedRetained.topologyState).toBe('retained');
    expectDefaultRailSelection(
      blocked.application,
      blocked.container,
      semanticAddressKey(gFinalTakeover),
    );
    expect(
      screen
        .getByRole('complementary', { name: 'Focused inspector' })
        .querySelector('.biome-batch-workbench'),
    ).not.toBeNull();
  });

  it('edits picked room and reward together while refreshing the decision summary', async () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat03', 1, 1),
      }),
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const decision = createExitDecisionAddress(pBiome, {
      kind: 'occurrence',
      occurrenceId: pOccurrenceIds.intro,
    });
    const railDecision = railButtonForMarker(view.container, semanticAddressKey(decision));
    await view.user.click(railDecision);

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    const radios = within(inspector).getAllByRole('radio');
    const unpicked = radios.find((radio) => !(radio as HTMLInputElement).checked);
    if (unpicked === undefined) throw new Error('P Decision 1 has no unpicked room');
    const unpickedOffer = unpicked.closest<HTMLElement>('.biome-target-row');
    if (unpickedOffer === null) throw new Error('P unpicked room offer is missing');
    const selectedRoomLabel = unpickedOffer.getAttribute('aria-label')?.replace(/ room offer$/, '');
    if (selectedRoomLabel === undefined) throw new Error('P unpicked room label is missing');
    expect(within(unpickedOffer).getByRole('button', { name: /^Exit \d+ room$/ })).toBeTruthy();
    expect(within(unpickedOffer).getByRole('button', { name: 'Reward' })).toBeTruthy();

    const historyBeforePick =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(unpicked);
    await waitFor(() => {
      expect(railDecision.textContent).toContain(selectedRoomLabel);
      expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
        historyBeforePick + 1,
      );
    });
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(decision);

    const pickedOffer = within(inspector).getByRole('article', {
      name: `${selectedRoomLabel} room offer`,
    });
    const rewardButton = within(pickedOffer).getByRole('button', { name: 'Reward' });
    const summaryBeforeReward = railDecision.querySelector('.biome-rail-summary')?.textContent;
    await view.user.click(rewardButton);
    const replacement = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true' &&
          !/Boon|Devotion|Blind Box/.test(option.textContent ?? ''),
      );
    if (replacement === undefined) {
      throw new Error('P picked room has no payload-free replacement reward');
    }
    const historyBeforeReward =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(replacement);
    await waitFor(() => {
      expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
        historyBeforeReward + 1,
      );
      expect(railDecision.querySelector('.biome-rail-summary')?.textContent).not.toBe(
        summaryBeforeReward,
      );
    });
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(decision);
  });

  it('renders N’s entry frontiers before its future Hub outline', () => {
    const emptyProjectDocument = emptyProject('Surface', 1);
    const emptyView = renderWorkspace(emptyProjectDocument, 'Surface', 'N');
    const emptyRail = railMarkerKeys(emptyView.container);
    const emptyWorkspace = workspaceBiome(emptyView.application, 'Surface', 'N');
    if (emptyWorkspace.frontier?.kind !== 'start') {
      throw new Error('empty N start frontier is missing');
    }
    expect(emptyRail).toEqual([
      emptyWorkspace.frontier?.marker.focusKey,
      semanticAddressKey(createHubDecisionAddress(nBiome, 'hub')),
    ]);
    const completion = screen.getByRole('region', { name: 'Biome completion' });
    expect(within(completion).getByText('Polyphemus')).toBeTruthy();
    expect(within(completion).getAllByText('Postboss')).toHaveLength(1);
    cleanup();

    const openingProject = applyProjectCommand(emptyProjectDocument, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: nOccurrenceIds.opening,
    });
    const openingView = renderWorkspace(openingProject, 'Surface', 'N');
    const openingRail = railMarkerKeys(openingView.container);
    const openingWorkspace = workspaceBiome(openingView.application, 'Surface', 'N');
    if (openingWorkspace.frontier?.kind !== 'exitDecision') {
      throw new Error('Opening-only N exit frontier is missing');
    }
    expect(openingRail).toEqual([
      semanticAddressKey(createOccurrenceAddress(nBiome, nOccurrenceIds.opening)),
      openingWorkspace.frontier?.marker.focusKey,
      semanticAddressKey(createHubDecisionAddress(nBiome, 'hub')),
    ]);
  });

  it('renders the fixed N Opening and linked PreHub without a room selector or Hub action', async () => {
    const view = renderWorkspace(emptyProject('Surface', 1), 'Surface', 'N');
    expect(screen.getByText('Start with Opening')).toBeTruthy();
    expect(screen.queryByText('N_Opening01')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Starting room' })).toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Start biome' }));
    const nPlanAfterStart = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    const openingId = nPlanAfterStart?.topology?.startOccurrenceId;
    if (openingId === undefined) throw new Error('N Opening was not authored');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(createBiomeAddress('Surface', 'N'), openingId),
    );
    const structure = screen.getByRole('region', { name: /structure$/ });
    await view.user.click(
      within(structure).getByRole('button', { name: /Continue authoring here/ }),
    );
    expect(screen.queryByText('Create Preboss batch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Evaluate Preboss batches' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create linked exit' })).toBeTruthy();
  });

  it('creates N’s Hub board through the projected Hub frontier after its fixed PreHub exit', async () => {
    const biome = createBiomeAddress('Surface', 'N');
    const openingId = createOccurrenceId('workspace-n-opening');
    let project = emptyProject('Surface', 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: openingId }),
      occurrenceId: createOccurrenceId('workspace-n-prehub'),
    });

    const view = renderWorkspace(project, 'Surface', 'N');
    await view.user.click(screen.getByRole('button', { name: 'Create Hub board' }));

    const nPlan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    expect(nPlan?.topology?.decisions.some((decision) => decision.kind === 'hub')).toBe(true);
    expect(screen.getAllByLabelText(/Hub slot$/)).toHaveLength(26);

    // A board begins below the nine-slot completion threshold.  Its first
    // physical door remains actionable so the player can assemble it instead
    // of needing an impossible all-at-once authoring action.
    await view.user.click(screen.getByLabelText('Combat 01 open'));
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat01',
        ),
      ).toBe(true),
    );
  });

  it('defaults a fresh authored Hub to its exact open-set board without authoring focus', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const openingId = createOccurrenceId('workspace-n-default-opening');
    let project = emptyProject('Surface', 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: openingId }),
      occurrenceId: createOccurrenceId('workspace-n-default-prehub'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateHubDecision',
      hub: createHubDecisionAddress(biome, 'hub'),
    });

    const view = renderWorkspace(project, 'Surface', 'N');
    const openSet = createHubOpenSetAddress(biome, 'hub');
    const projected = workspaceBiome(view.application, 'Surface', 'N');
    if (projected.frontier?.kind !== 'hubOpenSet') {
      throw new Error('fresh N Hub open-set frontier is missing');
    }

    expectDefaultRailSelection(
      view.application,
      view.container,
      semanticAddressKey(createHubDecisionAddress(biome, 'hub')),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Open Ephyra rooms' })).toBeTruthy();
    expect(
      document.getElementById(`semantic-owner-${encodeURIComponent(semanticAddressKey(openSet))}`),
    ).toBeTruthy();
  });

  it('characterizes Hub-decision and Hub-visit defaults plus the fixed Preboss exception', () => {
    const hubMarker = semanticAddressKey(createHubDecisionAddress(nBiome, 'hub'));
    const pendingHub = renderWorkspace(nOpeningPreHubProject(), 'Surface', 'N');
    const pendingBiome = workspaceBiome(pendingHub.application, 'Surface', 'N');
    if (pendingBiome.frontier?.kind !== 'hubDecision') {
      throw new Error('N Hub-decision frontier is missing');
    }

    expectDefaultRailSelection(pendingHub.application, pendingHub.container, hubMarker);
    expect(
      within(screen.getByRole('complementary', { name: 'Focused inspector' })).getByRole(
        'heading',
        {
          level: 3,
          name: 'Open Ephyra rooms',
        },
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Hub board' })).toBeTruthy();
    cleanup();

    const truncatedProject = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 4),
    });
    const truncatedHub = renderWorkspace(truncatedProject, 'Surface', 'N');
    const truncatedBiome = workspaceBiome(truncatedHub.application, 'Surface', 'N');
    if (truncatedBiome.frontier?.kind !== 'hubVisit') {
      throw new Error('N Hub-visit frontier is missing');
    }

    expectDefaultRailSelection(truncatedHub.application, truncatedHub.container, hubMarker);
    expect(
      within(screen.getByRole('complementary', { name: 'Focused inspector' })).getByRole(
        'heading',
        {
          level: 3,
          name: 'Pylon visit order',
        },
      ),
    ).toBeTruthy();
    const nextVisit = document.querySelector<HTMLElement>('.hub-visit-row[data-authoring="next"]');
    expect(nextVisit).not.toBeNull();
    cleanup();

    const handoffProject = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'default-inspector-n-handoff',
        name: 'N default Hub handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const handoff = renderWorkspace(handoffProject, 'Surface', 'N');
    const handoffBiome = workspaceBiome(handoff.application, 'Surface', 'N');
    if (
      handoffBiome.frontier?.kind !== 'exitDecision' ||
      handoffBiome.frontier.owner.source.kind !== 'hubDecision'
    ) {
      throw new Error('complete N Hub-owned handoff frontier is missing');
    }

    expectDefaultRailSelection(handoff.application, handoff.container, hubMarker);
    expect(
      within(screen.getByRole('complementary', { name: 'Focused inspector' })).getByRole(
        'heading',
        {
          level: 3,
          name: 'Open Ephyra rooms',
        },
      ),
    ).toBeTruthy();
    cleanup();

    const complete = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    const completeBiome = workspaceBiome(complete.application, 'Surface', 'N');
    const preboss = completeBiome.nodes.find(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.preboss,
    );
    if (completeBiome.frontier !== null || preboss?.sourceDecisionRemoval === undefined) {
      throw new Error('complete N fixed Preboss detail is missing');
    }

    expectDefaultRailSelection(
      complete.application,
      complete.container,
      semanticAddressKey(
        createTargetAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }, 'preboss'),
      ),
    );
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(inspector.querySelector('.biome-occurrence-workbench')).not.toBeNull();
    expect(within(inspector).getByRole('heading', { level: 3, name: 'Preboss' })).toBeTruthy();
  });

  it('characterizes defensive default subjects outside current authored projection inputs', () => {
    const { project: partialProject, start } = fTwoDoorBatchProject();
    let bareExitProject = emptyProject('Underworld', 1);
    bareExitProject = applyProjectCommand(bareExitProject, catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    const decisionApplication = createApplication();
    decisionApplication.store.dispatch(authoredProjectReplaced(bareExitProject));
    const bareExitBiome = workspaceBiome(decisionApplication, 'Underworld', 'F');
    if (bareExitBiome.frontier?.kind !== 'exitDecision') {
      throw new Error('synthetic matching F exit frontier is missing');
    }
    const matchingFrontier = bareExitBiome.frontier;
    decisionApplication.store.dispatch(authoredProjectReplaced(partialProject));
    const partialBiome = workspaceBiome(decisionApplication, 'Underworld', 'F');
    const matchingDecision = partialBiome.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(matchingFrontier.owner),
    );
    if (matchingDecision === undefined) {
      throw new Error('synthetic matching F exit decision is missing');
    }
    const matchingExitDefault: WorkspaceBiome = {
      ...partialBiome,
      frontier: matchingFrontier,
    };
    const matchingExitView = renderProjectedBiome(decisionApplication, matchingExitDefault);
    expectDefaultRailSelection(
      decisionApplication,
      matchingExitView.container,
      matchingDecision.marker.focusKey,
    );
    expect(
      screen
        .getByRole('complementary', { name: 'Focused inspector' })
        .querySelector('.biome-batch-workbench'),
    ).not.toBeNull();
    cleanup();
    decisionApplication.dispose();

    const fApplication = createApplication();
    const fProject = createGoldenFGHIProject(catalog);
    fApplication.store.dispatch(authoredProjectReplaced(fProject));
    const fBiome = workspaceBiome(fApplication, 'Underworld', 'F');
    const entry = fBiome.entry;
    if (entry === undefined) throw new Error('complete F entry is missing');

    // Every real entry currently has an active occurrence workbench and an
    // empty topology publishes a start frontier. Keep the remaining fallback
    // branches explicit here without inventing impossible authored documents.
    const entryDefault: WorkspaceBiome = {
      ...fBiome,
      nodes: fBiome.nodes.map(inactiveOccurrenceDetails),
    };
    const entryView = renderProjectedBiome(fApplication, entryDefault);
    expectDefaultRailSelection(fApplication, entryView.container, entry.marker.focusKey);
    expect(
      screen
        .getByRole('complementary', { name: 'Focused inspector' })
        .querySelector('.biome-occurrence-workbench'),
    ).not.toBeNull();
    cleanup();

    const first = fBiome.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'completion' }> =>
        node.kind === 'completion',
    );
    if (first === undefined) throw new Error('complete F completion node is missing');
    const firstNodeDefault: WorkspaceBiome = {
      ...withoutWorkspaceEntry(fBiome),
      nodes: [first],
      rail: [],
    };
    const firstNodeView = renderProjectedBiome(fApplication, firstNodeDefault);
    const firstNodeInspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(selectedRailMarkerKeys(firstNodeView.container)).toEqual([]);
    expect(
      within(firstNodeInspector).getByRole('heading', { level: 2, name: first.label }),
    ).toBeTruthy();
    expect(
      within(firstNodeInspector).getByText(
        'This completion room is derived from the biome layout and is not an authored occurrence.',
      ),
    ).toBeTruthy();
    cleanup();

    const noSubjectDefault: WorkspaceBiome = {
      ...firstNodeDefault,
      nodes: [],
    };
    const noSubjectView = renderProjectedBiome(fApplication, noSubjectDefault);
    expect(selectedRailMarkerKeys(noSubjectView.container)).toEqual([]);
    expect(
      within(screen.getByRole('complementary', { name: 'Focused inspector' })).getByText(
        'No authored structure is available yet.',
      ),
    ).toBeTruthy();
    cleanup();
    fApplication.dispose();

    const nApplication = createApplication();
    nApplication.store.dispatch(authoredProjectReplaced(createRepresentativeNOPQProject()));
    const nBiomeWorkspace = workspaceBiome(nApplication, 'Surface', 'N');
    const hub = nBiomeWorkspace.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub === undefined) throw new Error('complete N Hub node is missing');
    const hubDetailDefault: WorkspaceBiome = {
      ...nBiomeWorkspace,
      frontier: null,
      nodes: nBiomeWorkspace.nodes.filter(
        (node) =>
          node.kind !== 'occurrenceWorkbench' || node.room.occurrenceId !== nOccurrenceIds.preboss,
      ),
    };
    const hubDetailView = renderProjectedBiome(nApplication, hubDetailDefault);
    expectDefaultRailSelection(nApplication, hubDetailView.container, hub.marker.focusKey);
    expect(
      within(screen.getByRole('complementary', { name: 'Focused inspector' })).getByRole(
        'heading',
        {
          level: 3,
          name: 'Open Ephyra rooms',
        },
      ),
    ).toBeTruthy();
    nApplication.dispose();
  });

  it('routes an explicit completed-Hub handoff focus back to the Hub workbench and executes it', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'workspace-n-completed-handoff',
        name: 'N completed handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const view = renderWorkspace(project, 'Surface', 'N');
    const handoff = createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });

    act(() => view.application.store.dispatch(semanticOwnerFocused(handoff)));
    expect(screen.getByRole('heading', { name: 'Open Ephyra rooms' })).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Preboss' }));

    const nPlan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    expect(
      nPlan?.topology?.decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          semanticAddressKey(
            createExitDecisionAddress(createBiomeAddress('Surface', 'N'), decision.source),
          ) === semanticAddressKey(handoff),
      ),
    ).toBe(true);
  });

  it('authors only the next physical exit and keeps room and reward editing in its decision', async () => {
    const { owner, project } = fTwoDoorBatchProject();
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));

    expect(screen.getByRole('button', { name: 'Exit 1 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    const later = screen.getByLabelText('Exit 2 room') as HTMLSelectElement;
    expect(later.disabled).toBe(true);
    expect(later.textContent).toContain('Choose Exit 1 first.');

    await view.user.click(screen.getByRole('button', { name: 'Exit 1 room' }));
    const possible = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('data-candidate-state') !== 'impossible');
    if (possible === undefined) throw new Error('F Exit 1 has no selectable projected room');
    await view.user.click(possible);

    const focused = view.application.store.getState().editorSession.focusedSemanticOwner;
    expect(focused).toMatchObject({ kind: 'target', biomeKey: 'F', routeKey: 'Underworld' });
    const structure = screen.getByRole('region', { name: /structure$/ });
    const decisionRail = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === semanticAddressKey(owner));
    if (decisionRail === undefined) throw new Error('F authored decision rail stop is missing');
    expect(decisionRail.dataset.selected).toBe('true');
    expect(screen.getByRole('button', { name: 'Exit 2 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    const authoredOffer = document.querySelector<HTMLElement>(
      '.biome-target-row:not([data-missing="true"])',
    );
    if (authoredOffer === null) throw new Error('F authored room offer is missing');
    expect(within(authoredOffer).getByRole('button', { name: 'Reward' })).toBeTruthy();
  });

  it('creates a takeover batch through one projected atomic action', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Evaluate Preboss batches' }));
    await view.user.selectOptions(screen.getByLabelText('Preboss declaration'), 'F_PreBoss01');
    await view.user.click(screen.getByRole('button', { name: 'Create Preboss batch' }));

    const plan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    const topology = plan?.topology;
    if (topology === undefined || topology === null) {
      throw new Error('F topology was not authored');
    }
    const decision = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === goldenFOccurrenceId(10, 1),
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') {
      throw new Error('F takeover decision was not authored');
    }
    const gameNames = decision.normal.targets.map(
      (target) =>
        topology.occurrences.find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
          ?.gameName,
    );
    expect(gameNames).toEqual(['F_PreBoss01', 'F_PreBoss01']);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
  });

  it('does not expose or dispatch an impossible unselected Preboss batch', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const view = renderWorkspace(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Evaluate Preboss batches' }));

    const selector = screen.getByLabelText('Preboss declaration') as HTMLSelectElement;
    expect(Array.from(selector.options).map((option) => option.value)).not.toContain('F_PreBoss01');
    const action = screen.getByRole('button', { name: 'Replace with Preboss batch' });
    expect((action as HTMLButtonElement).disabled).toBe(true);
    await view.user.click(action);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
  });

  it('keeps a tentative takeover declaration scoped to its focused ordinary batch', async () => {
    const first = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const second = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const project = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'RemoveExitDecision',
      decision: first,
    });
    const view = renderWorkspace(project, 'Underworld', 'F');

    act(() => view.application.store.dispatch(semanticOwnerFocused(first)));
    await view.user.click(screen.getByRole('button', { name: 'Evaluate Preboss batches' }));
    await view.user.selectOptions(screen.getByLabelText('Preboss declaration'), 'F_PreBoss01');
    expect((screen.getByLabelText('Preboss declaration') as HTMLSelectElement).value).toBe(
      'F_PreBoss01',
    );

    act(() => view.application.store.dispatch(semanticOwnerFocused(second)));
    expect((screen.getByLabelText('Preboss declaration') as HTMLSelectElement).value).toBe('');
  });

  it('omits an impossible unselected batch reward pool', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const view = renderWorkspace(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));

    await view.user.click(screen.getByLabelText('Reward pool'));

    const selector = screen.getByLabelText('Reward pool') as HTMLSelectElement;
    const values = Array.from(selector.options).map((option) => option.value);
    expect(values).toContain('MetaProgress');
    expect(values).not.toContain('RunProgress');
  });

  it('restores generic decision removal and biome clearing as immediate semantic commands', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const removal = renderWorkspace(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    act(() => removal.application.store.dispatch(semanticOwnerFocused(owner)));
    const beforeRemoval = removal.application.store.getState().projectWorkspace.history.past.length;
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).queryByText(/This removes/)).toBeNull();

    const confirmation = vi.spyOn(globalThis, 'confirm');
    await removal.user.click(within(inspector).getByRole('button', { name: 'Remove decision' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        removal.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((candidate) => candidate.biomeKey === 'F')
          ?.topology?.decisions.some(
            (decision) =>
              decision.kind === 'exit' &&
              semanticAddressKey(createExitDecisionAddress(goldenFBiome, decision.source)) ===
                semanticAddressKey(owner),
          ),
      ).toBe(false),
    );
    expect(removal.application.store.getState().projectWorkspace.history.past).toHaveLength(
      beforeRemoval + 1,
    );

    cleanup();
    const clearing = renderWorkspace(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    const beforeClear = clearing.application.store.getState().projectWorkspace.history.past.length;
    await clearing.user.click(screen.getByRole('button', { name: 'Clear Erebus' }));
    await waitFor(() =>
      expect(
        clearing.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((candidate) => candidate.biomeKey === 'F')?.topology,
      ).toBeNull(),
    );
    expect(clearing.application.store.getState().projectWorkspace.history.past).toHaveLength(
      beforeClear + 1,
    );
  });

  it('keeps N linked-PreHub removal reachable from the visible PreHub stage', async () => {
    const linked = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    const structure = screen.getByRole('region', { name: 'Ephyra structure' });
    expect(structure.querySelector('[data-kind="linkedExit"]')).toBeNull();
    expect(structure.querySelector('[data-kind="takeoverBatch"]')).toBeNull();
    await view.user.click(
      railButtonForMarker(
        structure,
        semanticAddressKey(createTargetAddress(nBiome, linked.source, 'prehub')),
      ),
    );
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });

    expect(within(inspector).queryByText(/This removes/)).toBeNull();
    const confirmation = vi.spyOn(globalThis, 'confirm');
    await view.user.click(within(inspector).getByRole('button', { name: 'Remove PreHub' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() => {
      const plan = view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'N');
      expect(plan?.topology).not.toBeNull();
      expect(plan?.topology?.decisions.some((decision) => decision.kind === 'hub')).toBe(false);
      expect(
        plan?.topology?.occurrences.some(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.preHub,
        ),
      ).toBe(false);
      expect(
        plan?.topology?.occurrences.some(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.preboss,
        ),
      ).toBe(false);
      expect(
        plan?.topology?.occurrences.some(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.opening,
        ),
      ).toBe(true);
    });
  });

  it('keeps N completed-Hub handoff removal reachable from the visible Preboss stage', async () => {
    const handoff = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    const structure = screen.getByRole('region', { name: 'Ephyra structure' });
    expect(structure.querySelector('[data-kind="takeoverBatch"]')).toBeNull();
    await view.user.click(
      railButtonForMarker(
        structure,
        semanticAddressKey(createTargetAddress(nBiome, handoff.source, 'preboss')),
      ),
    );
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).queryByText(/This removes/)).toBeNull();
    const removal = within(inspector).getByRole('button', { name: 'Remove Preboss' });

    removal.focus();
    await view.user.keyboard('{Enter}');

    await waitFor(() => {
      const plan = view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'N');
      expect(plan?.topology?.decisions.some((decision) => decision.kind === 'hub')).toBe(true);
      expect(
        plan?.topology?.decisions.some(
          (decision) =>
            decision.kind === 'exit' &&
            semanticAddressKey(createExitDecisionAddress(nBiome, decision.source)) ===
              semanticAddressKey(handoff),
        ),
      ).toBe(false);
      expect(
        plan?.topology?.occurrences.some(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.opening,
        ),
      ).toBe(true);
      expect(
        plan?.topology?.occurrences.some(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.preHub,
        ),
      ).toBe(true);
      expect(
        plan?.topology?.occurrences.some(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.preboss,
        ),
      ).toBe(false);
    });
  });

  it('aggregates a target-owned finding onto its decision rail stop', async () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const structure = screen.getByRole('region', { name: /Olympus structure/ });
    const decision = createExitDecisionAddress(pBiome, {
      kind: 'occurrence',
      occurrenceId: pOccurrenceIds.intro,
    });
    const railDecision = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === semanticAddressKey(decision));
    if (railDecision === undefined) throw new Error('P invalid target decision is missing');

    expect(railDecision.dataset.findings).toBe('true');
    expect(railDecision.textContent).toContain('1 finding');
    expect(railDecision.textContent).toContain('Combat 02');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();

    await view.user.click(railDecision);
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
  });

  it('focuses retained downstream room rewards inside their decision workbench', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    const view = renderWorkspace(project, 'Underworld', 'F');
    const retained = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.topologyState === 'retained' &&
        node.targets.some((target) => target.room.rewardControls.length > 0),
    );
    if (retained === undefined) throw new Error('F retained downstream decision is missing');
    const target = retained.targets.find((candidate) => candidate.room.rewardControls.length > 0);
    const reward = target?.room.rewardControls[0];
    if (target === undefined || reward === undefined) {
      throw new Error('F retained downstream reward is missing');
    }

    act(() => view.application.store.dispatch(semanticOwnerFocused(reward.marker.address)));

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
    expect(
      within(inspector).getAllByRole('article', { name: `${target.room.label} room offer` }),
    ).not.toHaveLength(0);
  });

  it('labels an authored-selected retained route without claiming it was entered', () => {
    const base = createGoldenFGHIProject(catalog);
    const blocked = {
      ...base,
      routes: base.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((plan) =>
                plan.biomeKey !== 'F' || plan.topology === null
                  ? plan
                  : {
                      ...plan,
                      topology: {
                        ...plan.topology,
                        decisions: plan.topology.decisions.map((decision) =>
                          decision.kind === 'exit' &&
                          decision.source.kind === 'occurrence' &&
                          decision.source.occurrenceId === goldenFOccurrenceId(1, 1)
                            ? { ...decision, selection: { kind: 'unresolved' as const } }
                            : decision,
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const view = renderWorkspace(blocked, 'Underworld', 'F');
    const decision = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (
        node,
      ): node is Extract<
        WorkspaceNode,
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.targets.some((target) => target.selected && !target.room.entered),
    );
    if (decision === undefined) throw new Error('selected retained F decision is missing');
    const target = decision.targets.find(
      (candidate) => candidate.selected && !candidate.room.entered,
    );
    if (target === undefined) throw new Error('selected retained F room is missing');

    act(() => view.application.store.dispatch(semanticOwnerFocused(decision.owner)));

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    const selectedControl = within(inspector).getByRole('radio', {
      name: `Pick ${target.room.label} from Exit ${target.index}`,
    });
    const offer = selectedControl.closest<HTMLElement>('article');
    if (offer === null) throw new Error('selected retained F room offer is missing');
    expect(within(offer).getByText('Selected route')).toBeTruthy();
    expect(within(offer).queryByText('Entered route')).toBeNull();
    expect(within(inspector).getByText('Room selection')).toBeTruthy();
  });

  it('renders O’s fixed width-one Preboss takeover without a selector and creates its entered Shop lazily', async () => {
    const owner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const evaluationWork: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => evaluationWork.push(event),
    });
    const view = renderWorkspace(project, 'Surface', 'O', application);
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    evaluationWork.length = 0;
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    expect(screen.queryByLabelText('Preboss declaration')).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toBeTruthy();
    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(0);

    await view.user.click(screen.getByRole('button', { name: 'Go to Preboss' }));

    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(1);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    const plan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    const decision = plan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === oOccurrenceIds.combat02,
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') {
      throw new Error('O fixed width-one takeover did not create one atomic batch');
    }
    expect(decision.selection).toEqual({ kind: 'derived' });
    const prebossId = decision.normal.targets[0]?.occurrenceId;
    const preboss = plan?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === prebossId,
    );
    if (preboss?.state.kind !== 'shop' || preboss.state.shop === undefined) {
      throw new Error('O fixed width-one takeover must materialize its entered World Shop');
    }
    expect(preboss.gameName).toBe('O_PreBoss01');
    const projected = workspaceBiome(view.application, 'Surface', 'O');
    const target = projected.nodes
      .find(
        (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
          node.kind === 'takeoverBatch',
      )
      ?.targets.find((candidate) => candidate.room.occurrenceId === prebossId);
    expect(target).toMatchObject({ selected: true, room: { entered: true } });

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(oBiome, preboss.occurrenceId)),
      ),
    );
    expect(screen.getAllByText('Purchased')).not.toHaveLength(0);
  });

  it('keeps Q’s fixed width-one Preboss takeover on the selected spine after decision serialization is reordered', async () => {
    const owner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    const withoutPreboss = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const encoded = JSON.parse(encodeProjectDocument(withoutPreboss)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ biomeKey: string; topology: { decisions: unknown[] } | null }>;
      }>;
    };
    const topology = encoded.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    if (topology === null || topology === undefined) {
      throw new Error('Q staged project must retain its authored topology');
    }
    topology.decisions.reverse();
    const reordered = decodeProjectDocument(encoded, catalog);
    const evaluationWork: ApplicationEvaluationEvent[] = [];
    const view = renderWorkspace(
      reordered,
      'Surface',
      'Q',
      createApplication({ observeEvaluationWork: (event) => evaluationWork.push(event) }),
    );
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    evaluationWork.length = 0;

    expect(screen.queryByLabelText('Preboss declaration')).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Go to Preboss' }));

    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(1);
    const plan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q');
    const decision = plan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === qOccurrenceIds.secondMiniboss1,
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') {
      throw new Error('Q fixed width-one takeover did not create one atomic batch');
    }
    const prebossId = decision.normal.targets[0]?.occurrenceId;
    const preboss = plan?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === prebossId,
    );
    expect(preboss).toMatchObject({
      gameName: 'Q_PreBoss01',
      state: { kind: 'shop', shop: expect.any(Object) },
    });
    if (preboss === undefined) throw new Error('Q fixed width-one takeover occurrence is missing');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(qBiome, preboss.occurrenceId)),
      ),
    );
    expect(screen.getAllByText('Purchased')).not.toHaveLength(0);
  });

  it('keeps an unavailable fixed width-one Preboss takeover explanatory and non-committing', async () => {
    const qOwner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat02,
      }),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: qOwner,
    });
    const evaluationWork: ApplicationEvaluationEvent[] = [];
    const view = renderWorkspace(
      project,
      'Surface',
      'Q',
      createApplication({ observeEvaluationWork: (event) => evaluationWork.push(event) }),
    );
    act(() => view.application.store.dispatch(semanticOwnerFocused(qOwner)));
    evaluationWork.length = 0;
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Go to Preboss' }));

    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(1);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
    expect(screen.getByText(/before editing this biome contextually\./)).toBeTruthy();
    expect(screen.queryByText(/upstreamIncomplete|coverageNotReached/)).toBeNull();
  });

  it('renders an unpicked Shop as a dormant leaf without inventory controls', () => {
    const { owner, project } = fTwoDoorBatchProject();
    if (owner.source.kind !== 'occurrence') {
      throw new Error('F ordinary batch must be occurrence-owned');
    }
    const shop = createOccurrenceId('biome-workspace-dormant-shop');
    const sibling = createOccurrenceId('biome-workspace-dormant-shop-sibling');
    const withSibling = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, owner.source, 'exit1'),
      occurrenceId: sibling,
      gameName: 'F_Combat04',
    });
    const withDormantShop = applyProjectCommand(withSibling, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, owner.source, 'exit2'),
      occurrenceId: shop,
      gameName: 'F_Shop01',
    });
    const view = renderWorkspace(withDormantShop, 'Underworld', 'F');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, shop)),
      ),
    );

    expect(screen.getByText('Shop inventory materializes when this room is picked.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });

  it('keeps an impossible Shop purchase non-actionable while allowing its selected repair', async () => {
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
    const view = renderWorkspace(invalidOfferProject, 'Surface', 'P');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop)),
      ),
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
    const repair = renderWorkspace(selectedInvalidProject, 'Surface', 'P');
    act(() =>
      repair.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop)),
      ),
    );
    const repairBefore = repair.application.store.getState().projectWorkspace.history.past.length;
    const repairCheckbox = document.getElementById(
      `shop-${semanticAddressKey(purchase)}-purchased`,
    ) as HTMLInputElement | null;
    if (repairCheckbox === null) throw new Error('selected Boon Shop purchase control is missing');
    await repair.user.click(repairCheckbox);
    if (repairCheckbox.checked) {
      await repair.user.click(repairCheckbox);
    }
    expect(repairCheckbox.checked).toBe(false);
    expect(repair.application.store.getState().projectWorkspace.history.past).toHaveLength(
      repairBefore + 1,
    );
  });

  it('reconciles a retained takeover through its semantic command', async () => {
    const complete = createGoldenFGHIProject(catalog);
    const gPlan = complete.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    const takeoverDecision = gPlan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (takeoverDecision?.kind !== 'exit' || takeoverDecision.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    const project = applyProjectCommand(complete, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, takeoverDecision.source.occurrenceId),
      gameName: 'G_MiniBoss02',
    });
    const view = renderWorkspace(project, 'Underworld', 'G');
    const takeover = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('retained G takeover workbench is missing');
    act(() => view.application.store.dispatch(semanticOwnerFocused(takeover.owner)));
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Repair Preboss batch' }));

    const repaired = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (repaired === undefined) throw new Error('repaired G takeover workbench is missing');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    expect(repaired.targets.map((target) => [target.exitKey, target.physicalState])).toEqual([
      ['exit1', 'available'],
    ]);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      takeover.owner,
    );
  });

  it('reconciles an expanded takeover by allocating its newly declared exit', async () => {
    const complete = createGoldenFGHIProject(catalog);
    const gPlan = complete.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    const takeoverDecision = gPlan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (takeoverDecision?.kind !== 'exit' || takeoverDecision.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    const project = applyProjectCommand(complete, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, takeoverDecision.source.occurrenceId),
      gameName: 'G_Combat02',
    });
    const view = renderWorkspace(project, 'Underworld', 'G');
    const takeover = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('expanded G takeover workbench is missing');
    expect(takeover.missingTargets.map((target) => target.exitKey)).toEqual(['exit3']);
    act(() => view.application.store.dispatch(semanticOwnerFocused(takeover.owner)));

    expect(screen.getByText(/Missing Preboss exits are repaired atomically/)).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Repair Preboss batch' }));

    const repaired = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (repaired === undefined)
      throw new Error('repaired expanded G takeover workbench is missing');
    expect(repaired.targets.map((target) => target.exitKey)).toEqual(['exit1', 'exit2', 'exit3']);
    expect(repaired.missingTargets).toHaveLength(0);
  });

  it('renders and applies an ordinary retained-exit repair as a semantic command', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    expect(document.querySelector('[data-command="ReconcileBatchExitCapacity"]')).not.toBeNull();
    expect(screen.queryByText(/Repair removes/)).toBeNull();
    expect(
      Array.from(document.querySelectorAll('.biome-target-row .card-kicker')).map(
        (element) => element.textContent,
      ),
    ).toContain('Exit 2');
    expect(screen.queryByText('Exit 9007199254740991')).toBeNull();
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Reconcile unavailable exits' }));

    const repaired = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(owner),
    );
    if (repaired === undefined) throw new Error('repaired F ordinary batch is missing');
    expect(repaired.targets.map((target) => target.exitKey)).toEqual(['exit1']);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
  });

  it('keeps retained ordinary and takeover repairs actionable in a blocked suffix', async () => {
    const fOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    let fProject = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    fProject = applyProjectCommand(fProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const fView = renderWorkspace(fProject, 'Underworld', 'F');
    act(() => fView.application.store.dispatch(semanticOwnerFocused(fOwner)));
    const fBefore = fView.application.store.getState().projectWorkspace.history.past.length;
    expect(document.querySelector('[data-command="ReconcileBatchExitCapacity"]')).not.toBeNull();
    await fView.user.click(screen.getByRole('button', { name: 'Reconcile unavailable exits' }));
    expect(fView.application.store.getState().projectWorkspace.history.past).toHaveLength(
      fBefore + 1,
    );
    cleanup();

    const base = createGoldenFGHIProject(catalog);
    const gPlan = base.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    const gTakeover = gPlan?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.normal.kind === 'batch' &&
        decision.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (gTakeover?.kind !== 'exit' || gTakeover.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    let gProject = applyProjectCommand(base, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, gTakeover.source.occurrenceId),
      gameName: 'G_MiniBoss02',
    });
    gProject = applyProjectCommand(gProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const gOwner = createExitDecisionAddress(goldenGBiome, gTakeover.source);
    const gView = renderWorkspace(gProject, 'Underworld', 'G');
    act(() => gView.application.store.dispatch(semanticOwnerFocused(gOwner)));
    const gBefore = gView.application.store.getState().projectWorkspace.history.past.length;
    await gView.user.click(screen.getByRole('button', { name: 'Repair Preboss batch' }));
    expect(gView.application.store.getState().projectWorkspace.history.past).toHaveLength(
      gBefore + 1,
    );
  });

  it('renders Fields, Ship, Shop, mixed Preboss, and completion workbenches from room-local descriptors', async () => {
    const underworld = createGoldenFGHIProject(catalog);
    const h = renderWorkspace(underworld, 'Underworld', 'H');
    act(() =>
      h.application.store.dispatch(
        semanticOwnerFocused(
          createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat02')),
        ),
      ),
    );
    expect(screen.getByLabelText('Fields cage rewards')).toBeTruthy();
    expect(screen.getByText('Cage 1')).toBeTruthy();
    cleanup();

    const i = renderWorkspace(underworld, 'Underworld', 'I');
    const mixed = workspaceBiome(i.application, 'Underworld', 'I').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'mixedBatch' }> =>
        node.kind === 'mixedBatch',
    );
    if (mixed === undefined) throw new Error('I mixed Preboss workbench is missing');
    act(() => i.application.store.dispatch(semanticOwnerFocused(mixed.owner)));
    expect(document.querySelector('[data-batch-kind="mixedBatch"]')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Choose a room and reward' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exit 1 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Exit 2 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    cleanup();

    const surface = createRepresentativeNOPQProject();
    const o = renderWorkspace(surface, 'Surface', 'O');
    act(() =>
      o.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(oBiome, oOccurrenceIds.combat04)),
      ),
    );
    expect(screen.getByLabelText('Ship combat encounters')).toBeTruthy();
    expect(screen.getByText('Reward wheel 1')).toBeTruthy();
    cleanup();

    const p = renderWorkspace(surface, 'Surface', 'P');
    act(() =>
      p.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop)),
      ),
    );
    expect(screen.getAllByText('Purchased')).not.toHaveLength(0);
    const structure = screen.getByRole('region', { name: /Olympus structure/ });
    expect(structure.querySelector('[data-kind="completion"]')).toBeNull();
    const completion = within(structure).getByRole('region', { name: 'Biome completion' });
    expect(within(completion).getByText('Prometheus')).toBeTruthy();
  });

  it('focuses a fixed Story reward inside its owning decision workbench', () => {
    const project = createRepresentativeNOPQProject();
    const view = renderWorkspace(project, 'Surface', 'P');
    const storyOccurrenceId = pOccurrenceId('P_Story01', 7, 1);
    const story = workspaceBiome(view.application, 'Surface', 'P').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === storyOccurrenceId,
    );
    if (story === undefined) throw new Error('P Story occurrence workbench is missing');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createIncomingRewardAddress(pBiome, storyOccurrenceId)),
      ),
    );

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    const workbench = inspector.querySelector<HTMLElement>('.biome-batch-workbench');
    if (workbench === null) throw new Error('P Story decision inspector is missing');
    const offer = within(workbench).getByRole('article', {
      name: `${story.room.label} room offer`,
    });
    expect(within(offer).getByText(/^Fixed reward:/)).toBeTruthy();
  });

  it('moves keyboard focus through semantic owners without authoring a change', async () => {
    const project = createGoldenFGHIProject(catalog);
    const view = renderWorkspace(project, 'Underworld', 'F');
    const structure = screen.getByRole('region', { name: /structure$/ });
    const railButtons = within(structure).getAllByRole('button');
    const target = railButtons.find((button) => button.textContent?.includes('Decision 1'));
    if (target === undefined) throw new Error('F normal batch rail node is missing');
    target.focus();
    await view.user.keyboard('{Enter}');
    const focused = view.application.store.getState().editorSession.focusedSemanticOwner;
    expect(focused?.kind).toBe('exitDecision');
  });

  it('keeps a Hub local-child finding on its authored visit detail workbench', () => {
    const sideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    let project = createRepresentativeNOPQProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom,
      generation: 'notGenerated',
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    const finding = view.application.store
      .getState()
      .projectWorkspace.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'sideRoomGenerationUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(sideRoom),
      );
    if (finding === undefined) throw new Error('N side-room finding is missing');

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(sideRoom);
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).getByRole('heading', { level: 3, name: 'Combat 05' })).toBeTruthy();
    expect(within(inspector).getByRole('heading', { name: 'Side rooms' })).toBeTruthy();
    const visit = Array.from(
      view.container.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find(
      (button) =>
        button.dataset.workspaceNode ===
        semanticAddressKey(createOccurrenceAddress(nBiome, nOccurrenceId('combat05'))),
    );
    expect(visit?.dataset.selected).toBe('true');
  });

  it('navigates a guaranteed target finding to its owning decision workbench', () => {
    const target = createTargetAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
      'exit1',
    );
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const finding = view.application.store
      .getState()
      .projectWorkspace.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'targetRoomUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(target),
      );
    if (finding === undefined) throw new Error('P invalid target finding is missing');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.intro)),
      ),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(pBiome, pOccurrenceIds.intro),
    );
    const beforeInspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(
      within(beforeInspector).getByRole('heading', { level: 3, name: 'Entrance' }),
    ).toBeTruthy();

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    const workbench = inspector.querySelector<HTMLElement>('.biome-batch-workbench');
    if (workbench === null) throw new Error('P target finding decision is missing');
    expect(within(workbench).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
  });
});
