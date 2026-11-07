// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceRoomMap } from '@planner/projections/structured-workspace';
import { DoorChips } from '@planner/ui/editor/biome/DecisionWorkbench';
import { RoomMapColumn } from '@planner/ui/editor/biome/room-map/RoomMapColumn';
import { RoomMapHighlightScope } from '@planner/ui/editor/biome/room-map/RoomMapHighlightScope';
import type { DoorChip } from '@planner/ui/editor/biome/doorSummary';

afterEach(cleanup);

const map: WorkspaceRoomMap = {
  doors: [
    { id: 11, x: 6700, y: 9000, doorIndex: 1 },
    { id: 12, x: 6800, y: 9100, doorIndex: 2 },
  ],
  entries: [],
  anchors: [],
  chaosPoints: [],
};

const chips: readonly DoorChip[] = [
  { key: 'one', label: 'Door 1 · Combat 02', doorIndex: 1, rewards: [] },
  { key: 'two', label: 'Door 2 · Combat 03', doorIndex: 2, rewards: [] },
];

function Workbench({ scope }: { readonly scope: string }) {
  return (
    <RoomMapHighlightScope scope={scope}>
      <DoorChips chips={chips} />
      <RoomMapColumn
        chips={chips}
        gameName="F_Combat01"
        map={map}
        roomIdentity="room"
        stage="closed"
        title="Combat 01"
      />
    </RoomMapHighlightScope>
  );
}

const previewed = () =>
  [...within(screen.getByRole('region', { name: 'Combat 01 map' })).getAllByRole('img')].filter(
    (marker) => marker.hasAttribute('data-preview'),
  );

describe('room map highlight', () => {
  it('previews a hovered door chip’s door on the map until it is left or the scope changes', () => {
    const view = render(<Workbench scope="room:actions" />);
    const chip = screen.getByRole('listitem', { name: 'Door 2 · Combat 03' });

    fireEvent.pointerEnter(chip);
    expect(previewed().map((marker) => marker.getAttribute('aria-label'))).toEqual([
      'Door 2 · Combat 03 · Closed',
    ]);
    fireEvent.pointerLeave(chip);
    expect(previewed()).toEqual([]);

    fireEvent.pointerEnter(chip);
    view.rerender(<Workbench scope="room:overview" />);
    expect(previewed()).toEqual([]);
  });
});
