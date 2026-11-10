// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
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
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
  loadUnderworldFGProject,
} from '@run-planner/test-fixtures/underworld';
import { loadUnderworldFPoolCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  authoredAnomalyProject,
  decisionContainingOccurrence,
  expectBefore,
  occurrenceById,
  openNotReached,
  openRoomTab,
  reachedAnomalyProject,
} from '@planner-test/support/occurrence-workbench';
import {
  renderDecisionWorkbench,
  renderOccurrenceWorkbench,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import { hintOf } from '@planner-test/support/hints';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function chooseNemesisEvent(
  user: ReturnType<typeof renderOccurrenceWorkbench>['user'],
  label: string,
): Promise<void> {
  const encounter = screen.getByRole('button', { name: 'Encounter' });
  if (encounter.textContent?.includes('Nemesis event') !== true) {
    await user.click(encounter);
    await user.click(await screen.findByRole('option', { name: /^Nemesis event/ }));
  }
  await user.click(await screen.findByRole('button', { name: /^Nemesis event type/ }));
  await user.click(await screen.findByRole('option', { name: label }));
}

describe('OccurrenceRoomFeatures', () => {
  it('hides Nemesis detail pickers while the room waits on its Overview', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const reached = renderOccurrenceWorkbench(
      loadNemesisFieldsCheckpoint(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const enabled = screen.getByRole('button', { name: 'Reward' }) as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
    reached.unmount();
    const project = applyProjectCommand(loadNemesisFieldsCheckpoint(), catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      // A cage point another cage already holds blocks the room's Overview.
      spatial: createFieldsSpatialAddress(createOccurrenceAddress(goldenHBiome, occurrenceId), {
        kind: 'cage',
        slotKey: 'cage2',
      }),
      pointId: 573087,
    });
    renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    // The room stops in its Overview: its Timeline, the event's row included, waits unshown.
    expect(document.querySelector('[data-stop-notice="overview"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Reward' })).toBeNull();
  });

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
    // The capture-point outcome is decided in the room, not fixed on entry.
    expect(screen.queryByRole('button', { name: /^Anomaly outcome/ })).toBeNull();
    expect(screen.queryByLabelText('Reward')).toBeNull();
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Incoming reward' })).toBeTruthy();
    expect(screen.queryByLabelText('Room')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Restore Combat 01/ })).toBeNull();
    view.unmount();
    cleanup();

    const door = renderDecisionWorkbench(
      project,
      'Underworld',
      'G',
      decisionContainingOccurrence(occurrenceId),
      application,
    );
    expect(screen.getByLabelText('Reward')).toBeTruthy();
    const map = screen.getByRole('button', { name: /^Door \d+ room$/ });
    // Restore names the door it acts on, as Replace with Anomaly does.
    const doorNumber = /^Door (\d+) room$/.exec(map.getAttribute('aria-label') ?? '')?.[1];
    const restore = screen.getByRole('button', {
      name: `Restore Combat 01 on Door ${doorNumber}`,
    });
    expect(map.textContent).toContain('Anomaly 01');
    expect(screen.queryByRole('button', { name: /^Anomaly outcome/ })).toBeNull();
    await door.user.click(map);
    await door.user.click(screen.getByRole('option', { name: 'Anomaly 05' }));
    await door.user.click(restore);
    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([
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

  it('decides the Anomaly outcome at its Encounter outcome, before its end and reward pickup', async () => {
    const { occurrenceId, project } = reachedAnomalyProject();
    const application = createApplication();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'G',
      occurrenceById(occurrenceId),
      application,
    );
    expect(screen.queryByRole('button', { name: /^Anomaly outcome/ })).toBeNull();
    openRoomTab('Room Timeline');
    const timeline = screen.getByRole('tabpanel');
    const cleared = within(timeline).getByRole('button', { name: /^Anomaly outcome/ });
    expect(cleared.textContent).toBe('Cleared');
    const encounterEnd = within(timeline).getByText('Encounter ended');
    const pickup = within(timeline)
      .getAllByRole('listitem')
      .find((row) => row.getAttribute('data-room-action-key')?.includes('interactIncomingReward'));
    if (pickup === undefined) throw new Error('cleared Anomaly lost its reward pickup');
    expectBefore(cleared, encounterEnd);
    expectBefore(encounterEnd, pickup);
    // The capture point is how the fight ended: it sits among its outcome's controls.
    expect(cleared.closest('.timeline-banner-modifiers')).not.toBeNull();
    expect(cleared.closest('li')).toBe(within(timeline).getByLabelText('Encounter outcome'));

    await view.user.click(cleared);
    await view.user.click(await screen.findByRole('option', { name: 'Not cleared' }));
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
    expect(screen.queryByLabelText('Room')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Restore Combat 01/ })).toBeNull();
    cleanup();
    renderDecisionWorkbench(invalid, 'Underworld', 'G', decisionContainingOccurrence(occurrenceId));
    expect(screen.getByRole('button', { name: /^Door \d+ room$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Restore Combat 01 on Door \d+$/ })).toBeTruthy();
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
    // The Nemesis family is part of the phase identity, authored in Overview.
    openRoomTab('Room Overview');
    const family = screen.getByRole('button', { name: 'Nemesis event type' });
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
    openRoomTab('Room Timeline');
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
    expect(within(actionRow).getByText('sells')).toBeTruthy();
    await waitFor(() => expect(actionRow.dataset.selectedFinding).toBe('true'));
    await view.user.click(within(actionRow).getByRole('button', { name: 'Reward' }));
    await view.user.click(await screen.findByRole('option', { name: 'Max Health' }));
    await waitFor(() =>
      expect(
        authoredEvent()?.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result
          ?.offer.rewardType,
      ).toBeTruthy(),
    );
    expect(hintOf(within(actionRow).getByRole('button', { name: 'Reward' }))).toContain(
      'Max Health',
    );
    // The answer ends her encounter, so it is chosen on a banner, not on the row.
    expect(within(actionRow).queryByRole('button', { name: /^Nemesis outcome/ })).toBeNull();
    const outcome = () => screen.getByRole('button', { name: /^Nemesis outcome/ });
    expect(outcome().textContent).toBe('Declined');
    await view.user.click(outcome());
    await view.user.click(await screen.findByRole('option', { name: 'Accepted' }));
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
    await waitFor(() => expect(outcome().textContent).toBe('Declined'));
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].some(
        (row) => row.dataset.roomActionKey === generatedAction,
      ),
    ).toBe(false);
  });

  it('selects the Nemesis event in one step and authors its type beside the picker', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const authoredOccurrence = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);

    openRoomTab('Room Overview');
    const history = () => view.application.store.getState().projectWorkspace.history!;
    const before = history().present;
    const pastCount = history().past.length;
    const encounter = screen.getByRole('button', { name: 'Encounter' });
    const initialLabel = encounter.querySelector('span')!.textContent!;
    expect(screen.queryByRole('button', { name: /^Nemesis event type/ })).toBeNull();
    await view.user.click(encounter);
    const nemesis = await screen.findByRole('option', { name: 'Nemesis event' });
    expect(nemesis.getAttribute('aria-disabled')).not.toBe('true');
    await view.user.click(nemesis);
    // Choosing the event is one edit; no second step opens in the encounter picker.
    await waitFor(() =>
      expect(authoredOccurrence()?.encounters.encounterKeyByPhase.Encounter).toBe(
        'NemesisRandomEvent',
      ),
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(history().past).toHaveLength(pastCount + 1);
    expect(screen.getByRole('button', { name: 'Encounter' }).textContent).toBe('Nemesis event');

    const type = screen.getByRole('button', { name: 'Nemesis event type' });
    await view.user.click(type);
    for (const full of ['Free item', 'Gold trade', 'Damage trade', 'Boon trade', 'Damage contest'])
      expect(await screen.findByRole('option', { name: full })).toBeTruthy();
    await view.user.click(screen.getByRole('option', { name: 'Gold trade' }));
    await waitFor(() =>
      expect(authoredOccurrence()?.encounters.nemesisRandomEventByPhase?.Encounter).toEqual({
        kind: 'goldTrade',
        response: 'decline',
      }),
    );
    expect(history().past).toHaveLength(pastCount + 2);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(history().present).toBe(before);
    await view.user.click(screen.getByRole('button', { name: 'Encounter' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText(initialLabel));
    expect(authoredOccurrence()?.encounters.encounterKeyByPhase.Encounter).toBe(
      before.route.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrenceId,
      )!.encounters.encounterKeyByPhase.Encounter,
    );
  });

  it('shows the chosen Nemesis type by its short name and announces its full name', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    for (const [full, short] of [
      ['Free item', 'Item'],
      ['Gold trade', 'Gold'],
      ['Damage trade', 'Damage'],
      ['Boon trade', 'Boon'],
      ['Damage contest', 'Contest'],
    ] as const) {
      await chooseNemesisEvent(view.user, full);
      const type = await screen.findByRole('button', { name: `Nemesis event type: ${full}` });
      expect(type.querySelector('span')!.textContent).toBe(short);
    }
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
    openRoomTab('Room Overview');
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
    const family = screen.getByRole('button', { name: 'Nemesis event type' });
    await waitFor(() => expect(family.contains(document.activeElement)).toBe(true));
    openRoomTab('Room Timeline');
    // Its event type unchosen, the room stops in its Overview.
    expect(document.querySelector('[data-stop-notice="overview"]')).not.toBeNull();
    openRoomTab('Room Overview');
    await chooseNemesisEvent(view.user, 'Free item');
    openRoomTab('Room Timeline');
    expect(screen.queryByText('Choose a Nemesis event.')).toBeNull();
    let freeAction = [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
      (row) =>
        row.dataset.roomActionKey ===
        roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
    );
    if (freeAction === undefined) throw new Error('Free-item interaction action is missing');
    const nemesisAction = () =>
      [...document.querySelectorAll<HTMLElement>('[data-room-action-key]')].find(
        (row) =>
          row.dataset.roomActionKey ===
          roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
      )!;
    expect(within(freeAction).getByText('gives')).toBeTruthy();
    expect(within(freeAction).getByRole('button', { name: 'Reward' })).toBeTruthy();
    // A free item has no answer to settle.
    expect(screen.queryByRole('button', { name: /^Nemesis outcome/ })).toBeNull();
    openRoomTab('Room Overview');
    await chooseNemesisEvent(view.user, 'Boon trade');
    openRoomTab('Room Timeline');
    freeAction = nemesisAction();
    const trait = await screen.findByRole('button', { name: 'Boon offered' });
    expect(within(freeAction).getByText('takes')).toBeTruthy();
    const fixedReward = within(freeAction).getByRole('img', { name: 'Triple Gold' });
    expect(
      trait.compareDocumentPosition(fixedReward) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(freeAction).queryByRole('button', { name: /^Nemesis outcome/ })).toBeNull();
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
    openRoomTab('Room Overview');
    await chooseNemesisEvent(view.user, 'Damage trade');
    openRoomTab('Room Timeline');
    freeAction = nemesisAction();
    expect(within(freeAction).getByText('hits you to get')).toBeTruthy();
    expect(within(freeAction).getByRole('button', { name: 'Reward' })).toBeTruthy();
    // Her unchosen reward stops the walk at her row; the trade's outcome waits past it.
    openNotReached();
    expect(screen.getByRole('button', { name: /^Nemesis outcome/ }).textContent).toBe('Declined');
  });

  it('keeps the contest offer through its result; a failed contest spawns Consolation', async () => {
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
    openRoomTab('Room Overview');
    await chooseNemesisEvent(view.user, 'Damage contest');
    openRoomTab('Room Timeline');
    const sentence = () =>
      screen.getByText('to get').closest<HTMLElement>('[data-room-action-key]')!;
    const result = () => screen.getByRole('button', { name: /^Nemesis outcome/ });
    const choose = async (label: string) => {
      await view.user.click(result());
      await view.user.click(await screen.findByRole('option', { name: label }));
    };
    const authoredOccurrence = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    const reward = () =>
      authoredOccurrence()?.acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result;

    // A new contest has lost, with no success item planned; she still drops Consolation.
    expect(result().textContent).toBe('Failed');
    expect(within(sentence()).queryByRole('button', { name: /^Nemesis outcome/ })).toBeNull();
    expect(reward() ?? null).toBeNull();
    await view.user.click(within(sentence()).getByRole('button', { name: 'Reward' }));
    await view.user.click(await screen.findByRole('option', { name: 'Max Health' }));
    await waitFor(() => expect(reward()?.offer.rewardType).toBe('MaxHealthDrop'));

    await choose('Succeeded');
    await waitFor(() =>
      expect(authoredOccurrence()?.encounters.nemesisRandomEventByPhase?.Encounter).toEqual({
        kind: 'damageContest',
        result: 'success',
      }),
    );
    expect(reward()?.offer.rewardType).toBe('MaxHealthDrop');

    await choose('Failed');
    await waitFor(() => expect(result().textContent).toBe('Failed'));
    expect(reward()?.offer.rewardType).toBe('MaxHealthDrop');
    expect(within(sentence()).getByRole('button', { name: 'Reward' })).toBeTruthy();
    // Her Consolation is collected, never the planned item.
    const chip = document.querySelector<HTMLElement>('[data-spawned-loot="moment"] button')!;
    await view.user.click(chip);
    const collect = await waitFor(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-room-action-key="${CSS.escape(
          JSON.stringify(['interactAcquisitionEntry', 'nemesisGenerated:Encounter', 'result']),
        )}"]`,
      );
      expect(row).not.toBeNull();
      return row!;
    });
    expect(within(collect).getByRole('img', { name: 'Red Onion' })).toBeTruthy();
    expect(within(collect).queryByRole('img', { name: 'Max Health' })).toBeNull();
    expect(reward()?.offer.rewardType).toBe('MaxHealthDrop');
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
    const picker = screen.getByRole('button', { name: 'Stygian Well Offer 1 Item' });
    await view.user.click(picker);
    const choice = await screen.findByRole('option', { name: 'Splintered Shield' });
    expect(picker.getAttribute('data-candidate-state')).toBe('unassessed');
    expect(choice.getAttribute('data-candidate-state')).toBe('unassessed');
    expect(choice.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('shows the entry flip the plan holds where the door settles another, and clears it', async () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence,
      layout: { flipped: false },
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    const entry = screen.getByRole('button', { name: 'Entry' });
    expect(entry.getAttribute('aria-invalid')).toBe('true');
    expect(entry.textContent).not.toContain('⇋');
    await view.user.click(entry);
    await view.user.click(await screen.findByRole('option', { name: /Flipped/ }));
    const layout = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')!
        .topology!.occurrences.find((entry) => entry.occurrenceId === occurrenceId)!.layout;
    expect(layout()).toBeUndefined();
  });

  it('marks a reached stale Pool trait as selected-invalid', async () => {
    const occurrenceId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const owner = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const project = applyProjectCommand(loadUnderworldFPoolCheckpoint(), catalog, {
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

  it('disables the Passive Nemesis event after an earlier encounter and explains why', async () => {
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
    expect(screen.queryByRole('checkbox', { name: /Nemesis/ })).toBeNull();
    const passivePicker = () => screen.getByRole('button', { name: 'Passive' });
    const initialLabel = passivePicker().querySelector('span')!.textContent!;
    await view.user.click(passivePicker());
    await view.user.click(await screen.findByRole('button', { name: 'Unavailable (1)' }));
    const unavailable = await screen.findByRole('option', { name: /^Nemesis event/ });
    expect(unavailable.getAttribute('aria-disabled')).toBe('true');
    expect(unavailable.textContent).toContain('already occurred this run');
    const before = view.application.store.getState().projectWorkspace.history!.present;
    await view.user.click(unavailable);
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(before);
    await view.user.keyboard('{Escape}');

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
    expect(passivePicker().textContent).toContain('Nemesis event');

    await view.user.click(passivePicker());
    await view.user.click(within(await screen.findByRole('listbox')).getByText(initialLabel));
    expect(passivePicker().textContent).toContain(initialLabel);
    await view.user.click(passivePicker());
    await view.user.click(await screen.findByRole('button', { name: 'Unavailable (1)' }));
    expect(
      (await screen.findByRole('option', { name: /^Nemesis event/ })).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('binds an unavailable Passive Nemesis selection to its Passive picker for repair', async () => {
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
    const repaired = project;
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    const finding = simulateProject(catalog, project).findings.find(
      (entry) => entry.code === 'encounterUnavailable',
    )!;
    expect(finding.origin).toEqual(passive);
    const initialLabel = repaired.route.biomes
      .find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)!
      .encounters.encounterKeyByPhase.Passive;
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
    const picker = screen.getByRole('button', { name: 'Passive' });
    await waitFor(() => expect(document.activeElement).toBe(picker));
    expect(picker.getAttribute('data-selected-finding')).toBe('true');
    expect(picker.getAttribute('data-semantic-owner')).toBe(semanticAddressKey(passive));
    expect(claimants()).toEqual([picker]);
    const before = view.application.store.getState().projectWorkspace.history!.present;
    await view.user.click(picker);
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    const passiveCombat = options.find((option) => !/^Nemesis event/.test(option.textContent!))!;
    await view.user.click(passiveCombat);
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'H')
          ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)
          ?.encounters.encounterKeyByPhase.Passive,
      ).not.toBe('NemesisRandomEvent'),
    );
    expect(initialLabel).not.toBe('NemesisRandomEvent');
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(before);
  });

  it('allows the Passive Nemesis event despite an authored one on an unvisited alternative', async () => {
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
    const passivePicker = () => screen.getByRole('button', { name: 'Passive' });
    const initialLabel = passivePicker().querySelector('span')!.textContent!;
    await view.user.click(passivePicker());
    const nemesis = await screen.findByRole('option', { name: /^Nemesis event/ });
    expect(nemesis.getAttribute('aria-disabled')).not.toBe('true');
    await view.user.click(nemesis);
    await waitFor(() => expect(passivePicker().textContent).toContain('Nemesis event'));
    expect(screen.getByRole('button', { name: 'Nemesis event type' })).toBeTruthy();

    await view.user.click(passivePicker());
    await view.user.click(within(await screen.findByRole('listbox')).getByText(initialLabel));
    await waitFor(() => expect(passivePicker().textContent).toContain(initialLabel));
    expect(screen.queryByRole('button', { name: /^Nemesis event type/ })).toBeNull();
  });

  it('authors the Passive Nemesis event in its picker and preserves an over-cap count through repair and Undo', async () => {
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
    expect(workspace.interactions.encounterPhases.has(semanticAddressKey(passive))).toBe(true);
    const authoredFields = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);

    openRoomTab('Room Overview');
    expect(screen.getByRole('button', { name: 'Passive' }).textContent).toContain('Nemesis event');
    expect(screen.queryByRole('checkbox', { name: /Nemesis/ })).toBeNull();
    openRoomTab('Room Overview');
    const count = screen.getByRole('button', { name: /^Optional pickups/ });
    expect(count.textContent).toContain('4');

    await view.user.click(count);
    await view.user.click(await screen.findByRole('option', { name: '3' }));
    await waitFor(() => expect(authoredFields()?.state).toMatchObject({ optionalRewardCount: 3 }));
    // The Passive event's family is fixed when Nemesis spawns: it is authored in the Overview.
    const beforeEvent = view.application.store.getState().projectWorkspace.history!.present;
    const structure = screen.getByRole('region', { name: 'Encounter structure' });
    await view.user.click(within(structure).getByRole('button', { name: /^Nemesis event type/ }));
    await view.user.click(await screen.findByRole('option', { name: 'Damage contest' }));
    expect(authoredFields()?.encounters.nemesisRandomEventByPhase?.Passive).toEqual({
      kind: 'damageContest',
      result: 'failure',
    });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(beforeEvent);
    openRoomTab('Room Timeline');
    expect(screen.queryByRole('button', { name: /^Nemesis event type/ })).toBeNull();
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
    // The result moves by keyboard through its reorder handle: pick up, step, drop.
    const move = within(optionalRow).getByRole('button', { name: /^Reorder / });
    move.focus();
    await view.user.keyboard(' ');
    await view.user.keyboard('{ArrowUp}');
    await view.user.keyboard(' ');
    await waitFor(() => expect(authoredFields()?.roomActions.order).not.toEqual(orderBeforeMove));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(authoredFields()?.roomActions.order).toEqual(orderBeforeMove));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(authoredFields()?.state).toMatchObject({ optionalRewardCount: 4 }));

    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Passive' }));
    const passiveCombat = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find((option) => !/^Nemesis event/.test(option.textContent!))!;
    await view.user.click(passiveCombat);
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
