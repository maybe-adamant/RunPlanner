// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createOccurrenceId,
  rerollAppendIndex,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { hubBoardDrawPositions } from '@run-planner/engine/simulation';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PlannerApplication } from '@planner/composition/createApplication';
import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { loadSurfaceNProject, nBiome } from '@run-planner/test-fixtures/surface';
import {
  invalidTenDoorHubProject,
  nHubOccurrence,
  nHubState,
} from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

const hub = createHubDecisionAddress(nBiome, 'hub');

function currentProject(application: PlannerApplication): ProjectDocument {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.history.present;
}

function historySize(application: PlannerApplication): number {
  return application.store.getState().projectWorkspace.history!.past.length;
}

/** The open doors in the engine's reward draw order. */
function engineDrawOrder(application: PlannerApplication): readonly string[] {
  return (hubBoardDrawPositions(catalog, currentProject(application), hub) ?? [])
    .flatMap((slot) => (slot.open ? [slot] : []))
    .sort((left, right) => left.drawPosition - right.drawPosition)
    .map((slot) => slot.hubSlotKey);
}

function rewardRows(): HTMLElement {
  return screen.getByRole('region', { name: 'Hub door rewards' });
}

/** The listed door rows' slots, top to bottom. */
function listedSlots(): readonly string[] {
  return within(screen.getByRole('list', { name: 'Doors in draw order' }))
    .getAllByRole('listitem')
    .map((row) => row.dataset.hubSlotKey ?? '');
}

function mapDoor(name: string): HTMLElement {
  return within(screen.getByRole('region', { name: 'Ephyra Hub map' })).getByRole('button', {
    name,
  });
}

/** Keyboard activation of a map door: a click without a pointer. */
function pressDoor(name: string): void {
  fireEvent.click(mapDoor(name), { detail: 0 });
}

function unvisitedOpenSlot(application: PlannerApplication): string {
  const { decision } = nHubState(application);
  const visited = new Set(
    decision.actions.flatMap((action) => (action.kind === 'roomVisit' ? [action.hubSlotKey] : [])),
  );
  const slot = decision.openTargets.find((target) => !visited.has(target.hubSlotKey));
  if (slot === undefined) throw new Error('the N Hub has no unvisited open door');
  return slot.hubSlotKey;
}

describe('HubOverview', () => {
  it('lists the rewards in the engine draw order only once the board holds its least door count', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNProject());
    expect(nHubState(view.application).decision.openTargets).toHaveLength(9);
    expect(listedSlots()).toEqual(engineDrawOrder(view.application));
    expect(listedSlots()).toHaveLength(9);

    // Below nine open doors no rewards are drawn: the rows wait behind one status line.
    const closing = unvisitedOpenSlot(view.application);
    const label = within(rewardRows())
      .getAllByRole('listitem')
      .find((row) => row.dataset.hubSlotKey === closing)!
      .getAttribute('aria-label')!;
    pressDoor(`Close ${label}`);
    await waitFor(() => expect(nHubState(view.application).decision.openTargets).toHaveLength(8));
    expect(within(rewardRows()).queryByRole('list')).toBeNull();
    expect(within(rewardRows()).getByRole('status')).toBeTruthy();

    pressDoor(`Open ${label}`);
    await waitFor(() => expect(nHubState(view.application).decision.openTargets).toHaveLength(9));
    expect(listedSlots()).toEqual(engineDrawOrder(view.application));
  });

  it('re-sorts the rows into the new draw order when a tenth door opens', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNProject());
    const before = listedSlots();

    pressDoor('Open Combat 04');
    await waitFor(() => expect(nHubState(view.application).decision.openTargets).toHaveLength(10));
    const after = engineDrawOrder(view.application);
    expect(after).toContain('combat04');
    expect(listedSlots()).toEqual(after);
    // The new door takes its drawn place, not the end of the list.
    expect(after.filter((slot) => slot !== 'combat04')).not.toEqual(before);
  });

  it('opens a door through one lazy bound attempt and closes it again from its map button', async () => {
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const application = createApplication({
      allocateOccurrenceId: () => {
        const occurrenceId = createOccurrenceId(`hub-map-opening-${allocated.length + 1}`);
        allocated.push(occurrenceId);
        return occurrenceId;
      },
    });
    renderHubDecisionWorkbench(loadSurfaceNProject(), 'Surface', 'N', application);

    // Every declared door is one map button, named for what it does.
    const map = screen.getByRole('region', { name: 'Ephyra Hub map' });
    const doors = within(map).getAllByRole('button', { name: /^(Open|Close) / });
    expect(doors).toHaveLength(26);
    expect(new Set(doors.map((door) => door.dataset.hubSlotKey)).size).toBe(26);
    expect(doors.filter((door) => door.getAttribute('aria-pressed') === 'true')).toHaveLength(9);
    expect(allocated).toEqual([]);

    const closed = mapDoor('Open Combat 04');
    expect(closed.getAttribute('aria-pressed')).toBe('false');
    act(() => closed.focus());
    expect(allocated).toEqual([]);

    // A drag pans the map and never opens the door.
    fireEvent.pointerDown(closed, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(closed, { clientX: 28, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(closed, { clientX: 28, clientY: 20, pointerId: 1 });
    fireEvent.click(closed, { detail: 1 });
    expect(() => nHubOccurrence(application, 'combat04')).toThrow('not open');
    expect(allocated).toHaveLength(3);

    const before = historySize(application);
    act(() => closed.focus());
    fireEvent.click(closed, { detail: 0 });
    await waitFor(() =>
      expect(nHubOccurrence(application, 'combat04').occurrenceId).toBe(allocated[0]),
    );
    expect(historySize(application)).toBe(before + 1);
    expect(allocated).toHaveLength(3);
    // The door keeps keyboard focus and now closes it.
    const opened = mapDoor('Close Combat 04');
    expect(opened.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(opened);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toBeNull();

    fireEvent.click(opened, { detail: 0 });
    await waitFor(() => expect(() => nHubOccurrence(application, 'combat04')).toThrow('not open'));
    expect(historySize(application)).toBe(before + 2);

    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(mapDoor('Close Combat 04')).toBeTruthy());
    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(mapDoor('Open Combat 04')).toBeTruthy());
    act(() => application.store.dispatch(authoredProjectRedoRequested()));
    await waitFor(() =>
      expect(mapDoor('Close Combat 04').getAttribute('aria-pressed')).toBe('true'),
    );
  });

  it('begins a new opening attempt after the projection is replaced', async () => {
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const application = createApplication({
      allocateOccurrenceId: () => {
        const occurrenceId = createOccurrenceId(`hub-opening-attempt-${allocated.length + 1}`);
        allocated.push(occurrenceId);
        return occurrenceId;
      },
    });
    renderHubDecisionWorkbench(loadSurfaceNProject(), 'Surface', 'N', application);
    const closed = mapDoor('Open Combat 04');
    fireEvent.pointerDown(closed, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(closed, { clientX: 20, clientY: 20, pointerId: 1 });
    expect(allocated).toHaveLength(3);

    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceFearVowRank',
          route: { kind: 'route', routeKey: 'Surface' },
          vowKey: 'EnemyDamageShrineUpgrade',
          rank: 1,
        }),
      ),
    );
    const replaced = await screen.findByRole('button', { name: 'Open Combat 04' });
    fireEvent.pointerDown(replaced, { clientX: 20, clientY: 20, pointerId: 2 });
    fireEvent.pointerUp(replaced, { clientX: 20, clientY: 20, pointerId: 2 });
    expect(allocated).toHaveLength(6);
    fireEvent.click(replaced, { detail: 1 });
    await waitFor(() =>
      expect(nHubOccurrence(application, 'combat04').occurrenceId).toBe(allocated[3]),
    );
  });

  it('keeps a door that cannot open focusable with its reason, and inert to activation', async () => {
    const view = renderHubDecisionWorkbench(invalidTenDoorHubProject);
    const map = screen.getByRole('region', { name: 'Ephyra Hub map' });
    const door = within(map)
      .getAllByRole('button', { name: /^Open / })
      .find((candidate) => candidate.getAttribute('aria-disabled') === 'true')!;
    expect(door).toBeDefined();
    expect(door).not.toHaveProperty('disabled', true);
    act(() => door.focus());
    expect(document.activeElement).toBe(door);
    expect(door.getAttribute('aria-description')).toBeTruthy();

    const decision = nHubState(view.application).decision;
    const before = historySize(view.application);
    fireEvent.keyDown(door, { key: 'Enter' });
    fireEvent.click(door, { detail: 0 });
    expect(nHubState(view.application).decision).toBe(decision);
    expect(historySize(view.application)).toBe(before);
  });

  it('shows each door’s first draw while a Hub reroll replaces it later', async () => {
    const plain = loadSurfaceNProject();
    renderHubDecisionWorkbench(plain);
    const rowReward = () =>
      within(within(rewardRows()).getByRole('listitem', { name: 'Combat 03' }))
        .getByRole('button', { name: /^Reward(: |$)/ })
        .getAttribute('aria-label');
    const firstDraw = rowReward();
    cleanup();

    const held = applyProjectCommand(plain, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Surface' },
      arcanaKeys: ['DoorReroll'],
    });
    const rerolled = applyProjectCommand(held, catalog, {
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat03',
      reward: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' } },
      index: rerollAppendIndex(held, { kind: 'hubStay', hub, precedingVisitCount: 1 })!,
    });
    renderHubDecisionWorkbench(rerolled);
    expect(rowReward()).toBe(firstDraw);
    expect(rowReward()).not.toContain('Aphrodite');
  });

  it('resets the board as one command that Undo restores', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNProject());
    const before = nHubState(view.application).topology;
    const size = historySize(view.application);
    const reset = within(rewardRows()).getByRole('button', { name: 'Reset Board' });

    await view.user.click(reset);
    await waitFor(() => expect(nHubState(view.application).decision.openTargets).toEqual([]));
    expect(nHubState(view.application).decision.actions).toEqual([]);
    expect(historySize(view.application)).toBe(size + 1);
    expect(reset).toHaveProperty('disabled', true);
    expect(
      within(screen.getByRole('region', { name: 'Ephyra Hub map' })).getAllByRole('button', {
        name: /^Open /,
      }),
    ).toHaveLength(26);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(nHubState(view.application).topology).toEqual(before));
    expect(reset).toHaveProperty('disabled', false);
  });

  it('offers a ten-door board no singleton reward already on a peer', async () => {
    const view = renderHubDecisionWorkbench(invalidTenDoorHubProject);
    const row = within(rewardRows()).getByRole('listitem', { name: 'Combat 09' });
    await view.user.click(within(row).getByRole('button', { name: /^Reward(: |$)/ }));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: /Big Max Health/ })).toBeNull();
  });
});
