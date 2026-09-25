// @vitest-environment jsdom

import { createOccurrenceId } from '@run-planner/engine/authored-project';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { nHubOccurrence, nHubState } from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubMapOverview', () => {
  it.each(['List', 'Map'] as const)(
    'resets the board from %s and restores all contents with Undo',
    async (mode) => {
      const project = loadSurfaceNProject();
      const view = renderHubDecisionWorkbench(project);
      if (mode === 'List') await view.user.click(screen.getByRole('button', { name: 'Details →' }));
      const before = nHubState(view.application).topology;
      const historySize = view.application.store.getState().projectWorkspace.history!.past.length;
      const reset = screen.getByRole('button', { name: 'Reset Board' });
      if (mode === 'Map') {
        expect(reset.closest('.room-map-canvas')).toBeTruthy();
      } else {
        expect(reset.closest('.hub-board-heading')).toBeTruthy();
      }
      await view.user.click(reset);
      await waitFor(() => expect(nHubState(view.application).decision.openTargets).toEqual([]));
      expect(nHubState(view.application).decision.actions).toEqual([]);
      expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
      expect(reset).toHaveProperty('disabled', true);
      expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
        historySize + 1,
      );
      if (mode === 'Map') {
        expect(screen.getAllByRole('button', { name: /Closed\. Open room\./ })).toHaveLength(26);
        await view.user.click(screen.getByRole('button', { name: 'Details →' }));
      }
      expect(
        screen.getAllByRole('checkbox').every((box) => !(box as HTMLInputElement).checked),
      ).toBe(true);
      act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
      await waitFor(() => expect(nHubState(view.application).topology).toEqual(before));
      act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
      await waitFor(() => expect(nHubState(view.application).decision.openTargets).toEqual([]));
      await view.user.click(screen.getByRole('checkbox', { name: 'Combat 01 open' }));
      await waitFor(() => expect(nHubState(view.application).decision.openTargets).toHaveLength(1));
      expect(screen.getByRole('button', { name: 'Reset Board' })).toHaveProperty('disabled', false);
    },
  );

  it('maps every declared Hub slot once and opens a room through one lazy bound attempt', async () => {
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const application = createApplication({
      allocateOccurrenceId: () => {
        const occurrenceId = createOccurrenceId(`hub-map-opening-${allocated.length + 1}`);
        allocated.push(occurrenceId);
        return occurrenceId;
      },
    });
    renderHubDecisionWorkbench(loadSurfaceNProject(), 'Surface', 'N', application);

    const map = screen.getByLabelText('Ephyra Hub room map controls');
    const markers = Array.from(map.querySelectorAll<HTMLButtonElement>('[data-hub-slot-key]'));
    expect(markers).toHaveLength(26);
    expect(new Set(markers.map((marker) => marker.dataset.hubSlotKey)).size).toBe(26);
    expect(allocated).toEqual([]);

    const closedMarker = screen.getByRole('button', { name: 'Combat 04: Closed. Open room.' });
    fireEvent.pointerDown(closedMarker, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(closedMarker, { clientX: 28, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(closedMarker, { clientX: 28, clientY: 20, pointerId: 1 });
    fireEvent.click(closedMarker, { detail: 1 });
    expect(() => nHubOccurrence(application, 'combat04')).toThrow('not open');

    fireEvent.pointerDown(closedMarker, { clientX: 20, clientY: 20, pointerId: 2 });
    fireEvent.pointerCancel(closedMarker, { clientX: 20, clientY: 20, pointerId: 2 });
    fireEvent.keyDown(closedMarker, { key: 'Enter' });
    fireEvent.click(closedMarker, { detail: 0 });
    await waitFor(() => expect(nHubOccurrence(application, 'combat04').occurrenceId).toBeDefined());
    expect(allocated).toHaveLength(3);

    const openedMarker = screen.getByRole('button', {
      name: 'Combat 04: Opened. Edit reward or close room.',
    });
    // Opening publishes the reward popover immediately; no second marker click.
    expect(screen.getByText('Opened room')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reward' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close room' })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(document.activeElement).toBe(openedMarker));

    fireEvent.click(openedMarker);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })),
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(openedMarker));

    fireEvent.click(screen.getByRole('button', { name: 'Details →' }));
    application.store.dispatch(authoredProjectUndoRequested());
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('checkbox', { name: 'Combat 04 open' }).checked,
      ).toBe(false),
    );
    application.store.dispatch(authoredProjectRedoRequested());
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('checkbox', { name: 'Combat 04 open' }).checked,
      ).toBe(true),
    );
  });
});
