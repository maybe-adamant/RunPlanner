// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  hubVisitSlotKeys,
  rerollAppendIndex,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { loadSurfaceNProject, nBiome, nVisitSlotKeys } from '@run-planner/test-fixtures/surface';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import { nHubState, selectHubTab, twoVisitHubProject } from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

const hub = createHubDecisionAddress(nBiome, 'hub');

function withHubActions(
  project: ProjectDocument,
  visits: readonly string[],
  fountainAfterVisits: number | null,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubActionOrder',
    hub,
    actions: hubVisitActions(visits, fountainAfterVisits),
  });
}

function withDoorReroll(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Surface' },
    arcanaKeys: ['DoorReroll'],
  });
}

function historySize(application: PlannerApplication): number {
  return application.store.getState().projectWorkspace.history!.past.length;
}

/** The map beside the visits, named for the stay it shows. */
function shownMap(): HTMLElement {
  const [map, ...others] = screen
    .getAllByRole('region')
    .filter((region) => region.getAttribute('aria-label')?.startsWith('Ephyra Hub at '));
  if (map === undefined || others.length > 0) throw new Error('expected one Hub Timeline map');
  return map;
}

function shownStay(): string {
  return shownMap().getAttribute('aria-label')!.slice('Ephyra Hub at '.length);
}

/** The shown stay's doors, by accessible name. */
function shownDoors(): readonly string[] {
  return within(shownMap())
    .queryAllByRole('img')
    .flatMap((door) => (door.dataset.hubSlotKey === undefined ? [] : [door.ariaLabel ?? '']));
}

function shownDoor(slot: string): HTMLElement {
  const door = shownMap().querySelector<HTMLElement>(`[data-hub-slot-key="${slot}"]`);
  if (door === null) throw new Error(`the shown stay has no ${slot} door`);
  return door;
}

describe('HubTimeline', () => {
  it('shows on its map the stay of the choice being worked on', async () => {
    const view = renderHubDecisionWorkbench(twoVisitHubProject());
    selectHubTab('Hub Timeline');
    // It opens on the next visit to choose: the stay that visit picks from.
    expect(shownStay()).toBe('Visit 2');

    // A picked, settled visit's label shows the stay it leaves, its door cleared.
    fireEvent.click(screen.getByRole('button', { name: 'Visit 1' }));
    expect(shownStay()).toBe('Visit 1');
    expect(screen.getByRole('button', { name: 'Visit 1' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(shownDoor('combat05').ariaLabel).toMatch(/Cleared$/);
    expect(shownDoor('combat05').dataset.selectedVisit).toBe('true');

    // A visit's room picker shows the stay it picks from.
    fireEvent.focus(screen.getByRole('button', { name: 'Visit 2 room' }));
    expect(shownStay()).toBe('Visit 1');
    expect(shownDoor('miniBoss01').ariaLabel).not.toMatch(/Cleared$/);

    // An unpicked visit's label shows the stay before it.
    fireEvent.click(screen.getByRole('button', { name: 'Visit 3' }));
    expect(shownStay()).toBe('Visit 2');
    expect(shownDoors().length).toBeGreaterThan(0);

    // An unreached visit waits: its picker is held and its stay has no doors yet.
    const unreached = screen.getByRole('button', { name: 'Visit 4 room' });
    expect(unreached).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Visit 5' }));
    expect(shownStay()).toBe('Visit 4');
    expect(shownDoors()).toEqual([]);

    // The option under the picker's highlight links its door.
    await view.user.click(screen.getByRole('button', { name: 'Visit 3 room' }));
    expect(shownStay()).toBe('Visit 2');
    const listbox = await screen.findByRole('listbox');
    await view.user.keyboard('{ArrowDown}');
    const active = within(listbox)
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-selected') === 'true')!;
    const linked = shownMap().querySelectorAll<HTMLElement>('[data-linked="true"]');
    expect(linked).toHaveLength(1);
    expect(linked[0]!.ariaLabel?.startsWith(`${active.textContent}:`)).toBe(true);
  });

  it('shows a reroll row’s own stay, its door marked rerolled with its chain', () => {
    const held = withDoorReroll(loadSurfaceNProject());
    const project = applyProjectCommand(held, catalog, {
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat03',
      reward: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' } },
      index: rerollAppendIndex(held, { kind: 'hubStay', hub, precedingVisitCount: 1 })!,
    });
    renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    fireEvent.click(screen.getByRole('button', { name: 'Entry' }));
    expect(shownStay()).toBe('Entry');
    expect(shownDoor('combat03').ariaLabel).not.toMatch(/rerolled$/);

    const rerolls = screen.getByRole('region', { name: 'Visit 1 rerolls' });
    fireEvent.focus(within(rerolls).getByRole('button', { name: /^Reroll 1 reward/ }));
    expect(shownStay()).toBe('Visit 1');
    const door = shownDoor('combat03');
    expect(door.ariaLabel).toMatch(/Aphrodite, rerolled$/);
    expect(door.dataset.hint).toMatch(/ → .*Aphrodite/);
  });

  it('picks a visit’s room as one complete action order, and Undo restores it', async () => {
    const view = renderHubDecisionWorkbench(twoVisitHubProject());
    selectHubTab('Hub Timeline');
    const before = nHubState(view.application).decision.actions;
    const size = historySize(view.application);

    await view.user.click(screen.getByRole('button', { name: 'Visit 3 room' }));
    const listbox = await screen.findByRole('listbox');
    await view.user.click(within(listbox).getByRole('option', { name: /Combat 02/ }));
    await waitFor(() =>
      expect(hubVisitSlotKeys(nHubState(view.application).decision)).toEqual([
        'combat05',
        'miniBoss01',
        'combat02',
      ]),
    );
    expect(historySize(view.application)).toBe(size + 1);
    expect(screen.getByRole('button', { name: 'Open Combat 02' })).toBeTruthy();

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(nHubState(view.application).decision.actions).toEqual(before));
  });

  it('adds a stay reroll from its segment’s die', async () => {
    const application = createApplication();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderHubDecisionWorkbench(
      withDoorReroll(loadSurfaceNProject()),
      'Surface',
      'N',
      application,
    );
    selectHubTab('Hub Timeline');
    dispatch.mockClear();
    const entry = screen.getByRole('region', { name: 'Entry rerolls' });

    await view.user.click(within(entry).getByRole('button', { name: 'New reroll door' }));
    await view.user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Combat 03' }),
    );
    // The reward picker opens for the press; a Boon then asks for its source.
    while (
      !dispatch.mock.calls.some(([action]) => authoredProjectCommandDispatched.match(action))
    ) {
      const listbox = await screen.findByRole('listbox');
      const option = within(listbox)
        .getAllByRole('option')
        .find((candidate) => candidate.getAttribute('aria-disabled') !== 'true');
      if (option === undefined) throw new Error('the reroll offers no reward');
      await view.user.click(option);
    }
    const commands = dispatch.mock.calls
      .map(([action]) => action)
      .filter(authoredProjectCommandDispatched.match)
      .map((action) => action.payload);
    expect(commands).toEqual([
      expect.objectContaining({ kind: 'InsertHubReroll', hub, hubSlotKey: 'combat03' }),
    ]);
    await waitFor(() =>
      expect(nHubState(view.application).decision.actions.map((action) => action.kind)).toContain(
        'reroll',
      ),
    );
    expect(
      within(screen.getByRole('region', { name: 'Entry rerolls' })).getByRole('button', {
        name: 'Remove reroll 1',
      }),
    ).toBeTruthy();
  });

  it('resets the visits with one ResetHubVisits command that Undo restores', async () => {
    const application = createApplication();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderHubDecisionWorkbench(loadSurfaceNProject(), 'Surface', 'N', application);
    selectHubTab('Hub Timeline');
    const before = nHubState(view.application).topology;
    const openBefore = nHubState(view.application).decision.openTargets;
    const size = historySize(view.application);
    dispatch.mockClear();
    const visits = screen.getByRole('region', { name: 'Ephyra Hub timeline' });

    await view.user.click(within(visits).getByRole('button', { name: 'Reset visits' }));
    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([{ kind: 'ResetHubVisits', hub }]);
    await waitFor(() => expect(hubVisitSlotKeys(nHubState(view.application).decision)).toEqual([]));
    expect(historySize(view.application)).toBe(size + 1);
    // The board stays as it was.
    expect(nHubState(view.application).decision.openTargets).toEqual(openBefore);
    expect(within(visits).getByRole('button', { name: 'Reset visits' })).toHaveProperty(
      'disabled',
      true,
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(nHubState(view.application).topology).toEqual(before));
  });

  it('places an unused fountain in a chosen stay', async () => {
    const view = renderHubDecisionWorkbench(
      withHubActions(loadSurfaceNProject(), nVisitSlotKeys, null),
    );
    selectHubTab('Hub Timeline');
    expect(screen.queryByRole('button', { name: 'Reorder Fountain' })).toBeNull();
    await view.user.click(screen.getByRole('button', { name: 'Use Fountain' }));
    await view.user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Visit 3' }),
    );
    await waitFor(() =>
      expect(nHubState(view.application).decision.actions).toEqual(
        hubVisitActions(nVisitSlotKeys, 3),
      ),
    );
    expect(screen.queryByRole('button', { name: 'Use Fountain' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reorder Fountain' })).toBeTruthy();
  });

  it('leaves the Hub from its own segment only once every visit is set', () => {
    renderHubDecisionWorkbench(twoVisitHubProject());
    selectHubTab('Hub Timeline');
    expect(screen.queryByRole('group', { name: 'Leave' })).toBeNull();
  });

  it('closes the visits with the Leave segment after all six', () => {
    renderHubDecisionWorkbench(loadSurfaceNProject());
    selectHubTab('Hub Timeline');
    const visits = screen.getByRole('region', { name: 'Ephyra Hub timeline' });
    const leave = within(visits).getByRole('group', { name: 'Leave' });
    expect(within(leave).getByRole('button', { name: 'Open Preboss' })).toBeTruthy();
    expect(visits.lastElementChild).toBe(leave);
  });
});
