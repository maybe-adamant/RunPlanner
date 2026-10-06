// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createGorgonPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  encodeProjectDocument,
  parseProjectDocument,
  createTraitOfferAddress,
  semanticAddressKey,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { assembleExecutionProduct, compileExecutionPlan } from '@run-planner/engine/execution-plan';
import { simulateProject } from '@run-planner/engine/simulation';
import { loadUnderworldArachneCocoonsCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { arachneCocoonPhases } from '@run-planner/test-fixtures/underworld';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected, semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

import {
  authorLegalTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGAnomalyProject,
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
  goldenFOccurrenceId,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNProject,
  loadSurfaceNStoryBoardProject,
  loadSurfaceNOPQProject,
  reachedPOutdoorIcarusFixture,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  qOccurrenceIds,
  surfaceTravelDealRefillAnvilProject,
} from '@run-planner/test-fixtures/surface';
import {
  renderOccurrenceWorkbench,
  renderStaticOccurrenceWorkbench,
  renderWorkspace,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import {
  dormantShopProject,
  insertRoomAction,
  occurrenceById,
  occurrenceEncounterSelections,
  occurrenceRoomActionOrder,
  occurrenceState,
  openRoomTab,
  selectedNarcissusPickupSite,
  shipWheel,
  shipWheel2,
} from '@planner-test/support/occurrence-workbench';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (document as unknown as { elementFromPoint?: Document['elementFromPoint'] })
    .elementFromPoint;
});

describe('OccurrenceEncounterWorkbench', () => {
  it('shows a retained Aetos wave as waiting while its phase context is unreached', () => {
    const occurrenceId = pOccurrenceId('P_Combat03', 1, 1);
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceAetosWave',
      phase: createEncounterPhaseAddress(pBiome, { kind: 'occurrence', occurrenceId }, 'Combat'),
      value: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        createBiomeAddress('Surface', 'N'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-n-combat05') },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatN',
    });
    renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const wave = screen.getByRole('combobox', { name: 'Aetos wave' }) as HTMLSelectElement;
    expect(wave.value).toBe('2');
    expect(wave.disabled).toBe(true);
    expect(wave.title).toBe('Waits on an earlier choice');
    expect(within(wave).getByRole('option', { name: 'Wave 2' })).toBeDefined();
    expect(within(wave).queryByRole('option', { name: /unavailable/ })).toBeNull();
  });

  it('authors a native Aetos wave in Events, retains an unavailable choice, and repairs it directly', async () => {
    const occurrenceId = pOccurrenceId('P_Combat03', 1, 1);
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId },
      'Combat',
    );
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    expect(screen.queryByRole('combobox', { name: 'Aetos wave' })).toBeNull();
    await view.user.click(screen.getByRole('checkbox', { name: 'Aetos appearance' }));
    expect((screen.getByRole('combobox', { name: 'Aetos wave' }) as HTMLSelectElement).value).toBe(
      '2',
    );
    const selected = view.application.store.getState().projectWorkspace.history!.present;
    expect(
      selected.route.biomes
        .find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find((room) => room.occurrenceId === occurrenceId)?.encounters,
    ).toMatchObject({ aetosWaveByPhase: { Combat: 2 } });
    act(() => {
      view.application.store.dispatch(
        authoredProjectCommandDispatched({ kind: 'ReplaceAetosWave', phase, value: 3 }),
      );
    });
    expect((screen.getByRole('combobox', { name: 'Aetos wave' }) as HTMLSelectElement).value).toBe(
      '3',
    );
    expect(screen.getByRole('option', { name: 'Wave 3 (unavailable)' })).toBeDefined();
    await view.user.selectOptions(screen.getByRole('combobox', { name: 'Aetos wave' }), '2');
    await view.user.click(screen.getByRole('checkbox', { name: 'Aetos appearance' }));
    expect(screen.queryByRole('combobox', { name: 'Aetos wave' })).toBeNull();
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect((screen.getByRole('combobox', { name: 'Aetos wave' }) as HTMLSelectElement).value).toBe(
      '2',
    );
    act(() => {
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'SelectEncounter',
          phase,
          encounterKey: 'GeneratedP_Large',
        }),
      );
    });
    expect(
      (screen.getByRole('checkbox', { name: 'Aetos appearance' }) as HTMLInputElement).checked,
    ).toBe(true);
    await view.user.click(screen.getByRole('checkbox', { name: 'Aetos appearance' }));
    expect(screen.queryByRole('checkbox', { name: 'Aetos appearance' })).toBeNull();
  });

  it('hides later unselected Aetos controls but focuses a retained duplicate for repair', async () => {
    const fixture = reachedPOutdoorIcarusFixture();
    const earlier = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'Combat',
    );
    let project = applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: earlier,
      value: 2,
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'P',
      occurrenceById(fixture.occurrenceId),
    );
    openRoomTab('Room Timeline');
    expect(screen.queryByRole('checkbox', { name: 'Aetos appearance' })).toBeNull();
    act(() => {
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceAetosWave',
          phase: fixture.encounter,
          value: 2,
        }),
      );
    });
    project = view.application.store.getState().projectWorkspace.history!.present;
    const finding = simulateProject(catalog, project).findings.find(
      (entry) => entry.code === 'aetosAppearanceUnavailable',
    );
    if (finding === undefined) throw new Error('duplicate finding missing');
    act(() => {
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      );
    });
    const checkbox = screen.getByRole('checkbox', { name: 'Aetos appearance' });
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(checkbox));
    await view.user.click(checkbox);
    expect(screen.queryByRole('checkbox', { name: 'Aetos appearance' })).toBeNull();
  });

  it('exposes generated customization on a fixed opening encounter', async () => {
    const view = renderOccurrenceWorkbench(
      createCompleteFGProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFStartId),
    );
    openRoomTab('Room Overview');
    expect(screen.queryByRole('group', { name: 'Events' })).toBeNull();
    await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: /\(.+\)$/ });
    await view.user.click(within(dialog).getByRole('button', { name: 'Edit' }));
    expect(within(dialog).getByRole('radio', { name: '1' })).toBeDefined();
    expect(within(dialog).queryByRole('radio', { name: '2' })).toBeNull();
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes[0]?.topology?.occurrences.find(
          (room) => room.occurrenceId === goldenFStartId,
        )?.encounters.customizationByPhase?.Encounter?.generatedComposition,
    ).toMatchObject({ kind: 'generated', waveCount: 1 });
  });
  it('keeps an ordinary generated encounter Default until a compact customization edit', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const project = createCompleteFGProject();
    const canonical = encodeProjectDocument(project);
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    const launcher = screen.getByRole('button', { name: 'Customize encounter' });
    await view.user.click(launcher);
    await screen.findByRole('dialog', { name: /\(.+\)$/ });
    await view.user.click(screen.getByRole('button', { name: 'Close encounter customization' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      encodeProjectDocument(view.application.store.getState().projectWorkspace.history!.present),
    ).toBe(canonical);
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog', { name: /\(.+\)$/ });
    await view.user.click(within(dialog).getByRole('button', { name: 'Edit' }));
    await view.user.click(within(dialog).getByRole('radio', { name: '3' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
          ?.encounters.customizationByPhase?.Encounter?.generatedComposition,
      ).toMatchObject({ kind: 'generated', waveCount: 3 }),
    );
    await view.user.click(within(dialog).getByRole('button', { name: 'Shared Enemy' }));
    await view.user.click(await screen.findByRole('option', { name: 'Whisper (5)' }));
    await view.user.click(within(dialog).getByRole('tab', { name: /^Wave 2/ }));
    await view.user.click(within(dialog).getByRole('button', { name: 'Wave 2 enemies' }));
    await view.user.click(await screen.findByRole('option', { name: 'Whisper (5)' }));
    await view.user.click(await screen.findByRole('option', { name: 'Wastrel (18)' }));
    expect(screen.queryByRole('option', { name: 'Finish Wave' })).toBeNull();
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
          ?.encounters.customizationByPhase?.Encounter?.generatedComposition,
      ).toMatchObject({
        kind: 'generated',
        waveCount: 3,
        highlightKey: 'Guard',
        waves: expect.arrayContaining([
          expect.objectContaining({ waveIndex: 2, typeKeys: ['Brawler'] }),
        ]),
      }),
    );
    view.application.store.dispatch(authoredProjectUndoRequested());
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
        ?.encounters.customizationByPhase?.Encounter?.generatedComposition,
    ).toMatchObject({ waveCount: 3, highlightKey: 'Guard' });
  });

  it('edits a fixed Scylla phase in place and retains a now-invalid choice for finding repair', async () => {
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'G_Boss02');
    if (boss === undefined) throw new Error('rank-two Scylla Boss occurrence is missing');
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(boss.occurrenceId),
    );
    openRoomTab('Room Overview');
    const summary = screen.getByText('Scylla');
    const control = summary.closest('.encounter-phase-control');
    if (!(control instanceof HTMLElement)) throw new Error('Scylla encounter control is missing');
    expect(within(control).queryByRole('heading')).toBeNull();
    expect(within(control).getByText('Encounter', { selector: 'span' })).toBeTruthy();
    expect(within(control).queryByRole('button', { name: 'Encounter' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Customize' })).toBeNull();
    expect(document.querySelector('dialog.trait-offer-dialog-backdrop')).toBeNull();
    await view.user.click(within(control).getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Customize' })).toBeTruthy();
    await view.user.click(within(dialog).getByRole('button', { name: 'Featured performer' }));
    await view.user.click(screen.getByRole('option', { name: 'Charybdis' }));
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === boss.occurrenceId);
      expect(occurrence?.encounters.customizationByPhase?.Encounter?.featuredPerformer).toEqual({
        kind: 'single',
        choiceKey: 'charybdis',
      });
    });
    await view.user.click(
      within(dialog).getByRole('button', { name: 'Close encounter customization' }),
    );
    expect(screen.queryByRole('dialog', { name: 'Customize' })).toBeNull();
    expect(dialog.isConnected).toBe(false);
    await view.user.click(within(control).getByRole('button', { name: 'Customize encounter' }));
    const reopened = await screen.findByRole('dialog', { name: 'Customize' });
    fireEvent(reopened, new Event('cancel', { cancelable: true }));
    expect(reopened.isConnected).toBe(false);
    view.application.store.dispatch(authoredProjectUndoRequested());
    view.application.store.dispatch(authoredProjectRedoRequested());
  });

  it('selects, resets, and undoes a fixed Typhon egg-wave customization in the shared dialog', async () => {
    const project = loadSurfaceNOPQProject();
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === 'Q')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'Q_Boss01');
    if (boss === undefined) throw new Error('normal Typhon Boss occurrence is missing');
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'Q',
      occurrenceById(boss.occurrenceId),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    const firstEggWave = within(dialog).getByRole('button', { name: 'First egg wave' });
    await view.user.click(firstEggWave);
    await view.user.click(screen.getByRole('option', { name: '3 Eidolon eggs' }));
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'Q')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === boss.occurrenceId);
      expect(occurrence?.encounters.customizationByPhase?.Encounter?.firstEggWave).toEqual({
        kind: 'single',
        choiceKey: 'eidolons',
      });
    });
    const workspace = view.application.store.getState().projectWorkspace;
    if (workspace.kind !== 'openProject') throw new Error('Typhon workspace is not open');
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly: workspace.assembly, catalog }),
    });
    expect(
      plan.occurrences
        .find((occurrence) => occurrence.id === boss.occurrenceId)
        ?.overview.encounterPhases.find((phase) => phase.slotKey === 'Encounter')?.customization,
    ).toContainEqual({
      decisionKey: 'firstEggWave',
      kind: 'single',
      choiceKey: 'eidolons',
      nativeId: 'TyphonHeadCastSummon03',
    });
    await view.user.click(firstEggWave);
    await view.user.click(screen.getByRole('option', { name: 'Default' }));
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'Q')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === boss.occurrenceId);
      expect(occurrence?.encounters.customizationByPhase).toBeUndefined();
    });
    view.application.store.dispatch(authoredProjectUndoRequested());
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'Q')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === boss.occurrenceId);
      expect(occurrence?.encounters.customizationByPhase?.Encounter?.firstEggWave).toEqual({
        kind: 'single',
        choiceKey: 'eidolons',
      });
    });
  });

  it.each(['F', 'G'] as const)(
    'binds %s cocoon map and selector to the same independent position with Undo',
    async (biomeKey) => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(280);
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(500);
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 500, 280),
      );
      const project = loadUnderworldArachneCocoonsCheckpoint();
      const phase = arachneCocoonPhases[biomeKey];
      const occurrenceId = phase.owner.occurrenceId;
      const host = project.route.biomes
        .find((biome) => biome.biomeKey === biomeKey)!
        .topology!.occurrences.find((entry) => entry.occurrenceId === occurrenceId)!;
      const ids = catalog.rooms.byKey[host.gameName]!.cocoonRewardPointIds!;
      const view = renderOccurrenceWorkbench(
        project,
        'Underworld',
        biomeKey,
        occurrenceById(occurrenceId),
      );
      const values = () =>
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route.biomes.find(
            (biome) => biome.biomeKey === biomeKey,
          )!
          .topology!.occurrences.find((entry) => entry.occurrenceId === occurrenceId)!.encounters
          .customizationByPhase?.Encounter;
      const priorCount = values()?.cocoonCount;
      openRoomTab('Room Overview');
      await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
      const dialog = await screen.findByRole('dialog', { name: 'Customize' });
      const marker = within(dialog).getByRole('button', { name: 'Reward cocoon 1' });
      expect(
        within(dialog)
          .getByRole('img', { name: `Map of ${host.gameName} cocoons` })
          .getAttribute('src'),
      ).toContain('/cocoons/assets/');
      await view.user.click(marker);
      await waitFor(() =>
        expect(values()?.cocoonRewardPoint).toEqual({
          kind: 'cocoonRewardPoint',
          spawnPointId: ids[0],
        }),
      );
      expect(marker.getAttribute('aria-pressed')).toBe('true');
      expect(values()?.cocoonCount).toEqual(priorCount);
      const selector = within(dialog).getByRole('button', { name: 'Reward position' });
      expect(selector.textContent).toContain('1');
      await view.user.click(selector);
      await view.user.click(screen.getByRole('option', { name: '2' }));
      expect(
        within(dialog)
          .getByRole('button', { name: 'Reward cocoon 2' })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
      await waitFor(() =>
        expect(values()?.cocoonRewardPoint).toEqual({
          kind: 'cocoonRewardPoint',
          spawnPointId: ids[0],
        }),
      );
      const second = within(dialog).getByRole('button', { name: 'Reward cocoon 2' });
      second.focus();
      await view.user.keyboard('{Enter}');
      await waitFor(() =>
        expect(values()?.cocoonRewardPoint).toEqual({
          kind: 'cocoonRewardPoint',
          spawnPointId: ids[1],
        }),
      );
      await view.user.click(selector);
      await view.user.click(screen.getByRole('option', { name: 'Any' }));
      await waitFor(() => expect(values()?.cocoonRewardPoint).toBeUndefined());
      expect(values()?.cocoonCount).toEqual(priorCount);
      expect(
        within(dialog)
          .getAllByRole('button', { name: /Reward cocoon/ })
          .every((button) => button.getAttribute('aria-pressed') === 'false'),
      ).toBe(true);
      const image = within(dialog).getByRole('img', { name: `Map of ${host.gameName} cocoons` });
      Object.defineProperties(image, {
        naturalWidth: { value: 2560 },
        naturalHeight: { value: 1440 },
      });
      fireEvent.load(image);
      const stage = image.parentElement!.parentElement!;
      const scroll = within(dialog).getByRole('region', {
        name: `Pan map of ${host.gameName} cocoons`,
      });
      await view.user.click(within(dialog).getByRole('button', { name: 'Map controls' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
      expect(within(dialog).getByText('125%')).toBeTruthy();
      const beforePan = scroll.scrollLeft;
      const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 200, clientY: 100 };
      fireEvent.pointerDown(stage, pointer);
      fireEvent.pointerMove(stage, { ...pointer, clientX: 160 });
      fireEvent.pointerUp(stage, pointer);
      expect(scroll.scrollLeft).toBeGreaterThan(beforePan);
      fireEvent.pointerDown(marker, pointer);
      fireEvent.pointerMove(marker, { ...pointer, clientX: 240 });
      fireEvent.pointerUp(marker, { ...pointer, clientX: 240 });
      fireEvent.click(marker, { detail: 1 });
      expect(values()?.cocoonRewardPoint).toBeUndefined();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fit' }));
      expect(scroll.scrollLeft).toBe(0);
      expect(within(dialog).getByText('100%')).toBeTruthy();
    },
  );

  it('slides an Arachne cocoon count from Default and resets it to Default', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArachneCombatF',
    });
    const cocoonCount = (view: ReturnType<typeof renderOccurrenceWorkbench>) =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
        ?.encounters.customizationByPhase?.Encounter?.cocoonCount;
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    const slider = within(dialog).getByRole('slider', { name: 'Cocoons' });
    expect(slider.getAttribute('aria-valuetext')).toBe('Default');
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('7');
    const pointSelector = within(dialog).getByRole('button', { name: 'Reward position' });
    const firstPoint =
      catalog.rooms.byKey[
        project.route.biomes[0]!.topology!.occurrences.find(
          (entry) => entry.occurrenceId === occurrenceId,
        )!.gameName
      ]!.cocoonRewardPointIds![0]!;
    await view.user.click(pointSelector);
    await view.user.click(screen.getByRole('option', { name: '1' }));
    const point = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((b) => b.biomeKey === 'F')!
        .topology!.occurrences.find((o) => o.occurrenceId === occurrenceId)!.encounters
        .customizationByPhase?.Encounter?.cocoonRewardPoint;
    await waitFor(() =>
      expect(point()).toEqual({ kind: 'cocoonRewardPoint', spawnPointId: Number(firstPoint) }),
    );
    expect(cocoonCount(view)).toBeUndefined();
    await view.user.click(pointSelector);
    await view.user.click(screen.getByRole('option', { name: 'Any' }));
    await waitFor(() => expect(point()).toBeUndefined());
    expect(within(dialog).getByRole('button', { name: 'Reset' }).hasAttribute('disabled')).toBe(
      true,
    );

    fireEvent.change(slider, { target: { value: '4' } });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    await waitFor(() => expect(cocoonCount(view)).toEqual({ kind: 'cocoonCount', count: 11 }));
    expect(
      within(dialog).getByRole('slider', { name: 'Cocoons' }).getAttribute('aria-valuetext'),
    ).toBe('11');

    await view.user.click(within(dialog).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(cocoonCount(view)).toBeUndefined());

    fireEvent.change(within(dialog).getByRole('slider', { name: 'Cocoons' }), {
      target: { value: '7' },
    });
    fireEvent.keyUp(within(dialog).getByRole('slider', { name: 'Cocoons' }), { key: 'End' });
    await waitFor(() => expect(cocoonCount(view)).toEqual({ kind: 'cocoonCount', count: 14 }));
    fireEvent.change(within(dialog).getByRole('slider', { name: 'Cocoons' }), {
      target: { value: '0' },
    });
    fireEvent.keyUp(within(dialog).getByRole('slider', { name: 'Cocoons' }), { key: 'Home' });
    await waitFor(() => expect(cocoonCount(view)).toBeUndefined());
  });

  it('disables Customize for an Anomaly roster whose context is unreached', async () => {
    const occurrenceId = 'golden-g-b3-e2';
    const project = applyProjectCommand(createCompleteFGAnomalyProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    renderOccurrenceWorkbench(project, 'Underworld', 'G', occurrenceById(occurrenceId));
    openRoomTab('Room Overview');
    const trigger = screen.getByRole('button', {
      name: 'Customize encounter',
    }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.title).toBe('Waits on an earlier choice');
  });

  it('stages an ordered Anomaly roster from engine candidates and resets it to Default', async () => {
    const occurrenceId = 'golden-g-b3-e2';
    const roster = (view: ReturnType<typeof renderOccurrenceWorkbench>) =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
        ?.encounters.customizationByPhase?.Encounter?.infiniteRoster;
    const view = renderOccurrenceWorkbench(
      createCompleteFGAnomalyProject(),
      'Underworld',
      'G',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    expect(within(dialog).getByRole('button', { name: 'Reset' }).hasAttribute('disabled')).toBe(
      true,
    );

    // Normal-then-elite SpreadShot is not a native draw order.
    await view.user.click(within(dialog).getByRole('button', { name: 'Enemy roster' }));
    await view.user.click(await screen.findByRole('option', { name: 'Wretched Witch' }));
    await screen.findByRole('option', { name: 'Burn-Flinger' });
    expect(screen.queryByRole('option', { name: 'Elite Wretched Witch' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Finish Roster' })).toBeNull();
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(roster(view)).toBeUndefined();

    await view.user.click(within(dialog).getByRole('button', { name: 'Enemy roster' }));
    await view.user.click(await screen.findByRole('option', { name: 'Elite Wretched Witch' }));
    await view.user.click(await screen.findByRole('option', { name: 'Wretched Witch' }));
    // The single elite slot is spent.
    expect(screen.queryByRole('option', { name: 'Elite Bloodless' })).toBeNull();
    await view.user.click(await screen.findByRole('option', { name: 'Burn-Flinger' }));
    await view.user.click(await screen.findByRole('option', { name: 'Finish Roster' }));
    await waitFor(() =>
      expect(roster(view)).toEqual({
        kind: 'infiniteRoster',
        typeKeys: ['SpreadShotUnit_Elite', 'SpreadShotUnit', 'BloodlessPitcher'],
      }),
    );
    expect(within(dialog).getByRole('button', { name: 'Enemy roster' }).textContent).toContain(
      'Elite Wretched Witch · Wretched Witch · Burn-Flinger',
    );

    await view.user.click(within(dialog).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(roster(view)).toBeUndefined());
  });

  it('marks a retained context-invalid Anomaly roster for repair without rewriting it', async () => {
    const occurrenceId = createOccurrenceId('golden-g-b3-e2');
    const invalid = {
      kind: 'infiniteRoster' as const,
      typeKeys: ['SpreadShotUnit', 'SpreadShotUnit_Elite'],
    };
    const project = applyProjectCommand(createCompleteFGAnomalyProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId },
        'Encounter',
      ),
      decisionKey: 'infiniteRoster',
      value: invalid,
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    expect(within(dialog).queryByText('Needs repair')).toBeNull();
    const findingsRegion = within(dialog).getByRole('region', { name: 'Customization findings' });
    expect(findingsRegion.textContent).toContain('Retained choice is unavailable here.');
    // The one feedback region closes the dialog body, after every decision row.
    expect(dialog.querySelector('.encounter-customization-fields')?.lastElementChild).toBe(
      findingsRegion,
    );
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
        ?.encounters.customizationByPhase?.Encounter?.infiniteRoster,
    ).toEqual(invalid);
  });

  it('shows and repairs a retained unavailable cocoon reward point', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const selected = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArachneCombatF',
    });
    const project = applyProjectCommand(selected, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'cocoonRewardPoint',
      value: { kind: 'cocoonRewardPoint', spawnPointId: 1 },
    });
    const finding = simulateProject(catalog, project).findings.find(
      (candidate) =>
        candidate.code === 'encounterCustomizationUnavailable' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(phase),
    )!;
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    const trigger = screen.getByRole('button', { name: 'Customize encounter' });
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole('dialog', { name: 'Customize' })).toBeNull();
    await view.user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    const selector = within(dialog).getByRole('button', { name: 'Reward position' });
    expect(finding.origin).toEqual(phase);
    expect(selector.textContent).toContain('1 (unavailable)');
    expect(selector.getAttribute('aria-invalid')).toBe('true');
    expect(selector.getAttribute('title')).toBe('Retained position is unavailable here.');
    await view.user.click(selector);
    expect(
      screen.getByRole('option', { name: '1 (unavailable)' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(within(dialog).queryByText('Needs repair')).toBeNull();
    const findingsRegion = within(dialog).getByRole('region', { name: 'Customization findings' });
    expect(findingsRegion.textContent).toContain('Retained choice is unavailable here.');
    // The one feedback region closes the dialog body, after every decision row.
    expect(dialog.querySelector('.encounter-customization-fields')?.lastElementChild).toBe(
      findingsRegion,
    );
    const point = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')!
        .topology!.occurrences.find((entry) => entry.occurrenceId === occurrenceId)!.encounters
        .customizationByPhase?.Encounter?.cocoonRewardPoint;
    expect(point()).toEqual({ kind: 'cocoonRewardPoint', spawnPointId: 1 });
    const validId =
      catalog.rooms.byKey[
        project.route.biomes[0]!.topology!.occurrences.find(
          (entry) => entry.occurrenceId === occurrenceId,
        )!.gameName
      ]!.cocoonRewardPointIds![0]!;
    await view.user.click(screen.getByRole('option', { name: '1' }));
    await waitFor(() =>
      expect(point()).toEqual({ kind: 'cocoonRewardPoint', spawnPointId: Number(validId) }),
    );
    expect(
      within(dialog).getByRole('region', { name: 'Customization findings' }).textContent,
    ).not.toContain('Retained choice is unavailable here.');
    expect(selector.getAttribute('title')).toBeNull();
    await view.user.click(selector);
    expect(screen.queryByRole('option', { name: '1 (unavailable)' })).toBeNull();
    await view.user.keyboard('{Escape}');
  });

  it('repairs a retained out-of-range cocoon count by choosing its clamped stop', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const selected = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId },
        'Encounter',
      ),
      encounterKey: 'ArachneCombatF',
    });
    const saved = JSON.parse(encodeProjectDocument(selected)) as {
      route: {
        biomes: {
          biomeKey: string;
          topology: {
            occurrences: { occurrenceId: string; encounters: Record<string, unknown> }[];
          };
        }[];
      };
    };
    saved.route.biomes
      .find((biome) => biome.biomeKey === 'F')!
      .topology.occurrences.find(
        (occurrence) => occurrence.occurrenceId === occurrenceId,
      )!.encounters.customizationByPhase = {
      Encounter: { cocoonCount: { kind: 'cocoonCount', count: 20 } },
    };
    const project = parseProjectDocument(JSON.stringify(saved), catalog);
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const cocoonCount = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
        ?.encounters.customizationByPhase?.Encounter?.cocoonCount;
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    const slider = within(dialog).getByRole('slider', { name: 'Cocoons' });
    expect((slider as HTMLInputElement).value).toBe('7');
    expect(within(dialog).getByText('20 (unavailable)')).toBeTruthy();
    expect(slider.getAttribute('aria-invalid')).toBe('true');
    expect(slider.getAttribute('title')).toBe('Retained count 20 is unavailable here.');
    expect(within(dialog).queryByText('Needs repair')).toBeNull();
    const findingsRegion = within(dialog).getByRole('region', { name: 'Customization findings' });
    expect(findingsRegion.textContent).toContain('Retained choice is unavailable here.');
    // The one feedback region closes the dialog body, after every decision row.
    expect(dialog.querySelector('.encounter-customization-fields')?.lastElementChild).toBe(
      findingsRegion,
    );

    fireEvent.keyDown(slider, { key: 'End' });
    fireEvent.keyUp(slider, { key: 'End' });
    await waitFor(() => expect(cocoonCount()).toEqual({ kind: 'cocoonCount', count: 14 }));
    // The findings region stays mounted after the repair clears its entry.
    await waitFor(() =>
      expect(
        within(dialog).getByRole('region', { name: 'Customization findings' }).textContent,
      ).not.toContain('Retained choice is unavailable here.'),
    );
    expect(slider.getAttribute('aria-invalid')).toBeNull();
  });

  it('routes a reached retained Scylla finding to the manual popup trigger', async () => {
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'G_Boss02');
    if (boss === undefined) throw new Error('rank-two Scylla Boss occurrence is missing');
    const phase = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: boss.occurrenceId },
      'Encounter',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'featuredPerformer',
      value: { kind: 'single', choiceKey: 'charybdis' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 1,
    });
    const finding = simulateProject(catalog, project).findings.find(
      (candidate) =>
        candidate.code === 'encounterCustomizationUnavailable' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(phase),
    );
    if (finding === undefined) throw new Error('retained Scylla customization finding is missing');
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(boss.occurrenceId),
    );
    openRoomTab('Room Overview');
    const trigger = screen.getByRole('button', { name: 'Customize encounter' });
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.dataset.hasFindings).toBe('true');
    expect(screen.queryByRole('dialog', { name: 'Customize' })).toBeNull();
    expect(document.querySelector('dialog.trait-offer-dialog-backdrop')).toBeNull();
    await view.user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    const performer = within(dialog).getByRole('button', { name: 'Featured performer' });
    await view.user.click(performer);
    expect(
      screen.getByRole('option', { name: 'Charybdis (unavailable)' }).getAttribute('aria-disabled'),
    ).toBe('true');
    await view.user.click(screen.getByRole('option', { name: 'Default' }));
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === boss.occurrenceId);
      expect(occurrence?.encounters.customizationByPhase).toBeUndefined();
    });
  });

  it('authors an Eris ordered prefix without discarding its second choice on first-choice edits', async () => {
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Surface' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'O_Boss02');
    if (boss === undefined) throw new Error('Rival Eris Boss occurrence is missing');
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(boss.occurrenceId),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Customize encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize' });
    for (const name of ['Early summons', 'Late summons']) {
      const group = within(dialog).getByRole('region', { name });
      expect(within(group).getByRole('heading', { level: 3, name })).toBeTruthy();
      expect(within(group).getAllByRole('button')).toHaveLength(2);
    }
    expect(
      within(dialog).getByRole('button', { name: 'Early summons use 2' }).hasAttribute('disabled'),
    ).toBe(true);
    await view.user.click(within(dialog).getByRole('button', { name: 'Early summons use 1' }));
    await view.user.click(screen.getByRole('option', { name: 'Elite Harpy Talon' }));
    await view.user.click(within(dialog).getByRole('button', { name: 'Early summons use 2' }));
    await view.user.click(screen.getByRole('button', { name: /^Unavailable/ }));
    expect(
      screen.getByRole('option', { name: /^Elite Harpy Talon/ }).getAttribute('aria-disabled'),
    ).toBe('true');
    await view.user.click(screen.getByRole('option', { name: 'Elite Anchor' }));
    await view.user.click(within(dialog).getByRole('button', { name: 'Early summons use 1' }));
    await view.user.click(screen.getByRole('option', { name: 'Hellifishie' }));
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'O')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === boss.occurrenceId);
      expect(occurrence?.encounters.customizationByPhase?.Encounter?.earlySummons).toEqual({
        kind: 'orderedPrefix',
        choiceKeys: ['jellyfish', 'swab'],
      });
    });
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
      name: 'Gorgon Amulet: Death Defiance',
    }) as HTMLInputElement;
    expect(condition.disabled).toBe(false);
    expect(within(screen.getByRole('group', { name: 'Events' })).getByRole('checkbox')).toBe(
      condition,
    );
    await view.user.click(screen.getByText('Gorgon Amulet: Death Defiance'));
    await waitFor(() => {
      const launcher = screen.getByRole('button', {
        name: /Choose Trait; trait is not selected/,
      });
      expect(launcher.getAttribute('data-trait-status')).toBe('unspecified');
    });
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'P')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
        ?.encounters.gorgonResultByPhase?.Combat?.athenaTriggerConditionMet,
    ).toBe(true);
  });

  it('keeps a context-invalid Gorgon child visible as a repair surface', async () => {
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
    const view = renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const condition = screen.getByRole('checkbox', {
      name: 'Gorgon Amulet: Death Defiance',
    }) as HTMLInputElement;
    expect(condition.checked).toBe(true);
    expect(condition.disabled).toBe(false);
    // The Combat phase starts before the blocked Athena offer: its reached Gorgon support is unsupported.
    const launcher = screen.getByRole('button', {
      name: /Edit Trait · Divine Dash; trait configuration needs attention/,
    });
    expect(launcher.getAttribute('data-trait-status')).toBe('invalid');
    await view.user.click(condition);
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Gorgon Amulet: Death Defiance' })).toBeNull();
    });
    const updatedOccurrence = view.application.store
      .getState()
      .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    expect(updatedOccurrence?.roomActions.order).not.toContainEqual({
      kind: 'interactGorgon',
      phaseKey: 'Combat',
    });
  });

  it('targets an unavailable Gorgon condition on its checkbox and clears its action', async () => {
    const occurrenceId = pOccurrenceId('P_Combat12', 8, 1);
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId },
      'Combat',
    );
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const view = renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const condition = screen.getByRole('checkbox', {
      name: 'Gorgon Amulet: Death Defiance',
    });
    expect(condition.getAttribute('data-has-findings')).toBe('true');
    expect(condition.getAttribute('aria-description')).toContain('Gorgon cannot trigger');
    await view.user.click(condition);
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Gorgon Amulet: Death Defiance' })).toBeNull();
    });
    expect(screen.queryByText('Talk to Athena')).toBeNull();
    const updatedOccurrence = view.application.store
      .getState()
      .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    expect(updatedOccurrence?.roomActions.order).not.toContainEqual({
      kind: 'interactGorgon',
      phaseKey: 'Combat',
    });
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
    const skip = screen.getByRole('checkbox', { name: 'Skip with Fig Leaf' });
    expect((skip as HTMLInputElement).disabled).toBe(false);
    expect(within(screen.getByRole('group', { name: 'Events' })).getByRole('checkbox')).toBe(skip);
    (skip as HTMLInputElement).focus();
    await view.user.keyboard(' ');
    await waitFor(() => {
      const occurrence = view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === nOccurrenceIds.preHub,
        );
      expect(occurrence?.encounters.figLeafSkipByPhase).toMatchObject({ Encounter: true });
    });
  });

  it('targets an unavailable Fig Leaf skip on its Timeline checkbox, not the Overview identity', async () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const finding = simulateProject(catalog, project).findings.find(
      (entry) => entry.code === 'figLeafSkipUnavailable',
    );
    if (finding === undefined) throw new Error('Fig Leaf finding missing');
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(phase.owner.occurrenceId),
    );
    const identity = screen.getByLabelText('Encounter phase');
    expect(within(identity).getByRole('button', { name: 'Encounter' }).dataset.hasFindings).toBe(
      'false',
    );
    openRoomTab('Room Timeline');
    act(() => {
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      );
    });
    const skip = screen.getByRole('checkbox', { name: 'Skip with Fig Leaf' });
    expect(skip.dataset.hasFindings).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(skip));
  });

  it('groups retained event selections together so conflicting authoring remains repairable', async () => {
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
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const view = renderOccurrenceWorkbench(project, 'Surface', 'P', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const events = screen.getByRole('group', { name: 'Events' });
    expect(
      within(events)
        .getAllByRole('checkbox')
        .map((input) => (input as HTMLInputElement).checked),
    ).toEqual([true, true]);
    const skip = within(events).getByRole('checkbox', {
      name: 'Skip with Fig Leaf',
    }) as HTMLInputElement;
    expect(skip.disabled).toBe(false);
    expect(
      within(events).getByRole('checkbox', { name: 'Gorgon Amulet: Death Defiance' }),
    ).toBeTruthy();
    await view.user.click(skip);
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Skip with Fig Leaf' })).toBeNull();
    });
  });

  it('places a Narcissus Mystery Boon before resolving its source and traits', async () => {
    let project = createCompleteFGProject();
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    const decision = project.route.biomes
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
    const actionRow = screen.getByText(/^Collect Mystery Boon/).closest('li');
    if (actionRow === null) throw new Error('Narcissus pickup action is missing');
    const authoredOccurrence = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        );
    expect(within(actionRow).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(
      authoredOccurrence()?.acquisitionSites?.[narcissusSite]?.pickupEntries?.mysteryBoon,
    ).toBeNull();
    const insert = within(actionRow).getByRole('button', {
      name: 'Add Collect Mystery Boon · Mixed Blessings',
    });
    await view.user.click(insert);
    const insertion = screen
      .getAllByRole('button', { name: /^Add Collect Mystery Boon · Mixed Blessings here:/ })
      .find((button) => button.getAttribute('aria-disabled') !== 'true');
    if (insertion === undefined) throw new Error('Narcissus pickup has no legal insertion');
    await view.user.click(insertion);
    const placedRow = screen
      .getByText(/^Collect Mystery Boon/, { selector: 'strong' })
      .closest('li');
    if (placedRow === null) throw new Error('Narcissus pickup action is missing');
    await view.user.click(within(placedRow).getByRole('button', { name: 'Reward' }));
    await view.user.click(await within(await screen.findByRole('listbox')).findByText('Hestia'));
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
      { kind: 'interactAcquisitionEntry', siteKey: narcissusSite, entryKey: 'mysteryBoon' },
    ]);

    const hiddenSource = workspaceProjection(view.application).interactions.traitOffers.get(
      semanticAddressKey(createTraitOfferAddress(mysteryBoon, 'hiddenSource')),
    );
    const hiddenSourceDraft = hiddenSource?.traitOfferStartingOutcome?.();
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
        view.application.store.getState().projectWorkspace.history!.present,
      ).route?.biomes.find((biome) => biome.biomeKey === 'G');
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
    expect(hasAcquiredMysteryBoon()).toBe(true);
    await view.user.click(
      screen.getByRole('button', {
        name: 'Remove Collect Mystery Boon · Mixed Blessings from timeline',
      }),
    );
    expect(authoredOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
    ]);
    expect(hasAcquiredMysteryBoon()).toBe(false);
    const optionalRow = screen
      .getByText(/^Collect Mystery Boon/, { selector: 'strong' })
      .closest('li');
    if (optionalRow === null) throw new Error('Narcissus optional pickup is missing');
    expect(within(optionalRow).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(
      workspaceProjection(view.application).interactions.traitOffers.has(
        semanticAddressKey(createTraitOfferAddress(mysteryBoon, 'hiddenSource')),
      ),
    ).toBe(false);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredOccurrence()?.roomActions.order.at(-1)).toEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: narcissusSite,
      entryKey: 'mysteryBoon',
    });
    expect(hasAcquiredMysteryBoon()).toBe(true);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(hasAcquiredMysteryBoon()).toBe(false);
    expect(screen.getByText('Collect Mystery Boon · Mixed Blessings')).toBeTruthy();
  });

  it('activates and retires a Narcissus Pom target with its timeline pickup', async () => {
    let project = createCompleteFGProject();
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((room) => room.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    for (const selectedOptionKey of ['option3', 'option1'] as const) {
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
            { traitKey: 'NarcissusA' },
            { traitKey: 'NarcissusB' },
            { traitKey: 'NarcissusG' },
          ],
          selectedOptionKey,
        },
      });
    }
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrence.occurrenceId),
    );
    openRoomTab('Room Timeline');
    const pickupRow = () => {
      const row = screen.getByText('Collect Pom Slice · Verdure Sampler').closest('li');
      if (row === null) throw new Error('Narcissus Pom row is missing');
      return row;
    };
    expect(within(pickupRow()).queryByRole('button', { name: /^Edit Pom:/ })).toBeNull();
    const insert = within(pickupRow()).getByRole('button', {
      name: 'Add Collect Pom Slice · Verdure Sampler',
    });
    await view.user.click(insert);
    const position = screen
      .getAllByRole('button', { name: /^Add Collect Pom Slice · Verdure Sampler here:/ })
      .find((button) => button.getAttribute('aria-disabled') !== 'true');
    if (position === undefined) throw new Error('Narcissus Pom has no insertion point');
    await view.user.click(position);
    await view.user.click(
      within(pickupRow()).getByRole('button', { name: /^Edit Pom: Choose target/ }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Recorded random Pom target' }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    const target = options.find((option) => option.getAttribute('aria-disabled') !== 'true');
    if (target === undefined) throw new Error('Narcissus Pom has no available target');
    await view.user.click(target);
    await view.user.click(screen.getByRole('button', { name: 'Save Pom' }));
    const authored = view.application.store.getState().projectWorkspace.history!.present;
    expect(
      simulateProject(catalog, authored).route.biomes.find((biome) => biome.biomeKey === 'G')
        ?.findings,
    ).toEqual([]);
    await view.user.click(
      screen.getByRole('button', {
        name: 'Remove Collect Pom Slice · Verdure Sampler from timeline',
      }),
    );
    expect(within(pickupRow()).queryByRole('button', { name: /^Edit Pom:/ })).toBeNull();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(authored);
    expect(
      within(pickupRow()).getByRole('button', {
        name: /^Edit Pom:.*Pom configuration has no findings/,
      }),
    ).toBeTruthy();
  });

  it('picks up and Time Piece-converts Psyche as one undoable Narcissus row edit', async () => {
    let project = createCompleteFGProject();
    const occurrence = project.route.biomes
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
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        );

    const psycheRow = screen.getByText(/^Collect Psyche/).closest('li');
    if (!(psycheRow instanceof HTMLElement)) throw new Error('Psyche acquisition row is missing');
    expect(within(psycheRow).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(within(psycheRow).queryByLabelText(/Pickup outcome/)).toBeNull();
    const insert = within(psycheRow).getByRole('button', {
      name: /^Add Collect Psyche/,
    });
    await view.user.click(insert);
    const insertion = screen
      .getAllByRole('button', { name: /^Add Collect Psyche.* here:/ })
      .find((button) => button.getAttribute('aria-disabled') !== 'true');
    if (insertion === undefined) throw new Error('Psyche has no legal insertion');
    await view.user.click(insertion);
    expect(authoredOccurrence()?.roomActions.order.at(-1)).toEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: narcissusSite,
      entryKey: 'psyche',
    });
    const orderedPsycheRow = screen
      .getByText(/^Collect Psyche/, { selector: 'strong' })
      .closest('li');
    if (!(orderedPsycheRow instanceof HTMLElement))
      throw new Error('Ordered Psyche acquisition row is missing');
    expect(within(orderedPsycheRow).queryByRole('button', { name: 'Reward' })).toBeNull();
    await view.user.click(within(orderedPsycheRow).getByRole('button', { name: /Pickup outcome/ }));
    await view.user.click(screen.getByRole('option', { name: 'Timepiece' }));
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
    let project = createCompleteFGProject();
    const occurrence = project.route.biomes
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
    const maxManaRow = screen.getByText(/^Collect Max Magick/).closest('li');
    if (maxManaRow === null) throw new Error('Max Magick action row is missing');
    const maxMana = within(maxManaRow).getByRole('button', {
      name: /^Add Collect Max Magick/,
    });
    await view.user.click(maxMana);
    const insertion = screen
      .getAllByRole('button', { name: /^Add Collect Max Magick.* here:/ })
      .findLast((button) => button.getAttribute('aria-disabled') !== 'true');
    if (insertion === undefined) throw new Error('Max Magick has no legal insertion');
    await view.user.click(insertion);

    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'G')
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

  it('keeps the incoming reward in the room banner across tabs without another editor', () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const historyLength = view.application.store.getState().projectWorkspace.history!.past.length;
    expect(screen.getByRole('heading', { level: 3, name: 'Combat 02' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' }).textContent).toContain(
      'Big Max Magick',
    );
    expect(
      screen.getByRole('region', { name: 'Incoming reward' }).closest('header'),
    ).not.toBeNull();
    openRoomTab('Room Timeline');
    expect(screen.getByRole('region', { name: 'Incoming reward' }).textContent).toContain(
      'Big Max Magick',
    );
    expect(screen.queryByLabelText('Hub reward')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Hub reward' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyLength,
    );
  });

  it('summarizes a fixed Hub reward in the room banner', () => {
    const project = loadSurfaceNStoryBoardProject();
    renderStaticOccurrenceWorkbench(
      project,
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('story')),
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Medea' })).toBeTruthy();
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
      createCompleteFGProject(),
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
      expect.arrayContaining([expect.objectContaining({ address: phase, customizable: true })]),
    );
    expect(workspaceProjection(view.application).focusByOwner.has(semanticAddressKey(phase))).toBe(
      true,
    );
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(phase),
      ),
    ).toBe(true);
    openRoomTab('Room Overview');
    expect(screen.getByLabelText('Encounter phase')).toBeTruthy();
  });

  it('keeps the P entrance encounter picker available after selecting Empty', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.intro),
    );
    openRoomTab('Room Overview');

    const encounterControl = screen.getByLabelText('Encounter phase');
    await view.user.click(within(encounterControl).getByRole('button', { name: 'Encounter' }));
    await view.user.click(screen.getByRole('option', { name: 'Empty' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Encounter phase')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Encounter' }).textContent).toContain('Empty');
    });

    const retainedControl = screen.getByLabelText('Encounter phase');
    await view.user.click(within(retainedControl).getByRole('button', { name: 'Encounter' }));
    await view.user.click(screen.getByRole('option', { name: 'Opening combat 01' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Encounter phase')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Encounter' }).textContent).toContain(
        'Opening combat 01',
      );
    });
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
    openRoomTab('Room Overview');
    const retainedCombat = occurrenceEncounterSelections(
      view.application.store.getState().projectWorkspace.history!.present,
      'Surface',
      'P',
      occurrenceId,
    ).Combat;

    if (retainedCombat === undefined)
      throw new Error('P Combat 02 has no retained Combat selection');

    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const introControl = screen.getByLabelText('Opening encounter phase');
    expect(screen.getByLabelText('Follow-up encounter phase')).toBeTruthy();
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(combat),
      ),
    ).toBe(true);

    await view.user.click(within(introControl).getByRole('button', { name: 'Opening encounter' }));
    await view.user.click(screen.getByRole('option', { name: /Heracles combat/ }));

    await waitFor(() => expect(screen.queryByLabelText('Follow-up encounter phase')).toBeNull());
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      occurrenceEncounterSelections(
        view.application.store.getState().projectWorkspace.history!.present,
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

    await view.user.click(within(introControl).getByRole('button', { name: 'Opening encounter' }));
    await view.user.click(screen.getByRole('option', { name: /Pre-combat/ }));

    await waitFor(() => expect(screen.getByLabelText('Follow-up encounter phase')).toBeTruthy());
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 2,
    );
    expect(
      occurrenceEncounterSelections(
        view.application.store.getState().projectWorkspace.history!.present,
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
    openRoomTab('Room Overview');

    const introControl = screen.getByLabelText('Opening encounter phase');
    const combatControl = screen.getByLabelText('Follow-up encounter phase');
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(combat),
      ),
    ).toBe(true);
    await view.user.click(within(introControl).getByRole('button', { name: 'Opening encounter' }));
    await waitFor(() =>
      expect(
        within(introControl)
          .getByRole('button', { name: 'Opening encounter' })
          .getAttribute('data-candidate-state'),
      ).toBe('impossible'),
    );

    const combatPicker = within(combatControl).getByRole('button', { name: 'Follow-up encounter' });
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
    openRoomTab('Room Overview');
    const count = screen.getByRole('button', { name: 'Combat phases' });
    await view.user.click(count);
    await waitFor(() => expect(count.dataset.candidateState).toBe('impossible'));
    await view.user.keyboard('{Escape}');
    openRoomTab('Combat 2 Timeline');
    // The Timeline projects the phase read-only; its identity is authored in Overview.
    const projected = screen.getByLabelText('Combat 2 encounter events');
    expect(within(projected).queryByRole('button', { name: 'Encounter' })).toBeNull();
    openRoomTab('Room Overview');
    const phase = screen.getByLabelText('Combat 2 encounter phase');
    const phaseAddress = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Combat2',
    );
    const finding = simulateProject(catalog, project).findings.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(phaseAddress),
    );
    if (finding === undefined) throw new Error('invalid Ship Combat2 finding is missing');
    const historyLength = view.application.store.getState().projectWorkspace.history!.past.length;

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(phase.contains(document.activeElement)).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyLength,
    );
    expect(phase.dataset.readOnly).toBeUndefined();
    const encounter = within(phase).getByRole('button', { name: 'Combat 2 encounter' });
    await view.user.click(encounter);
    await waitFor(() => {
      expect(encounter.getAttribute('data-candidate-state')).toBe('impossible');
      expect(
        screen.getAllByText(/Requires biome encounter depth 2–5; currently \d+\./),
      ).not.toHaveLength(0);
    });
    expect(
      workspaceProjection(view.application).interactions.encounterPhases.has(
        semanticAddressKey(phaseAddress),
      ),
    ).toBe(true);
  });

  it('keeps I Combat selected without exposing its topology-derived Goal variant', async () => {
    const occurrenceId = createOccurrenceId('golden-i-combat01');
    const initial = createGoldenFGHIProject();
    const view = renderOccurrenceWorkbench(
      initial,
      'Underworld',
      'I',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    expect(
      within(screen.getByRole('region', { name: 'Room Timeline' })).queryByText(
        'Outgoing generation',
      ),
    ).toBeNull();
    openRoomTab('Room Overview');
    const encounter = screen.getByLabelText('Encounter phase');
    const picker = within(encounter).getByRole('button', { name: 'Encounter' });

    await view.user.click(picker);
    expect(screen.getAllByText('Combat')).not.toHaveLength(0);
    expect(screen.queryByText('Goal combat')).toBeNull();
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'I')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
        ?.encounters.encounterKeyByPhase,
    ).toEqual({ Encounter: 'GeneratedI' });
  });

  it('keeps an unavailable opening Ship Combat2 count visible and disabled', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    openRoomTab('Room Overview');
    const count = screen.getByRole('button', { name: 'Combat phases' });
    await view.user.click(count);
    await waitFor(() => {
      expect(count.dataset.candidateState).toBe('forced');
      expect(screen.getByRole('option', { name: /^Intro \+ 1 combat/ })).toBeTruthy();
    });
    await view.user.click(screen.getByRole('button', { name: /^Unavailable/ }));
    expect(
      screen.getByRole('option', { name: /^Intro \+ 2 combats/ }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      screen.getByText('Intro + 2 combats is unavailable at this point in the route.'),
    ).toBeTruthy();
    await view.user.keyboard('{Escape}');
    expect(screen.getByRole('tab', { name: 'Room Overview' })).toBeTruthy();
    openRoomTab('Intro Timeline');
    expect(screen.getByLabelText('Intro ship phase')).toBeTruthy();
    expect(
      within(screen.getByLabelText('Intro ship phase')).queryByRole('heading', { name: 'Intro' }),
    ).toBeNull();
    expect(
      within(screen.getByLabelText('Intro ship phase')).queryByRole('heading', {
        name: 'Timeline',
      }),
    ).toBeNull();
    expect(
      within(screen.getByLabelText('Intro ship phase')).getByText('Room entered'),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText('Intro ship phase')).getByLabelText('Combat 1 reward'),
    ).toBeTruthy();
    expect(within(screen.getByLabelText('Intro ship phase')).queryByText('Doors open')).toBeNull();
    openRoomTab('Combat 1 Timeline');
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    expect(combatOne).toBeTruthy();
    expect(within(combatOne).queryByRole('heading', { name: 'Combat 1' })).toBeNull();
    expect(within(combatOne).queryByRole('heading', { name: 'Timeline' })).toBeNull();
    expect(within(combatOne).getByText('Start encounter')).toBeTruthy();
    expect(within(combatOne).queryByLabelText('Combat 1 reward')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Combat 2 Timeline' })).toBeNull();
    expect(within(combatOne).getByText('Doors open')).toBeTruthy();
    expect(within(combatOne).queryByText('Outgoing generation')).toBeNull();
    act(() =>
      view.application.store.dispatch(
        semanticOwnerNavigated(createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1')),
      ),
    );
    openRoomTab('Intro Timeline');
    expect(screen.getByLabelText('Combat 1 reward')).toBeTruthy();
  });

  it('marks a forfeited Ship wheel pick on its wheel offer and collects the onion on its row', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Surface' },
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = authorLegalTraitOffers(project);
    renderOccurrenceWorkbench(project, 'Surface', 'O', occurrenceById(oOccurrenceIds.combat04));

    openRoomTab('Intro Timeline');
    const ship = screen.getByLabelText('Ship combat structure');
    const trigger = within(ship).getByTitle('Vow of Forfeit');
    expect(trigger.classList.contains('contextual-picker-trigger')).toBe(true);
    expect(trigger.textContent).toMatch(/Apollo.*\(Red Onion\)/);
    expect(within(ship).queryByText(/^Forfeit →/)).toBeNull();
    expect(within(ship).getAllByTitle('Vow of Forfeit')).toHaveLength(1);

    openRoomTab('Combat 1 Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).queryByTitle('Vow of Forfeit')).toBeNull();
    expect(within(actions).queryByRole('button', { name: /Edit Trait/ })).toBeNull();
    expect(actions.textContent).toContain('Red Onion');
    expect(actions.textContent).not.toContain('(Red Onion)');
    expect(actions.textContent).not.toContain('Forfeit');
  });

  it('keeps Ship offer identity on the wheel and acquisition children on its Room Action row', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      value: { rewardType: 'GiftDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'RunProgress',
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
    const choiceAddress = createRoomActionAddress(
      oBiome,
      oOccurrenceIds.combat07,
      roomActionKey({ kind: 'chooseRewardWheel', wheelKey: 'wheel1' }),
    );
    expect(focusByOwner.get(semanticAddressKey(choiceAddress))?.roomTab).toBe('shipIntroActions');
    expect(focusByOwner.get(semanticAddressKey(choiceAddress))?.focusAddress).toEqual(wheel);
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
    expect(within(ship).queryByText('Choose Combat 1 wheel')).toBeNull();
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Surface',
        'O',
        oOccurrenceIds.combat07,
      )?.some((action) => action.kind === 'chooseRewardWheel' && action.wheelKey === 'wheel1'),
    ).toBe(true);

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
      actionRow.querySelector(':scope > [data-timeline-cell="editors"]')?.contains(traitLauncher),
    ).toBe(true);
    expect(
      actionRow.querySelector('.acquisition-entry-resolution')?.getAttribute('data-empty'),
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
      storeKey: 'RunProgress',
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
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer2'),
      value: { rewardType: 'MaxManaDrop' },
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
    expect(within(combatOne).queryByText('Choose Combat 2 wheel')).toBeNull();
    const restoredWheel = within(combatOne).getByLabelText('Combat 2 reward');
    expect(
      within(restoredWheel).getByRole('button', { name: 'Reward pool' }).textContent,
    ).toContain('Major Reward');
    expect(
      (
        within(within(restoredWheel).getByRole('radiogroup', { name: 'Offers' })).getByRole(
          'radio',
          { name: '2' },
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    openRoomTab('Combat 2 Timeline');
    const combatTwo = screen.getByLabelText('Combat 2 ship phase');
    expect(within(combatTwo).queryByRole('heading', { name: 'Combat 2' })).toBeNull();
    expect(within(combatTwo).queryByRole('heading', { name: 'Timeline' })).toBeNull();
    expect(within(combatTwo).getByText('Start encounter')).toBeTruthy();
    expect(within(combatTwo).getByText(/^Collect .+ · Combat 2 reward/)).toBeTruthy();
    expect(within(combatTwo).getByText('Doors open')).toBeTruthy();
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
    expect(within(repairs).getByText('Choose Combat 2 wheel')).toBeTruthy();
    expect(within(repairs).getByText(/^Collect .+ · Combat 2 reward/)).toBeTruthy();
    expect(screen.getAllByText('Choose Combat 2 wheel')).toHaveLength(1);
    expect(screen.getAllByText(/^Collect .+ · Combat 2 reward/)).toHaveLength(1);

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
    expect(shipWheel2(view.application.store.getState().projectWorkspace.history!.present)).toEqual(
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
    const staleNpc = within(repairs).getByText('Resolve Combat2 encounter').closest('li');
    if (staleNpc === null) throw new Error('Dormant Combat2 NPC action is missing');
    expect(screen.getAllByText('Resolve Combat2 encounter')).toHaveLength(1);
    expect(within(staleNpc).getByText('stale')).toBeTruthy();
    expect(staleNpc.querySelector('.room-action-issues')).toBeNull();
    expect(document.getElementById(semanticOwnerControlElementId(action))).toBe(staleNpc);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(action);

    await view.user.click(
      within(staleNpc).getByRole('button', {
        name: 'Remove Resolve Combat2 encounter from timeline',
      }),
    );
    await waitFor(() => expect(screen.queryByText('Resolve Combat2 encounter')).toBeNull());
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
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
    expect(within(repairs).getByText('Clear Ship combat')).toBeTruthy();
    expect(screen.getAllByText('Clear Ship combat')).toHaveLength(1);
    openRoomTab('Combat 1 Timeline');
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    expect(within(combatOne).queryByText('Clear Ship combat')).toBeNull();
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
    openRoomTab('Room Overview');
    const count = screen.getByRole('button', { name: 'Combat phases' });

    await view.user.click(count);
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Intro + 2 combats' }).getAttribute('aria-disabled'),
      ).not.toBe('true');
      expect(
        screen
          .getByRole('option', { name: 'Intro + 2 combats' })
          .getAttribute('data-candidate-state'),
      ).toBe('possible');
    });

    await view.user.click(screen.getByRole('option', { name: 'Intro + 2 combats' }));
    openRoomTab('Combat 2 Timeline');
    await waitFor(() => expect(screen.getByLabelText('Combat 2 ship phase')).toBeTruthy());
    expect(
      occurrenceState(
        view.application.store.getState().projectWorkspace.history!.present,
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
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      value: { rewardType: 'GiftDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel1', 'offer1'),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = authorLegalTraitOffers(project);
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );

    openRoomTab('Intro Timeline');
    let rewardWheel = screen.getByLabelText('Combat 1 reward');
    const offerGrid = rewardWheel.querySelector<HTMLElement>('.reward-wheel-offers');
    if (offerGrid === null) throw new Error('Reward wheel offer grid is missing');
    expect(offerGrid.getAttribute('data-active-offer-count')).toBe('1');
    expect(offerGrid.children).toHaveLength(1);
    expect(offerGrid.firstElementChild?.getAttribute('data-picked')).toBe('true');
    expect(within(offerGrid).queryByRole('radio')).toBeNull();
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
    expect(offerGrid.getAttribute('data-active-offer-count')).toBe('2');
    expect(offerGrid.children).toHaveLength(2);
    expect(offerGrid.lastElementChild?.getAttribute('data-picked')).toBeNull();
    expect(within(offerGrid).getAllByRole('radio')).toHaveLength(2);

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRewardWheelOffer',
          offer,
          value: { rewardType: 'HermesUpgrade' },
        }),
      ),
    );
    await view.user.click(
      within(rewardWheel).getByRole('radio', {
        name: 'Pick Offer 2 from Combat 1 reward',
      }),
    );
    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history!.present, 'wheel1')
        .pickedOfferIndex,
    ).toBe(2);

    openRoomTab('Combat 1 Timeline');
    expect(
      within(screen.getByRole('region', { name: 'Room Timeline' })).getByRole('button', {
        name: /Choose Trait/,
      }),
    ).toBeTruthy();
    openRoomTab('Intro Timeline');
    rewardWheel = screen.getByLabelText('Combat 1 reward');

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
      shipWheel(view.application.store.getState().projectWorkspace.history!.present, 'wheel1')
        .offers.offer2,
    ).toEqual({
      offer: { rewardType: 'HermesUpgrade' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: { self: null },
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
      'Hermes',
    );
    expect(
      within(screen.getByRole('region', { name: 'Room Timeline' })).queryByRole('combobox', {
        name: 'Picked offer',
      }),
    ).toBeNull();
    expect(within(rewardWheel).getAllByRole('radio', { name: /Pick Offer/ })).toHaveLength(2);
  });

  it('authors an active O wheel through pool, count, offers, and picked offer controls', async () => {
    const project = loadSurfaceNOPQProject();
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );

    openRoomTab('Intro Timeline');
    const wheel = screen.getByLabelText('Combat 1 reward');
    const pool = within(wheel).getByRole('button', { name: 'Reward pool' });
    await view.user.click(pool);
    await view.user.click(await screen.findByRole('button', { name: 'Unavailable (1)' }));
    const excluded = within(screen.getByRole('listbox')).getByText('Major Reward');
    const excludedItem = excluded.closest('[cmdk-item]');
    expect(excludedItem?.getAttribute('data-candidate-state')).toBe('impossible');
    // The wheel reads the same run-wide controller ledger a batch store does,
    // at its own spawn boundary.
    expect(
      within(excludedItem as HTMLElement).getByText(
        '0 of 1 entered rooms counted Minor Reward; the controller forces Minor Reward here.',
      ),
    ).toBeTruthy();
    await view.user.click(within(screen.getByRole('listbox')).getByText('Minor Reward'));
    await waitFor(() => expect(pool.textContent).toContain('Minor Reward'));
    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history!.present, 'wheel1')
        .storeKey,
    ).toBe('MetaProgress');

    const count = within(wheel).getByRole('radiogroup', { name: 'Offers' });
    const twoOffers = within(count).getByRole('radio', { name: '2' }) as HTMLInputElement;
    await view.user.click(twoOffers);
    await waitFor(() => expect(twoOffers.checked).toBe(true));
    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history!.present, 'wheel1')
        .offerCount,
    ).toBe(2);

    const authorOffer = async (offerLabel: string, rewardLabel: string): Promise<void> => {
      const offer = screen.getByLabelText(offerLabel);
      await view.user.click(within(offer).getByRole('button', { name: 'Reward' }));
      const listbox = await screen.findByRole('listbox');
      await view.user.click(within(listbox).getByText(rewardLabel));
      await waitFor(() =>
        expect(within(screen.getByLabelText(offerLabel)).getByText(rewardLabel)).toBeTruthy(),
      );
    };

    await authorOffer('Offer 1', 'Big Bones');
    await authorOffer('Offer 2', 'Big Ashes');
    const offer2 = within(screen.getByLabelText('Combat 1 reward')).getByLabelText('Offer 2');
    await view.user.click(
      within(offer2).getByRole('radio', { name: 'Pick Offer 2 from Combat 1 reward' }),
    );
    await waitFor(() =>
      expect(
        shipWheel(view.application.store.getState().projectWorkspace.history!.present, 'wheel1')
          .pickedOfferIndex,
      ).toBe(2),
    );

    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history!.present, 'wheel1'),
    ).toMatchObject({
      storeKey: 'MetaProgress',
      offerCount: 2,
      pickedOfferIndex: 2,
      offers: {
        offer1: { offer: { rewardType: 'MetaCurrencyBigDrop' } },
        offer2: { offer: { rewardType: 'MetaCardPointsCommonBigDrop' } },
      },
    });
  });

  it('renders materialized Shop descriptors directly', () => {
    const surface = loadSurfaceNOPQProject();
    renderStaticOccurrenceWorkbench(
      surface,
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );
    expect(screen.queryByRole('columnheader')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Offer [123] Item$/ })).toHaveLength(3);
    expect(screen.queryByRole('checkbox', { name: /Interact.*Shop/i })).toBeNull();
    expect(screen.queryByText('Participation')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Preboss' })).toBeTruthy();
    cleanup();

    const goldenView = renderOccurrenceWorkbench(
      createCompleteFGProject(),
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
    expect(within(timeline).queryByText('Collect infernalContractReward')).toBeNull();
    expect(within(timeline).queryByRole('region', { name: 'Timeline repairs' })).toBeNull();
  });

  it('exposes Boosted Boons as exact I and Q World Shop items', async () => {
    const underworld = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'I',
      occurrenceById(createOccurrenceId('golden-i-preboss')),
    );
    await underworld.user.click(screen.getByRole('button', { name: 'Offer 1 Item' }));
    expect(
      within(await screen.findByRole('listbox')).getByRole('group', { name: 'Boosted Boon' }),
    ).toBeTruthy();
    cleanup();

    const surface = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'Q',
      occurrenceById(qOccurrenceIds.preboss),
    );
    await surface.user.click(screen.getByRole('button', { name: 'Offer 1 Item' }));
    const inventory = await screen.findByRole('listbox');
    expect(within(inventory).getByRole('group', { name: 'Boon' })).toBeTruthy();
    expect(within(inventory).getByRole('group', { name: 'Boosted Boon' })).toBeTruthy();
  });

  it('authors a World Shop Mystery Boon source only after purchasing it', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.prebossShop),
    );

    await view.user.click(screen.getByRole('button', { name: 'Offer 1 Item' }));
    await view.user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Mystery Boon' }),
    );
    expect(screen.queryByText('Eventual God')).toBeNull();

    const reopenedShopOffer = screen.getByRole('button', { name: 'Offer 1 Item' });
    expect(reopenedShopOffer.getAttribute('aria-disabled')).toBeNull();
    await view.user.click(reopenedShopOffer);
    expect(await screen.findByRole('listbox')).toBeTruthy();
    expect(screen.queryByText('Eventual God')).toBeNull();
    await view.user.keyboard('{Escape}');

    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Offer 1' }));
    openRoomTab('Room Timeline');
    const timeline = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(timeline).queryByText(/Collect Mystery Boon/)).toBeNull();
    const purchase = screen.getByText('Buy Mystery Boon · Slot 1').closest('li');
    if (purchase === null) throw new Error('purchased Mystery Boon row is missing');
    await view.user.click(within(purchase).getByRole('button', { name: 'Reward' }));
    expect(await screen.findByText('Eventual God')).toBeTruthy();
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Apollo'));
    const resolvedPurchase = screen.getByText('Buy Mystery Boon · Slot 1').closest('li');
    if (resolvedPurchase === null) throw new Error('resolved Mystery Boon row is missing');
    expect(within(resolvedPurchase).getByRole('button', { name: /Trait/ })).toBeTruthy();
  });

  it('authors Travel inventory on its source purchase line and preserves repair through Undo and reload', async () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const shop = createOccurrenceAddress(goldenFBiome, shopId);
    const project = authorLegalTraitOffers(
      replaceTestShopOfferActions(loadUnderworldFStygianWellCheckpoint(), catalog, shop, ['Boon']),
    );
    const view = renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));
    const current = () => view.application.store.getState().projectWorkspace.history!.present;
    const room = () =>
      current().route.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === shopId,
      )!;
    openRoomTab('Room Overview');
    expect(screen.queryByRole('button', { name: 'Travel Deal Item' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Purchased Travel Deal' })).toBeNull();
    openRoomTab('Room Timeline');
    const line = () => screen.getByRole('listitem', { name: 'Travel Deal' });
    expect(line().previousElementSibling?.textContent).toContain('Slot 1');
    await view.user.click(within(line()).getByRole('button', { name: 'Travel Deal Item' }));
    await view.user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Mystery Boon' }),
    );
    expect(room().state.kind === 'shop' ? room().state : undefined).toMatchObject({
      shop: {
        travelDealRefill: {
          optionKey: 'BlindBoxLoot',
          reward: { offer: { rewardType: 'BlindBoxLoot' } },
        },
      },
    });
    expect(room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toBeUndefined();
    expect(screen.queryByText('Eventual God')).toBeNull();
    await view.user.click(within(line()).getByRole('checkbox', { name: 'Purchased Travel Deal' }));
    const purchase = () => screen.getByText('Buy Mystery Boon · Travel Deal Offer').closest('li')!;
    await view.user.click(within(purchase()).getByRole('button', { name: 'Reward' }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    await view.user.click(
      options.find((option) => option.getAttribute('aria-disabled') !== 'true')!,
    );
    await view.user.click(within(purchase()).getByRole('button', { name: /Trait/ }));
    await view.user.click(await screen.findByRole('button', { name: 'Save trait offer' }));
    expect(
      room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill
        ?.traitOffersByAcquisitionRole.hiddenSource,
    ).toBeTruthy();
    await view.user.click(within(line()).getByRole('checkbox', { name: 'Purchased Travel Deal' }));
    expect(room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toBeUndefined();
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toBeTruthy();
    const restoredChild = room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill;
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Offer 1' }));
    openRoomTab('Room Timeline');
    // Without its source purchase the retained refill purchase loses its line and keeps removal.
    expect(screen.queryByRole('listitem', { name: 'Travel Deal' })).toBeNull();
    expect(room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toEqual(
      restoredChild,
    );
    await view.user.click(
      within(purchase()).getByRole('button', { name: /^Remove .* from timeline$/ }),
    );
    expect(room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toBeUndefined();
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(within(line()).getByRole('button', { name: 'Travel Deal Item' }).textContent).toContain(
      'Mystery Boon',
    );
    expect(room().acquisitionSites?.roomExit?.pickupEntries?.travelDealRefill).toEqual(
      restoredChild,
    );
    const saved = parseProjectDocument(encodeProjectDocument(current()), catalog);
    cleanup();
    renderOccurrenceWorkbench(saved, 'Underworld', 'F', occurrenceById(shopId));
    openRoomTab('Room Timeline');
    expect(within(purchase()).getByRole('button', { name: /Trait/ })).toBeTruthy();
  });

  it('authors a Travel Deal refill Anvil at its own purchase row, not on the Travel Deal line', () => {
    renderOccurrenceWorkbench(
      surfaceTravelDealRefillAnvilProject(),
      'Surface',
      'Q',
      occurrenceById(qOccurrenceIds.preboss),
    );
    openRoomTab('Room Timeline');
    const line = screen.getByRole('listitem', { name: 'Travel Deal' });
    expect(within(line).queryByRole('button', { name: /^Edit Anvil/ })).toBeNull();
    const refill = screen.getByText('Buy Anvil of Fates · Travel Deal Offer').closest('li');
    if (refill === null) throw new Error('Travel Deal refill purchase row is missing');
    expect(within(refill).getByRole('button', { name: /^Edit Anvil: / })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('removes the Shop Death Defiance repair control while retaining purchase authoring', async () => {
    const project = createGoldenFGHIProject();
    const shop = project.route.biomes
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
    const before = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(control);
    expect(control.checked).toBe(true);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      before + 1,
    );
  });

  it('renders an unpicked Shop as dormant without inventory controls', () => {
    const { project, shopId } = dormantShopProject();
    renderStaticOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));

    expect(screen.getByText('Shop inventory appears when you select this room.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });
});
