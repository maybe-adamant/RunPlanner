// @vitest-environment jsdom

import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { selectHubTab, twoVisitHubProject } from '@planner-test/support/hub-workbench';
import { renderStaticHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubCompletionHandoff', () => {
  it('shows the Hub-owned Preboss as locked while the Hub is incomplete, navigable through the shared continuation', () => {
    renderStaticHubDecisionWorkbench(twoVisitHubProject());
    selectHubTab('Hub Exit');

    const door = screen.getByRole('article', { name: 'Preboss room' });
    expect(door.dataset.hubExitState).toBe('locked');
    expect(within(door).getByText('Locked')).toBeTruthy();
    expect(door.querySelector('.door-status-note')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open next room' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('shows the Preboss as reached once the Hub is complete', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNProject());
    selectHubTab('Hub Exit');

    const door = screen.getByRole('article', { name: 'Preboss room' });
    expect(door.dataset.hubExitState).toBe('reached');
    expect(within(door).getByText('Reached')).toBeTruthy();
  });
});
