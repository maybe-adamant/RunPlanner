// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import { authorLegalTraitOffers, hubVisitActions } from '@run-planner/test-fixtures/shared';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
  createStartingRewardAddress,
  decodeProjectDocument,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { presentFinding, semanticFindingKey } from '@planner/projections/evaluationProjection';
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
  loadSurfaceNProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
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
import { BiomeWorkspace } from '@planner/ui/editor/biome/BiomeWorkspace';
import {
  renderWorkspace,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import { expectBefore } from '@planner-test/support/occurrence-workbench';

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
    routeKey,
    configuredBiomeCount: count,
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
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Underworld'),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
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
  for (const occurrenceId of [combat]) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, occurrenceId),
      value: { rewardType: 'MaxHealthDrop' },
    });
  }
  return { owner, project: authorLegalTraitOffers(project), start };
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
  it.each([
    { entry: 'Pre-Hub', persistence: 'authored' },
    { entry: 'Pre-Hub', persistence: 'uncommitted' },
    { entry: 'Chaos', persistence: 'authored' },
    { entry: 'Chaos', persistence: 'uncommitted' },
  ])(
    'repairs the $persistence $entry continuation finding through Room Doors to the Hub',
    async ({ entry, persistence }) => {
      const occurrenceId =
        entry === 'Chaos' ? createOccurrenceId('biome-workspace-hub-chaos') : nOccurrenceIds.preHub;
      const owner = createExitDecisionAddress(nBiome, { kind: 'occurrence', occurrenceId });
      let project = applyProjectCommand(loadSurfaceNEntryFrontierResolvedProject(), catalog, {
        kind: 'RemoveExitDecision',
        decision: createExitDecisionAddress(nBiome, {
          kind: 'occurrence',
          occurrenceId: nOccurrenceIds.preHub,
        }),
      });
      if (entry === 'Chaos') {
        project = applyProjectCommand(project, catalog, {
          kind: 'AddChaos',
          additional: createAdditionalExitAddress(nBiome, nOccurrenceIds.opening, 'chaos'),
          occurrenceId,
        });
        project = applyProjectCommand(project, catalog, {
          kind: 'SetExitSelection',
          selection: createExitSelectionAddress(nBiome, {
            kind: 'occurrence',
            occurrenceId: nOccurrenceIds.opening,
          }),
          value: { kind: 'additional', additionalExitKey: 'chaos' },
        });
        project = authorLegalTraitOffers(project);
      }
      if (persistence === 'authored') {
        project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: owner });
      }
      const view = renderWorkspace(project, 'Surface', 'N');
      const finding = view.application.store
        .getState()
        .projectWorkspace.assembly!.evaluation.findings.find(
          (candidate) =>
            candidate.code === 'continuationMissing' &&
            semanticAddressKey(candidate.origin) === semanticAddressKey(owner),
        );
      if (finding === undefined) throw new Error('Hub continuation finding is missing');
      act(() =>
        view.application.store.dispatch(
          semanticOwnerFocused(createOccurrenceAddress(nBiome, occurrenceId)),
        ),
      );
      await view.user.click(screen.getByRole('tab', { name: 'Room Overview' }));
      act(() =>
        view.application.store.dispatch(
          findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
        ),
      );
      expect(screen.getByRole('tab', { name: 'Room Doors' }).getAttribute('aria-selected')).toBe(
        'true',
      );
      const room = screen.getByRole('button', { name: 'Door 1 room' });
      expect(room.hasAttribute('inert')).toBe(false);
      expect(room.getAttribute('aria-disabled')).not.toBe('true');
      await view.user.click(room);
      const hub = within(screen.getByRole('listbox')).getByRole('option', { name: /Ephyra Hub/ });
      expect(hub.getAttribute('aria-disabled')).not.toBe('true');
      await view.user.click(hub);
      expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
    },
  );

  it('uses the finding origin for its complete destination instead of redirected focus metadata', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const projection = workspaceProjection(application);
    const biome = projection.route.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (biome === undefined) throw new Error('F workspace is missing');
    const redirected = [...projection.focusByOwner.values()].find(
      (destination) =>
        destination.roomTab === 'actions' &&
        semanticAddressKey(destination.ownerAddress) !==
          semanticAddressKey(destination.focusAddress),
    );
    if (redirected === undefined)
      throw new Error('a redirected Room Timeline destination is missing');
    const focusedDestination = projection.focusByOwner.get(
      semanticAddressKey(redirected.focusAddress),
    );
    if (focusedDestination === undefined)
      throw new Error('redirected focus destination is missing');
    const focusByOwner = new Map(projection.focusByOwner);
    focusByOwner.set(
      semanticAddressKey(redirected.focusAddress),
      Object.freeze({ ...focusedDestination, roomTab: 'overview' as const }),
    );
    const view = render(
      <Provider store={application.store}>
        <BiomeWorkspace
          biome={biome}
          focusByOwner={focusByOwner}
          interactions={projection.interactions}
          runStateLaunchers={projection.runStateLaunchers}
        />
      </Provider>,
    );
    const selection = {
      focusAddress: redirected.focusAddress,
      key: 'redirected-finding',
      origin: redirected.ownerAddress,
      traitDialogTarget: redirected.traitDialogTarget ?? null,
      levelResolutionDialogTarget: redirected.levelResolutionDialogTarget ?? null,
    } as const;

    act(() => application.store.dispatch(findingSelected(selection)));
    expect(screen.getByRole('tab', { name: 'Room Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(selectedRailMarkerKeys(view.container)).toEqual(
      redirected.selectedRailKey === undefined ? [] : [redirected.selectedRailKey],
    );

    return view.unmount();
  });

  it('reapplies a repeated finding tab request after the user changes tabs', async () => {
    const view = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    const projection = workspaceProjection(view.application);
    const destination = [...projection.focusByOwner.values()].find(
      (candidate) => candidate.roomTab === 'actions',
    );
    if (destination === undefined) throw new Error('a Room Timeline destination is missing');
    const selection = {
      focusAddress: destination.focusAddress,
      key: 'repeat-finding',
      origin: destination.ownerAddress,
      traitDialogTarget: destination.traitDialogTarget ?? null,
      levelResolutionDialogTarget: destination.levelResolutionDialogTarget ?? null,
    } as const;

    act(() => view.application.store.dispatch(findingSelected(selection)));
    expect(screen.getByRole('tab', { name: 'Room Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    await view.user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    act(() => view.application.store.dispatch(findingSelected(selection)));
    expect(screen.getByRole('tab', { name: 'Room Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('reapplies a repeated finding Hub tab request', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const projection = workspaceProjection(view.application);
    const destination = [...projection.focusByOwner.values()].find(
      (candidate) => candidate.hubTab === 'timeline',
    );
    if (destination === undefined) throw new Error('a Hub Timeline destination is missing');
    const selection = {
      focusAddress: destination.focusAddress,
      key: 'repeat-hub-finding',
      origin: destination.ownerAddress,
      traitDialogTarget: destination.traitDialogTarget ?? null,
      levelResolutionDialogTarget: destination.levelResolutionDialogTarget ?? null,
    } as const;

    act(() => view.application.store.dispatch(findingSelected(selection)));
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    await view.user.click(screen.getByRole('tab', { name: 'Hub Overview' }));
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    act(() => view.application.store.dispatch(findingSelected(selection)));
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('binds an incomplete Hub visit finding to its next Timeline count and repairs it from the map', async () => {
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceHubActionOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      actions: hubVisitActions(['combat05', 'miniBoss01']),
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    const findingForNextVisit = () => {
      const finding = view.application.store
        .getState()
        .projectWorkspace.assembly!.evaluation.findings.find(
          (candidate) => candidate.code === 'hubVisitOrderIncomplete',
        );
      if (finding === undefined) throw new Error('incomplete Hub visit finding is missing');
      return finding;
    };
    const initialFinding = findingForNextVisit();
    expect(semanticAddressKey(initialFinding.origin)).toBe(
      semanticAddressKey(createHubVisitAddress(nBiome, 'hub', 3)),
    );

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(initialFinding), origin: initialFinding.origin }),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const count = screen.getByText('2 of 6 planned');
    expect(count.getAttribute('data-semantic-owner')).toBe(
      semanticAddressKey(createHubVisitAddress(nBiome, 'hub', 3)),
    );
    expect(count.getAttribute('data-selected-finding')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(count));
    await view.user.click(screen.getByRole('button', { name: 'Combat 01: Unvisited. Add visit.' }));
    await waitFor(() => expect(screen.getByText('3 of 6 planned')).toBeTruthy());

    const repeatedFinding = findingForNextVisit();
    act(() =>
      view.application.store.dispatch(
        findingSelected({
          key: semanticFindingKey(repeatedFinding),
          origin: repeatedFinding.origin,
        }),
      ),
    );
    const nextCount = screen.getByText('3 of 6 planned');
    expect(nextCount.getAttribute('data-semantic-owner')).toBe(
      semanticAddressKey(createHubVisitAddress(nBiome, 'hub', 4)),
    );
    await waitFor(() => expect(document.activeElement).toBe(nextCount));
  });

  it('routes the combined Hub action finding to the Timeline fountain and repairs it there', async () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceHubActionOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      actions: hubVisitActions(nVisitSlotKeys, null),
    });
    const fountain = createHubFountainAddress(nBiome, 'hub');
    const view = renderWorkspace(project, 'Surface', 'N');
    const finding = view.application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) => candidate.code === 'hubVisitOrderIncomplete',
      );
    if (finding === undefined) throw new Error('combined Hub action finding is missing');
    expect(finding.origin).toEqual(fountain);
    expect(presentFinding(finding).title).toBe('Plan six room visits and use the fountain');

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const marker = screen.getByRole('button', { name: 'Hub fountain: Unused. Use fountain.' });
    expect(marker.getAttribute('data-semantic-owner')).toBe(semanticAddressKey(fountain));
    expect(marker.getAttribute('data-selected-finding')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(marker));
    await view.user.click(marker);
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.assembly!.evaluation.findings.some(
            (candidate) => candidate.code === 'hubVisitOrderIncomplete',
          ),
      ).toBe(false),
    );
  });

  it.each([
    ['before the next room', nVisitSlotKeys, 'Combat 11'],
    ['in the Hub before that room exists', nVisitSlotKeys.slice(0, 3), undefined],
  ] as const)(
    'routes a missing Phial target to the Hub fountain controls %s',
    async (_case, visits, hostLabel) => {
      const withPhial = applyProjectCommand(loadSurfaceNProject(), catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Surface'),
        keepsakeKey: 'FountainRarityKeepsake',
      });
      const project = applyProjectCommand(withPhial, catalog, {
        kind: 'ReplaceHubActionOrder',
        hub: createHubDecisionAddress(nBiome, 'hub'),
        actions: hubVisitActions(visits, 3),
      });
      const outcome = createFountainRarityOutcomeAddress(createHubFountainAddress(nBiome, 'hub'));
      const view = renderWorkspace(project, 'Surface', 'N');
      const finding = view.application.store
        .getState()
        .projectWorkspace.assembly!.evaluation.findings.find(
          (candidate) => candidate.code === 'fountainRarityResultMissing',
        );
      if (finding === undefined) throw new Error('missing Phial target finding is absent');
      expect(finding.origin).toEqual(outcome);

      act(() =>
        view.application.store.dispatch(
          findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
        ),
      );
      const controls = await screen.findByRole('region', { name: 'Hub fountain' });
      const target = Array.from(
        document.querySelectorAll<HTMLElement>('[data-semantic-owner]'),
      ).find(
        (element) => element.getAttribute('data-semantic-owner') === semanticAddressKey(outcome),
      );
      if (target === undefined) throw new Error('Phial outcome target is not rendered');
      expect(controls.contains(target)).toBe(true);
      expect(target.getAttribute('data-selected-finding')).toBe('true');
      expect(target.closest('[inert]')).toBeNull();
      if (hostLabel === undefined) {
        // The Hub Timeline keeps the actionable Hub-owned destination.
        expect(
          screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected'),
        ).toBe('true');
        expect(
          within(controls).getByText('Used in the Hub after the planned visits.'),
        ).toBeTruthy();
        return;
      }
      expect(within(controls).getByText(`Used in the Hub before ${hostLabel}.`)).toBeTruthy();
      expect(controls.nextElementSibling?.querySelector('h3')?.textContent).toBe(hostLabel);
      await view.user.click(
        await screen.findByText(catalog.traits.byKey['HermesWeaponBoon']?.label ?? ''),
      );
      await waitFor(() =>
        expect(
          view.application.store
            .getState()
            .projectWorkspace.assembly!.evaluation.findings.some(
              (candidate) => candidate.code === 'fountainRarityResultMissing',
            ),
        ).toBe(false),
      );
    },
  );

  it('moves the fountain on Hub Timeline and opens its read-only timing in the next room', async () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceHubActionOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      actions: hubVisitActions(nVisitSlotKeys, 3),
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubVisitAddress(nBiome, 'hub', 1)),
      ),
    );
    const controls = await screen.findByRole('region', { name: 'Fountain order' });
    const current = within(controls).getByRole('button', { name: 'After visit 3' });
    act(() => current.focus());
    expect(current.getAttribute('aria-pressed')).toBe('true');

    await view.user.tab({ shift: true });
    expect(document.activeElement?.textContent).toBe('After visit 2');
    await view.user.keyboard('{Enter}');
    const hub = () => {
      const plan = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'N');
      const decision = plan?.topology?.decisions.find((candidate) => candidate.kind === 'hub');
      if (decision?.kind !== 'hub') throw new Error('N Hub is missing');
      return decision;
    };
    await waitFor(() => expect(hub().actions).toEqual(hubVisitActions(nVisitSlotKeys, 2)));
    const moved = await screen.findByRole('region', { name: 'Fountain order' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(moved).getByRole('button', { name: 'After visit 2' }),
      ),
    );
    await view.user.click(screen.getByRole('button', { name: 'Hub fountain: Step 3.' }));
    const hosted = await screen.findByRole('region', { name: 'Hub fountain' });
    expect(within(hosted).getByText('Used in the Hub before Combat 02.')).toBeTruthy();
    expect(within(hosted).queryByRole('group', { name: 'Fountain use' })).toBeNull();
  });

  it('returns an Overview finding from Map to its canonical List presentation', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const projection = workspaceProjection(view.application);
    const destination = [...projection.focusByOwner.values()].find(
      (candidate) => candidate.hubTab === 'overview',
    );
    if (destination === undefined) throw new Error('a Hub Overview destination is missing');
    const selection = {
      focusAddress: destination.focusAddress,
      key: 'hub-overview-finding',
      origin: destination.ownerAddress,
      traitDialogTarget: destination.traitDialogTarget ?? null,
      levelResolutionDialogTarget: destination.levelResolutionDialogTarget ?? null,
    } as const;

    act(() => view.application.store.dispatch(findingSelected(selection)));
    expect(screen.getByRole('group', { name: 'Hub room set' })).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Back to Map' }));
    expect(screen.getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();

    act(() => view.application.store.dispatch(findingSelected(selection)));
    expect(screen.getByRole('group', { name: 'Hub room set' })).toBeTruthy();
  });
  it('opens an available Run State sheet without changing inspector selection or authored history, and restores launcher focus on close', async () => {
    const evaluationEvents: string[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => evaluationEvents.push(event.kind),
    });
    const { user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F', application);
    const launcher = screen.getAllByRole('button', { name: 'Run State' })[0];
    if (launcher === undefined) throw new Error('available Run State launcher is missing');
    const beforeHistory = application.store.getState().projectWorkspace.history!;
    const beforeFocus = application.store.getState().editorSession.focusedSemanticOwner;
    const beforePanel = application.store.getState().editorSession.activePanel;
    const beforeEvaluationEvents = [...evaluationEvents];

    await user.click(launcher);
    const sheet = screen.getByRole('region', { name: /State before/ });
    expect(within(sheet).getByRole('heading', { name: 'Run State', level: 2 })).toBeTruthy();
    expect(
      within(sheet)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Overview', 'Arcana', 'Fear', 'Hex', 'More Info']);
    expect(within(sheet).getByRole('tabpanel', { name: 'Overview' })).toBeTruthy();
    const keepsakeHeading = within(sheet).getByRole('heading', { name: 'Keepsake' });
    expect(keepsakeHeading.closest('details')).toBeNull();
    expect(within(sheet).getByText('1st Biome').nextElementSibling?.textContent).toContain(
      'Silver Wheel',
    );
    expect(within(sheet).queryByRole('heading', { name: 'More Info' })).toBeNull();
    await user.click(within(sheet).getByRole('tab', { name: 'Hex' }));
    expect(within(sheet).queryByRole('heading', { name: 'Equipped traits' })).toBeNull();
    expect(within(sheet).getByRole('tabpanel', { name: 'Hex' })).toBeTruthy();
    expect(within(sheet).getByText('Hex', { selector: 'dt' }).nextElementSibling?.textContent).toBe(
      'None',
    );
    expect(within(sheet).getByRole('heading', { name: 'Path points' })).toBeTruthy();
    expect(
      within(sheet).getByText('God Sent', { selector: 'dt' }).nextElementSibling?.textContent,
    ).toBe('No Hex');
    expect(
      within(sheet).getByText('Path of Stars', { selector: 'dt' }).nextElementSibling?.textContent,
    ).toBe('Ineligible — no Hex');
    expect(within(sheet).getByText('Banked', { selector: 'dt' })).toBeTruthy();
    await user.keyboard('{Home}{ArrowRight}');
    expect(within(sheet).getByRole('tabpanel', { name: 'Arcana' })).toBeTruthy();
    expect(within(sheet).getByRole('heading', { name: 'Arcana' })).toBeTruthy();
    await user.keyboard('{ArrowRight}');
    expect(within(sheet).getByRole('tabpanel', { name: 'Fear' })).toBeTruthy();
    expect(within(sheet).getByText('Vow of Forfeit', { selector: 'dt' })).toBeTruthy();
    expect(
      within(sheet).getByRole('heading', { name: 'Banned traits' }).nextElementSibling?.textContent,
    ).toBe('None');
    await user.keyboard('{End}{ArrowRight}');
    expect(within(sheet).getByRole('tabpanel', { name: 'Overview' })).toBeTruthy();
    expect(document.activeElement).toBe(within(sheet).getByRole('tab', { name: 'Overview' }));
    const godHeading = within(sheet).getByRole('heading', { name: 'Gods in pool' });
    const godSection = godHeading.closest('section');
    if (godSection === null) throw new Error('Gods in pool section is missing');
    expect(godSection.textContent).toContain('Apollo');
    expect(godSection.textContent).not.toContain('ApolloUpgrade');
    expect(within(sheet).getByRole('heading', { name: 'Elements' })).toBeTruthy();
    const traitHeading = within(sheet).getByRole('heading', { name: 'Equipped traits' });
    const traitSection = traitHeading.closest('section');
    if (traitSection === null) throw new Error('Equipped traits section is missing');
    for (const [name, level] of [
      ['Nova Strike', 2],
      ['Heaven Flourish', 1],
      ['Engagement Ring', 1],
    ] as const) {
      const trait = within(traitSection).getByText(name).parentElement!;
      expect(within(trait).getByText('Common')).toBeTruthy();
      expect(within(trait).getByText(`Lv. ${level}`)).toBeTruthy();
    }
    expect(within(traitSection).getByRole('heading', { name: 'All other traits' })).toBeTruthy();
    expect(
      within(within(traitSection).getByText('Wicked Thrasher').parentElement!).getByText('Rank I'),
    ).toBeTruthy();
    expect(within(traitSection).getByText('Sprint:').nextElementSibling?.textContent).toBe('None');
    expect(within(traitSection).getByText('Magick:').nextElementSibling?.textContent).toBe('None');
    expect(within(traitSection).getByText('Hex:').nextElementSibling?.textContent).toBe('None');
    expect(within(sheet).queryByRole('heading', { name: 'Banned traits' })).toBeNull();
    expect(traitSection.textContent).not.toContain('ApolloWeaponBoon');
    expect(traitSection.textContent).not.toContain('WeaponUpgrade');
    await user.click(within(sheet).getByRole('tab', { name: 'More Info' }));
    expect(within(sheet).getByRole('tabpanel', { name: 'More Info' })).toBeTruthy();
    expect(within(sheet).getByRole('heading', { name: 'Counters' }).closest('details')).toBeNull();
    expect(within(sheet).getByText('biomeDepthCache')).toBeTruthy();
    expect(
      within(sheet).getByRole('heading', { name: 'Reward Bags' }).closest('details'),
    ).toBeNull();
    const bag = within(sheet).getByRole('heading', { name: 'Major Reward' }).closest('article')!;
    expect(bag.closest('details')).toBeNull();
    expect(within(bag).getByText('RunProgress')).toBeTruthy();
    expect(within(bag).getByText('Remaining').nextElementSibling?.textContent).toBe('x3');
    expect(
      within(bag).getByText('Eligible', { selector: 'dt' }).nextElementSibling?.textContent,
    ).toBe('x0');
    expect(
      within(bag).getByText('Ineligible', { selector: 'dt' }).nextElementSibling?.textContent,
    ).toBe('x3');
    const entry = within(bag).getByText('Max Health', { selector: 'summary' });
    expect(entry.closest('details')?.open).toBe(false);
    await user.click(entry);
    expect(entry.closest('details')?.open).toBe(true);
    expect(within(bag).getByText('MaxHealthDrop')).toBeTruthy();
    expect(
      within(sheet).getAllByRole('list', { name: 'Max Health conditions' })[0]!.textContent,
    ).toContain('No additional condition.');
    expect(sheet.getAttribute('aria-modal')).toBeNull();
    expect(application.store.getState().projectWorkspace.history!).toBe(beforeHistory);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(beforeFocus);
    expect(application.store.getState().editorSession.activePanel).toEqual(beforePanel);

    await user.click(within(sheet).getByRole('button', { name: 'Close Run State' }));
    expect(screen.queryByRole('region', { name: /State before/ })).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expect(evaluationEvents).toEqual(beforeEvaluationEvents);

    await user.click(launcher);
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeTruthy();
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

  it('shows the automatic N entry in the rail without a start step', () => {
    renderWorkspace(emptyProject('Surface', 1), 'Surface', 'N');

    const structure = screen.getByRole('region', { name: 'Ephyra route structure' });
    expect(within(structure).queryByRole('button', { name: /Start biome/ })).toBeNull();
    expect(within(structure).getByRole('button', { name: /Opening/ })).toBeTruthy();
  });

  it('creates F generically and leaves room identity authoring in the Opening Overview', async () => {
    const project = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const view = renderWorkspace(project, 'Underworld', 'F');

    expect(screen.queryByRole('button', { name: 'Room' })).toBeNull();
    expect(screen.queryByText('Choose room to show reward')).toBeNull();
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(inspector).getByRole('button', { name: 'Starting room' }));
    await view.user.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]!);

    const identity = await screen.findByRole('region', { name: 'Start room configuration' });
    expect(within(identity).getByRole('button', { name: 'Room' })).toBeTruthy();
    expect(within(identity).queryByLabelText('Reward')).toBeNull();
    const plan = view.application.store
      .getState()
      .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F');
    expect(plan?.topology?.occurrences[0]?.gameName).toBe('F_Opening01');

    await view.user.click(within(identity).getByRole('button', { name: 'Room' }));
    expect(within(await screen.findByRole('listbox')).getAllByRole('option')).toHaveLength(3);
  });

  it('repairs an imported fixed null entry through the declared room picker', async () => {
    const created = emptyProject('Surface', 1);
    let project = decodeProjectDocument(
      {
        ...created,
        route: {
          ...created.route,
          biomes: created.route.biomes.map((biome) => ({ ...biome, topology: null })),
        },
      },
      catalog,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Surface'),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    await view.user.click(screen.getByRole('button', { name: 'Starting room' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    await view.user.click(options[0]!);
    expect(
      view.application.store.getState().projectWorkspace.history!.present.route.biomes[0]?.topology
        ?.occurrences,
    ).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Start room configuration' })).toBeNull();
  });

  it('keeps a later Dream entry choice in its biome inspector behind prior readiness', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'later-dream-entry-ui',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['G', 'F'],
      configuredBiomeCount: 2,
    });
    renderWorkspace(project, 'Dream', 'F');
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const picker = within(inspector).getByRole('button', { name: 'Starting room' });
    expect(picker).toHaveProperty('disabled', true);
    expect(picker.dataset.authoringLocked).toBe('true');
  });

  it('uses concise Hub headings without a redundant Details header', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');

    expect(screen.getByRole('button', { name: 'Hub, 6 of 6 visits, Evaluated' })).toBe(
      hubRailButton(),
    );
    await view.user.click(hubRailButton());
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(within(inspector).getByRole('heading', { name: 'Ephyra Hub' })).toBeTruthy();
    expect(within(inspector).queryByText('Details')).toBeNull();
    expect(inspector.querySelector('.biome-inspector-heading')).toBeNull();
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
    expect(
      screen.getByRole('button', {
        name: `${firstVisit.node.room.label}: Visit 1, step 2.`,
      }),
    ).toBeTruthy();
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
      'Opening',
    );

    await view.user.click(railButtonForMarker(view.container, preHubDecision.marker.focusKey));
    expect(within(inspector).getByRole('heading', { level: 3, name: 'Pre-Hub' })).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Combat 02: Visit 3, step 4.' })).toBeTruthy();

    const visit = screen.getByRole('button', { name: /Visit 3 · Combat 02/ });
    act(() => visit.focus());
    await view.user.keyboard('{Enter}');

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, nOccurrenceId('combat02')),
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Combat 02' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' }).textContent).toContain(
      'Big Max Magick',
    );
    await view.user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    expect(screen.getByRole('heading', { name: /^Side Rooms/ })).toBeTruthy();
    expect(screen.queryByText('Door 558353')).toBeNull();
    expect(screen.getByLabelText('Side Room 01 generation')).toBeTruthy();
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-inspector-heading')).toBeNull();
    expect(within(inspector).getAllByRole('button', { name: 'Reward' })).toHaveLength(2);
    await view.user.click(
      within(inspector).getByRole('checkbox', { name: 'Side Room 03 generation' }),
    );
    const localVisit = view.application.store
      .getState()
      .projectWorkspace.history!.present.route?.biomes.find(
        (candidate) => candidate.biomeKey === 'N',
      )
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
    expect(within(inspector).queryByRole('button', { name: 'Open Side Room 01' })).toBeNull();
  });

  it('renders entered side rooms beneath their Hub visit and focuses the side workbench', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const biome = workspaceBiome(view.application, 'Surface', 'N');
    const hub = biome.rail.find(
      (entry): entry is Extract<(typeof biome.rail)[number], { readonly kind: 'hubGroup' }> =>
        entry.kind === 'hubGroup',
    );
    const parentVisit = hub?.visits.find(
      (visit) => visit.node.room.occurrenceId === nOccurrenceId('combat05'),
    );
    const sideVisit = parentVisit?.sideVisits[0];
    if (sideVisit === undefined) throw new Error('entered N side visit is missing');

    await view.user.click(hubRailButton());
    const sideButton = railButtonForMarker(view.container, sideVisit.marker.focusKey);
    expect(sideButton.textContent).toContain(sideVisit.label);
    await view.user.click(sideButton);

    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      sideVisit.node.room.marker.address,
    );
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: `${sideVisit.node.room.label}`,
      }),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('region', { name: 'Room features' })).toBeTruthy();
  });

  it('summarizes the Hub door reward in Overview without exposing another editor', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    await view.user.click(hubRailButton());
    await view.user.click(screen.getByRole('button', { name: /Visit 3 · Combat 02/ }));

    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    expect(within(inspector).getByRole('heading', { level: 3, name: 'Combat 02' })).toBeTruthy();
    expect(
      within(inspector).getByRole('region', { name: 'Incoming reward' }).textContent,
    ).toContain('Big Max Magick');
    expect(within(inspector).queryByRole('region', { name: 'Hub reward' })).toBeNull();
    expect(within(inspector).queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
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
      expect(inspector.querySelector('.biome-batch-workbench')).toBeNull();
      expect(inspector.querySelector('.biome-occurrence-workbench')).not.toBeNull();
      cleanup();
    }
  });

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
        .querySelector('.biome-occurrence-workbench'),
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
    expect(within(inspector).getByRole('heading', { name: 'Configure door offer' })).toBeTruthy();
    expect(within(inspector).queryByText('Continue from this room')).toBeNull();
    expect(within(inspector).queryByRole('button', { name: 'Remove these doors' })).toBeNull();
    const before = view.application.store.getState().projectWorkspace.history!.past.length;

    const pool = within(inspector).getByRole('button', { name: 'Reward Pool' });
    await view.user.click(pool);
    const minor = within(await screen.findByRole('listbox')).getByText('Minor Reward');
    expect(minor.closest('[cmdk-item]')?.getAttribute('aria-disabled')).not.toBe('true');
    await view.user.click(minor);

    await waitFor(() => {
      expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
      expect(screen.getByRole('button', { name: 'Door 1 room' })).toBeTruthy();
    });
    const authoredDecision = view.application.store
      .getState()
      .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
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
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      before + 1,
    );
    expect(screen.getByRole('button', { name: 'Remove these doors' })).toBeTruthy();

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(
        view.application.store.getState().projectWorkspace.history!.present.route?.biomes[0]
          ?.topology?.decisions,
      ).toEqual([]),
    );
    const restoredInspector = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(restoredInspector).getByRole('tab', { name: 'Room Doors' }));
    expect(screen.getByRole('heading', { name: 'Configure door offer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove these doors' })).toBeNull();
  });

  it('renders topology-owned and fixed outgoing states on their exact N occurrences', async () => {
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
    expect(within(outgoing).getByText('Continue to Polyphemus.')).toBeTruthy();

    // A mid-route Postboss continues to the next biome's display name, never
    // its internal key.
    const postboss = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.kind === 'PostBoss',
    );
    if (postboss?.kind !== 'occurrenceWorkbench') throw new Error('N Postboss node is missing');
    act(() => view.application.store.dispatch(semanticOwnerFocused(postboss.room.address)));
    await view.user.click(
      within(screen.getByRole('complementary', { name: 'Details' })).getByRole('tab', {
        name: 'Room Doors',
      }),
    );
    outgoing = within(screen.getByRole('complementary', { name: 'Details' })).getByRole('region', {
      name: 'Outgoing doors',
    });
    expect(within(outgoing).getByText('Continue to Thessaly.')).toBeTruthy();
  });

  it('celebrates the completed run beyond the final biome boss chain', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'Q');
    const terminal = workspaceBiome(view.application, 'Surface', 'Q').nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' &&
        (node.room.kind === 'PostBoss' || node.room.kind === 'Boss'),
    );
    if (terminal?.kind !== 'occurrenceWorkbench') throw new Error('Q boss chain node is missing');
    act(() => view.application.store.dispatch(semanticOwnerFocused(terminal.room.address)));
    await view.user.click(
      within(screen.getByRole('complementary', { name: 'Details' })).getByRole('tab', {
        name: 'Room Doors',
      }),
    );
    const outgoing = within(screen.getByRole('complementary', { name: 'Details' })).getByRole(
      'region',
      { name: 'Outgoing doors' },
    );
    expect(within(outgoing).getByText('The run is complete — congratulations.')).toBeTruthy();
    expect(within(outgoing).queryByText(/route boundary/)).toBeNull();
  });

  it('renders N’s entry frontiers without an unauthored Hub rail stop', () => {
    const emptyProjectDocument = emptyProject('Surface', 1);
    const emptyView = renderWorkspace(emptyProjectDocument, 'Surface', 'N');
    const emptyRail = railMarkerKeys(emptyView.container);
    const emptyWorkspace = workspaceBiome(emptyView.application, 'Surface', 'N');
    if (emptyWorkspace.frontier?.kind !== 'exitDecision') {
      throw new Error('N entry exit frontier is missing');
    }
    const openingId = emptyProjectDocument.route.biomes[0]!.topology!.startOccurrenceId;
    expect(emptyRail).toEqual([
      semanticAddressKey(createOccurrenceAddress(nBiome, openingId)),
      emptyWorkspace.frontier.marker.focusKey,
    ]);
    expect(screen.queryByRole('region', { name: 'Biome completion' })).toBeNull();
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
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;

    await view.user.click(action);

    await waitFor(() => {
      expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(hub);
      expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
    });
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
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
      view.application.store.getState().projectWorkspace.assembly!.evaluation.findings,
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
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.kind === 'PostBoss',
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
      within(firstNodeInspector).getByRole('heading', {
        level: 3,
        name: `${first.room.label}`,
      }),
    ).toBeTruthy();
    expect(within(firstNodeInspector).queryByRole('region', { name: 'Keepsake Rack' })).toBeNull();
    expect(
      within(firstNodeInspector).queryByText('This room is added automatically after the biome.'),
    ).toBeNull();
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
      .projectWorkspace.history!.present.route?.biomes.find(
        (candidate) => candidate.biomeKey === 'N',
      );
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
    const withoutDecision = applyProjectCommand(
      authorLegalTraitOffers(createGoldenFGHIProject()),
      catalog,
      {
        kind: 'RemoveExitDecision',
        decision: first,
      },
    );
    let project = applyProjectCommand(withoutDecision, catalog, {
      decision: first,
      kind: 'CreateBatch',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, first.source),
      storeKey: 'RunProgress',
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
        .projectWorkspace.history!.present.route?.biomes.find(
          (candidate) => candidate.biomeKey === 'N',
        );
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

  it('focuses a fixed Story reward on its owning predecessor door', async () => {
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
    const rewardStatus = door.querySelector<HTMLElement>('.door-reward-list [id$="-status"]');
    if (rewardStatus === null) throw new Error('fixed Story reward status is missing');
    expect(rewardStatus.getAttribute('tabindex')).toBe('-1');
    expect(rewardStatus.getAttribute('data-semantic-owner')).toBe(
      semanticAddressKey(createIncomingRewardAddress(pBiome, storyOccurrenceId)),
    );

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(
          createTargetAddress(
            pBiome,
            { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat10', 6, 1) },
            'exit1',
          ),
        ),
      ),
    );
    await waitFor(() => expect(document.activeElement).toBe(rewardStatus));
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
      .projectWorkspace.assembly!.evaluation.findings.find(
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

describe('boss-door reward pool in the outgoing-door section', () => {
  /** Focus the one room in this biome that owns a boss door, and open its doors. */
  async function openBossDoors(
    project: ProjectDocument,
    routeKey: string,
    biomeKey: string,
  ): Promise<{
    readonly section: HTMLElement;
    readonly user: ReturnType<typeof renderWorkspace>['user'];
  }> {
    const view = renderWorkspace(project, routeKey, biomeKey);
    const node = workspaceBiome(view.application, routeKey, biomeKey).nodes.find(
      (candidate): candidate is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        candidate.kind === 'occurrenceWorkbench' &&
        candidate.room.bossDoorRewardStore !== undefined,
    );
    if (node === undefined) throw new Error(`${biomeKey} has no boss-door room`);
    act(() => view.application.store.dispatch(semanticOwnerFocused(node.room.address)));
    await view.user.click(screen.getByRole('tab', { name: 'Room Doors' }));
    return { section: screen.getByRole('region', { name: 'Outgoing doors' }), user: view.user };
  }

  it('authors a rolling boss pool between the door heading and its destination', async () => {
    const { section } = await openBossDoors(loadSurfaceNOPQProject(), 'Surface', 'O');
    // The boss door reads as an ordinary outgoing door with a fixed
    // destination: heading, pool control, then where it goes.
    const heading = within(section).getByRole('heading', { level: 3, name: 'Outgoing doors' });
    const picker = within(section).getByRole('button', { name: 'Reward Pool' });
    const destination = within(section).getByText(/^Continue to /);
    expect(within(section).getByText('Reward Pool')).toBeTruthy();
    expect(picker.textContent).not.toContain('Select pool');
    expectBefore(heading, picker);
    expectBefore(picker, destination);
  });

  it('explains a saturated boss pool with the ledger that forced it', async () => {
    const { section, user } = await openBossDoors(loadSurfaceNOPQProject(), 'Surface', 'P');
    await user.click(within(section).getByRole('button', { name: 'Reward Pool' }));
    await user.click(await screen.findByRole('button', { name: 'Unavailable (1)' }));
    const excluded = within(screen.getByRole('listbox')).getByText('Major Reward');
    const item = excluded.closest('[cmdk-item]');
    expect(item?.getAttribute('data-candidate-state')).toBe('impossible');
    expect(
      within(item as HTMLElement).getByText(
        '2 of 17 entered rooms counted Minor Reward; the controller forces Minor Reward here.',
      ),
    ).toBeTruthy();
  });

  it('reports a pinned boss pool in the same place, with nothing to author', async () => {
    const { section } = await openBossDoors(createGoldenFGHIProject(), 'Underworld', 'H');
    // H's boss pins its entered store at spawn.
    expect(within(section).queryByRole('button', { name: 'Reward Pool' })).toBeNull();
    const line = within(section).getByText('Reward Pool is fixed as Major Reward for this boss.');
    expectBefore(within(section).getByRole('heading', { level: 3, name: 'Outgoing doors' }), line);
    expectBefore(line, within(section).getByText(/^Continue to /));
  });

  it('presents I’s pinned Tartarus pool in player-facing language', async () => {
    const { section } = await openBossDoors(createGoldenFGHIProject(), 'Underworld', 'I');
    expect(
      within(section).getByText('Reward Pool is fixed as Tartarus Reward for this boss.'),
    ).toBeTruthy();
  });

  it('reports a store-ignoring boss pool in the same place', async () => {
    const { section } = await openBossDoors(createGoldenFGHIProject(), 'Underworld', 'F');
    expect(within(section).queryByRole('button', { name: 'Reward Pool' })).toBeNull();
    const line = within(section).getByText('Reward Pool is ignored for this boss.');
    expectBefore(within(section).getByRole('heading', { level: 3, name: 'Outgoing doors' }), line);
    expectBefore(line, within(section).getByText(/^Continue to /));
  });
});
