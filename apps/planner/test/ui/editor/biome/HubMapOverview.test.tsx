// @vitest-environment jsdom

import { createOccurrenceId } from '@run-planner/engine/authored-project';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { nHubOccurrence } from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubMapOverview', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
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
