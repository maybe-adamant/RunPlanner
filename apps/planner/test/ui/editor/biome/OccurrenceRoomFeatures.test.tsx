// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
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
  workspaceProjection,
} from '@planner-test/support/biome-workbench';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function chooseNemesisEvent(
  user: ReturnType<typeof renderOccurrenceWorkbench>['user'],
  label: string,
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Encounter' }));
  await user.click(await screen.findByRole('option', { name: /^Nemesis event/ }));
  await user.click(await screen.findByRole('option', { name: label }));
}

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
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' })).toBeTruthy();
    expect(screen.queryByLabelText('Room')).toBeNull();
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
    const map = screen.getByLabelText('Room');
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
    expect(screen.queryByLabelText('Room')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore Combat 01' })).toBeNull();
    cleanup();
    renderDecisionWorkbench(invalid, 'Underworld', 'G', decisionContainingOccurrence(occurrenceId));
    expect(screen.getByLabelText('Room')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore Combat 01' })).toBeTruthy();
  });
  it('authors a Gold trade immediately from Event through its action-row interaction and Undo', async () => {
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
    expect(screen.getByRole('button', { name: 'Encounter' })).toBeTruthy();
    const family = screen.getByRole('button', { name: 'Encounter' });
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const eventOwner = createNemesisRandomEventAddress(phase);
    const finding = simulateProject(catalog, project).findings.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(eventOwner),
    );
    if (finding === undefined) throw new Error('missing Nemesis outcome finding');
    act(() =>
      view.application.store.dispatch(
        findingSelected({
          key: semanticFindingKey(finding),
          origin: finding.origin,
          focusAddress: workspaceProjection(view.application).focusByOwner.get(
            semanticAddressKey(finding.origin),
          )!.focusAddress,
        }),
      ),
    );
    await waitFor(() => expect(family.contains(document.activeElement)).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    await chooseNemesisEvent(view.user, 'Gold trade');
    const authoredEvent = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    await waitFor(() =>
      expect(authoredEvent()?.encounters.nemesisRandomEventByPhase?.Encounter).toEqual({
        kind: 'goldTrade',
        response: 'decline',
      }),
    );
    const actionOwner = createRoomActionAddress(
      goldenFBiome,
      occurrenceId,
      roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
    );
    const missingDetail = simulateProject(
      catalog,
      view.application.store.getState().projectWorkspace.history!.present,
    ).findings.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(actionOwner),
    );
    if (missingDetail === undefined) throw new Error('missing Nemesis interaction-detail finding');
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(missingDetail), origin: missingDetail.origin }),
      ),
    );
    const actionRow = [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (row) =>
        row.dataset.roomActionKey ===
        roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
    );
    if (actionRow === undefined) throw new Error('Nemesis interaction row is missing');
    expect(within(actionRow).getByText('Nemesis offers to take Gold to give')).toBeTruthy();
    await waitFor(() => expect(actionRow.dataset.selectedFinding).toBe('true'));
    expect(family.dataset.selectedFinding).toBe('false');
    await view.user.click(within(actionRow).getByRole('button', { name: 'Reward' }));
    await view.user.click(await screen.findByRole('option', { name: 'Max Health' }));
    await waitFor(() =>
      expect(
        authoredEvent()?.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result
          ?.offer.rewardType,
      ).toBeTruthy(),
    );
    expect(within(actionRow).getByRole('button', { name: 'Reward' }).textContent).toContain(
      'Max Health',
    );
    const accept = screen.getByRole('checkbox', { name: 'Accept' });
    expect(accept.closest('.nemesis-interaction-controls')).toBeTruthy();
    expect(
      within(actionRow).getByRole('button', { name: 'Reward' }).compareDocumentPosition(accept) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect((accept as HTMLInputElement).checked).toBe(false);
    await view.user.click(accept);
    await waitFor(() =>
      expect(authoredEvent()?.encounters.nemesisRandomEventByPhase?.Encounter).toEqual({
        kind: 'goldTrade',
        response: 'accept',
      }),
    );
    const generatedAction = roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'nemesisGenerated:Encounter',
      entryKey: 'result',
    });
    await waitFor(() =>
      expect(
        [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].some(
          (row) => row.dataset.roomActionKey === generatedAction,
        ),
      ).toBe(true),
    );
    expect(view.application.store.getState().projectWorkspace.history!.past.length).toBeGreaterThan(
      historyBefore,
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect((screen.getByRole('checkbox', { name: 'Accept' }) as HTMLInputElement).checked).toBe(
        false,
      ),
    );
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].some(
        (row) => row.dataset.roomActionKey === generatedAction,
      ),
    ).toBe(false);
  });

  it('selects a Nemesis family atomically and returns to combat through the same picker', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const authoredEncounter = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
        ?.encounters.encounterKeyByPhase.Encounter;

    openRoomTab('Room Timeline');
    const history = () => view.application.store.getState().projectWorkspace.history!;
    const before = history().present;
    const pastCount = history().past.length;
    const encounter = screen.getByRole('button', { name: 'Encounter' });
    const initialLabel = encounter.querySelector('span')!.textContent!;
    await view.user.click(encounter);
    const nemesis = await screen.findByRole('option', { name: 'Nemesis event' });
    expect(nemesis.getAttribute('aria-disabled')).not.toBe('true');
    await view.user.click(nemesis);
    expect(await screen.findByRole('option', { name: 'Gold trade' })).toBeTruthy();
    expect(history().present).toBe(before);
    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(history().present).toBe(before);
    expect(history().past).toHaveLength(pastCount);
    await chooseNemesisEvent(view.user, 'Gold trade');
    await waitFor(() => expect(authoredEncounter()).toBe('NemesisRandomEvent'));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
          ?.encounters.nemesisRandomEventByPhase?.Encounter,
      ).toEqual({ kind: 'goldTrade', response: 'decline' }),
    );

    const retainedPicker = screen.getByRole('button', { name: 'Encounter' });
    expect(retainedPicker.textContent).toContain('Nemesis event · Gold trade');
    expect(history().past).toHaveLength(pastCount + 1);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(history().present).toBe(before);
    await chooseNemesisEvent(view.user, 'Free item');
    await view.user.click(screen.getByRole('button', { name: 'Encounter' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText(initialLabel));
    expect(authoredEncounter()).toBe(
      before.route.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrenceId,
      )!.encounters.encounterKeyByPhase.Encounter,
    );
  });

  it('keeps free and boon-trade detail on the Nemesis action row', async () => {
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
        findingSelected({
          key: semanticFindingKey(finding),
          origin: finding.origin,
          focusAddress: workspaceProjection(view.application).focusByOwner.get(
            semanticAddressKey(finding.origin),
          )!.focusAddress,
        }),
      ),
    );
    const family = screen.getByRole('button', { name: 'Encounter' });
    await waitFor(() => expect(family.contains(document.activeElement)).toBe(true));
    await chooseNemesisEvent(view.user, 'Free item');
    const freeAction = [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (row) =>
        row.dataset.roomActionKey ===
        roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
    );
    if (freeAction === undefined) throw new Error('Free-item interaction action is missing');
    expect(within(freeAction).getByText('Interact with Nemesis to get')).toBeTruthy();
    expect(within(freeAction).getByRole('button', { name: 'Reward' })).toBeTruthy();
    expect(within(freeAction).queryByRole('checkbox')).toBeNull();
    await chooseNemesisEvent(view.user, 'Boon trade');
    const trait = await screen.findByRole('button', { name: 'Boon offered' });
    expect(within(freeAction).getByText('Nemesis offers to take')).toBeTruthy();
    const fixedReward = within(freeAction).getByText('to give Triple Gold');
    expect(
      within(freeAction)
        .getByRole('checkbox', { name: 'Accept' })
        .closest('.nemesis-interaction-controls'),
    ).toBeTruthy();
    expect(
      trait.compareDocumentPosition(fixedReward) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      fixedReward.compareDocumentPosition(
        within(freeAction).getByRole('checkbox', { name: 'Accept' }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await view.user.click(trait);
    const listbox = await screen.findByRole('listbox');
    const firstChoice = within(listbox).getAllByRole('option')[0];
    if (firstChoice === undefined) throw new Error('Nemesis trait choices are missing');
    await view.user.click(firstChoice);
    expect(trait.textContent).not.toContain('Choose a boon');

    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
          ?.encounters.nemesisRandomEventByPhase?.Encounter?.kind,
      ).toBe('traitTrade'),
    );
    await chooseNemesisEvent(view.user, 'Damage trade');
    expect(within(freeAction).getByText('Nemesis offers to hit you to give')).toBeTruthy();
    expect(
      within(freeAction)
        .getByRole('checkbox', { name: 'Accept' })
        .closest('.nemesis-interaction-controls'),
    ).toBeTruthy();
    expect(
      within(freeAction)
        .getByRole('button', { name: 'Reward' })
        .compareDocumentPosition(within(freeAction).getByRole('checkbox', { name: 'Accept' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('switches the leading contest result between a selectable reward and fixed consolation', async () => {
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
    await chooseNemesisEvent(view.user, 'Damage contest');
    const phrase = screen.getByText('at Nemesis’s damage challenge →');
    const sentence = phrase.parentElement!;
    const result = within(sentence).getByRole('combobox', { name: 'Contest result' });
    expect((result as HTMLSelectElement).value).toBe('failure');
    expect(result.compareDocumentPosition(phrase) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(sentence).getByText('Red Onion')).toBeTruthy();
    const authoredOccurrence = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    const reward = () =>
      authoredOccurrence()?.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result;
    expect(reward()?.offer.rewardType).toBe('RoomRewardConsolationPrize');

    await view.user.selectOptions(result, 'success');
    await waitFor(() => expect(reward()).toBeNull());
    expect(
      result.compareDocumentPosition(within(sentence).getByRole('button', { name: 'Reward' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(authoredOccurrence()?.encounters.nemesisRandomEventByPhase?.Encounter).toEqual({
      kind: 'damageContest',
      result: 'success',
    });
    await view.user.click(screen.getByRole('button', { name: 'Reward' }));
    await view.user.click(await screen.findByRole('option', { name: 'Max Health' }));
    expect(reward()?.offer.rewardType).toBe('MaxHealthDrop');

    await view.user.selectOptions(result, 'failure');
    await waitFor(() => expect(reward()?.offer.rewardType).toBe('RoomRewardConsolationPrize'));
    expect(screen.queryByRole('button', { name: 'Reward' })).toBeNull();
  });

  it('keeps an unreached Well domain visible as unassessed', async () => {
    const occurrenceId = createOccurrenceId('golden-f-b2-e2');
    const owner = createOccurrenceAddress(goldenFBiome, occurrenceId);
    let project = loadUnderworldFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'AddStygianWell',
      occurrence: owner,
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
      .selectStructuredWorkspace(application.store.getState())!
      .route?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.nodes.find((node) => {
        if (node.kind !== 'occurrenceWorkbench') return false;
        return node.room.occurrenceId === occurrenceId;
      });
    const workbench = feature?.kind === 'occurrenceWorkbench' ? feature.room.workbench : undefined;
    if (workbench?.kind !== 'standard') throw new Error('F Postboss workbench is missing');
    const well = workbench.features.find((candidate) => candidate.kind === 'stygianWell');
    expect(well).toMatchObject({ assessment: 'unassessed' });

    openRoomTab('Room Overview');
    const presence = screen.getByRole('checkbox', { name: 'Stygian Well present' });
    expect((presence as HTMLInputElement).checked).toBe(true);
    expect((presence as HTMLInputElement).disabled).toBe(false);
    const picker = screen.getByRole('button', { name: 'Stygian Well Offer 1 Item' });
    await view.user.click(picker);
    const choice = await screen.findByRole('option', { name: 'Splintered Shield' });
    expect(picker.getAttribute('data-candidate-state')).toBe('unassessed');
    expect(choice.getAttribute('data-candidate-state')).toBe('unassessed');
    expect(choice.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('marks a reached stale Pool trait as selected-invalid', async () => {
    const occurrenceId = createOccurrenceId('golden-f-preboss-shop:postboss');
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
      .selectStructuredWorkspace(view.application.store.getState())!
      .route?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.nodes.find((node) => {
        if (node.kind !== 'occurrenceWorkbench') return false;
        return node.room.occurrenceId === occurrenceId;
      });
    expect(feature?.kind).toBe('occurrenceWorkbench');
    openRoomTab('Room Overview');
    const picker = screen.getByRole('button', { name: 'Pool of Purging Offer 1 Item' });
    await view.user.click(picker);
    const choice = await screen.findByRole('option', { name: /Phalanx Shot/ });
    await waitFor(() => expect(picker.getAttribute('data-candidate-state')).toBe('impossible'));
    expect(screen.getByText('Current selection')).toBeTruthy();
    expect(choice.getAttribute('data-candidate-state')).toBe('impossible');
    expect(choice.getAttribute('aria-disabled')).toBe('true');
  });

  it('disables adding Nemesis after an earlier encounter and explains why', async () => {
    const earlierId = createOccurrenceId('golden-h-combat09');
    const phase = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: earlierId },
      'Cage01',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisCombatH',
    });
    expect(simulateProject(catalog, project).findings).toEqual([]);
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat05')),
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Nemesis Event' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.getAttribute('aria-description')).toContain('already occurred this run');
    const before = view.application.store.getState().projectWorkspace.history!.present;

    await view.user.click(checkbox);

    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(before);

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'SelectEncounter',
          phase: createEncounterPhaseAddress(
            goldenHBiome,
            {
              kind: 'occurrence',
              occurrenceId: createOccurrenceId('golden-h-combat05'),
            },
            'Passive',
          ),
          encounterKey: 'NemesisRandomEvent',
        }),
      ),
    );
    const retained = screen.getByRole('checkbox', { name: 'Nemesis Event' }) as HTMLInputElement;
    expect(retained.checked).toBe(true);
    expect(retained.disabled).toBe(false);

    await view.user.click(retained);

    const removed = screen.getByRole('checkbox', { name: 'Nemesis Event' }) as HTMLInputElement;
    expect(removed.checked).toBe(false);
    expect(removed.disabled).toBe(true);
  });

  it('binds an unavailable Passive Nemesis selection to its checkbox for repair', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const passive = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId },
      'Passive',
    );
    const claimants = () =>
      [...document.querySelectorAll<HTMLElement>('[data-semantic-owner]')].filter(
        (element) => element.dataset.semanticOwner === semanticAddressKey(passive),
      );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat09') },
        'Cage01',
      ),
      encounterKey: 'NemesisCombatH',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    const finding = simulateProject(catalog, project).findings.find(
      (entry) => entry.code === 'encounterUnavailable',
    )!;
    expect(finding.origin).toEqual(passive);
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    expect(claimants()).toEqual([]);
    openRoomTab('Room Overview');
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Nemesis Event' });
    await waitFor(() => expect(document.activeElement).toBe(checkbox));
    expect(checkbox.getAttribute('data-selected-finding')).toBe('true');
    expect(checkbox.getAttribute('data-semantic-owner')).toBe(semanticAddressKey(passive));
    expect(claimants()).toEqual([checkbox]);
    const before = view.application.store.getState().projectWorkspace.history!.present;
    await view.user.click(checkbox);
    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Nemesis Event' }) as HTMLInputElement).checked,
      ).toBe(false),
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(before);
  });

  it('allows adding Nemesis despite an authored encounter on an unvisited alternative', async () => {
    const laterId = createOccurrenceId('golden-h-combat04');
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: laterId },
        'Passive',
      ),
      encounterKey: 'NemesisRandomEvent',
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat05')),
    );
    const checkbox = () =>
      screen.getByRole('checkbox', { name: 'Nemesis Event' }) as HTMLInputElement;
    expect(checkbox().checked).toBe(false);
    expect(checkbox().disabled).toBe(false);

    await view.user.click(checkbox());

    expect(checkbox().checked).toBe(true);
    expect(checkbox().disabled).toBe(false);

    await view.user.click(checkbox());

    expect(checkbox().checked).toBe(false);
    expect(checkbox().disabled).toBe(false);
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
    if (workspace === undefined) throw new Error('workspace projection is unavailable');
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
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);

    openRoomTab('Room Overview');
    const nemesis = screen.getByRole('checkbox', { name: 'Nemesis Event' });
    expect((nemesis as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('combobox', { name: /Passive encounter/i })).toBeNull();
    openRoomTab('Room Overview');
    const count = screen.getByRole('combobox', { name: 'Optional pickups' });
    expect((count as HTMLSelectElement).value).toBe('4');
    expect(within(count).getByRole('option', { name: '4' })).toBeTruthy();

    await view.user.selectOptions(count, '3');
    await waitFor(() => expect(authoredFields()?.state).toMatchObject({ optionalRewardCount: 3 }));
    openRoomTab('Room Timeline');
    const beforeEvent = view.application.store.getState().projectWorkspace.history!.present;
    await view.user.click(screen.getByRole('button', { name: 'Event' }));
    await view.user.click(await screen.findByRole('option', { name: 'Damage contest' }));
    expect(authoredFields()?.encounters.nemesisRandomEventByPhase?.Passive).toEqual({
      kind: 'damageContest',
      result: 'failure',
    });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(beforeEvent);
    const eventActionKey = roomActionKey({ kind: 'interactEncounter', phaseKey: 'Passive' });
    const eventRow = [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (row) => row.dataset.roomActionKey === eventActionKey,
    );
    if (eventRow === undefined) throw new Error('Nemesis interaction row is missing');
    expect(within(eventRow).getByRole('button', { name: 'Reward' })).toBeTruthy();
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
    await view.user.click(screen.getByRole('checkbox', { name: 'Nemesis Event' }));
    await waitFor(() =>
      expect(authoredFields()?.encounters.encounterKeyByPhase.Passive).not.toBe(
        'NemesisRandomEvent',
      ),
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(authoredFields()?.encounters.encounterKeyByPhase.Passive).toBe('NemesisRandomEvent'),
    );
  });
});
