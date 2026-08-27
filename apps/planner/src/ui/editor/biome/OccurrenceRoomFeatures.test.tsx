// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  roomActionKey,
  semanticAddressKey,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  createGoldenFGHIProject,
  createUnderworldFPoolCheckpoint,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
  loadUnderworldFGProject,
} from '@run-planner/test-fixtures/underworld';
import {
  authoredAnomalyProject,
  decisionContainingOccurrence,
  occurrenceById,
  openRoomTab,
} from '@planner-test/support/occurrence-workbench';
import {
  renderDecisionWorkbench,
  renderOccurrenceWorkbench,
} from '@planner-test/support/biome-workbench';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OccurrenceRoomFeatures', () => {
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
    expect(
      screen.getByRole('button', { name: 'Save event' }).classList.contains('primary-action'),
    ).toBe(true);

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

  it('edits a Nemesis trait trade target through the contextual picker', async () => {
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
    const eventEditor = await screen.findByRole('region', { name: 'Nemesis event' });
    await waitFor(() => expect(eventEditor.contains(document.activeElement)).toBe(true));

    const family = screen.getByRole('combobox', { name: 'Nemesis family' });
    await view.user.click(family);
    await waitFor(() =>
      expect(within(family).getByRole('option', { name: 'trait Trade' })).toBeTruthy(),
    );
    await view.user.selectOptions(family, 'traitTrade');
    const trait = await screen.findByRole('button', { name: 'Nemesis trait' });
    await view.user.click(trait);
    const listbox = await screen.findByRole('listbox');
    const firstChoice = within(listbox).getAllByRole('option')[0];
    if (firstChoice === undefined) throw new Error('Nemesis trait choices are missing');
    await view.user.click(firstChoice);
    expect(trait.textContent).not.toContain('Choose a trait');

    await view.user.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
          ?.encounters.nemesisRandomEventByPhase?.Encounter?.kind,
      ).toBe('traitTrade'),
    );
  });

  it('keeps an unreached Well domain visible as unassessed', async () => {
    const occurrenceId = createOccurrenceId('completion:F:postboss');
    const owner = createOccurrenceAddress(goldenFBiome, occurrenceId);
    let project = applyProjectCommand(loadUnderworldFGProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellInteraction',
      occurrence: owner,
      interacted: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: owner,
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });

    const application = createApplication();
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
      application,
    );
    const feature = application
      .selectStructuredWorkspace(application.store.getState())
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.nodes.find((node) => {
        if (node.kind !== 'occurrenceWorkbench') return false;
        return node.room.occurrenceId === occurrenceId;
      });
    const workbench = feature?.kind === 'occurrenceWorkbench' ? feature.room.workbench : undefined;
    if (workbench?.kind !== 'standard') throw new Error('F Postboss workbench is missing');
    const well = workbench.features.find((candidate) => candidate.kind === 'stygianWell');
    expect(well).toMatchObject({ assessment: 'unassessed' });

    const picker = screen.getByRole('button', { name: 'Stygian Well Healing' });
    await view.user.click(picker);
    const choice = await screen.findByRole('option', { name: 'ArmorBoostStore' });
    expect(picker.getAttribute('data-candidate-state')).toBe('unassessed');
    expect(choice.getAttribute('data-candidate-state')).toBe('unassessed');
    expect(choice.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('marks a reached stale Pool trait as selected-invalid', async () => {
    const occurrenceId = createOccurrenceId('completion:F:postboss');
    const owner = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const project = applyProjectCommand(createUnderworldFPoolCheckpoint(), catalog, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: owner,
      slotKey: 'left',
      traitKey: 'AthenaProjectileBoon',
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const feature = view.application
      .selectStructuredWorkspace(view.application.store.getState())
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.nodes.find((node) => {
        if (node.kind !== 'occurrenceWorkbench') return false;
        return node.room.occurrenceId === occurrenceId;
      });
    expect(feature?.kind).toBe('occurrenceWorkbench');
    const picker = screen.getByRole('button', { name: 'Pool of Purging Left slot' });
    await view.user.click(picker);
    const choice = await screen.findByRole('option', { name: /Phalanx Shot/ });
    await waitFor(() => expect(picker.getAttribute('data-candidate-state')).toBe('impossible'));
    expect(screen.getByText('Current selection')).toBeTruthy();
    expect(choice.getAttribute('data-candidate-state')).toBe('impossible');
    expect(choice.getAttribute('aria-disabled')).toBe('true');
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

    const removeNemesis = screen.getByRole('button', { name: 'Remove Nemesis event' });
    expect(removeNemesis).toBeTruthy();
    expect(removeNemesis.classList.contains('danger-action')).toBe(true);
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
    const addNemesis = screen.getByRole('button', { name: 'Add Nemesis event' });
    expect(addNemesis).toBeTruthy();
    expect(addNemesis.classList.contains('secondary-action')).toBe(true);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(authoredFields()?.encounters.encounterKeyByPhase.Passive).toBe('NemesisRandomEvent'),
    );
  });
});
