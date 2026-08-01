// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildGroupAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlannerApplication } from '../../../composition/createApplication';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  renderHubDecisionWorkbench,
  renderStaticHubDecisionWorkbench,
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

describe('HubDecisionWorkbench', () => {
  it('renders the declaration-owned board and complete visit timeline', () => {
    renderStaticHubDecisionWorkbench(createRepresentativeNOPQProject());

    expect(screen.getByRole('heading', { name: 'Open Ephyra rooms' })).toBeTruthy();
    expect(screen.getAllByLabelText(/Hub slot$/)).toHaveLength(26);
    expect(document.querySelectorAll('.hub-visit-row')).toHaveLength(6);
    expect(screen.getByText('Pylon visit order')).toBeTruthy();
  });

  it('creates the board from its Hub frontier and keeps the first physical slot actionable', async () => {
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

    await view.user.click(screen.getByRole('button', { name: 'Create Hub board' }));
    await waitFor(() => expect(screen.getAllByLabelText(/Hub slot$/)).toHaveLength(26));
    await view.user.click(screen.getByLabelText('Combat 01 open'));
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat01',
        ),
      ).toBe(true),
    );
  });

  it('opens, edits, focuses, and closes an unvisited room through its compact card', async () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'hub-compact-unvisited-room',
        name: 'Hub compact unvisited room',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    const view = renderHubDecisionWorkbench(project);
    const closedCard = screen.getByRole('article', { name: 'Combat 04 Hub slot' });
    const open = within(closedCard).getByRole('checkbox', { name: 'Combat 04 open' });
    expect(closedCard.querySelector('[data-assessment]')?.getAttribute('data-assessment')).toBe(
      'assessed',
    );

    await view.user.pointer({ keys: '[MouseLeft]', target: open });
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub slot' });
    expect(within(openedCard).queryByText(/Closing this slot removes/)).toBeNull();
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

    const openedOccurrenceId = nHubOccurrence(view.application, 'combat04').occurrenceId;
    await view.user.click(within(openedCard).getByRole('button', { name: 'Inspect Combat 04' }));
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, openedOccurrenceId),
    );

    const close = within(screen.getByRole('article', { name: 'Combat 04 Hub slot' })).getByRole(
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
  }, 10_000);

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

    const confirmation = vi.spyOn(globalThis, 'confirm');
    await view.user.click(screen.getByRole('button', { name: 'Remove visits from Visit 2' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(['combat05']),
    );
    expect(orderedNHubSideEntries(view.application, 'combat05')).toEqual(preservedSideOrder);
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
    await view.user.click(screen.getByRole('button', { name: 'Remove visits from Visit 6' }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toHaveLength(5));
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

    expect(screen.getAllByLabelText(/Hub slot$/)).toHaveLength(26);
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
});
