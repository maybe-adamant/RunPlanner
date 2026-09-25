// @vitest-environment jsdom

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNCompleteHubFrontierProject } from '@run-planner/test-fixtures/surface';
import { withRetainedHubBehindMissingLink } from '@planner-test/support/hub-workbench';
import { renderStaticHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubDecisionWorkbench interaction', () => {
  it('locks destructive Hub removal without locking map viewing when the retained Hub is unavailable', () => {
    renderStaticHubDecisionWorkbench(
      withRetainedHubBehindMissingLink(loadSurfaceNCompleteHubFrontierProject()),
    );

    expect(screen.getByRole('button', { name: 'Remove Hub' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Reset Board' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Details →' }));
    expect(
      screen.getByRole('group', { name: 'Hub room set' }).querySelector('.hub-owner-assessment'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset visits' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    expect(screen.getByRole('button', { name: 'Reset visits' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Combat 02: Visit 3, step 4.' })).not.toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Fit' })).toBeTruthy();
  });

  it('resets only the finding-requested Overview view to List and keeps Timeline map-only', () => {
    const view = renderStaticHubDecisionWorkbench(
      loadSurfaceNCompleteHubFrontierProject(),
      'Surface',
      'N',
      {
        findingNavigationRevision: 1,
        initialTab: 'overview',
      },
    );
    expect(screen.getByRole('group', { name: 'Hub room set' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Map' }));
    view.rerenderHub({ findingNavigationRevision: 1, initialTab: 'overview' });
    expect(screen.getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    expect(screen.getByRole('region', { name: 'Ephyra Hub timeline map' })).toBeTruthy();

    view.rerenderHub({ findingNavigationRevision: 2, initialTab: 'timeline' });
    expect(screen.getByRole('region', { name: 'Ephyra Hub timeline map' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Hub Overview' }));
    expect(screen.getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();

    view.rerenderHub({ findingNavigationRevision: 3, initialTab: 'overview' });
    expect(screen.getByRole('group', { name: 'Hub room set' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    expect(screen.getByRole('region', { name: 'Ephyra Hub timeline map' })).toBeTruthy();
  });

  it('separates participation, visit/reward editing, and the completed exit into occurrence-style tabs', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());

    const overview = screen.getByRole('tab', { name: 'Hub Overview' });
    const timeline = screen.getByRole('tab', { name: 'Hub Timeline' });
    const exit = screen.getByRole('tab', { name: 'Hub Exit' });
    const removal = screen.getByRole('button', { name: 'Remove Hub' });
    const hubPanel = screen.getByRole('region', { name: 'Ephyra Hub' });
    expect(hubPanel.classList.contains('room-card')).toBe(true);
    expect(
      screen.getByRole('heading', { name: 'Ephyra Hub' }).closest('.room-card-heading')
        ?.parentElement,
    ).toBe(hubPanel);
    expect(removal.closest('.room-workbench-tab-row')).toBe(
      overview.closest('.room-workbench-tab-row'),
    );
    expect(removal.closest('[role="tablist"]')).toBeNull();
    const panel = screen.getByRole('region', { name: 'Hub room participation' });
    expect(screen.getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();
    const details = screen.getByRole('button', { name: 'Details →' });
    expect(details.closest('.room-map-canvas')).toBeTruthy();
    expect(details.parentElement).toBe(
      screen.getByRole('button', { name: 'Reset Board' }).parentElement,
    );
    expect(panel.querySelector('.room-map-toolbar')).toBeNull();
    fireEvent.click(details);
    const back = screen.getByRole('button', { name: 'Back to Map' });
    expect(back.closest('header')).toBeTruthy();
    expect(document.activeElement).toBe(back);
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Combat 01 open' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Move Combat 01 later' })).toBeNull();
    expect(screen.getAllByLabelText('Reward').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open this room to edit its reward.')).toHaveLength(17);
    fireEvent.click(back);
    expect(screen.getByRole('region', { name: 'Hub room participation' })).toBe(panel);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Details →' }));
    expect(screen.getByRole('button', { name: 'Fit' }).closest('.room-map-canvas')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /Opened|Closed/ })).toHaveLength(26);
    const healthMarker = screen.getByRole('button', {
      name: 'Combat 01: Opened. Edit reward or close room.',
    });
    expect(healthMarker.getAttribute('aria-description')).toBe('Reward: Big Max Health');
    expect(
      decodeURIComponent(healthMarker.querySelector('img')?.getAttribute('src') ?? ''),
    ).toContain('Max Health.webp');
    const closedMarker = screen.getByRole('button', { name: 'Combat 04: Closed. Open room.' });
    expect(within(closedMarker).getByText('Closed')).toBeTruthy();
    expect(closedMarker.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();

    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(timeline.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Remove Hub' })).toBe(removal);
    expect(screen.queryByRole('checkbox', { name: 'Combat 01 open' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Combat 05: Visit 1, step 2.' })).toBeTruthy();
    expect(screen.queryByLabelText('Reward')).toBeNull();
    expect(screen.getByLabelText('Ephyra Hub timeline map controls')).toBeTruthy();
    const timelinePanel = screen.getByRole('region', { name: 'Ephyra Hub timeline map' });
    expect(timelinePanel.classList.contains('hub-board')).toBe(true);
    expect(screen.getByRole('button', { name: 'Fit' }).closest('.hub-board')).toBe(timelinePanel);
    expect(screen.getByRole('button', { name: 'Reset visits' }).closest('.hub-board')).toBe(
      timelinePanel,
    );
    expect(timelinePanel.querySelector('.room-map-toolbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reset visits' }).closest('.room-map-canvas')).toBe(
      screen.getByRole('button', { name: 'Fit' }).closest('.room-map-canvas'),
    );

    fireEvent.keyDown(timeline, { key: 'End' });
    expect(exit.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Remove Hub' })).toBe(removal);
    expect(screen.getByRole('article', { name: 'Preboss room offer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open next room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByRole('button', { name: 'Combat 05: Visit 1, step 2.' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Details →' })).toBeNull();

    fireEvent.keyDown(exit, { key: 'Home' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();
  });
});
