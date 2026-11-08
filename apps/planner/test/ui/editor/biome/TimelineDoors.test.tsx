// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRoomActionAddress,
  createStartingRewardAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { findingSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { PurchaseCost } from '@planner/ui/editor/biome/commerce/GoldAmount';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import {
  leaveOptionNames,
  openLeavePicker,
  renderWorkspace,
} from '@planner-test/support/biome-workbench';

afterEach(cleanup);

const f = createBiomeAddress('Underworld', 'F');
const source = createOccurrenceId('golden-f-b2-e1');
const doorTo = createOccurrenceId('golden-f-b3-e1');

async function openTimeline(view: ReturnType<typeof renderWorkspace>) {
  act(() =>
    view.application.store.dispatch(semanticOwnerFocused(createOccurrenceAddress(f, source))),
  );
  const details = screen.getByRole('complementary', { name: 'Details' });
  await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
  return details;
}

function history(view: ReturnType<typeof renderWorkspace>) {
  return view.application.store.getState().projectWorkspace.history!;
}

describe('a room’s doors on its Timeline', () => {
  it('keeps its doors collapsed by default and remembers an explicit choice per room', async () => {
    const view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    const details = await openTimeline(view);
    const before = history(view);
    const disclosure = () => within(details).getByRole('button', { name: 'Door details' });
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');
    expect(within(details).queryByRole('region', { name: 'Door details' })).toBeNull();
    // The closed row still names every door.
    const summary = within(details).getByRole('list', { name: 'Door summary' });
    // Chips name their doors without being tab stops of their own.
    expect(
      within(summary)
        .getAllByRole('listitem')
        .every((chip) => !chip.hasAttribute('tabindex')),
    ).toBe(true);

    await view.user.click(disclosure());
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(disclosure().getAttribute('aria-controls')!)).not.toBeNull();
    expect(within(details).getByRole('region', { name: 'Door details' })).toBeTruthy();

    // The open stays across a tab switch and a visit to another room.
    await view.user.click(within(details).getByRole('tab', { name: 'Room Overview' }));
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(f, createOccurrenceId('golden-f-start'))),
      ),
    );
    await openTimeline(view);
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');

    // So does a close.
    await view.user.click(disclosure());
    await view.user.click(within(details).getByRole('tab', { name: 'Room Overview' }));
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');
    // Opening and closing is no authored edit.
    expect(history(view)).toBe(before);

    // Navigating to a door's owner opens the doors again.
    act(() =>
      view.application.store.dispatch(semanticOwnerFocused(createIncomingRewardAddress(f, doorTo))),
    );
    expect(within(details).getByRole('region', { name: 'Door details' })).toBeTruthy();
  });

  it('opens on a door finding, stays closed after a close while it lasts, and reopens on a new one', async () => {
    const view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    const details = await openTimeline(view);
    const disclosure = () => within(details).getByRole('button', { name: 'Door details' });
    await view.user.click(disclosure());
    await view.user.click(disclosure());
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');

    // A door reward the bag cannot give is new attention: the doors open.
    const doorTwo = createIncomingRewardAddress(f, createOccurrenceId('golden-f-b3-e2'));
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceIncomingReward',
          reward: doorTwo,
          value: { rewardType: 'MaxHealthDrop' },
        }),
      ),
    );
    const finding = view.application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(doorTwo),
      );
    if (finding === undefined) throw new Error('missing door reward finding');
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');

    // Closed again with the same finding, the doors stay closed.
    await view.user.click(disclosure());
    await view.user.click(within(details).getByRole('tab', { name: 'Room Overview' }));
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');

    // Navigating to the finding opens them, so its target shows.
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(within(details).getByRole('region', { name: 'Door details' })).toBeTruthy();
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');
  });

  it('opens when the room’s doors are the next required input', async () => {
    const start = createOccurrenceId('timeline-doors-f-start');
    let project = createProjectDocument(catalog, {
      projectId: 'timeline-doors-frontier',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: f,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() =>
      view.application.store.dispatch(semanticOwnerFocused(createOccurrenceAddress(f, start))),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    expect(
      within(details).getByRole('button', { name: 'Door details' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('picks the exit on the Leave row as one authored step', async () => {
    const view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    const details = await openTimeline(view);
    const before = history(view).past.length;
    const options = await openLeavePicker(view.user, details);
    await view.user.click(within(options).getByRole('option', { name: /^Door 2 ·/ }));
    expect(history(view).past).toHaveLength(before + 1);
    const decision = history(view)
      .present.route.biomes.find((biome) => biome.biomeKey === 'F')!
      .topology!.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === source,
      );
    expect(decision?.kind === 'exit' ? decision.selection : undefined).toEqual({
      kind: 'normal',
      exitKey: 'exit2',
    });
    // The chosen door is the picked option.
    const names = leaveOptionNames(await openLeavePicker(view.user, details));
    expect(names.filter((name) => name.endsWith('(picked)'))).toEqual([
      expect.stringMatching(/^Door 2 · /),
    ]);
  });

  it('shows each press’s door chips as that press leaves them', async () => {
    let project = applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: ['DoorReroll'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(f, source),
      target: { kind: 'door', exitKey: 'exit1', occurrenceId: doorTo },
      reward: { rewardType: 'RoomMoneyDrop' },
      index: project.route.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === source,
      )!.roomActions.order.length,
    });
    const press = project.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === source,
    )!.roomActions.order.find((action) => action.kind === 'reroll');
    if (press?.kind !== 'reroll') throw new Error('Door 1 press is missing');
    const view = renderWorkspace(project, 'Underworld', 'F');
    const details = await openTimeline(view);
    const row = details.querySelector<HTMLElement>(
      `[data-room-action-key="${CSS.escape(
        createRoomActionAddress(f, source, JSON.stringify(['reroll', press.rerollId])).actionKey,
      )}"]`,
    );
    if (row === null) throw new Error('Door 1 press row is missing');
    const [doorOne] = within(within(row).getByRole('list', { name: 'Door summary' })).getAllByRole(
      'listitem',
    );
    // The press row shows Door 1 with the reward its press left: Gold.
    const gold = rewardIcon('RoomMoneyDrop');
    expect([...doorOne!.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toContain(
      gold,
    );
    // The Doors open row keeps Door 1's first draw.
    const firstDraw = within(within(details).getByLabelText('Doors open')).getAllByRole(
      'listitem',
    )[0]!;
    expect(
      [...firstDraw.querySelectorAll('img')].map((img) => img.getAttribute('src')),
    ).not.toContain(gold);
  });
});

describe('a room’s door notes', () => {
  const sideRoom = createOccurrenceAddress(nBiome, nLocalOccurrenceId('combat05', 'sideDoor1'));

  async function openRoom(view: ReturnType<typeof renderWorkspace>, room: typeof sideRoom) {
    act(() => view.application.store.dispatch(semanticOwnerFocused(room)));
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    return details;
  }

  const note = (text: RegExp | string) =>
    within(screen.getByRole('complementary', { name: 'Notes' }))
      .getByText(text)
      .closest('li')!;
  const lit = (element: Element | null | undefined) => element?.hasAttribute('data-note-active');

  it('lights the hidden door’s chip while the doors are shut, and its row once open', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const details = await openRoom(view, sideRoom);
    const disclosure = within(details).getByRole('button', { name: 'Door details' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    const hiddenNote = within(screen.getByRole('complementary', { name: 'Notes' }))
      .getAllByRole('listitem')
      .find((item) => item.querySelector('.door-note-symbol') !== null)!;
    const chip = () =>
      within(within(details).getByRole('list', { name: 'Door summary' })).getByRole('listitem', {
        name: 'Hidden door',
      });

    fireEvent.mouseEnter(hiddenNote);
    expect(lit(chip())).toBe(true);
    expect(lit(disclosure)).toBe(false);
    // Hovering never opens the doors.
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    fireEvent.mouseLeave(hiddenNote);
    expect(lit(chip())).toBe(false);

    await view.user.click(disclosure);
    fireEvent.mouseEnter(hiddenNote);
    const door = within(details).getByRole('article', { name: 'Hidden return door' });
    expect(lit(door.querySelector('[aria-describedby]'))).toBe(true);
    expect(lit(chip())).toBe(false);
    expect(lit(disclosure)).toBe(false);
  });

  it('lights the Doors open title for a note on the doors as a whole', async () => {
    const view = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'H');
    const details = await openRoom(
      view,
      createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-miniboss01')),
    );
    const disclosure = within(details).getByRole('button', { name: 'Door details' });
    const batchNote = note('Cage rewards appear bottom to top on the door');
    const shut = disclosure.getAttribute('aria-expanded') === 'false';
    fireEvent.mouseEnter(batchNote);
    expect(lit(disclosure)).toBe(true);
    fireEvent.mouseLeave(batchNote);
    expect(lit(disclosure)).toBe(false);

    // The title stays its target with the doors either way.
    await view.user.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe(shut ? 'true' : 'false');
    fireEvent.mouseEnter(batchNote);
    expect(lit(disclosure)).toBe(true);

    // Opening it lands on the doors themselves.
    await view.user.click(batchNote);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(
      within(details).getByRole('region', { name: 'Door details' }),
    );
  });

  it('opens the doors onto a clicked note’s door, keeping the remembered choice', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    const details = await openRoom(view, sideRoom);
    const disclosure = () => within(details).getByRole('button', { name: 'Door details' });
    // Shut by choice.
    await view.user.click(disclosure());
    await view.user.click(disclosure());
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');
    const choices = view.application.store.getState().editorSession.doorEditorChoices;

    const hiddenNote = within(screen.getByRole('complementary', { name: 'Notes' }))
      .getAllByRole('listitem')
      .find((item) => item.querySelector('.door-note-symbol') !== null)!;
    await view.user.click(hiddenNote);
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');
    const door = within(details).getByRole('article', { name: 'Hidden return door' });
    expect(door.contains(document.activeElement)).toBe(true);
    expect(view.application.store.getState().editorSession.doorEditorChoices).toBe(choices);

    // Leaving that navigation brings the choice back.
    await openRoom(view, sideRoom);
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');
  });
  it('opens the doors onto a boss door’s fixed pool from its note', async () => {
    const view = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'H');
    const details = await openRoom(
      view,
      createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-preboss-shop')),
    );
    const disclosure = () => within(details).getByRole('button', { name: 'Door details' });
    if (disclosure().getAttribute('aria-expanded') === 'true') await view.user.click(disclosure());
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');

    await view.user.click(note('Fixed for this boss'));
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.hasAttribute('data-door-note-focus')).toBe(true);
    expect(document.activeElement?.textContent).toContain('Major Reward');
  });
});

describe('a room’s last Timeline row', () => {
  it('offers a lone door as the way out, with ending the plan', async () => {
    const view = renderWorkspace(loadUnderworldFGCheckpoint(), 'Underworld', 'F');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(f, createOccurrenceId('golden-f-start'))),
      ),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    expect(leaveOptionNames(await openLeavePicker(view.user, details))).toEqual([
      'Door 1 · Combat 02 (picked)',
      'End plan here',
    ]);
  });

  it('puts a Ship room’s doors and last row in its last phase only', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'O');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(oBiome, oOccurrenceIds.combat07)),
      ),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Intro Timeline' }));
    expect(within(details).queryByRole('listitem', { name: 'Leave room' })).toBeNull();
    expect(within(details).getByRole('listitem', { name: 'Select wheel' })).toBeTruthy();
    await view.user.click(within(details).getByRole('tab', { name: 'Combat 1 Timeline' }));
    expect(within(details).getByLabelText('Doors open')).toBeTruthy();
    expect(within(details).getByRole('listitem', { name: 'Leave room' })).toBeTruthy();
    expect(within(details).queryByRole('listitem', { name: 'Select wheel' })).toBeNull();
  });
});

describe('a room with no way on planned yet', () => {
  it('has no last row but keeps the plan-end action', async () => {
    const view = renderWorkspace(createCompleteFGProject(), 'Underworld', 'F');
    // An unpicked door's room is not on the route: nothing leads on from it.
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(2, 2))),
      ),
    );
    const details = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(details).getByRole('tab', { name: 'Room Timeline' }));
    expect(within(details).queryByRole('listitem', { name: 'Leave room' })).toBeNull();
    expect(within(details).getByRole('button', { name: 'End plan here' })).toBeTruthy();
  });
});

describe('a purchase’s chance to afford', () => {
  it('tells the gold held just before the purchase on hover', () => {
    render(
      <PurchaseCost
        affordability={{ label: '>99%', tone: 'high', balanceBefore: { label: '1413 ±90' } }}
        price={{ label: '650' }}
      />,
    );
    const figure = screen.getByText('>99%').closest<HTMLElement>('.purchase-affordability');
    expect(figure?.dataset.hint).toBe('1413 ±90 gold before this purchase');
    expect(figure?.tabIndex).toBe(0);
  });
});
