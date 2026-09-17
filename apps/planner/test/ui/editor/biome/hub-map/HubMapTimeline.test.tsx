// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
} from '@run-planner/engine/authored-project';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNCompleteHubFrontierProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { nHubState, twoVisitHubProject } from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

async function showTimeline(user: {
  click: (element: HTMLElement) => Promise<void>;
}): Promise<void> {
  const tab = screen.getByRole('tab', { name: 'Hub Timeline' });
  if (tab.getAttribute('aria-selected') !== 'true') await user.click(tab);
}

describe('HubMapTimeline', () => {
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
        expect(nHubState(view.application).decision.visitOrder).toHaveLength(visitCount + 1),
      );
    }

    expect(screen.queryByRole('button', { name: /Unvisited\. Add visit\./ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Visit \d+\.$/ })).toHaveLength(6);
  });

  it('keeps rewards readable without activating visited rooms or appending past capacity', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    await showTimeline(view.user);
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const visited = screen.getByRole('button', { name: 'Combat 05: Visit 1.' });

    expect(visited.getAttribute('aria-disabled')).toBe('true');
    expect(visited.getAttribute('aria-description')).toBe('Reward: Hermes');
    expect(visited.getAttribute('title')).toBe('Combat 05: Hermes');
    await view.user.click(visited);
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
    await view.user.click(screen.getByRole('button', { name: 'Reset visits' }));
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toEqual([]));
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
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toHaveLength(6));
    expect(nHubState(view.application).topology).toEqual(before);
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
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toHaveLength(3));
    await view.user.click(screen.getByRole('button', { name: 'Reset visits' }));
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toEqual([]));
  });
});
