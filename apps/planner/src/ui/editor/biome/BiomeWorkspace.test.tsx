// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import type { WorkspaceBiome, WorkspaceNode } from '@planner/projections/structured-workspace';
import { findingSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@run-planner/test-fixtures';
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

function inactiveOccurrenceDetails(node: WorkspaceNode): WorkspaceNode {
  if (node.kind !== 'occurrenceWorkbench') return node;
  return { ...node, room: { ...node.room, detailsActive: false } };
}

function withoutWorkspaceEntry({ entry, ...biome }: WorkspaceBiome): Omit<WorkspaceBiome, 'entry'> {
  void entry;
  return biome;
}

describe('BiomeWorkspace', () => {
  it('keeps the fixed N start room in the rail next step', () => {
    renderWorkspace(emptyProject('Surface', 1), 'Surface', 'N');

    const start = screen.getByRole('button', { name: /Start with Opening/ });
    expect(start.textContent).toContain('Next step');
    expect(start.textContent).not.toContain('Choose the first room');
  });

  it('uses one concise player-facing name for the Hub rail stop', () => {
    renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');

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
    renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');

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

  it('renders Ephyra primary rewards on fixed stages and authored Hub visits', () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    const biome = workspaceBiome(view.application, 'Surface', 'N');
    const opening = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        entry.node.kind === 'occurrenceWorkbench' &&
        entry.node.room.gameName === 'N_Opening01',
    );
    const preHub = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        entry.node.kind === 'occurrenceWorkbench' &&
        entry.node.room.gameName === 'N_PreHub01',
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
      preHub?.kind !== 'node' ||
      preHub.node.kind !== 'occurrenceWorkbench' ||
      preHub.mainReward === undefined ||
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
      railButtonForMarker(view.container, preHub.marker.focusKey).querySelector(
        '.biome-rail-selection',
      )?.textContent,
    ).toContain(preHub.mainReward.label);
    expect(
      railButtonForMarker(view.container, firstVisit.marker.focusKey).querySelector(
        '.biome-rail-selection',
      )?.textContent,
    ).toContain(firstVisit.mainReward.label);
  });

  it('routes a keyboard-selected Hub rail visit to its occurrence-owned local detail workbench', async () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    const boardCard = screen.getByRole('article', { name: 'Combat 02 Hub room' });
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
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(within(inspector).getAllByRole('button', { name: 'Reward' })).toHaveLength(2);
  });

  it('returns from local Hub reward context to the exact closed board picker without authoring', async () => {
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    await view.user.click(screen.getByRole('button', { name: /Visit 3 · Combat 02/ }));

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const context = within(inspector).getByRole('region', { name: 'Hub reward' });
    expect(within(context).getByText('Big Max Magick')).toBeTruthy();
    const edit = within(context).getByRole('button', { name: 'Edit Hub reward' });
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(edit);

    const rewardOwner = createIncomingRewardAddress(nBiome, nOccurrenceId('combat02'));
    await waitFor(() => {
      const card = screen.getByRole('article', { name: 'Combat 02 Hub room' });
      const trigger = within(card).getByRole('button', { name: 'Reward' });
      expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
        rewardOwner,
      );
      expect(card.dataset.focusedMainReward).toBe('true');
      expect(document.activeElement).toBe(trigger);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
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

  it('renders ordinary rails in semantic decision order and defaults to a decision inspector', () => {
    const underworld = createGoldenFGHIProject();
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
      expect(screen.getByRole('region', { name: /route structure$/ })).toBeTruthy();
      expect(screen.queryByText(projected.source)).toBeNull();
      expect(railMarkerKeys(view.container)).toEqual(
        projected.rail.map((entry) => entry.marker.focusKey),
      );
      const inspector = screen.getByRole('complementary', { name: 'Details' });
      expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
      expect(inspector.querySelector('.biome-occurrence-workbench')).toBeNull();
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

  it('keeps semantic focus after an inspector reward edit and updates direct rail context', async () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
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
    const railDecision = railButtonForMarker(view.container, semanticAddressKey(owner));
    await view.user.click(railDecision);

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const selected = within(inspector)
      .getAllByRole('radio')
      .find((radio) => (radio as HTMLInputElement).checked);
    const offer = selected?.closest<HTMLElement>('.biome-target-row');
    if (offer === null || offer === undefined) throw new Error('P selected room offer is missing');
    const before = railDecision.querySelector<HTMLElement>('.biome-rail-selection');
    if (before === null) throw new Error('P selected room rail context is missing');
    const beforeText = before.textContent;
    await view.user.click(within(offer).getByRole('button', { name: 'Reward' }));
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
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
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

  it('authors and enters the next generated decision from its predecessor', async () => {
    const occurrenceId = createOccurrenceId('direct-next-decision-f-start');
    const source = { kind: 'occurrence' as const, occurrenceId };
    const owner = createExitDecisionAddress(goldenFBiome, source);
    const project = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId,
    });
    const view = renderWorkspace(project, 'Underworld', 'F');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, occurrenceId)),
      ),
    );
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-occurrence-workbench')).not.toBeNull();
    expect(within(inspector).queryByText('Continue from this room')).toBeNull();
    const continuation = within(inspector).getByRole('button', { name: 'Add next decision' });
    expect(continuation.classList.contains('primary-action')).toBe(true);
    expect(continuation.closest('.workbench-action-row')).not.toBeNull();
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(continuation);

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
    expect(authoredDecision.normal).toMatchObject({ kind: 'batch', targets: [] });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    expect(screen.queryByText('Continue from this room')).toBeNull();

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, occurrenceId)),
      ),
    );
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add next decision' })).toBeNull();
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
    nApplication.store.dispatch(authoredProjectReplaced(createRepresentativeNOPQProject()));
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
        name: 'Open Ephyra rooms',
      }),
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
    const view = renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N');
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
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
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
    expect(within(inspector).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
  });

  it('focuses retained downstream room rewards inside their decision workbench', () => {
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
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
    expect(
      within(inspector).getAllByRole('article', { name: `${target.room.label} room offer` }),
    ).not.toHaveLength(0);
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

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const workbench = inspector.querySelector<HTMLElement>('.biome-batch-workbench');
    if (workbench === null) throw new Error('P Story decision inspector is missing');
    const offer = within(workbench).getByRole('article', {
      name: `${story.room.label} room offer`,
    });
    expect(within(offer).getByText(/^Fixed reward:/)).toBeTruthy();
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
      .projectWorkspace.assembly.evaluation.findings.find(
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
    const inspector = screen.getByRole('complementary', { name: 'Details' });
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
      within(beforeInspector).getByRole('heading', { level: 3, name: 'Entrance' }),
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
});
