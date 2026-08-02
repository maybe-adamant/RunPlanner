// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildGroupAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  appendCompleteN,
  createRepresentativeNProject,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  renderHubDecisionWorkbench,
  renderStaticHubDecisionWorkbench,
  workspaceBiome,
} from '@planner-test/support/biome-workbench';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

function withRetainedHubBehindMissingLink(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== 'Surface'
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((biome) => {
                  if (biome.biomeKey !== 'N' || biome.topology === null) return biome;
                  const startOccurrenceId = biome.topology.startOccurrenceId;
                  return Object.freeze({
                    ...biome,
                    topology: Object.freeze({
                      ...biome.topology,
                      decisions: Object.freeze(
                        biome.topology.decisions.filter(
                          (decision) =>
                            !(
                              decision.kind === 'exit' &&
                              decision.source.kind === 'occurrence' &&
                              decision.source.occurrenceId === startOccurrenceId
                            ),
                        ),
                      ),
                    }),
                  });
                }),
              ),
            }),
      ),
    ),
  });
}

describe('HubDecisionWorkbench', () => {
  it('renders the declaration-owned board and complete visit timeline', () => {
    renderStaticHubDecisionWorkbench(createRepresentativeNOPQProject());

    expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Open Ephyra rooms' })).toBeTruthy();
    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26);
    expect(document.querySelectorAll('.hub-visit-row')).toHaveLength(6);
    expect(screen.getByText('Pylon visit order')).toBeTruthy();
  });

  it('partitions the authored board into compact open and closed presentation regions', () => {
    renderStaticHubDecisionWorkbench(createRepresentativeNOPQProject());

    const closedDisclosure = document.querySelector<HTMLDetailsElement>(
      '.hub-closed-room-disclosure',
    );
    expect(document.querySelectorAll('.hub-open-room-card')).toHaveLength(9);
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(17);
    expect(closedDisclosure?.open).toBe(false);
    expect(screen.getByText('9 open · 9–10 required')).toBeTruthy();
    expect(screen.getByText('6 of 6 planned')).toBeTruthy();
    expect(document.querySelector('.hub-slot-grid')).toBeNull();
    expect(screen.queryByText(/^Door \d/)).toBeNull();

    for (const card of document.querySelectorAll<HTMLElement>('.hub-open-room-card')) {
      expect(card.querySelector('.hub-main-reward')).not.toBeNull();
      expect(card.textContent).not.toContain('Evaluated');
    }
    for (const option of document.querySelectorAll<HTMLElement>('.hub-closed-room-option')) {
      expect(option.querySelector('.hub-main-reward')).toBeNull();
      expect(option.querySelector('.semantic-focus-link')).toBeNull();
      expect(option.textContent).not.toContain('This room is closed.');
    }
  });

  it('orders the authored board, visit plan, handoff, and closed rooms as one workspace', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-section-order',
        name: 'Hub section order',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    renderStaticHubDecisionWorkbench(project);
    const workbench = screen.getByRole('region', { name: 'Ephyra Hub' });

    expect(Array.from(workbench.children).map((element) => element.className)).toEqual([
      'hub-board',
      'hub-visit-timeline',
      'takeover-action',
      'hub-closed-room-disclosure',
    ]);
  });

  it('keeps the outline compact until the Hub is set up', () => {
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'hub-outline-presentation',
        name: 'Hub outline presentation',
        configuredBiomeCounts: { Surface: 1 },
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome: nBiome,
        occurrenceId: createOccurrenceId('hub-outline-opening'),
      },
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('hub-outline-opening'),
      }),
      occurrenceId: nOccurrenceIds.preHub,
    });
    renderStaticHubDecisionWorkbench(project);

    const disclosure = document.querySelector<HTMLDetailsElement>('.hub-outline-room-disclosure');
    expect(screen.getByText('Possible Hub rooms (26)')).toBeTruthy();
    expect(document.querySelectorAll('.hub-outline-room-option')).toHaveLength(26);
    expect(disclosure?.open).toBe(false);
    expect(document.querySelectorAll('.hub-visit-row')).toHaveLength(0);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Set up Hub rooms to plan six Pylon visits.')).toBeTruthy();
  });

  it('creates the board from its Hub frontier and keeps keyboard membership selection in its batch', async () => {
    const opening = createOccurrenceId('hub-workbench-opening');
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'hub-workbench-creation',
        name: 'Hub workbench creation',
        configuredBiomeCounts: { Surface: 1 },
      }),
      catalog,
      { kind: 'CreateStart', biome: nBiome, occurrenceId: opening },
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: opening,
      }),
      occurrenceId: nOccurrenceIds.preHub,
    });
    const view = renderHubDecisionWorkbench(project);
    const historyBeforeBoard =
      view.application.store.getState().projectWorkspace.history.past.length;

    const setUpHub = screen.getByRole('button', { name: 'Set up Hub rooms' });
    expect(setUpHub.classList.contains('primary-action')).toBe(true);
    await view.user.click(setUpHub);
    await waitFor(() => expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeBoard + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createHubDecisionAddress(nBiome, 'hub'),
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await screen.findByRole('button', { name: 'Set up Hub rooms' });
    await view.user.click(screen.getByRole('button', { name: 'Set up Hub rooms' }));
    await waitFor(() => expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26));
    const disclosure = document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure');
    const summary = disclosure?.querySelector<HTMLElement>('summary');
    if (summary === null || summary === undefined) {
      throw new Error('An empty authored Hub must render its closed-room disclosure.');
    }
    await view.user.click(summary);
    const firstClosed = screen.getByLabelText('Combat 01 open');
    act(() => firstClosed.focus());
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat01',
        ),
      ).toBe(true),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createHubDecisionAddress(nBiome, 'hub'),
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Combat 02 open'));
  });

  it('scopes a provisional opening identity to activation, cancellation, and projection replacement', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-opening-attempt-lifecycle',
        name: 'Hub opening attempt lifecycle',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const application = createApplication({
      allocateOccurrenceId: () => {
        const occurrenceId = createOccurrenceId(`hub-opening-attempt-${allocated.length + 1}`);
        allocated.push(occurrenceId);
        return occurrenceId;
      },
    });
    renderHubDecisionWorkbench(project, 'Surface', 'N', application);
    const opening = screen.getByRole('checkbox', { name: 'Combat 04 open' });

    expect(allocated).toEqual([]);
    act(() => opening.focus());
    expect(allocated).toEqual([]);
    fireEvent.pointerDown(opening);
    expect(allocated).toEqual([createOccurrenceId('hub-opening-attempt-1')]);
    expect(opening.closest('label')?.dataset.openingAttempt).toBe('active');
    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'RenameProject',
          name: 'Hub opening attempt replacement',
        }),
      ),
    );
    await waitFor(() => expect(opening.closest('label')?.dataset.openingAttempt).toBeUndefined());
    fireEvent.pointerDown(opening);
    expect(allocated).toEqual([
      createOccurrenceId('hub-opening-attempt-1'),
      createOccurrenceId('hub-opening-attempt-2'),
    ]);
    fireEvent.blur(opening);
    expect(opening.closest('label')?.dataset.openingAttempt).toBeUndefined();

    fireEvent.pointerDown(opening);
    expect(allocated).toEqual([
      createOccurrenceId('hub-opening-attempt-1'),
      createOccurrenceId('hub-opening-attempt-2'),
      createOccurrenceId('hub-opening-attempt-3'),
    ]);
    const historyBeforeOpen = application.store.getState().projectWorkspace.history.past.length;
    fireEvent.click(opening);
    await waitFor(() =>
      expect(nHubOccurrence(application, 'combat04').occurrenceId).toBe(
        createOccurrenceId('hub-opening-attempt-3'),
      ),
    );
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeOpen + 1,
    );
    expect(application.store.getState().editorSession.focusedSemanticOwner).toBeNull();

    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    const restored = await screen.findByRole('checkbox', { name: 'Combat 04 open' });
    expect((restored as HTMLInputElement).checked).toBe(false);
    fireEvent.pointerDown(restored);
    expect(allocated).toEqual([
      createOccurrenceId('hub-opening-attempt-1'),
      createOccurrenceId('hub-opening-attempt-2'),
      createOccurrenceId('hub-opening-attempt-3'),
      createOccurrenceId('hub-opening-attempt-4'),
    ]);
    fireEvent.blur(restored);
  });

  it('keeps keyboard opening in the closed-room batch at the maximum', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-keyboard-open-continuity',
        name: 'Hub keyboard open continuity',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const disclosure = document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure');
    const summary = disclosure?.querySelector<HTMLElement>('summary');
    if (
      disclosure === null ||
      disclosure === undefined ||
      summary === null ||
      summary === undefined
    ) {
      throw new Error('The authored Hub must render its closed-room disclosure.');
    }
    await view.user.click(summary);
    expect(disclosure.open).toBe(true);

    const opening = screen.getByRole('checkbox', { name: 'Combat 04 open' });
    act(() => opening.focus());
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(document.activeElement).toBe(summary);
    expect(document.activeElement).not.toBe(
      within(openedCard).getByRole('checkbox', { name: 'Combat 04 open' }),
    );
    expect(disclosure.open).toBe(true);
  });

  it('opens, edits, and closes an unvisited room through its compact card', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-compact-unvisited-room',
        name: 'Hub compact unvisited room',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const closedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    const open = within(closedCard).getByRole('checkbox', { name: 'Combat 04 open' });
    expect(closedCard.querySelector('[data-assessment]')).toBeNull();

    await view.user.pointer({ keys: '[MouseLeft]', target: open });
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    expect(within(openedCard).queryByText(/Closing this slot removes/)).toBeNull();
    expect(document.activeElement).not.toBe(
      within(openedCard).getByRole('checkbox', { name: 'Combat 04 open' }),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(screen.getByText('10 open · 9–10 required')).toBeTruthy();
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(16);
    const beforeReward = nHubOccurrence(view.application, 'combat04').state;
    await view.user.click(within(openedCard).getByLabelText('Reward'));
    const rewardTypes = within(
      await screen.findByRole('listbox', {}, { timeout: 5_000 }),
    ).getAllByRole('option');
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

    expect(
      within(openedCard).queryByRole('button', { name: 'Open details for Combat 04' }),
    ).toBeNull();

    const close = within(screen.getByRole('article', { name: 'Combat 04 Hub room' })).getByRole(
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
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure')?.open).toBe(
      false,
    );
    expect(
      screen.getByRole('group', { name: 'Open Ephyra rooms' }).contains(document.activeElement),
    ).toBe(true);
    expect(screen.getByText('9 open · 9–10 required')).toBeTruthy();
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(17);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );
  }, 10_000);

  it('only offers Room details for visit-active rooms with meaningful local detail', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-room-detail-boundary',
        name: 'Hub room detail boundary',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);

    const sideRoomCombat = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const miniboss = screen.getByRole('article', { name: 'Satyr Champion Hub room' });
    const unvisitedCombat = screen.getByRole('article', { name: 'Combat 10 Hub room' });
    const detail = within(sideRoomCombat).getByRole('button', {
      name: 'Open details for Combat 05',
    });

    expect(detail.closest('.hub-slot-meta')).not.toBeNull();
    expect(sideRoomCombat.querySelector('.hub-main-reward')?.nextElementSibling).not.toBe(detail);
    expect(unvisitedCombat.querySelector('.hub-slot-meta')).not.toBeNull();
    expect(within(miniboss).queryByRole('button', { name: /Open details/ })).toBeNull();
    expect(within(unvisitedCombat).queryByRole('button', { name: /Open details/ })).toBeNull();
    await view.user.click(detail);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, nHubOccurrence(view.application, 'combat05').occurrenceId),
    );
  });

  it('reveals the closed-room disclosure for exact closed-slot focus without authoring history', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-closed-focus-reveal',
        name: 'Hub closed focus reveal',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const disclosure = document.querySelector<HTMLDetailsElement>('.hub-closed-room-disclosure');
    if (disclosure === null) throw new Error('closed Hub rooms disclosure is missing');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    expect(disclosure.open).toBe(false);
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubSlotAddress(nBiome, 'hub', 'combat04')),
      ),
    );
    await waitFor(() => expect(disclosure.open).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );

    await view.user.click(within(disclosure).getByText('Closed rooms (17)'));
    expect(disclosure.open).toBe(false);
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({ kind: 'RenameProject', name: 'Hub native disclosure' }),
      ),
    );
    await waitFor(() =>
      expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
        historyBefore + 1,
      ),
    );
    expect(disclosure.open).toBe(false);
  });

  it('shows read-only visit reward context and marks the exact board card for reward focus', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-visit-reward-context',
        name: 'Hub visit reward context',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const firstVisit = document.querySelectorAll<HTMLElement>('.hub-visit-row')[0];
    const combatCard = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const rewardOwner = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));
    if (firstVisit === undefined) throw new Error('first Hub visit row is missing');

    expect(within(firstVisit).getByText(/^Reward:/)).toBeTruthy();
    expect(firstVisit.querySelector('.reward-value-editor')).toBeNull();
    expect(combatCard.dataset.focusedMainReward).toBeUndefined();

    act(() => view.application.store.dispatch(semanticOwnerFocused(rewardOwner)));

    expect(combatCard.dataset.focusedMainReward).toBe('true');
    expect(
      combatCard.querySelector('.hub-main-reward')?.getAttribute('data-hub-main-reward-owner'),
    ).toBe(semanticAddressKey(rewardOwner));
    expect(document.activeElement).toBe(within(combatCard).getByRole('button', { name: 'Reward' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps each visit summary synchronized with its board-owned reward', async () => {
    const view = renderHubDecisionWorkbench(createRepresentativeNOPQProject());
    const combatCard = screen.getByRole('article', { name: 'Combat 02 Hub room' });
    const visitAt = (visitIndex: number): HTMLElement => {
      const visit = document.querySelectorAll<HTMLElement>('.hub-visit-row')[visitIndex - 1];
      if (visit === undefined) throw new Error(`Hub visit ${visitIndex} row is missing`);
      return visit;
    };
    const summaryBefore = visitAt(3).querySelector('.hub-visit-reward')?.textContent;
    if (summaryBefore === undefined) throw new Error('Combat 02 has no visit reward summary');

    await view.user.click(within(combatCard).getByRole('button', { name: 'Reward' }));
    const rewardTypes = within(await screen.findByRole('listbox')).getAllByRole('option');
    const replacementType = rewardTypes.find(
      (option) =>
        option.getAttribute('aria-disabled') !== 'true' &&
        option.getAttribute('data-selected-value') !== 'true',
    );
    if (replacementType === undefined) {
      throw new Error('Combat 02 has no editable alternative reward type');
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
        throw new Error('Combat 02 has no editable alternative Boon source');
      }
      await view.user.click(replacementSource);
    }

    await waitFor(() =>
      expect(visitAt(3).querySelector('.hub-visit-reward')?.textContent).not.toBe(summaryBefore),
    );
    expect(visitAt(3).querySelector('.reward-value-editor')).toBeNull();
  });

  it('shows a fixed Story visit summary without a second reward editor', () => {
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
    renderStaticHubDecisionWorkbench(project);
    const storyVisit = document.querySelectorAll<HTMLElement>('.hub-visit-row')[0];
    if (storyVisit === undefined) throw new Error('Story Hub visit row is missing');

    expect(within(storyVisit).getByText('Reward: Story')).toBeTruthy();
    expect(storyVisit.querySelector('.reward-value-editor')).toBeNull();
    expect(within(storyVisit).queryByRole('button', { name: 'Reward' })).toBeNull();
  });

  it('appends, replaces, and removes visits through semantic Hub commands', async () => {
    let project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-visit-commands',
        name: 'Hub visit commands',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: ['combat05', 'miniBoss01'] },
    );
    project = applyProjectCommand(project, catalog, {
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor1', 'sideDoor2'],
      kind: 'ReplaceSideRoomEntryOrder',
    });
    const view = renderHubDecisionWorkbench(project);
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    const focusBefore = view.application.store.getState().editorSession.focusedSemanticOwner;
    const originalVisitOrder = [...nHubState(view.application).decision.visitOrder];
    const preservedSideOrder = orderedNHubSideEntries(view.application, 'combat05');
    expect(preservedSideOrder).toEqual(['sideDoor1', 'sideDoor2']);
    const hubVisitControl = (visitIndex: number): HTMLSelectElement => {
      const row = document.querySelectorAll<HTMLElement>('.hub-visit-row')[visitIndex - 1];
      if (row === undefined) throw new Error(`N Hub visit ${visitIndex} row is missing`);
      return within(row).getByRole('combobox') as HTMLSelectElement;
    };
    const chooseAvailableVisit = async (
      control: HTMLSelectElement,
      excludedSlotKeys: readonly string[],
    ): Promise<string> => {
      await view.user.click(control);
      await waitFor(() =>
        expect(
          Array.from(control.options).some(
            (option) =>
              option.value !== control.value &&
              !excludedSlotKeys.includes(option.value) &&
              !option.disabled &&
              option.dataset.candidateSupport !== 'unavailable',
          ),
        ).toBe(true),
      );
      const choice = Array.from(control.options).find(
        (option) =>
          option.value !== control.value &&
          !excludedSlotKeys.includes(option.value) &&
          !option.disabled &&
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
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      focusBefore,
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
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 2,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      focusBefore,
    );

    const confirmation = vi.spyOn(globalThis, 'confirm');
    await view.user.click(screen.getByRole('button', { name: 'Remove visits from Visit 2' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(['combat05']),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 3,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      focusBefore,
    );
    expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual(preservedSideOrder);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(nHubState(view.application).decision.visitOrder).toEqual([
      'combat05',
      replacement,
      appended,
    ]);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(nHubState(view.application).decision.visitOrder).toEqual(originalVisitOrder);
  });

  it('removes the completed-Hub handoff when a visit is truncated', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-handoff-truncation',
        name: 'Hub handoff truncation',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);

    const confirmation = vi.spyOn(globalThis, 'confirm');
    const removal = screen.getByRole('button', { name: 'Remove visits from Visit 6' });
    expect(removal.classList.contains('danger-action')).toBe(true);
    expect(removal.classList.contains('action-compact')).toBe(true);
    await view.user.click(removal);
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toHaveLength(5));
    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
  });

  it('creates and undoes the completed-Hub handoff through its bound intent', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-completed-handoff',
        name: 'Hub completed handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const view = renderHubDecisionWorkbench(project);
    const handoff = document.querySelector<HTMLElement>(
      '[data-presentation="completedHubHandoff"]',
    );
    if (handoff === null) throw new Error('completed Hub handoff control is missing');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(within(handoff).getByRole('button'));
    const owner = createExitDecisionAddress(nBiome, {
      decisionKey: 'hub',
      kind: 'hubDecision',
    });
    await waitFor(() =>
      expect(
        nHubState(view.application).topology.decisions.some(
          (decision) =>
            decision.kind === 'exit' &&
            decision.source.kind === 'hubDecision' &&
            decision.source.decisionKey === 'hub',
        ),
      ).toBe(true),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
  });

  it('keeps the board and exact next visit visible at an invalid local boundary', async () => {
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 4),
    });
    const view = renderHubDecisionWorkbench(project);

    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26);
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const invalidRewardMarker = screen
      .getByRole('article', { name: 'Combat 10 Hub room' })
      .querySelector<HTMLElement>(
        `[data-semantic-owner='${semanticAddressKey(
          createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
        )}']`,
      );
    expect(invalidRewardMarker?.dataset.hasFindings).toBe('true');
    expect(
      document.querySelector(".hub-closed-room-option [data-assessment='unassessed']"),
    ).not.toBeNull();
    const rows = document.querySelectorAll<HTMLElement>('.hub-visit-row');
    expect(rows).toHaveLength(6);
    expect(rows[3]?.dataset.authoring).toBe('next');
    expect(
      Array.from(document.querySelectorAll<HTMLElement>('.hub-owner-assessment'))
        .filter((element) => element.closest('.hub-visit-row') !== null)
        .slice(0, 3)
        .map((element) => element.dataset.assessment),
    ).toEqual(['unassessed', 'unassessed', 'unassessed']);
    const visitControl = within(rows[3]!).getByRole('combobox', {
      name: /^Visit 4 room/,
    }) as HTMLSelectElement;
    await view.user.click(visitControl);
    await waitFor(() => expect(visitControl.dataset.candidateSupport).toBe('unavailable'));
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

  it('keeps authored room details available when evaluation has not reached the retained Hub', () => {
    const view = renderHubDecisionWorkbench(
      withRetainedHubBehindMissingLink(createRepresentativeNOPQProject()),
    );
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const laterVisit = hub.slots.find((slot) => slot.hubSlotKey === 'combat02');
    if (laterVisit?.room === undefined) throw new Error('Combat 02 Hub room is missing');

    expect(laterVisit.visited).toBe(true);
    expect(laterVisit.room.detailsActive).toBe(true);
    expect(laterVisit.room.entered).toBe(false);
    expect(
      within(screen.getByRole('article', { name: 'Combat 02 Hub room' })).getByRole('button', {
        name: 'Open details for Combat 02',
      }),
    ).toBeTruthy();
  });
});
