// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';

afterEach(cleanup);

describe('RoomMapLauncher', () => {
  it('views a room image, reports a local load failure, and supports zoom and Fit', () => {
    render(<RoomMapLauncher gameName="F_Combat01" hostId="occurrence-a" title="Combat 01" />);

    fireEvent.click(screen.getByRole('button', { name: 'View map for Combat 01' }));
    expect(screen.getByRole('heading', { name: 'Combat 01 map' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Map of Combat 01' })).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();
    fireEvent.click(screen.getByText('Fit'));
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.error(screen.getByRole('img', { name: 'Map of Combat 01' }));
    expect(screen.getByText('Unable to load this map image.')).toBeTruthy();
  });

  it('uses the room-named placeholder and resets when the displayed room changes', () => {
    const view = render(
      <RoomMapLauncher gameName="H_Combat01" hostId="occurrence-a" title="Combat 01" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View map for Combat 01' }));
    expect(roomMapAssetFor('H_Combat01')?.isPlaceholder).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();

    view.rerender(
      <RoomMapLauncher gameName="H_Combat02" hostId="occurrence-a" title="Combat 02" />,
    );
    expect(screen.getByRole('heading', { name: 'Combat 02 map' })).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('closes with Close or Escape and returns focus to its launcher', () => {
    render(<RoomMapLauncher gameName="F_Combat01" hostId="occurrence-a" title="Combat 01" />);
    const launcher = screen.getByRole('button', { name: 'View map for Combat 01' });

    fireEvent.click(launcher);
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(launcher);

    fireEvent.click(launcher);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });
});
