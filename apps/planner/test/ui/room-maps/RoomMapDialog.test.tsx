// @vitest-environment jsdom

import { cleanup, fireEvent, render as renderView, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';

afterEach(cleanup);

/** Renders inside a store, as the editor dialog the map opens in needs one. */
function render(ui: ReactElement) {
  const { store } = createApplication();
  const view = renderView(<Provider store={store}>{ui}</Provider>);
  return {
    ...view,
    rerender: (next: ReactElement) => view.rerender(<Provider store={store}>{next}</Provider>),
  };
}

/** Opens the map's collapsed zoom controls. */
function showControls() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Map controls' }).at(-1)!);
}

describe('RoomMapLauncher', () => {
  it('views a room image, reports a local load failure, and supports zoom and Fit', () => {
    render(<RoomMapLauncher gameName="F_Combat01" hostId="occurrence-a" title="Combat 01" />);

    fireEvent.click(screen.getByRole('button', { name: 'View map of Combat 01' }));
    // The readable name titles the dialog; the room's code name is its hover.
    const heading = screen.getByRole('heading', { name: 'Combat 01' });
    expect(heading.querySelector('[data-hint="F_Combat01"]')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Map of Combat 01' })).toBeTruthy();
    showControls();
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();
    fireEvent.click(screen.getByText('Fit'));
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.error(screen.getByRole('img', { name: 'Map of Combat 01' }));
    expect(screen.getByText('Unable to load this map image.')).toBeTruthy();
  });

  it('uses the room-named image and resets when the displayed room changes', () => {
    const view = render(
      <RoomMapLauncher gameName="H_Combat01" hostId="occurrence-a" title="Combat 01" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View map of Combat 01' }));
    expect(screen.getByRole('img', { name: 'Map of Combat 01' }).getAttribute('src')).toBe(
      roomMapAssetFor('H_Combat01')?.src,
    );
    showControls();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeTruthy();

    view.rerender(
      <RoomMapLauncher gameName="H_Combat02" hostId="occurrence-a" title="Combat 02" />,
    );
    expect(screen.getByRole('heading', { name: 'Combat 02' })).toBeTruthy();
    showControls();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('draws the given marks over the room image', () => {
    render(
      <RoomMapLauncher
        gameName="N_Hub"
        hostId="hub-a"
        overlay={<span aria-label="Door 1" role="img" />}
        title="Ephyra Hub"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View map of Ephyra Hub' }));
    expect(screen.getByRole('img', { name: 'Door 1' })).toBeTruthy();
  });

  it('closes with Close or Escape and returns focus to its launcher', () => {
    render(<RoomMapLauncher gameName="F_Combat01" hostId="occurrence-a" title="Combat 01" />);
    const launcher = screen.getByRole('button', { name: 'View map of Combat 01' });

    fireEvent.click(launcher);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(launcher);

    fireEvent.click(launcher);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });
});
