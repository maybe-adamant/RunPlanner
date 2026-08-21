// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBossCompletionArcanaAddress,
  createCompletionRoomAddress,
  createPostbossKeepsakeSelectionAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import type { WorkspaceBiome, WorkspaceNode } from '@planner/projections/structured-workspace';
import { findingSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNEntryFrontierProject,
  loadSurfaceNEntryFrontierResolvedProject,
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  nOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';
import { BiomeWorkspace } from './BiomeWorkspace';
import {
  renderWorkspace,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderProjectedBiome(application: PlannerApplication, biome: WorkspaceBiome) {
  const workspace = workspaceProjection(application);
  return render(
    <Provider store={application.store}>
      <BiomeWorkspace
        biome={biome}
        focusByOwner={workspace.focusByOwner}
        interactions={workspace.interactions}
        runStateLaunchers={workspace.runStateLaunchers}
      />
    </Provider>,
  );
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

function inactiveOccurrenceDetails(node: WorkspaceNode): WorkspaceNode {
  if (node.kind !== 'occurrenceWorkbench') return node;
  return { ...node, room: { ...node.room, detailsActive: false } };
}

function withoutWorkspaceEntry({ entry, ...biome }: WorkspaceBiome): Omit<WorkspaceBiome, 'entry'> {
  void entry;
  return biome;
}

describe('BiomeWorkspace', () => {
  it('opens an available Run State sheet without changing inspector selection or authored history, and restores launcher focus on close', async () => {
    const evaluationEvents: string[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => evaluationEvents.push(event.kind),
    });
    const { user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F', application);
    const launcher = screen.getAllByRole('button', { name: 'Run State' })[0];
    if (launcher === undefined) throw new Error('available Run State launcher is missing');
    const beforeHistory = application.store.getState().projectWorkspace.history;
    const beforeFocus = application.store.getState().editorSession.focusedSemanticOwner;
    const beforePanel = application.store.getState().editorSession.activePanelByRoute.Underworld;
    const beforeEvaluationEvents = [...evaluationEvents];

    await user.click(launcher);
    const sheet = screen.getByRole('region', { name: /State before/ });
    const keepsakes = within(sheet).getByText(/Keepsakes/, { selector: 'summary' });
    const arcana = within(sheet).getByText(/Arcana/, { selector: 'summary' });
    const fear = within(sheet).getByText(/Fear/, { selector: 'summary' });
    expect(keepsakes.closest('details')?.open).toBe(false);
    expect(arcana.closest('details')?.open).toBe(false);
    expect(fear.closest('details')?.open).toBe(false);
    await user.click(keepsakes);
    expect(within(sheet).getByText(/1st Biome:/).parentElement?.textContent).toContain(
      'Silver Wheel',
    );
    const godHeading = within(sheet).getByRole('heading', { name: 'Gods in pool' });
    const godSection = godHeading.closest('section');
    if (godSection === null) throw new Error('Gods in pool section is missing');
    expect(godSection.textContent).toContain('Apollo');
    expect(godSection.textContent).not.toContain('ApolloUpgrade');
    expect(within(sheet).getByRole('heading', { name: 'Elements' })).toBeTruthy();
    const traitHeading = within(sheet).getByRole('heading', { name: 'Equipped traits' });
    const traitSection = traitHeading.closest('section');
    if (traitSection === null) throw new Error('Equipped traits section is missing');
    expect(within(traitSection).getByText('Nova Strike · Common · Lv. 2')).toBeTruthy();
    expect(within(traitSection).getByText('Heaven Flourish · Common · Lv. 1')).toBeTruthy();
    expect(within(traitSection).getByText('Engagement Ring · Common · Lv. 1')).toBeTruthy();
    expect(within(traitSection).getByRole('heading', { name: 'All other traits' })).toBeTruthy();
    expect(within(traitSection).getByText('Wicked Thrasher · Rank I')).toBeTruthy();
    expect(within(traitSection).getByText('Sprint:').nextElementSibling?.textContent).toBe('None');
    expect(within(traitSection).getByText('Magick:').nextElementSibling?.textContent).toBe('None');
    expect(
      within(traitSection).getByRole('heading', { name: 'Banned traits' }).nextElementSibling
        ?.textContent,
    ).toBe('None');
    expect(traitSection.textContent).not.toContain('ApolloWeaponBoon');
    expect(traitSection.textContent).not.toContain('WeaponUpgrade');
    expect(within(sheet).getByRole('heading', { name: 'More Info' })).toBeTruthy();
    const counterSummary = within(sheet).getByText('Counters');
    const counterDisclosure = counterSummary.closest('details');
    if (counterDisclosure === null) throw new Error('Counters disclosure is missing');
    expect(counterDisclosure.open).toBe(false);
    await user.click(counterSummary);
    expect(counterDisclosure.open).toBe(true);
    expect(within(counterDisclosure).getByText('biomeDepthCache')).toBeTruthy();
    const rewardBagsSummary = within(sheet).getByText('Reward Bags');
    const rewardBagsDisclosure = rewardBagsSummary.closest('details');
    if (rewardBagsDisclosure === null) throw new Error('Reward Bags disclosure is missing');
    expect(rewardBagsDisclosure.open).toBe(false);
    await user.click(rewardBagsSummary);
    expect(rewardBagsDisclosure.open).toBe(true);
    const bagSummary = within(sheet).getByText(/Major Reward \(RunProgress\)/);
    expect(bagSummary.textContent).toMatch(/x3.*Eligible now x1.*Ineligible now x2/);
    await user.click(bagSummary);
    await user.click(within(sheet).getAllByText(/Max Health \(MaxHealthDrop\)/)[0]!);
    expect(
      within(sheet).getAllByRole('list', { name: 'Max Health conditions' })[0]!.textContent,
    ).toContain('No additional condition.');
    expect(sheet.getAttribute('aria-modal')).toBeNull();
    expect(application.store.getState().projectWorkspace.history).toBe(beforeHistory);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(beforeFocus);
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual(
      beforePanel,
    );

    await user.click(within(sheet).getByRole('button', { name: 'Close Run State' }));
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expect(evaluationEvents).toEqual(beforeEvaluationEvents);

    await user.click(launcher);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });

  it('renders an engine-unavailable Run State launcher as disabled and never opens its sheet', async () => {
    const { user } = renderWorkspace(loadSurfaceNEntryFrontierProject(), 'Surface', 'N');
    const launcher = screen.getByRole('button', { name: 'Run State' });
    if (!(launcher instanceof HTMLButtonElement))
      throw new Error('Run State launcher is not a button');
    expect(launcher.disabled).toBe(true);
    expect(launcher.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByText(/Run State is unavailable/)).toBeNull();
    await user.click(launcher);
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
  });

  it('keeps the fixed N start room in the rail next step', () => {
    renderWorkspace(emptyProject('Surface', 1), 'Surface', 'N');

    const start = screen.getByRole('button', { name: /Start with Opening/ });
    expect(start.textContent).toContain('Next step');
    expect(start.textContent).not.toContain('Choose the first room');
  });

  it('edits authored start identity beside the read-only room workbench and undoes exactly', async () => {
    const occurrenceId = createOccurrenceId('start-identity-surface');
    const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const started = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId,
    });
    const project = started;
    const view = renderWorkspace(project, 'Underworld', 'F');
    const identity = screen.getByRole('region', { name: 'Start room identity' });
    const workbench = document.querySelector('.biome-occurrence-workbench');
    if (!(workbench instanceof HTMLElement)) throw new Error('start workbench is missing');
    expect(within(workbench).queryByLabelText('Start room')).toBeNull();
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(within(identity).getByRole('button', { name: 'Start room' }));
    const replacement = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      );
    if (replacement === undefined) throw new Error('F start has no replacement room');
    await view.user.click(replacement);

    const authoredStart = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
        ?.gameName;
    expect(authoredStart()).not.toBe('F_Opening01');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      occurrence,
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredStart()).toBe('F_Opening01');
  });

  it('edits a selectable F entry reward beside identity and undoes exactly once', async () => {
    const occurrenceId = createOccurrenceId('start-entry-reward');
    const started = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId,
    });
    const view = renderWorkspace(started, 'Underworld', 'F');
    const identity = screen.getByRole('region', { name: 'Start room identity' });
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(within(identity).getByLabelText('Reward'));
    const listbox = await screen.findByRole('listbox');
    await view.user.click(within(listbox).getByText('Hammer'));

    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      view.application.store.getState().projectWorkspace.history.present.routes[0]?.biomes[0]
        ?.topology?.occurrences[0]?.state,
    ).toMatchObject({
      kind: 'counted',
      reward: { offer: { rewardType: 'WeaponUpgrade' } },
    });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      view.application.store.getState().projectWorkspace.history.present.routes[0]?.biomes[0]
        ?.topology?.occurrences[0]?.state,
    ).toMatchObject({ kind: 'counted', reward: null });
  });

  it('shows the fixed N entry reward without a start identity picker', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await view.user.click(screen.getByRole('button', { name: /^Opening/ }));
    const entryReward = screen.getByRole('region', { name: 'Entry reward' });
    expect(within(entryReward).getByLabelText('Reward')).toBeTruthy();
    expect(within(entryReward).queryByLabelText('Start room')).toBeNull();
    expect(within(entryReward).queryByRole('heading', { name: 'Entry reward' })).toBeNull();
    expect(within(entryReward).queryByRole('button', { name: /Edit Trait/ })).toBeNull();
  });

  it('uses one concise player-facing name for the Hub rail stop', () => {
    renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');

    expect(screen.getByRole('button', { name: 'Hub, 6 of 6 visits, Evaluated' })).toBe(
      hubRailButton(),
    );
  });

  it('keeps node assessment beside its title without redundant structural kickers', () => {
    const view = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    const decision = view.container.querySelector<HTMLButtonElement>(
      '.biome-rail-stop[data-kind="ordinaryBatch"] > .biome-rail-node',
    );
    if (decision === null) throw new Error('F decision rail stop is missing');

    const heading = decision.querySelector('.biome-rail-heading');
    expect(heading?.querySelector('strong')?.textContent).toMatch(/^Decision /);
    expect(heading?.querySelector('.biome-rail-status')?.textContent).toContain('Evaluated');
    expect(decision.querySelector('.biome-rail-kicker')).toBeNull();
    expect(view.container.querySelector('.biome-rail')?.textContent).not.toContain('Door choice');
    expect(view.container.querySelector('.biome-rail')?.textContent).not.toContain('Biome stage');
  });

  it('uses the same compact title-and-status row for the Hub and its visits', () => {
    renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');

    const hub = hubRailButton();
    const hubHeading = hub.querySelector('.biome-rail-heading');
    expect(hubHeading?.querySelector('strong')?.textContent).toBe('Hub');
    expect(hubHeading?.querySelector('.biome-rail-status')?.textContent).toContain('Evaluated');
    expect(hub.querySelector('.biome-rail-kicker')).toBeNull();

    const visit = screen.getByRole('button', { name: /Visit 3 · Combat 02/ });
    const visitHeading = visit.querySelector('.biome-rail-heading');
    expect(visitHeading?.querySelector('strong')?.textContent).toBe('Visit 3 · Combat 02');
    expect(visitHeading?.querySelector('.biome-rail-status')?.textContent).toContain('Evaluated');
    expect(visit.querySelector('.biome-rail-kicker')).toBeNull();
  });

  it('keeps the compact clear action on the biome title row', () => {
    renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');

    const clear = screen.getByRole('button', { name: 'Clear Erebus' });
    expect(clear.textContent).toBe('Clear biome');
    expect(clear.classList.contains('action-compact')).toBe(true);
    expect(clear.closest('.biome-structure-title-row')).not.toBeNull();
  });

  it('renders Ephyra primary rewards on fixed stages, decision selections, and authored Hub visits', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const biome = workspaceBiome(view.application, 'Surface', 'N');
    const opening = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        entry.node.kind === 'occurrenceWorkbench' &&
        entry.node.room.gameName === 'N_Opening01',
    );
    const preHubDecision = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        (entry.node.kind === 'ordinaryBatch' || entry.node.kind === 'mixedBatch') &&
        entry.node.targets.some((target) => target.room.gameName === 'N_PreHub01'),
    );
    const hub = biome.rail.find(
      (entry): entry is Extract<(typeof biome.rail)[number], { readonly kind: 'hubGroup' }> =>
        entry.kind === 'hubGroup',
    );
    const firstVisit = hub?.visits[0];
    if (
      opening?.kind !== 'node' ||
      opening.node.kind !== 'occurrenceWorkbench' ||
      opening.mainReward === undefined ||
      preHubDecision?.kind !== 'node' ||
      preHubDecision.selectedTarget?.reward === undefined ||
      firstVisit?.mainReward === undefined
    ) {
      throw new Error('Ephyra rail primary-reward entries are missing');
    }

    expect(
      railButtonForMarker(view.container, opening.marker.focusKey).querySelector(
        '.biome-rail-selection',
      )?.textContent,
    ).toContain(opening.mainReward.label);
    expect(
      railButtonForMarker(view.container, preHubDecision.marker.focusKey).querySelector(
        '.biome-rail-selection',
      )?.textContent,
    ).toContain(preHubDecision.selectedTarget.reward.label);
    expect(
      railButtonForMarker(view.container, firstVisit.marker.focusKey).querySelector(
        '.biome-rail-selection',
      )?.textContent,
    ).toContain(firstVisit.mainReward.label);
    await view.user.click(hubRailButton());
    await view.user.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    const hubCard = screen.getByRole('article', {
      name: `${firstVisit.node.room.label} Hub room`,
    });
    expect(hubCard.querySelector('.hub-main-reward')?.textContent).toContain(
      firstVisit.mainReward.label,
    );
  });

  it('uses a selected decision rail stop to open its continuation occurrence stage', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const biome = workspaceBiome(view.application, 'Surface', 'N');
    const opening = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        entry.node.kind === 'occurrenceWorkbench' &&
        entry.node.room.gameName === 'N_Opening01',
    );
    const preHubDecision = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        (entry.node.kind === 'ordinaryBatch' || entry.node.kind === 'mixedBatch') &&
        entry.node.targets.some((target) => target.room.gameName === 'N_PreHub01'),
    );
    if (
      opening?.kind !== 'node' ||
      preHubDecision?.kind !== 'node' ||
      (preHubDecision.node.kind !== 'ordinaryBatch' && preHubDecision.node.kind !== 'mixedBatch')
    ) {
      throw new Error('N Opening or Pre-Hub rail stop is missing');
    }
    const preHub = preHubDecision.node.targets.find(
      (target) => target.selected && target.room.gameName === 'N_PreHub01',
    );
    if (preHub === undefined) throw new Error('N selected Pre-Hub continuation is missing');

    await view.user.click(railButtonForMarker(view.container, opening.marker.focusKey));
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-occurrence-workbench > header h3')?.textContent).toBe(
      'Entering Opening',
    );

    await view.user.click(railButtonForMarker(view.container, preHubDecision.marker.focusKey));
    expect(
      within(inspector).getByRole('heading', { level: 3, name: 'Entering Pre-Hub' }),
    ).toBeTruthy();
    expect(
      within(inspector).getByRole('region', { name: 'Incoming reward' }).textContent,
    ).toContain('Boon · Ares');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      preHub.room.marker.address,
    );
    expect(
      railButtonForMarker(view.container, preHubDecision.marker.focusKey).dataset.selected,
    ).toBe('true');
  });

  it('routes a keyboard-selected Hub rail visit to its occurrence-owned local detail workbench', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    await view.user.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    const boardCard = screen.getByRole('article', { name: 'Combat 02 Hub room' });
    expect(within(boardCard).getByLabelText('Combat 02 reward preview').textContent).toContain(
      'Big Max Magick',
    );

    const visit = screen.getByRole('button', { name: /Visit 3 · Combat 02/ });
    act(() => visit.focus());
    await view.user.keyboard('{Enter}');

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, nOccurrenceId('combat02')),
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Entering Combat 02' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' }).textContent).toContain(
      'Big Max Magick',
    );
    expect(screen.getByRole('heading', { name: 'Side rooms' })).toBeTruthy();
    expect(screen.getByText('Door 558353')).toBeTruthy();
    expect(screen.getByLabelText('Side Room 01 generation')).toBeTruthy();
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-inspector-heading')).toBeNull();
    expect(within(inspector).getAllByRole('button', { name: 'Reward' })).toHaveLength(2);
    await view.user.selectOptions(
      within(inspector).getByLabelText('Side Room 03 generation'),
      'notGenerated',
    );
    const localVisit = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N')
      ?.topology?.decisions.find(
        (decision) =>
          decision.kind === 'localVisit' &&
          decision.sourceOccurrenceId === nOccurrenceId('combat02'),
      );
    expect(
      localVisit?.kind === 'localVisit'
        ? localVisit.targetsBySlot.sideDoor2?.generation
        : undefined,
    ).toBe('notGenerated');
    await view.user.click(within(inspector).getByRole('button', { name: 'Open Side Room 01' }));
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor1')),
    );
    expect(within(inspector).getByRole('heading', { level: 3, name: /^Entering / })).toBeTruthy();
    expect(within(inspector).getByRole('region', { name: 'Incoming reward' })).toBeTruthy();
    expect(within(inspector).queryByRole('button', { name: 'Reward' })).toBeNull();
  });

  it('summarizes the Hub door reward in Overview without exposing another editor', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    await view.user.click(screen.getByRole('button', { name: /Visit 3 · Combat 02/ }));

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    expect(
      within(inspector).getByRole('heading', { level: 3, name: 'Entering Combat 02' }),
    ).toBeTruthy();
    expect(
      within(inspector).getByRole('region', { name: 'Incoming reward' }).textContent,
    ).toContain('Big Max Magick');
    expect(within(inspector).queryByRole('region', { name: 'Hub reward' })).toBeNull();
    expect(within(inspector).queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
  });

  it('keeps Hub visit and board focus represented by the nested rail', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    const railVisit = screen.getByRole('button', { name: /Visit 3 · Combat 02/ });

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubVisitAddress(nBiome, 'hub', 3)),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(railVisit.dataset.selected).toBe('true');
    expect(hubRailButton().dataset.selected).toBe('false');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubSlotAddress(nBiome, 'hub', 'combat02')),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
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
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(hubRailButton().dataset.selected).toBe('true');
    expect(screen.getByRole('button', { name: /Visit 3 · Combat 02/ }).dataset.selected).toBe(
      'false',
    );
  });

  it('renders ordinary rails in semantic decision order and defaults to a decision inspector', () => {
    const underworld = createGoldenFGHIProject();
    const surface = loadSurfaceNOPQProject();
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
      expect(screen.getByRole('region', { name: /route structure$/ })).toBeTruthy();
      expect(screen.queryByText(projected.source)).toBeNull();
      expect(railMarkerKeys(view.container)).toEqual(
        projected.rail.map((entry) => entry.marker.focusKey),
      );
      const inspector = screen.getByRole('complementary', { name: 'Details' });
      expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
      expect(inspector.querySelector('.biome-occurrence-workbench')).not.toBeNull();
      cleanup();
    }
  }, 15_000);

  it('keeps a stale explicit biome owner on the projected default without selecting the rail', () => {
    const view = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    const projected = workspaceBiome(view.application, 'Underworld', 'F');
    expect(projected.defaultInspectorDestination?.kind).toBe('node');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(
          createOccurrenceAddress(goldenFBiome, createOccurrenceId('stale-biome-workspace-owner')),
        ),
      ),
    );

    expect(selectedRailMarkerKeys(view.container)).toEqual([]);
    expect(
      screen
        .getByRole('complementary', { name: 'Details' })
        .querySelector('.biome-batch-workbench'),
    ).not.toBeNull();
  });

  it('updates decision rail context from the predecessor occurrence stage', async () => {
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat03', 1, 1),
      }),
    });
    const owner = createExitDecisionAddress(pBiome, {
      kind: 'occurrence',
      occurrenceId: pOccurrenceIds.intro,
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const projected = workspaceBiome(view.application, 'Surface', 'P');
    const railDecision = railButtonForMarker(view.container, semanticAddressKey(owner));
    const sourceOccurrence = projected.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' &&
        owner.source.kind === 'occurrence' &&
        node.room.occurrenceId === owner.source.occurrenceId,
    );
    const sourceRail = projected.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        sourceOccurrence !== undefined &&
        entry.node.key === sourceOccurrence.key,
    );
    if (sourceOccurrence?.kind !== 'occurrenceWorkbench' || sourceRail?.kind !== 'node') {
      throw new Error('P predecessor occurrence rail stage is missing');
    }
    await view.user.click(railButtonForMarker(view.container, sourceRail.marker.focusKey));

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const decisionNode = projected.nodes.find(
      (node) =>
        (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
        semanticAddressKey(node.owner) === semanticAddressKey(owner),
    );
    if (decisionNode?.kind !== 'ordinaryBatch' && decisionNode?.kind !== 'mixedBatch') {
      throw new Error('P selected room decision is missing');
    }
    const picked = decisionNode.targets.find((target) => target.selected);
    if (picked === undefined) throw new Error('P selected room is missing');
    const before = railDecision.querySelector<HTMLElement>('.biome-rail-selection');
    if (before === null) throw new Error('P selected room rail context is missing');
    const beforeText = before.textContent;
    await view.user.click(within(inspector).getByRole('tab', { name: 'Room Doors' }));
    const pickedDoor = within(inspector).getByRole('article', {
      name: `${picked.door.room.label} room offer`,
    });
    await view.user.click(within(pickedDoor).getByRole('button', { name: 'Reward' }));
    const replacement = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true' &&
          !/Boon|Devotion|Blind Box/.test(option.textContent ?? ''),
      );
    if (replacement === undefined) throw new Error('P picked room has no replacement reward');
    await view.user.click(replacement);

    const after = railDecision.querySelector<HTMLElement>('.biome-rail-selection');
    if (after === null) throw new Error('P updated room rail context is missing');
    expect(after.textContent).not.toBe(beforeText);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      sourceOccurrence.room.marker.address,
    );
  });

  it('keeps the owning decision rail selected when the next physical target takes focus', async () => {
    const { owner, project } = fTwoDoorBatchProject();
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));

    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    const possible = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('data-candidate-state') !== 'impossible');
    if (possible === undefined) throw new Error('F Exit 1 has no selectable projected room');
    await view.user.click(possible);

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createTargetAddress(goldenFBiome, owner.source, 'exit1'),
    );
    const structure = screen.getByRole('region', { name: /route structure$/ });
    const decisionRail = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === semanticAddressKey(owner));
    if (decisionRail === undefined) throw new Error('F authored decision rail stop is missing');
    expect(decisionRail.dataset.selected).toBe('true');
  });

  it('authors the first outgoing edit atomically and undo restores provisional doors', async () => {
    const occurrenceId = goldenFStartId;
    const source = { kind: 'occurrence' as const, occurrenceId };
    const owner = createExitDecisionAddress(goldenFBiome, source);
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const view = renderWorkspace(project, 'Underworld', 'F');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, occurrenceId)),
      ),
    );
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-occurrence-workbench')).not.toBeNull();
    await view.user.click(within(inspector).getByRole('tab', { name: 'Room Doors' }));
    expect(within(inspector).getByText('Choose a room')).toBeTruthy();
    expect(within(inspector).queryByText('Continue from this room')).toBeNull();
    expect(within(inspector).queryByRole('button', { name: 'Remove these doors' })).toBeNull();
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    const pool = within(inspector).getByRole('combobox', { name: 'Reward Pool' });
    await view.user.click(pool);
    await waitFor(() =>
      expect(
        within(pool)
          .getByRole('option', { name: 'Minor Reward' })
          .getAttribute('data-candidate-support'),
      ).not.toBe('unavailable'),
    );
    await view.user.selectOptions(pool, 'MetaProgress');

    await waitFor(() => {
      expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
      expect(screen.getByRole('button', { name: 'Door 1 room' })).toBeTruthy();
    });
    const authoredDecision = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          semanticAddressKey(createExitDecisionAddress(goldenFBiome, decision.source)) ===
            semanticAddressKey(owner),
      );
    if (authoredDecision?.kind !== 'exit') {
      throw new Error('direct continuation did not create its F decision');
    }
    expect(authoredDecision.normal).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'MetaProgress' },
      targets: [],
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    expect(screen.getByRole('button', { name: 'Remove these doors' })).toBeTruthy();

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(
        view.application.store.getState().projectWorkspace.history.present.routes[0]?.biomes[0]
          ?.topology?.decisions,
      ).toEqual([]),
    );
    const restoredInspector = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(restoredInspector).getByRole('tab', { name: 'Room Doors' }));
    expect(screen.getByText('Choose a room')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove these doors' })).toBeNull();
  });

  it('renders topology-owned and terminal outgoing states on their exact N occurrences', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(nBiome, nOccurrenceId('combat02'))),
      ),
    );
    await view.user.click(
      within(screen.getByRole('complementary', { name: 'Details' })).getByRole('tab', {
        name: 'Room Doors',
      }),
    );
    let outgoing = within(screen.getByRole('complementary', { name: 'Details' })).getByRole(
      'region',
      { name: 'Outgoing doors' },
    );
    expect(
      within(outgoing).getByText('Continuation is owned by this room’s local visits.'),
    ).toBeTruthy();

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(nBiome, nOccurrenceId('preboss'))),
      ),
    );
    await view.user.click(
      within(screen.getByRole('complementary', { name: 'Details' })).getByRole('tab', {
        name: 'Room Doors',
      }),
    );
    outgoing = within(screen.getByRole('complementary', { name: 'Details' })).getByRole('region', {
      name: 'Outgoing doors',
    });
    expect(
      within(outgoing).getByText('No physical outgoing door before biome completion.'),
    ).toBeTruthy();
  });

  it('renders N’s entry frontiers without an unauthored Hub rail stop', () => {
    const emptyProjectDocument = emptyProject('Surface', 1);
    const emptyView = renderWorkspace(emptyProjectDocument, 'Surface', 'N');
    const emptyRail = railMarkerKeys(emptyView.container);
    const emptyWorkspace = workspaceBiome(emptyView.application, 'Surface', 'N');
    if (emptyWorkspace.frontier?.kind !== 'start') {
      throw new Error('empty N start frontier is missing');
    }
    expect(emptyRail).toEqual([emptyWorkspace.frontier?.marker.focusKey]);
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
    ]);
  });

  it('replaces the terminal PreHub decision with Hub and restores it through undo and redo', async () => {
    const terminalProject = loadSurfaceNEntryFrontierResolvedProject();
    const terminalOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const view = renderWorkspace(terminalProject, 'Surface', 'N');
    act(() => view.application.store.dispatch(semanticOwnerFocused(terminalOwner)));

    const picker = await screen.findByRole('button', { name: 'Door 1 room' });
    await view.user.click(picker);
    const action = await screen.findByText('Ephyra Hub');
    expect(
      workspaceBiome(view.application, 'Surface', 'N').nodes.some(
        (node) => node.kind === 'hubDecision',
      ),
    ).toBe(false);
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(action);

    await waitFor(() => {
      expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(hub);
      expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => {
      const restored = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
        (node) =>
          node.kind === 'ordinaryBatch' &&
          semanticAddressKey(node.owner) === semanticAddressKey(terminalOwner),
      );
      expect(restored?.kind === 'ordinaryBatch' ? restored.targets : []).toHaveLength(0);
    });
    act(() => view.application.store.dispatch(semanticOwnerFocused(terminalOwner)));
    expect(await screen.findByRole('button', { name: 'Door 1 room' })).toBeTruthy();

    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy());
  });

  it('keeps the terminal Hub candidate visible when an invalid PreHub reward blocks evaluation', async () => {
    const preHubReward = createIncomingRewardAddress(nBiome, nOccurrenceIds.preHub);
    const invalidPrefix = applyProjectCommand(loadSurfaceNEntryFrontierResolvedProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: preHubReward,
      value: { rewardType: 'TalentDrop' },
    });
    const terminalOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const view = renderWorkspace(invalidPrefix, 'Surface', 'N');
    const terminal = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(terminalOwner),
    );

    expect(
      view.application.store.getState().projectWorkspace.assembly.evaluation.findings,
    ).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: preHubReward,
      }),
    );
    expect(terminal?.kind === 'ordinaryBatch' ? terminal.targets : []).toHaveLength(0);

    act(() => view.application.store.dispatch(semanticOwnerFocused(terminalOwner)));
    const picker = await screen.findByRole('button', { name: 'Door 1 room' });
    await view.user.click(picker);
    const action = await screen.findByText('Ephyra Hub');
    expect(action.closest('[aria-disabled="true"]')).toBeTruthy();
    expect(
      workspaceBiome(view.application, 'Surface', 'N').nodes.some(
        (node) => node.kind === 'hubDecision',
      ),
    ).toBe(false);
  });

  it('resolves defensive projected defaults outside current authored projection inputs', () => {
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
      defaultInspectorDestination: {
        kind: 'node',
        nodeKey: matchingDecision.key,
        selectedRailKey: matchingDecision.marker.focusKey,
      },
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
        .getByRole('complementary', { name: 'Details' })
        .querySelector('.biome-batch-workbench'),
    ).not.toBeNull();
    cleanup();
    decisionApplication.dispose();

    const fApplication = createApplication();
    const fProject = createGoldenFGHIProject();
    fApplication.store.dispatch(authoredProjectReplaced(fProject));
    const fBiome = workspaceBiome(fApplication, 'Underworld', 'F');
    const entry = fBiome.entry;
    if (entry === undefined) throw new Error('complete F entry is missing');

    // Every real entry currently has an active occurrence workbench and an
    // empty topology publishes a start frontier. Keep the remaining fallback
    // branches explicit here without inventing impossible authored documents.
    const entryDefault: WorkspaceBiome = {
      ...fBiome,
      defaultInspectorDestination: {
        kind: 'node',
        nodeKey: entry.key,
        selectedRailKey: entry.marker.focusKey,
      },
      nodes: fBiome.nodes.map(inactiveOccurrenceDetails),
    };
    const entryView = renderProjectedBiome(fApplication, entryDefault);
    expectDefaultRailSelection(fApplication, entryView.container, entry.marker.focusKey);
    expect(
      screen
        .getByRole('complementary', { name: 'Details' })
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
      defaultInspectorDestination: { kind: 'node', nodeKey: first.key },
      nodes: [first],
      rail: [],
    };
    const firstNodeView = renderProjectedBiome(fApplication, firstNodeDefault);
    const firstNodeInspector = screen.getByRole('complementary', { name: 'Details' });
    expect(selectedRailMarkerKeys(firstNodeView.container)).toEqual([]);
    expect(
      within(firstNodeInspector).getByRole('heading', { level: 2, name: first.label }),
    ).toBeTruthy();
    expect(
      within(firstNodeInspector).getByText('This room is added automatically after the biome.'),
    ).toBeTruthy();
    cleanup();

    const noSubjectDefault: WorkspaceBiome = {
      ...firstNodeDefault,
      defaultInspectorDestination: null,
      nodes: [],
    };
    const noSubjectView = renderProjectedBiome(fApplication, noSubjectDefault);
    expect(selectedRailMarkerKeys(noSubjectView.container)).toEqual([]);
    expect(
      within(screen.getByRole('complementary', { name: 'Details' })).getByText(
        'Choose the first room to start this biome.',
      ),
    ).toBeTruthy();
    cleanup();
    fApplication.dispose();

    const nApplication = createApplication();
    nApplication.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));
    const nBiomeWorkspace = workspaceBiome(nApplication, 'Surface', 'N');
    const hub = nBiomeWorkspace.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub === undefined) throw new Error('complete N Hub node is missing');
    const hubDetailDefault: WorkspaceBiome = {
      ...nBiomeWorkspace,
      defaultInspectorDestination: {
        kind: 'node',
        nodeKey: hub.key,
        selectedRailKey: hub.marker.focusKey,
      },
      frontier: null,
      nodes: nBiomeWorkspace.nodes.filter(
        (node) =>
          node.kind !== 'occurrenceWorkbench' || node.room.occurrenceId !== nOccurrenceIds.preboss,
      ),
    };
    const hubDetailView = renderProjectedBiome(nApplication, hubDetailDefault);
    expectDefaultRailSelection(nApplication, hubDetailView.container, hub.marker.focusKey);
    expect(
      within(screen.getByRole('complementary', { name: 'Details' })).getByRole('heading', {
        level: 3,
        name: 'Ephyra Hub',
      }),
    ).toBeTruthy();
    nApplication.dispose();
  });

  it('routes an explicit completed-Hub handoff focus back to the Hub workbench and executes it', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderWorkspace(project, 'Surface', 'N');
    const handoff = createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });

    act(() => view.application.store.dispatch(semanticOwnerFocused(handoff)));
    expect(screen.getByRole('tab', { name: 'Hub Exit' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('article', { name: 'Preboss room offer' })).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Open next room' }));

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

  it('keeps direct Preboss choice inside Door 1 and out of ordinary batches', async () => {
    const first = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const second = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const withoutDecision = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: first,
    });
    const project = applyProjectCommand(withoutDecision, catalog, {
      decision: first,
      kind: 'CreateBatch',
    });
    const view = renderWorkspace(project, 'Underworld', 'F');

    act(() => view.application.store.dispatch(semanticOwnerFocused(first)));
    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .some((option) => option.getAttribute('data-candidate-state') === 'forced'),
    ).toBe(true);

    act(() => view.application.store.dispatch(semanticOwnerFocused(second)));
    expect(screen.queryByRole('button', { name: 'Check Preboss rooms' })).toBeNull();
    expect(screen.queryByText('Add Preboss doors')).toBeNull();
  });

  it('keeps N completed-Hub handoff removal reachable from the visible Preboss stage', async () => {
    const handoff = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const structure = screen.getByRole('region', { name: 'Ephyra route structure' });
    expect(structure.querySelector('[data-kind="takeoverBatch"]')).toBeNull();
    await view.user.click(
      railButtonForMarker(
        structure,
        semanticAddressKey(createTargetAddress(nBiome, handoff.source, 'preboss')),
      ),
    );
    const inspector = screen.getByRole('complementary', { name: 'Details' });
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
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const structure = screen.getByRole('region', { name: /Olympus route structure/ });
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
    expect(railDecision.querySelector('.biome-rail-selection')?.textContent).toContain('Combat 02');
    expect(railDecision.querySelector('.biome-rail-summary')).toBeNull();
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();

    await view.user.click(railDecision);
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(inspector).getByRole('tab', { name: 'Room Doors' }));
    expect(within(inspector).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
  });

  it('focuses retained downstream room rewards inside their occurrence workbench', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
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

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-occurrence-workbench')).not.toBeNull();
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
  });

  it('focuses a fixed Story reward on its owning predecessor door', () => {
    const project = loadSurfaceNOPQProject();
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

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const door = within(inspector).getByRole('article', {
      name: `${story.room.label} room offer`,
    });
    expect(within(door).queryByText('Door reward')).toBeNull();
    expect(
      door.querySelector('.door-reward-list .room-state-with-marker > .semantic-owner-marker'),
    ).not.toBeNull();
  });

  it('moves keyboard focus through semantic owners without authoring a change', async () => {
    const project = createGoldenFGHIProject();
    const view = renderWorkspace(project, 'Underworld', 'F');
    const structure = screen.getByRole('region', { name: /route structure$/ });
    const railButtons = within(structure).getAllByRole('button');
    const target = railButtons.find((button) => button.textContent?.includes('Decision 1'));
    if (target === undefined) throw new Error('F normal batch rail node is missing');
    target.focus();
    await view.user.keyboard('{Enter}');
    const focused = view.application.store.getState().editorSession.focusedSemanticOwner;
    const decision = workspaceBiome(view.application, 'Underworld', 'F').rail.find(
      (entry) => entry.kind === 'node' && entry.label === 'Decision 1',
    );
    if (decision?.kind !== 'node') throw new Error('F Decision 1 projection is missing');
    expect(focused).toEqual(decision.focusMarker.address);
    expect(focused?.kind).toBe('occurrence');
  });

  it('navigates a guaranteed target finding to its owning decision workbench', () => {
    const target = createTargetAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
      'exit1',
    );
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const finding = view.application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
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
    const beforeInspector = screen.getByRole('complementary', { name: 'Details' });
    expect(
      within(beforeInspector).getByRole('heading', { level: 3, name: 'Entering Entrance' }),
    ).toBeTruthy();

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const workbench = inspector.querySelector<HTMLElement>('.biome-batch-workbench');
    if (workbench === null) throw new Error('P target finding decision is missing');
    expect(within(workbench).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
  });

  it('keeps the reached Judgment picker line-separated and directly reopenable', () => {
    const dormant = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const dormantBoss = workspaceBiome(dormant.application, 'Surface', 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'completion' }> =>
        node.kind === 'completion' && node.role === 'boss',
    );
    if (dormantBoss === undefined) throw new Error('N Boss completion is missing');
    expect(dormantBoss.judgment).toBeUndefined();
    cleanup();
    dormant.application.dispose();

    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Surface'),
      arcanaKeys: ['CastCount'],
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    const workspace = workspaceProjection(view.application);
    const owner = createBossCompletionArcanaAddress(createCompletionRoomAddress(nBiome, 'boss'));
    const boss = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'completion' }> =>
        node.kind === 'completion' && node.role === 'boss',
    );
    if (boss?.judgment === undefined)
      throw new Error('active Judgment completion control is missing');
    expect(workspace.interactions.bossCompletionArcana.has(semanticAddressKey(owner))).toBe(true);

    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(within(inspector).getByText('Judgment — choose 5 inactive Arcana cards')).toBeTruthy();
    const optionList = inspector.querySelector('.completion-judgment-options');
    if (optionList === null) throw new Error('Judgment options list is missing');
    expect(optionList.querySelectorAll(':scope > label')).toHaveLength(
      boss.judgment.inactiveArcanaKeys.length,
    );
    for (let index = 0; index < boss.judgment.requiredCount; index += 1) {
      const next = within(inspector)
        .getAllByRole<HTMLInputElement>('checkbox')
        .find((checkbox) => !checkbox.checked);
      if (next === undefined) throw new Error('Judgment picker has too few inactive cards');
      act(() => next.click());
    }
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')?.bossCompletionArcanaKeys,
    ).toHaveLength(5);

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(nBiome, nOccurrenceIds.opening)),
      ),
    );
    expect(within(inspector).queryByText('Judgment — choose 5 inactive Arcana cards')).toBeNull();
    act(() => screen.getByRole('button', { name: 'Open Boss completion' }).click());
    expect(within(inspector).getByText('Judgment — choose 5 inactive Arcana cards')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Open Boss completion' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('binds the reached Postboss keepsake selector through replacement and retention', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const owner = createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(nBiome, 'postboss'),
    );
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Keepsake' });
    fireEvent.focus(selector);
    await waitFor(() =>
      expect(
        selector.querySelector<HTMLOptionElement>('option[value="BossPreDamageKeepsake"]')?.dataset
          .candidateSupport,
      ).toBe('possible'),
    );
    fireEvent.change(selector, { target: { value: 'BossPreDamageKeepsake' } });
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')?.postbossKeepsakeDisposition,
    ).toEqual({ kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' });
    fireEvent.change(selector, { target: { value: '' } });
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')?.postbossKeepsakeDisposition,
    ).toEqual({ kind: 'retain' });
  });
});
