// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { LeavePicker } from '@planner/ui/editor/biome/LeavePicker';
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
  fieldsCagePoints: [],
  fieldsOptionalPoints: [],
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

  it('marks the controls that own a map point while the pointer is on it, without previewing it', () => {
    render(<Workbench scope="room:actions" />);
    const marker = screen.getByRole('img', { name: 'Door 2 · Combat 03 · Closed' });
    const pointed = () =>
      screen
        .getAllByRole('listitem')
        .filter((chip) => chip.hasAttribute('data-map-pointed'))
        .map((chip) => chip.getAttribute('aria-label'));

    fireEvent.pointerEnter(marker);
    expect(pointed()).toEqual(['Door 2 · Combat 03']);
    expect(previewed()).toEqual([]);
    fireEvent.pointerLeave(marker);
    expect(pointed()).toEqual([]);
  });

  it('rings the door of the Leave room option under the highlight, and marks the picker from the map', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={createApplication().store}>
        <RoomMapHighlightScope scope="room:actions">
          <LeavePicker
            chosenKey="one"
            id="leave"
            options={chips.map((chip) => ({ key: chip.key, label: chip.label, chip }))}
            planEnd={undefined}
          />
          <RoomMapColumn
            chips={chips}
            gameName="F_Combat01"
            map={map}
            roomIdentity="room"
            stage="closed"
            title="Combat 01"
          />
        </RoomMapHighlightScope>
      </Provider>,
    );
    const trigger = screen.getByRole('button', { name: 'Exit door' });
    const marker = screen.getByRole('img', { name: 'Door 2 · Combat 03 · Closed' });
    fireEvent.pointerEnter(marker);
    expect(trigger.hasAttribute('data-map-pointed')).toBe(true);
    fireEvent.pointerLeave(marker);
    expect(trigger.hasAttribute('data-map-pointed')).toBe(false);

    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    expect(previewed().map((point) => point.getAttribute('aria-label'))).toEqual([
      'Door 2 · Combat 03 · Closed',
    ]);
    // Closing returns focus to the picker, which previews the chosen door.
    await user.keyboard('{Escape}');
    expect(previewed().map((point) => point.getAttribute('aria-label'))).toEqual([
      'Door 1 · Combat 02 · Closed',
    ]);
  });

  it('keeps the Leave room picker’s active option ringed as the pointer moves from the trigger onto it', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={createApplication().store}>
        <RoomMapHighlightScope scope="room:actions">
          <LeavePicker
            chosenKey="one"
            id="leave"
            options={chips.map((chip) => ({ key: chip.key, label: chip.label, chip }))}
            planEnd={undefined}
          />
          <RoomMapColumn
            chips={chips}
            gameName="F_Combat01"
            map={map}
            roomIdentity="room"
            stage="closed"
            title="Combat 01"
          />
        </RoomMapHighlightScope>
      </Provider>,
    );
    const trigger = screen.getByRole('button', { name: 'Exit door' });
    await user.hover(trigger);
    await user.click(trigger);
    const list = await screen.findByRole('listbox');
    const ringed = () => previewed().map((point) => point.getAttribute('aria-label'));
    expect(ringed()).toEqual(['Door 1 · Combat 02 · Closed']);
    await user.hover(within(list).getByRole('option', { name: 'Door 1 · Combat 02' }));
    expect(ringed()).toEqual(['Door 1 · Combat 02 · Closed']);
  });
});
