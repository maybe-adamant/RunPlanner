// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { type PlannerApplication } from '@planner/composition/createApplication';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { openLeavePicker, renderWorkspace } from '@planner-test/support/biome-workbench';
import { takeLive } from '@planner-test/support/live-row';

afterEach(cleanup);

const f = createBiomeAddress('Underworld', 'F');
const source = createOccurrenceId('golden-f-b2-e1');

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

function presses(application: PlannerApplication) {
  return application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')!
    .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === source)!
    .roomActions.order.filter((action) => action.kind === 'reroll');
}

async function openDoors(view: ReturnType<typeof renderWorkspace>) {
  act(() =>
    view.application.store.dispatch(semanticOwnerFocused(createOccurrenceAddress(f, source))),
  );
  const details = screen.getByRole('complementary', { name: 'Details' });
  await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
  return within(details);
}

/** The room's Doors on the live row, where a press on a door is added. */
function doorsChip(): HTMLElement | null {
  const row = document.querySelector<HTMLElement>('.timeline-live-row');
  return row === null ? null : within(row).queryByRole('button', { name: 'Doors' });
}

/** The room's door presses on its Timeline, in order. */
function pressRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-door-press]')];
}

/** Appends a press: its door, then the first reward the picker that opens next offers. */
async function appendPress(view: ReturnType<typeof renderWorkspace>, door: RegExp) {
  await takeLive(view.user, 'Doors', 'Reroll…', door);
  await screen.findByRole('listbox');
  // A staged reward (a Boon) asks for its god next; each step takes the first possible row.
  while (screen.queryByRole('listbox') !== null) {
    const options = await within(screen.getByRole('listbox')).findAllByRole('option');
    const possible = options.find((option) => option.getAttribute('aria-disabled') !== 'true');
    await view.user.click(possible!);
  }
}

describe('RoomRerolls', () => {
  it('appends presses from the live row as Timeline rows and removes a press', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    // The reward is asked for once a door is chosen.
    expect(screen.queryByRole('button', { name: 'New reroll reward' })).toBeNull();
    await appendPress(view, /^Door 2/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(1));
    const [row] = pressRows();
    expect(within(row!).getByText('Reroll')).toBeTruthy();
    expect(within(row!).getByText('Door 2')).toBeTruthy();
    expect(within(row!).getByRole('button', { name: 'Door 2 reroll reward' })).toBeTruthy();
    // The doors keep their first draws; the press row's chips show them as it leaves them.
    expect(screen.queryAllByRole('img', { name: /^Rerolled into / })).toHaveLength(0);
    expect(within(row!).getByRole('list', { name: 'Door summary' })).toBeTruthy();

    await appendPress(view, /^Door 1/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(2));
    const [first, second] = presses(view.application);
    await view.user.click(
      within(pressRows()[0]!).getByRole('button', { name: /^Remove .* from timeline$/ }),
    );
    await waitFor(() => expect(presses(view.application)).toEqual([second]));
    expect(first).not.toEqual(second);
  });

  it('offers no door press at an empty pool or without the card', async () => {
    let view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    for (const door of [/^Door 2/, /^Door 1/, /^Door 2/]) {
      const count = presses(view.application).length;
      await appendPress(view, door);
      await waitFor(() => expect(presses(view.application)).toHaveLength(count + 1));
    }
    expect(doorsChip()).toBeNull();
    cleanup();

    view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    await openDoors(view);
    expect(doorsChip()).toBeNull();
  });

  it('edits a press reward on its own Timeline row and shows the final reward on the Leave row', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    await appendPress(view, /^Door 2/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(1));
    const [press] = presses(view.application);
    if (press?.kind !== 'reroll') throw new Error('Door 2 press is missing');
    const row = pressRows()[0]!;
    // The row is edited in place: no link elsewhere.
    expect(within(row).queryByRole('button', { name: 'Doors' })).toBeNull();
    // Picking Door 2 to leave shows its reward as the press left it.
    const exitDoor = async () =>
      within(
        await openLeavePicker(view.user, screen.getByRole('complementary', { name: 'Details' })),
      ).getByRole('option', { name: /^Door 2 ·/ });
    await view.user.click(await exitDoor());
    expect((await exitDoor()).getAttribute('data-selected-value')).toBe('true');
  });
});
