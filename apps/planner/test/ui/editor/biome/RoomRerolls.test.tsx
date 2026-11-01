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
import { renderWorkspace } from '@planner-test/support/biome-workbench';

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
  await view.user.click(within(details).getByRole('tab', { name: 'Room Doors' }));
  return within(details);
}

async function choose(view: ReturnType<typeof renderWorkspace>, picker: HTMLElement, name: RegExp) {
  await view.user.click(picker);
  await view.user.click(
    await within(await screen.findByRole('listbox')).findByRole('option', { name }),
  );
}

/** Appends a press: a door, then the first reward the picker that opens next offers. */
async function appendPress(view: ReturnType<typeof renderWorkspace>, door: RegExp) {
  const rerolls = within(screen.getByRole('region', { name: 'Rerolls' }));
  await choose(view, rerolls.getByRole('button', { name: 'New reroll door' }), door);
  await screen.findByRole('listbox');
  // A staged reward (a Boon) asks for its god next; each step takes the first possible row.
  while (screen.queryByRole('listbox') !== null) {
    const options = await within(screen.getByRole('listbox')).findAllByRole('option');
    const possible = options.find((option) => option.getAttribute('aria-disabled') !== 'true');
    await view.user.click(possible!);
  }
}

describe('RoomRerolls', () => {
  it('appends presses below the doors, labels the door first to final and removes a press', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    const rerolls = () => within(screen.getByRole('region', { name: 'Rerolls' }));
    expect(rerolls().getByRole('img', { name: '3 rerolls left' })).toBeTruthy();
    // The reward is asked for once a door is chosen.
    expect(rerolls().queryByRole('button', { name: 'New reroll reward' })).toBeNull();

    await appendPress(view, /^Door 2$/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(1));
    expect(rerolls().getByRole('img', { name: '2 rerolls left' })).toBeTruthy();
    expect(rerolls().getByRole('button', { name: 'Reroll 1 reward' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /^Rerolled into / })).toHaveLength(1);

    await appendPress(view, /^Door 1$/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(2));
    const [first, second] = presses(view.application);
    await view.user.click(rerolls().getByRole('button', { name: 'Remove reroll 1' }));
    await waitFor(() => expect(presses(view.application)).toEqual([second]));
    expect(first).not.toEqual(second);
  });

  it('disables the next press at an empty pool and hides the list without the card', async () => {
    let view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    for (const door of [/^Door 2$/, /^Door 1$/, /^Door 2$/]) {
      const count = presses(view.application).length;
      await appendPress(view, door);
      await waitFor(() => expect(presses(view.application)).toHaveLength(count + 1));
    }
    const rerolls = within(screen.getByRole('region', { name: 'Rerolls' }));
    expect(rerolls.getByRole('img', { name: '0 rerolls left' })).toBeTruthy();
    expect(rerolls.getByRole('button', { name: 'New reroll door' }).getAttribute('data-hint')).toBe(
      'No rerolls left.',
    );
    cleanup();

    view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    await openDoors(view);
    expect(screen.queryByRole('region', { name: 'Rerolls' })).toBeNull();
  });

  it('returns focus to the new press trigger when the pending reward is dismissed or chosen', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    await openDoors(view);
    const trigger = () =>
      within(screen.getByRole('region', { name: 'Rerolls' })).getByRole('button', {
        name: 'New reroll door',
      });

    // Escape on the reward picker drops the pending press.
    await choose(view, trigger(), /^Door 2$/);
    await screen.findByRole('listbox');
    await view.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(presses(view.application)).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(trigger()));

    // Choosing the reward appends the press.
    await appendPress(view, /^Door 2$/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(1));
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it('links a reroll Timeline row to its press in Room Doors', async () => {
    const view = renderWorkspace(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'Underworld',
      'F',
    );
    const details = await openDoors(view);
    await appendPress(view, /^Door 2$/);
    await waitFor(() => expect(presses(view.application)).toHaveLength(1));
    await view.user.click(details.getByRole('tab', { name: 'Room Timeline' }));
    expect(details.getByText(/^Reroll Door 2 → \S/)).toBeTruthy();
    await view.user.click(details.getByRole('button', { name: 'Room Doors' }));
    await waitFor(() =>
      expect(details.getByRole('tab', { name: 'Room Doors' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
    expect(screen.getByRole('region', { name: 'Rerolls' })).toBeTruthy();
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
