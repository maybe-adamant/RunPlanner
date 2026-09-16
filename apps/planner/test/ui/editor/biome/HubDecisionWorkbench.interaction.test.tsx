// @vitest-environment jsdom

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNCompleteHubFrontierProject } from '@run-planner/test-fixtures/surface';
import { renderStaticHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubDecisionWorkbench interaction', () => {
  it('separates participation, visit/reward editing, and the completed exit into occurrence-style tabs', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());

    const overview = screen.getByRole('tab', { name: 'Hub Overview' });
    const timeline = screen.getByRole('tab', { name: 'Hub Timeline' });
    const exit = screen.getByRole('tab', { name: 'Hub Exit' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Combat 01 open' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Move Combat 01 later' })).toBeNull();
    expect(screen.getAllByLabelText('Reward').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open this room to edit its reward.')).toHaveLength(17);
    const hubMap = screen.getByRole('button', { name: 'Toggle Hub map reference' });
    fireEvent.click(hubMap);
    expect(screen.getByRole('complementary', { name: 'Ephyra Hub map reference' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();

    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(timeline.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('checkbox', { name: 'Combat 01 open' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Move Combat 01 later' })).toBeTruthy();
    expect(screen.queryByLabelText('Reward')).toBeNull();
    expect(screen.getByLabelText('Combat 01 reward preview').textContent).toContain(
      'Big Max Health',
    );
    expect(screen.getByRole('complementary', { name: 'Ephyra Hub map reference' })).toBeTruthy();
    expect(screen.getByText('125%')).toBeTruthy();

    fireEvent.keyDown(timeline, { key: 'End' });
    expect(exit.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('article', { name: 'Preboss room offer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open next room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByRole('button', { name: 'Move Combat 01 later' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Toggle Hub map reference' })).toBeNull();

    fireEvent.keyDown(exit, { key: 'Home' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Toggle Hub map reference' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Ephyra Hub map reference' })).toBeTruthy();
  });
});
