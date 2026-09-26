// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  hubVisitSlotKeys,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNPartialHubProject,
  loadSurfaceNProject,
  nBiome,
  nOccurrenceId,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures/surface';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import { nHubState, twoVisitHubProject } from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

async function showTimeline(user: {
  click: (element: HTMLElement) => Promise<void>;
}): Promise<void> {
  const tab = screen.getByRole('tab', { name: 'Hub Timeline' });
  if (tab.getAttribute('aria-selected') !== 'true') await user.click(tab);
}

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

function visitBadges(): readonly (string | null)[] {
  return Array.from(document.querySelectorAll('.hub-map-visit-badge')).map(
    (badge) => badge.textContent,
  );
}

describe('HubMapTimeline', () => {
  it('appends the fountain use once and badges the combined action order', async () => {
    const view = renderHubDecisionWorkbench(
      withHubActions(loadSurfaceNPartialHubProject(), ['combat05', 'miniBoss01'], null),
    );
    await showTimeline(view.user);
    expect(screen.getByRole('button', { name: 'Combat 05: Visit 1, step 1.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Satyr Champion: Visit 2, step 2.' })).toBeTruthy();

    await view.user.click(
      screen.getByRole('button', { name: 'Hub fountain: Unused. Use fountain.' }),
    );
    await waitFor(() =>
      expect(nHubState(view.application).decision.actions).toEqual(
        hubVisitActions(['combat05', 'miniBoss01'], 2),
      ),
    );
    const used = screen.getByRole('button', { name: 'Hub fountain: Step 3.' });
    expect(used.getAttribute('aria-disabled')).toBe('true');
    expect([...visitBadges()].sort()).toEqual(['1', '2', '3']);

    // A used fountain is not offered again; a later room visit follows it.
    const historySize = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(used);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historySize,
    );
    const next = screen.getAllByRole('button', { name: /Unvisited\. Add visit\./ })[0]!;
    await view.user.click(next);
    await waitFor(() => expect(nHubState(view.application).decision.actions).toHaveLength(4));
    expect(
      nHubState(view.application).decision.actions.filter(
        (action) => action.kind === 'useFountain',
      ),
    ).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Visit 3, step 4\.$/ })).toHaveLength(1);
  });

  it('badges fountain-first order while room visit ordinals stay one through six', async () => {
    const view = renderHubDecisionWorkbench(twoVisitHubProject());
    await showTimeline(view.user);
    expect(screen.getByRole('button', { name: 'Hub fountain: Step 1.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Combat 05: Visit 1, step 2.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Satyr Champion: Visit 2, step 3.' })).toBeTruthy();
    expect([...visitBadges()].sort()).toEqual(['1', '2', '3']);
  });

  it('keeps six-room capacity independent of the fountain use', async () => {
    const view = renderHubDecisionWorkbench(
      withHubActions(loadSurfaceNProject(), nVisitSlotKeys, null),
    );
    await showTimeline(view.user);
    expect(screen.queryByRole('button', { name: /Unvisited\. Add visit\./ })).toBeNull();
    await view.user.click(
      screen.getByRole('button', { name: 'Hub fountain: Unused. Use fountain.' }),
    );
    await waitFor(() =>
      expect(nHubState(view.application).decision.actions).toEqual(
        hubVisitActions(nVisitSlotKeys, 6),
      ),
    );
    expect(screen.getByRole('button', { name: 'Hub fountain: Step 7.' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Visit \d+, step \d+\.$/ })).toHaveLength(6);
  });

  it('does not use the fountain when a pointer drag pans the map', async () => {
    const view = renderHubDecisionWorkbench(
      withHubActions(loadSurfaceNPartialHubProject(), ['combat05'], null),
    );
    await showTimeline(view.user);
    const historySize = view.application.store.getState().projectWorkspace.history!.past.length;
    const fountain = screen.getByRole('button', { name: 'Hub fountain: Unused. Use fountain.' });
    fireEvent.pointerDown(fountain, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(fountain, { clientX: 40, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(fountain, { clientX: 40, clientY: 20, pointerId: 1 });
    fireEvent.click(fountain, { detail: 1 });
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historySize,
    );
    expect(nHubState(view.application).decision.actions).toEqual(
      hubVisitActions(['combat05'], null),
    );
  });

  it('appends unvisited rooms sequentially until the authored visit order reaches capacity', async () => {
    const view = renderHubDecisionWorkbench(twoVisitHubProject());
    await showTimeline(view.user);

    const healthRoom = screen.getByRole('button', { name: 'Combat 01: Unvisited. Add visit.' });
    expect(healthRoom.getAttribute('aria-description')).toBe('Reward: Big Max Health');
    expect(healthRoom.getAttribute('title')).toBe('Combat 01: Big Max Health');
    const healthIcon = healthRoom.querySelector('img');
    expect(decodeURIComponent(healthIcon?.getAttribute('src') ?? '')).toContain('Max Health.webp');
    expect(healthIcon?.draggable).toBe(false);

    for (let visitCount = 2; visitCount < 6; visitCount += 1) {
      const next = screen.getAllByRole('button', { name: /Unvisited\. Add visit\./ })[0];
      if (next === undefined) throw new Error('partial Hub has no next open room to append');
      await view.user.click(next.querySelector('img') ?? next);
      await waitFor(() =>
        expect(hubVisitSlotKeys(nHubState(view.application).decision)).toHaveLength(visitCount + 1),
      );
    }

    expect(screen.queryByRole('button', { name: /Unvisited\. Add visit\./ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Visit \d+, step \d+\.$/ })).toHaveLength(6);
    // Six rooms follow the fountain-first use: seven actions, six visit ordinals.
    expect(nHubState(view.application).decision.actions).toHaveLength(7);
  });

  it('opens visited rooms on a complete board without appending past capacity', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    await showTimeline(view.user);
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const visited = screen.getByRole('button', { name: 'Combat 05: Visit 1, step 2.' });

    expect(visited.getAttribute('aria-disabled')).toBeNull();
    expect(visited.getAttribute('aria-description')).toBe('Reward: Hermes');
    expect(visited.getAttribute('title')).toBe('Combat 05: Hermes');
    const focusBefore = view.application.store.getState().editorSession.focusedSemanticOwner;
    await view.user.click(visited);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      focusBefore,
    );
    const popup = screen.getByRole('dialog', { name: 'Combat 05' });
    expect(within(popup).getByText('Reward: Hermes')).toBeTruthy();
    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(visited));
    await view.user.click(visited);
    await view.user.click(screen.getByRole('button', { name: 'Open Room →' }));
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toMatchObject({
      kind: 'occurrence',
      occurrenceId: nOccurrenceId('combat05'),
    });
    await view.user.keyboard('{Enter}');

    const unvisited = screen.getByRole('button', {
      name: 'Combat 01: Unvisited.',
    });
    expect(unvisited.getAttribute('aria-disabled')).toBe('true');
    expect(unvisited.getAttribute('aria-description')).toBe('Reward: Big Max Health');
    expect(unvisited.getAttribute('title')).toBe('Combat 01: Big Max Health');
    await view.user.click(unvisited);
    await view.user.keyboard(' ');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
  });

  it('resets a completed Hub through its existing cleanup and Undo restores its open rooms and rewards', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    await showTimeline(view.user);
    await view.user.click(screen.getByRole('tab', { name: 'Hub Exit' }));
    await view.user.click(screen.getByRole('button', { name: 'Open next room' }));
    await waitFor(() =>
      expect(
        nHubState(view.application).topology.decisions.some(
          (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
        ),
      ).toBe(true),
    );
    const before = nHubState(view.application).topology;
    const openRooms = nHubState(view.application).decision.openTargets.map((target) => {
      const room = before.occurrences.find(
        (occurrence) => occurrence.occurrenceId === target.occurrenceId,
      );
      if (room === undefined) throw new Error(`open Hub room ${target.hubSlotKey} is missing`);
      return room;
    });

    await showTimeline(view.user);
    const actionsBefore = nHubState(view.application).decision.actions;
    expect(actionsBefore).toHaveLength(7);
    expect(actionsBefore.filter((action) => action.kind === 'useFountain')).toHaveLength(1);
    await view.user.click(screen.getByRole('button', { name: 'Reset visits' }));
    await waitFor(() => expect(nHubState(view.application).decision.actions).toEqual([]));
    expect(
      screen.getByRole('button', { name: 'Hub fountain: Unused. Use fountain.' }),
    ).toBeTruthy();
    expect(nHubState(view.application).decision.openTargets).toHaveLength(openRooms.length);
    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    for (const room of openRooms) {
      expect(
        nHubState(view.application).topology.occurrences.find(
          (occurrence) => occurrence.occurrenceId === room.occurrenceId,
        ),
      ).toEqual(room);
    }

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(hubVisitSlotKeys(nHubState(view.application).decision)).toHaveLength(6),
    );
    expect(nHubState(view.application).topology).toEqual(before);
    expect(nHubState(view.application).decision.actions).toEqual(actionsBefore);
  });

  it('keeps append and Reset ready when the first visited room has incomplete content', async () => {
    const incompleteFirstVisit = applyProjectCommand(twoVisitHubProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const view = renderHubDecisionWorkbench(incompleteFirstVisit);
    await showTimeline(view.user);
    const next = screen.getAllByRole('button', { name: /Unvisited\. Add visit\./ })[0];
    if (next === undefined) throw new Error('partial Hub has no room to append');
    expect(next).not.toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Reset visits' })).not.toHaveProperty(
      'disabled',
      true,
    );
    await view.user.click(next);
    await waitFor(() =>
      expect(hubVisitSlotKeys(nHubState(view.application).decision)).toHaveLength(3),
    );
    await view.user.click(screen.getByRole('button', { name: 'Reset visits' }));
    await waitFor(() => expect(nHubState(view.application).decision.actions).toEqual([]));
  });
});
