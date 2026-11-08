// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { openLeavePicker, renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(cleanup);

const f = createBiomeAddress('Underworld', 'F');
const source = createOccurrenceId('golden-f-b2-e1');
const doorTo = createOccurrenceId('golden-f-b3-e1');

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

function occurrenceOf(application: PlannerApplication, occurrenceId: string) {
  return application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')!
    .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)!;
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

/** The room's Doors object, where a press on a door is added. */
function doorsObject(): HTMLElement {
  return screen.getByRole('button', { name: 'Doors' });
}

/** The room's door presses on its Timeline, in order. */
function pressRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-door-press]')];
}

async function choose(view: ReturnType<typeof renderWorkspace>, picker: HTMLElement, name: RegExp) {
  await view.user.click(picker);
  await view.user.click(
    await within(await screen.findByRole('listbox')).findByRole('option', { name }),
  );
}

/** Appends a press: a door, then the first reward the picker that opens next offers. */
async function appendPress(view: ReturnType<typeof renderWorkspace>, door: RegExp) {
  await choose(view, doorsObject(), door);
  await screen.findByRole('listbox');
  // A staged reward (a Boon) asks for its god next; each step takes the first possible row.
  while (screen.queryByRole('listbox') !== null) {
    const options = await within(screen.getByRole('listbox')).findAllByRole('option');
    const possible = options.find((option) => option.getAttribute('aria-disabled') !== 'true');
    await view.user.click(possible!);
  }
}

describe('RoomRerolls', () => {
  it('appends presses from the Doors object as Timeline rows and removes a press', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    // The reward is asked for once a door is chosen.
    expect(screen.queryByRole('button', { name: 'New reroll reward' })).toBeNull();
    // Each option names its door and the rerolls left before the press, and what it spends.
    await view.user.click(doorsObject());
    const option = within(await screen.findByRole('listbox')).getByRole('option', {
      name: /^Reroll Door 2/,
    });
    expect(option.textContent).toContain('· 3 (\u22121)');
    expect(option.querySelector('.contextual-picker-item-trail-icon')).not.toBeNull();
    await view.user.keyboard('{Escape}');
    expect(doorsObject().querySelector('img')).toBeNull();

    await appendPress(view, /^Reroll Door 2/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(1));
    const [row] = pressRows();
    expect(within(row!).getByText('Reroll')).toBeTruthy();
    expect(within(row!).getByText('Door 2')).toBeTruthy();
    expect(within(row!).getByRole('button', { name: 'Door 2 reroll reward' })).toBeTruthy();
    // The doors keep their first draws; the press row's chips show them as it leaves them.
    expect(screen.queryAllByRole('img', { name: /^Rerolled into / })).toHaveLength(0);
    expect(within(row!).getByRole('list', { name: 'Door summary' })).toBeTruthy();

    await appendPress(view, /^Reroll Door 1/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(2));
    const [first, second] = presses(view.application);
    await view.user.click(
      within(pressRows()[0]!).getByRole('button', { name: /^Remove .* from timeline$/ }),
    );
    await waitFor(() => expect(presses(view.application)).toEqual([second]));
    expect(first).not.toEqual(second);
  });

  it('disables the Doors object at an empty pool and hides it without the card', async () => {
    let view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    for (const door of [/^Reroll Door 2/, /^Reroll Door 1/, /^Reroll Door 2/]) {
      const count = presses(view.application).length;
      await appendPress(view, door);
      await waitFor(() => expect(presses(view.application)).toHaveLength(count + 1));
    }
    expect(doorsObject().getAttribute('data-hint')).toBe('No rerolls left.');
    cleanup();

    view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    await openDoors(view);
    expect(screen.queryByRole('button', { name: 'Doors' })).toBeNull();
  });

  it('returns focus to the Doors object when the pending reward is dismissed or chosen', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);

    // Escape on the reward picker drops the pending press.
    await choose(view, doorsObject(), /^Reroll Door 2/);
    await screen.findByRole('listbox');
    await view.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(presses(view.application)).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(doorsObject()));

    // Choosing the reward appends the press.
    await appendPress(view, /^Reroll Door 2/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(1));
    await waitFor(() => expect(document.activeElement).toBe(doorsObject()));
  });

  it('edits a press reward on its own Timeline row and shows the final reward on the Leave row', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    await appendPress(view, /^Reroll Door 2/);
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

  it("repairs a door row's stale kept rerolled reward from its last reroll", async () => {
    // Door 1 rerolled into a Pom whose kept resolution is authored, then the press changes.
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    const occurrence = createOccurrenceAddress(f, source);
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertReroll',
      occurrence,
      target: { kind: 'door', exitKey: 'exit1', occurrenceId: doorTo },
      reward: { rewardType: 'StackUpgrade' },
      index: project.route.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === source,
      )!.roomActions.order.length,
    });
    const owner = createIncomingRewardAddress(f, doorTo);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(owner, 'self'),
      value: { kind: 'choice', offeredTraitKeys: ['ZeusSpecialBoon'], selectedTraitKey: null },
    });
    const press = project.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === source,
    )!.roomActions.order.find((action) => action.kind === 'reroll');
    if (press?.kind !== 'reroll') throw new Error('Door 1 has no reroll press');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRerollReward',
      action: createRoomActionAddress(f, source, JSON.stringify(['reroll', press.rerollId])),
      reward: { rewardType: 'RoomMoneyDrop' },
    });
    const application = createApplication();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderWorkspace(project, 'Underworld', 'F', application);
    await openDoors(view);

    await view.user.click(screen.getByRole('button', { name: 'Use last reroll for Door 1' }));

    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([{ kind: 'AdoptRerolledReward', owner }]);
    expect(occurrenceOf(application, doorTo).rerolledIncomingReward?.offer).toEqual({
      rewardType: 'RoomMoneyDrop',
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Use last reroll for Door 1' })).toBeNull(),
    );
  });
});
