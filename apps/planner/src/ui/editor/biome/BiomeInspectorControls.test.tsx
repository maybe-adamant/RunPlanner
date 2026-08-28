// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-unused-vars */

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createFigurineArcanaAddress,
  createJudgmentArcanaAddress,
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
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { semanticOwnerElementId } from '@planner/ui/feedback/semanticOwner';
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
  loadSurfaceNResourcesProject,
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
  loadUnderworldFGProject,
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
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

describe('Biome inspector controls', () => {
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

  it('binds a room-local selected resource removal to one semantic edit and undo', async () => {
    const view = renderWorkspace(loadSurfaceNResourcesProject(), 'Surface', 'N');
    await view.user.click(screen.getByRole('button', { name: /^Opening/ }));
    const resources = screen.getByRole('region', { name: 'Resources' });
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    const removeMining = within(resources).getByRole('button', { name: 'Remove Mining' });
    expect(removeMining.classList.contains('danger-action')).toBe(true);
    await view.user.click(removeMining);
    const selected = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.resourcePlacements.Pickaxe;
    expect(selected()).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(selected()).toEqual({ biomeKey: 'N', occurrenceId: 'surface-n-opening' });
  });

  it('keeps the reached Judgment editor on the fixed Boss timeline and directly reopenable', () => {
    const dormant = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const dormantBoss = workspaceBiome(dormant.application, 'Surface', 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.kind === 'Boss',
    );
    if (dormantBoss === undefined) throw new Error('N Boss completion is missing');
    expect(dormantBoss.room.judgment).toBeUndefined();
    cleanup();
    dormant.application.dispose();

    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Surface'),
      arcanaKeys: ['CastCount'],
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    const workspace = workspaceProjection(view.application);
    const owner = createJudgmentArcanaAddress(
      createOccurrenceAddress(nBiome, createOccurrenceId('completion:N:boss')),
      'Encounter',
    );
    const boss = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.kind === 'Boss',
    );
    if (boss?.room.judgment === undefined)
      throw new Error('active Judgment completion control is missing');
    expect(workspace.interactions.judgmentArcana.has(semanticAddressKey(owner))).toBe(true);

    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    const judgmentLauncher = within(inspector).getByRole('button', {
      name: /Judgment — choose 5 inactive Arcana cards/,
    });
    const finding = view.application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'judgmentOutcomeMissing' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(owner),
      );
    if (finding === undefined) throw new Error('Judgment finding is missing');
    expect(document.getElementById(semanticOwnerElementId(owner))).toBeTruthy();
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(document.activeElement).toBe(document.getElementById(semanticOwnerElementId(owner)));
    expect(inspector.querySelector('.room-judgment-popup')).toBeNull();
    expect(within(inspector).getByText('Start encounter')).toBeTruthy();
    expect(within(inspector).getByText('Boss defeated')).toBeTruthy();
    expect(within(inspector).getByText('End encounter')).toBeTruthy();
    const timeline = within(inspector).getByRole('region', { name: 'Room Timeline' });
    expect(timeline.classList.contains('room-actions-workbench')).toBe(true);
    expect(
      within(timeline).getByRole('listitem', {
        name: /Judgment — choose 5 inactive Arcana cards/,
      }),
    ).toBeTruthy();
    const timelineEntries = Array.from(timeline.querySelectorAll('ol > li'));
    expect(
      timelineEntries.findIndex((entry) => entry.getAttribute('aria-label') === 'Boss defeated'),
    ).toBeLessThan(
      timelineEntries.findIndex((entry) => entry.getAttribute('aria-label') === 'End encounter'),
    );
    act(() => judgmentLauncher.click());
    const optionList = inspector.querySelector('.room-judgment-options');
    if (optionList === null) throw new Error('Judgment options list is missing');
    expect(optionList.querySelectorAll(':scope > label')).toHaveLength(
      boss.room.judgment.inactiveArcanaKeys.length,
    );
    for (let index = 0; index < boss.room.judgment.requiredCount; index += 1) {
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
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.completionOccurrences.find(
          (occurrence) => occurrence.occurrenceId === createOccurrenceId('completion:N:boss'),
        )?.encounters.judgmentArcanaKeysByPhase?.Encounter,
    ).toHaveLength(5);

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(nBiome, nOccurrenceIds.opening)),
      ),
    );
    expect(within(inspector).queryByText('Judgment — choose 5 inactive Arcana cards')).toBeNull();
    act(() => screen.getByRole('button', { name: 'Open Boss completion' }).click());
    expect(
      within(inspector).getByRole('button', {
        name: /Judgment — choose 5 inactive Arcana cards/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Open Boss completion' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('keeps Judgment and Crystal Figurine independently authorable and undoable', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Surface'),
      arcanaKeys: ['CastCount'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'BossMetaUpgradeKeepsake',
    });
    const view = renderWorkspace(project, 'Surface', 'N');
    const workspace = workspaceProjection(view.application);
    const bossOccurrence = createOccurrenceAddress(nBiome, createOccurrenceId('completion:N:boss'));
    const judgmentOwner = createJudgmentArcanaAddress(bossOccurrence, 'Encounter');
    const figurineOwner = createFigurineArcanaAddress(bossOccurrence, 'Encounter');
    expect(workspace.interactions.judgmentArcana.has(semanticAddressKey(judgmentOwner))).toBe(true);

    act(() => view.application.store.dispatch(semanticOwnerFocused(judgmentOwner)));
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    act(() =>
      within(inspector)
        .getByRole('button', { name: /Judgment — choose 5 inactive Arcana cards/ })
        .click(),
    );
    const judgmentPopup = within(inspector).getByRole('dialog', { name: 'Judgment editor' });
    for (let index = 0; index < 5; index += 1) {
      const next = within(judgmentPopup)
        .getAllByRole<HTMLInputElement>('checkbox')
        .find((checkbox) => !checkbox.checked);
      if (next === undefined) throw new Error('Judgment picker has too few inactive cards');
      act(() => next.click());
    }
    const closeJudgment = within(judgmentPopup).getByRole('button', {
      name: 'Close Judgment editor',
    });
    expect(closeJudgment.classList.contains('quiet-action')).toBe(true);
    act(() => closeJudgment.click());
    const updatedWorkspace = workspaceProjection(view.application);
    expect(
      updatedWorkspace.interactions.figurineArcana.has(semanticAddressKey(figurineOwner)),
    ).toBe(true);

    act(() =>
      within(inspector)
        .getByRole('button', { name: /Crystal Figurine — choose 2 inactive Arcana cards/ })
        .click(),
    );
    const figurinePopup = within(inspector).getByRole('dialog', {
      name: 'Crystal Figurine editor',
    });
    for (let index = 0; index < 2; index += 1) {
      const next = within(figurinePopup)
        .getAllByRole<HTMLInputElement>('checkbox')
        .find((checkbox) => !checkbox.checked);
      if (next === undefined) throw new Error('Figurine picker has too few inactive cards');
      act(() => next.click());
    }

    const authored = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.completionOccurrences.find(
          (occurrence) => occurrence.occurrenceId === createOccurrenceId('completion:N:boss'),
        )?.encounters;
    expect(authored()?.judgmentArcanaKeysByPhase?.Encounter).toHaveLength(5);
    expect(authored()?.figurineArcanaKeysByPhase?.Encounter).toHaveLength(2);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authored()?.judgmentArcanaKeysByPhase?.Encounter).toHaveLength(5);
    expect(authored()?.figurineArcanaKeysByPhase?.Encounter ?? []).toHaveLength(0);
  });

  it('binds the reached Postboss keepsake selector through replacement and deletion', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const owner = createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(nBiome, createOccurrenceId('completion:N:postboss')),
    );
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    const timeline = screen.getByRole('region', { name: 'Room Timeline' });
    const optional = within(timeline).getByRole('region', { name: 'Optional actions' });
    const rack = within(optional).getByRole('listitem', { name: 'Keepsake Rack' });
    const selector = within(rack).getByRole('button', { name: 'Keepsake' });
    fireEvent.click(selector);
    const keepsakeList = screen.getByRole('listbox');
    await waitFor(() =>
      expect(
        within(keepsakeList)
          .getByText('Knuckle Bones')
          .closest('[cmdk-item]')
          ?.getAttribute('data-candidate-state'),
      ).toBe('possible'),
    );
    fireEvent.click(within(keepsakeList).getByText('Knuckle Bones'));
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.completionOccurrences.find(
          (occurrence) => occurrence.occurrenceId === createOccurrenceId('completion:N:postboss'),
        )?.keepsakeRack,
    ).toEqual({ keepsakeKey: 'BossPreDamageKeepsake' });
    await waitFor(() =>
      expect(
        within(timeline).getByRole('button', { name: 'Move Choose keepsake earlier' }),
      ).toBeTruthy(),
    );
    expect(
      within(timeline).getByText('Choose keepsake').closest('[data-in-order="true"]'),
    ).not.toBeNull();
    expect(within(timeline).queryByRole('listitem', { name: 'Keepsake Rack' })).toBeNull();
    const orderBeforeChange = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.completionOccurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('completion:N:postboss'),
      )?.roomActions.order;
    fireEvent.click(within(timeline).getByRole('button', { name: 'Keepsake' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Evil Eye'));
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.completionOccurrences.find(
          (occurrence) => occurrence.occurrenceId === createOccurrenceId('completion:N:postboss'),
        )?.roomActions.order,
    ).toEqual(orderBeforeChange);
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.completionOccurrences.find(
          (occurrence) => occurrence.occurrenceId === createOccurrenceId('completion:N:postboss'),
        )?.keepsakeRack,
    ).toEqual({ keepsakeKey: 'DeathVengeanceKeepsake' });
    fireEvent.click(within(timeline).getByRole('button', { name: 'Delete keepsake change' }));
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.completionOccurrences.find(
          (occurrence) => occurrence.occurrenceId === createOccurrenceId('completion:N:postboss'),
        )?.keepsakeRack,
    ).toBeUndefined();
    expect(
      within(timeline)
        .getByRole('region', { name: 'Optional actions' })
        .querySelector('[aria-label="Keepsake Rack"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Room Overview' }));
    expect(screen.queryByRole('region', { name: 'Keepsake Rack' })).toBeNull();
    expect(screen.queryByRole('listitem', { name: 'Keepsake Rack' })).toBeNull();
  });

  it('publishes the Aromatic Phial target after adding the optional rack before the fountain', async () => {
    const view = renderWorkspace(
      authorLegalTraitOffers(loadUnderworldFGProject()),
      'Underworld',
      'F',
    );
    const postbossId = createOccurrenceId('completion:F:postboss');
    const owner = createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(goldenFBiome, postbossId),
    );
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    const timeline = screen.getByRole('region', { name: 'Room Timeline' });
    const optionalRack = within(
      within(timeline).getByRole('region', { name: 'Optional actions' }),
    ).getByRole('listitem', { name: 'Keepsake Rack' });
    fireEvent.click(within(optionalRack).getByRole('button', { name: 'Keepsake' }));
    const keepsakes = screen.getByRole('listbox');
    await waitFor(() =>
      expect(
        within(keepsakes)
          .getByText('Aromatic Phial')
          .closest('[cmdk-item]')
          ?.getAttribute('data-candidate-state'),
      ).toBe('possible'),
    );
    fireEvent.click(within(keepsakes).getByText('Aromatic Phial'));
    fireEvent.click(
      await within(timeline).findByRole('button', { name: 'Move Choose keepsake earlier' }),
    );

    const phialTarget = await within(timeline).findByLabelText('Aromatic Phial target');
    fireEvent.click(phialTarget);
    const target = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.textContent?.trim() !== 'Unresolved' &&
          option.getAttribute('data-disabled') !== 'true',
      );
    if (target === undefined) throw new Error('Aromatic Phial has no eligible Postboss target');
    fireEvent.click(target);
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.completionOccurrences.find((occurrence) => occurrence.occurrenceId === postbossId)
          ?.fountainRarityResult?.targetTraitKey,
      ).toBeTruthy(),
    );
  });
});
