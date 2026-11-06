// @vitest-environment jsdom

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNCompleteHubFrontierProject } from '@run-planner/test-fixtures/surface';
import { withRetainedHubBehindMissingLink } from '@planner-test/support/hub-workbench';
import { renderStaticHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubDecisionWorkbench interaction', () => {
  it('retains finding navigation and later manual navigation when the finding clears', () => {
    const view = renderStaticHubDecisionWorkbench(
      loadSurfaceNCompleteHubFrontierProject(),
      'Surface',
      'N',
      { initialTab: 'timeline' },
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Hub Overview' }));
    view.rerenderHub({ initialTab: 'timeline', findingNavigationRevision: 1 });
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    view.rerenderHub({ initialTab: 'overview' });
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    view.rerenderHub({ initialTab: 'timeline', findingNavigationRevision: 2 });
    fireEvent.click(screen.getByRole('tab', { name: 'Hub Overview' }));
    view.rerenderHub({ initialTab: 'timeline' });
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    view.rerenderHub({ initialTab: 'timeline', findingNavigationRevision: 3 });
    view.rerenderHub({ initialTab: 'overview', navigationRevision: 4 });
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    view.rerenderHub({
      initialTab: 'timeline',
      findingNavigationRevision: 5,
      navigationRevision: 5,
    });
    expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('locks the resets without locking map viewing when the retained Hub is unavailable', () => {
    renderStaticHubDecisionWorkbench(
      withRetainedHubBehindMissingLink(loadSurfaceNCompleteHubFrontierProject()),
    );

    expect(screen.getByRole('button', { name: 'Reset Board' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Map controls' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    expect(screen.getByRole('button', { name: 'Reset visits' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Map controls' })).toBeTruthy();
  });

  it('separates the board from the visits in two keyboard tabs, each beside its map', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());

    const overview = screen.getByRole('tab', { name: 'Hub Overview' });
    const timeline = screen.getByRole('tab', { name: 'Hub Timeline' });
    expect(screen.getAllByRole('tab')).toEqual([overview, timeline]);
    expect(overview.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('region', { name: 'Hub door rewards' })).toBeTruthy();
    expect(within(panel).getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Reset Board' })).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Reset visits' })).toBeNull();

    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(timeline.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(timeline);
    const visits = within(screen.getByRole('tabpanel')).getByRole('region', {
      name: 'Ephyra Hub timeline',
    });
    expect(within(visits).getByRole('button', { name: 'Reset visits' })).toBeTruthy();
    expect(within(visits).getByRole('button', { name: 'Visit 1 room' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset Board' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Hub door rewards' })).toBeNull();

    fireEvent.keyDown(timeline, { key: 'Home' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();
  });
});
