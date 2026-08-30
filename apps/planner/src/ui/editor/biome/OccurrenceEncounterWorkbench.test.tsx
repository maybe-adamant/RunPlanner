// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createGorgonPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
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

import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
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

  it('keeps the P entrance encounter picker available after selecting Empty', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'P',
      occurrenceById(pOccurrenceIds.intro),
    );
    openRoomTab('Room Timeline');

    const encounterControl = screen.getByLabelText('Encounter encounter phase');
    await view.user.click(within(encounterControl).getByRole('button', { name: 'Encounter' }));
    await view.user.click(screen.getByRole('option', { name: 'Empty' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Encounter encounter phase')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Encounter' }).textContent).toContain('Empty');
    });

    const retainedControl = screen.getByLabelText('Encounter encounter phase');
    await view.user.click(within(retainedControl).getByRole('button', { name: 'Encounter' }));
    await view.user.click(screen.getByRole('option', { name: 'Opening combat 01' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Encounter encounter phase')).toBeTruthy();
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
    openRoomTab('Room Overview');
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

  it('keeps an unavailable opening Ship Combat2 count visible and disabled', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    openRoomTab('Room Overview');
    const count = screen.getByRole('combobox', { name: /Combat phases/ }) as HTMLSelectElement;
    await view.user.click(count);
    await waitFor(() => {
      expect(count.dataset.candidateSupport).toBe('forced');
      expect(Array.from(count.options).map((option) => option.value)).toEqual(['2', '3']);
      expect(count.options[1]).toMatchObject({
        disabled: true,
        textContent: 'Intro + 2 combats — unavailable',
      });
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
    expect(within(combatOne).getByText('Choose Combat 2 reward')).toBeTruthy();
    const restoredWheel = within(combatOne).getByLabelText('Combat 2 reward');
    expect(
      (within(restoredWheel).getByRole('combobox', { name: 'Reward pool' }) as HTMLSelectElement)
        .value,
    ).toBe('RunProgress');
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
    expect(within(rewardWheel).queryByRole('radio')).toBeNull();
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
    expect(within(rewardWheel).getAllByRole('radio')).toHaveLength(2);

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
      shipWheel(view.application.store.getState().projectWorkspace.history.present, 'wheel1')
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
      shipWheel(view.application.store.getState().projectWorkspace.history.present, 'wheel1').offers
        .offer2,
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
    expect(within(rewardWheel).getAllByRole('radio')).toHaveLength(2);
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
    const pool = within(wheel).getByRole('combobox', { name: 'Reward pool' }) as HTMLSelectElement;
    await view.user.click(pool);
    await waitFor(() => expect(pool.options[0]?.dataset.candidateSupport).toBe('impossible'));
    await view.user.selectOptions(pool, 'MetaProgress');
    await waitFor(() => expect(pool.value).toBe('MetaProgress'));
    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history.present, 'wheel1')
        .storeKey,
    ).toBe('MetaProgress');

    const count = within(wheel).getByRole('combobox', { name: 'Offers' }) as HTMLSelectElement;
    await view.user.click(count);
    await waitFor(() => expect(count.options[1]?.dataset.candidateSupport).toBe('possible'));
    await view.user.selectOptions(count, '2');
    await waitFor(() => expect(count.value).toBe('2'));
    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history.present, 'wheel1')
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
        shipWheel(view.application.store.getState().projectWorkspace.history.present, 'wheel1')
          .pickedOfferIndex,
      ).toBe(2),
    );

    expect(
      shipWheel(view.application.store.getState().projectWorkspace.history.present, 'wheel1'),
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

  it('renders an unpicked Shop as dormant without inventory controls', () => {
    const { project, shopId } = dormantShopProject();
    renderStaticOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));

    expect(screen.getByText('Shop inventory appears when you select this room.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });
});
