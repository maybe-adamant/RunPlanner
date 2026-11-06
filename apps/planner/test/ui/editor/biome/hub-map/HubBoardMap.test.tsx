// @vitest-environment jsdom

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { selectHubTab } from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

function linkedDoors(): readonly string[] {
  return [
    ...screen
      .getByRole('region', { name: 'Ephyra Hub map' })
      .querySelectorAll<HTMLElement>('[data-linked="true"]'),
  ].map((door) => door.dataset.hubSlotKey ?? '');
}

describe('HubBoardMap', () => {
  it('keeps its zoom controls collapsed until the map controls are expanded, on both tabs', () => {
    renderHubDecisionWorkbench(loadSurfaceNProject());
    for (const tab of ['Hub Overview', 'Hub Timeline'] as const) {
      selectHubTab(tab);
      expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Map controls' }));
      expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Map controls' }));
    }
  });

  it('links an Overview row and its door both ways while either is hovered or focused', () => {
    renderHubDecisionWorkbench(loadSurfaceNProject());
    const row = within(screen.getByRole('list', { name: 'Doors in draw order' })).getByRole(
      'listitem',
      { name: 'Combat 05' },
    );
    expect(linkedDoors()).toEqual([]);
    fireEvent.pointerEnter(row);
    expect(linkedDoors()).toEqual(['combat05']);
    expect(row.dataset.linked).toBe('true');
    fireEvent.pointerLeave(row);
    expect(linkedDoors()).toEqual([]);

    const door = screen.getByRole('button', { name: 'Close Combat 05' });
    fireEvent.pointerEnter(door);
    expect(row.dataset.linked).toBe('true');
    fireEvent.pointerLeave(door);
    expect(row.dataset.linked).toBeUndefined();

    // A closed door has no row to link.
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Open Combat 04' }));
    expect(linkedDoors()).toEqual([]);
  });
});
