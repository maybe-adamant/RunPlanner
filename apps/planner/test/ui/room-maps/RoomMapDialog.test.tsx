// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { RoomMapReferencePane } from '@planner/ui/room-maps/RoomMapReferencePane';
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

describe('RoomMapReferencePane', () => {
  it('keeps the non-modal reference while inspecting it in the shared dialog', () => {
    render(<RoomMapReferencePane gameName="F_Combat01" hostId="occurrence-a" title="Combat 01" />);

    expect(screen.getByRole('complementary', { name: 'Combat 01 map reference' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();

    const expand = screen.getByRole('button', { name: 'Expand' });
    fireEvent.click(expand);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(expand);
    expect(screen.getByText('125%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close room map reference' }));
    expect(screen.queryByRole('complementary', { name: 'Combat 01 map reference' })).toBeNull();
    const reopen = screen.getByRole('button', { name: 'Show map reference for Combat 01' });
    expect(document.activeElement).toBe(reopen);
    fireEvent.click(reopen);
    expect(screen.getByRole('complementary', { name: 'Combat 01 map reference' })).toBeTruthy();
  });

  it('resets the image for a replacement and closes inherited references for a new host', () => {
    const view = render(
      <RoomMapReferencePane gameName="H_Combat02" hostId="occurrence-a" title="Combat 02" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();
    view.rerender(
      <RoomMapReferencePane gameName="H_Combat03" hostId="occurrence-a" title="Combat 03" />,
    );
    expect(screen.getByRole('complementary', { name: 'Combat 03 map reference' })).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    view.rerender(
      <RoomMapReferencePane gameName="H_Combat04" hostId="occurrence-b" title="Combat 04" />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Combat 04 map reference' })).toBeNull();
    const reopen = screen.getByRole('button', { name: 'Show map reference for Combat 04' });
    fireEvent.click(reopen);
    expect(screen.getByRole('complementary', { name: 'Combat 04 map reference' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByRole('heading', { name: 'Combat 04 map' })).toBeTruthy();
  });
});
