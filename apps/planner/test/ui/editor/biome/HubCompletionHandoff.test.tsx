// @vitest-environment jsdom

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { selectHubTab, twoVisitHubProject } from '@planner-test/support/hub-workbench';
import { renderStaticHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubCompletionHandoff', () => {
  it('holds the shared continuation while the Hub is incomplete', () => {
    renderStaticHubDecisionWorkbench(twoVisitHubProject());
    selectHubTab('Hub Exit');

    const door = screen.getByRole('article', { name: 'Preboss room' });
    expect(door.dataset.available).toBe('false');
    expect(door.querySelector('.door-status-note')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open next room' })).toHaveProperty('disabled', true);
  });

  it('opens the shared continuation once the Hub is complete', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNProject());
    selectHubTab('Hub Exit');

    const door = screen.getByRole('article', { name: 'Preboss room' });
    expect(door.dataset.available).toBe('true');
    expect(screen.getByRole('button', { name: 'Open next room' })).toHaveProperty(
      'disabled',
      false,
    );
  });
});
