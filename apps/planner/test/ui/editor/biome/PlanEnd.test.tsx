// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, nBiome, nOccurrenceId } from '@run-planner/test-fixtures/surface';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFMidshopPomFrontierCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { createApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import type { WorkspaceRoomPlanEnd } from '@planner/projections/structured-workspace';
import { LeavePicker } from '@planner/ui/editor/biome/LeavePicker';
import {
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  expandDoors,
  leaveOptionNames,
  openLeavePicker,
  renderWorkspace,
} from '@planner-test/support/biome-workbench';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { hintOf } from '@planner-test/support/hints';

afterEach(() => cleanup());

/** The Midshop whose Pom target is unset, so the plan cannot end there yet. */
const midshop = 'midshop-pom-b5-e1';
/** A room behind a door not taken. */
const offPath = 'midshop-pom-b4-e2';

function endedAt(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePlanEnd',
    route: createRouteAddress(project.route.routeKey),
    planEnd: { biomeKey, occurrenceId: createOccurrenceId(occurrenceId) },
  });
}

function currentPlanEnd(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.history.present.route.planEnd;
}

/** The exit picked from a room, kept whether or not the plan ends there. */
function exitSelection(application: PlannerApplication, occurrenceId: string) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  const decision = workspace.history.present.route.biomes
    .flatMap((biome) => biome.topology?.decisions ?? [])
    .find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === occurrenceId,
    );
  return decision?.kind === 'exit' ? decision.selection : undefined;
}

/** The Leave room picker's closed face. */
function leaveTrigger(): HTMLElement {
  return within(within(roomCard()).getByRole('listitem', { name: 'Leave room' })).getByRole(
    'button',
    { name: 'Exit door' },
  );
}

function openRoom(
  application: PlannerApplication,
  room: ReturnType<typeof createOccurrenceAddress>,
) {
  act(() => {
    application.store.dispatch(semanticOwnerFocused(room));
  });
}

function roomCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('.biome-occurrence-workbench');
  if (card === null) throw new Error('no room workbench is open');
  return card;
}

describe('plan end in the biome workspace', () => {
  it('ends the plan from the Leave room picker, keeping the exit, and continues through it', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openRoom(
      application,
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b3-e1')),
    );
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    const exit = exitSelection(application, 'golden-f-b3-e1');
    expect(exit).toEqual({ kind: 'normal', exitKey: expect.any(String) });

    const options = await openLeavePicker(user, roomCard());
    const picked = leaveOptionNames(options).find((name) => name.endsWith(' (picked)'))!;
    expect(leaveOptionNames(options).at(-1)).toBe('End plan here');
    await user.click(within(options).getByRole('option', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({ biomeKey: 'F', occurrenceId: 'golden-f-b3-e1' });
    // Ending the plan keeps the exit underneath.
    expect(exitSelection(application, 'golden-f-b3-e1')).toEqual(exit);
    expect(leaveTrigger().textContent).toBe('End plan');

    // The end room's doors open inside the plan and stay editable.
    expandDoors();
    expect(document.querySelector('.door-body')?.hasAttribute('data-authoring-locked')).toBe(false);
    // Only its exit selection lies past the end; it must not lock the picker that continues the plan.
    expect(leaveTrigger().closest('[inert]')).toBeNull();
    expect(leaveTrigger()).toHaveProperty('disabled', false);
    const ended = await openLeavePicker(user, roomCard());
    expect(leaveOptionNames(ended).at(-1)).toBe('End plan here (picked)');
    // Picking the kept door continues the plan through it.
    await user.click(within(ended).getByRole('option', { name: picked.replace(' (picked)', '') }));
    expect(currentPlanEnd(application)).toBeUndefined();
    expect(exitSelection(application, 'golden-f-b3-e1')).toEqual(exit);

    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(currentPlanEnd(application)).toEqual({ biomeKey: 'F', occurrenceId: 'golden-f-b3-e1' });
    expect(exitSelection(application, 'golden-f-b3-e1')).toEqual(exit);
  });

  it('continues the plan through another door as one step', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openRoom(
      application,
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b3-e1')),
    );
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    const exit = exitSelection(application, 'golden-f-b3-e1');
    const options = await openLeavePicker(user, roomCard());
    const other = leaveOptionNames(options).find(
      (name) => name.startsWith('Door ') && !name.endsWith(')'),
    )!;
    await user.click(within(options).getByRole('option', { name: 'End plan here' }));
    const past = () => {
      const workspace = application.store.getState().projectWorkspace;
      if (workspace.kind !== 'openProject') throw new Error('expected an open project');
      return workspace.history.past.length;
    };
    const before = past();

    await user.click(
      within(await openLeavePicker(user, roomCard())).getByRole('option', { name: other }),
    );
    expect(currentPlanEnd(application)).toBeUndefined();
    expect(exitSelection(application, 'golden-f-b3-e1')).not.toEqual(exit);
    expect(past()).toBe(before + 1);
  });

  it('marks the end and the rooms past it on the rail', () => {
    renderWorkspace(endedAt(createGoldenFGHIProject(), 'F', 'golden-f-b5-e1'), 'Underworld', 'F');
    const stops = [...document.querySelectorAll<HTMLElement>('.biome-rail-stop')];
    const relation = (label: string) =>
      stops.find((stop) => within(stop).queryByText(label, { selector: 'strong' }) !== null)
        ?.dataset.planEnd;

    expect(relation('Decision 4')).toBeUndefined();
    expect(relation('Decision 5')).toBe('end');
    expect(relation('Decision 6')).toBe('pastEnd');
    expect(relation('Preboss')).toBe('pastEnd');
  });

  it('keeps a room past the end read-only while its Leave room picker moves the end to it', async () => {
    const { application, user } = renderWorkspace(
      endedAt(createGoldenFGHIProject(), 'F', 'golden-f-b5-e1'),
      'Underworld',
      'F',
    );
    openRoom(
      application,
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b7-e1')),
    );

    const overview = roomCard().querySelector('.room-workbench-panel-content');
    expect(overview?.hasAttribute('inert')).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    // Its doors, dormant past the end, are not shown: its Timeline is its last row alone.
    expect(within(roomCard()).queryByLabelText('Doors open')).toBeNull();
    expect(
      within(within(roomCard()).getByRole('list', { name: 'Room timeline' }))
        .getAllByRole('listitem')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual(['Leave room']);
    expect(screen.queryByRole('button', { name: 'End plan here' })).toBeNull();

    const options = await openLeavePicker(user, roomCard());
    expect(leaveOptionNames(options)).toEqual(['End plan here']);
    await user.click(within(options).getByRole('option', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({ biomeKey: 'F', occurrenceId: 'golden-f-b7-e1' });
  });

  it('waits on an earlier choice in a room the plan does not reach', async () => {
    const { application, user } = renderWorkspace(
      loadUnderworldFMidshopPomFrontierCheckpoint(),
      'Underworld',
      'F',
    );
    openRoom(application, createOccurrenceAddress(goldenFBiome, createOccurrenceId(offPath)));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    expect(screen.queryByRole('button', { name: 'End plan here' })).toBeNull();
    expect(leaveTrigger()).toHaveProperty('disabled', true);
    expect(hintOf(leaveTrigger())).toBe('Waits on an earlier choice.');
  });

  it('shows a saved end in its room while the plan up to it is incomplete, and continues it', async () => {
    const { application, user } = renderWorkspace(
      endedAt(loadUnderworldFMidshopPomFrontierCheckpoint(), 'F', midshop),
      'Underworld',
      'F',
    );
    openRoom(application, createOccurrenceAddress(goldenFBiome, createOccurrenceId(midshop)));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    expect(leaveTrigger().textContent).toBe('End plan');
    // Ended before its doors are planned, it continues through them.
    const options = await openLeavePicker(user, roomCard());
    expect(leaveOptionNames(options)).toEqual(['Doors', 'End plan here (picked)']);
    await user.click(within(options).getByRole('option', { name: 'Doors' }));
    expect(currentPlanEnd(application)).toBeUndefined();
  });

  it('continues planning from the end room, which offers no way on but keeps its door repair', async () => {
    const { application, user } = renderWorkspace(
      endedAt(createGoldenFGHIProject(), 'F', 'golden-f-b5-e1'),
      'Underworld',
      'F',
    );
    openRoom(
      application,
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b5-e1')),
    );
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    expect(screen.queryByRole('button', { name: 'End plan here' })).toBeNull();
    expect(leaveTrigger().textContent).toBe('End plan');
    expandDoors(roomCard());
    expect(screen.getByRole('button', { name: 'Reset Doors' })).toHaveProperty('disabled', false);
    const options = await openLeavePicker(user, roomCard());
    const way = within(options)
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('aria-label') !== 'End plan here',
      )!;
    await user.click(way);
    expect(currentPlanEnd(application)).toBeUndefined();
  });

  it("rerolls the end room's doors before the plan ends", async () => {
    const withDoorReroll = applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['DoorReroll'],
    });
    const { application, user } = renderWorkspace(
      endedAt(withDoorReroll, 'F', 'golden-f-b2-e1'),
      'Underworld',
      'F',
    );
    openRoom(
      application,
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b2-e1')),
    );
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    expect(leaveTrigger().textContent).toBe('End plan');
    await user.click(screen.getByRole('button', { name: 'Doors' }));
    await user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: /^Reroll Door 2/ }),
    );
    // The press asks for its reward like any room's; take the first possible one.
    await screen.findByRole('listbox');
    while (screen.queryByRole('listbox') !== null) {
      const options = await within(screen.getByRole('listbox')).findAllByRole('option');
      await user.click(options.find((option) => option.getAttribute('aria-disabled') !== 'true')!);
    }
    await waitFor(() => {
      const workspace = application.store.getState().projectWorkspace;
      if (workspace.kind !== 'openProject') throw new Error('expected an open project');
      const end = workspace.history.present.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'golden-f-b2-e1',
      )!;
      expect(end.roomActions.order.filter((action) => action.kind === 'reroll')).toHaveLength(1);
    });
    expect(currentPlanEnd(application)).toEqual({ biomeKey: 'F', occurrenceId: 'golden-f-b2-e1' });
  });

  it('ends the plan from the Preboss, whose fixed exit is its last row', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openRoom(
      application,
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-preboss-shop')),
    );
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    const options = await openLeavePicker(user, roomCard());
    expect(leaveOptionNames(options)).toEqual([
      expect.stringMatching(/ \(picked\)$/),
      'End plan here',
    ]);
    await user.click(within(options).getByRole('option', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({
      biomeKey: 'F',
      occurrenceId: 'golden-f-preboss-shop',
    });
    // Its one way out continues the plan again.
    await user.click(within(await openLeavePicker(user, roomCard())).getAllByRole('option')[0]!);
    expect(currentPlanEnd(application)).toBeUndefined();
  });

  it('ends the plan with a Hub visit from its main room', async () => {
    const { application, user } = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    openRoom(application, createOccurrenceAddress(nBiome, nOccurrenceId('combat02')));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    // Its last way out, back to the Hub, ends the whole visit.
    const exits = within(roomCard()).getAllByRole('listitem', { name: 'Leave room' });
    const options = await openLeavePicker(user, roomCard(), exits.length - 1);
    expect(leaveOptionNames(options)[0]).toBe('Hub (picked)');
    await user.click(within(options).getByRole('option', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({
      biomeKey: 'N',
      occurrenceId: nOccurrenceId('combat02'),
    });
  });

  it('keeps the hidden door of a Hub visit end room editable with its doors', async () => {
    const { application, user } = renderWorkspace(
      endedAt(loadSurfaceNOPQProject(), 'N', nOccurrenceId('combat05')),
      'Surface',
      'N',
    );
    openRoom(application, createOccurrenceAddress(nBiome, nOccurrenceId('combat05')));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    expandDoors(roomCard());
    const door = within(roomCard()).getByRole('article', { name: 'Hidden return door' });
    expect(within(door).getByRole('button', { name: 'Choose' })).toHaveProperty('disabled', false);
  });

  it('continues planning from a Hub main room the plan ends in through its way back', async () => {
    const { application, user } = renderWorkspace(
      endedAt(loadSurfaceNOPQProject(), 'N', nOccurrenceId('combat05')),
      'Surface',
      'N',
    );
    openRoom(application, createOccurrenceAddress(nBiome, nOccurrenceId('combat05')));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    const exits = within(roomCard()).getAllByRole('listitem', { name: 'Leave room' });
    // Its side visits stay inside the plan; only the way back to the Hub ends it.
    expect(within(exits[0]!).getByRole('button', { name: 'Exit door' }).textContent).not.toBe(
      'End plan',
    );
    const options = await openLeavePicker(user, roomCard(), exits.length - 1);
    expect(leaveOptionNames(options)[0]).toBe('Hub');
    expect(leaveOptionNames(options).at(-1)).toBe('End plan here (picked)');
    await user.click(within(options).getByRole('option', { name: 'Hub' }));
    expect(currentPlanEnd(application)).toBeUndefined();
  });

  it('leaves the Pre-Hub into its Hub, which continues a plan ended there', async () => {
    const { application, user } = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    openRoom(application, createOccurrenceAddress(nBiome, createOccurrenceId('surface-n-prehub')));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    let options = await openLeavePicker(user, roomCard());
    expect(leaveOptionNames(options)).toEqual(['Hub (picked)', 'End plan here']);
    await user.click(within(options).getByRole('option', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({
      biomeKey: 'N',
      occurrenceId: 'surface-n-prehub',
    });

    options = await openLeavePicker(user, roomCard());
    expect(leaveOptionNames(options)).toEqual(['Hub', 'End plan here (picked)']);
    await user.click(within(options).getByRole('option', { name: 'Hub' }));
    expect(currentPlanEnd(application)).toBeUndefined();
  });

  it('offers only its ways to continue an end room whose ways wait on its doors', async () => {
    const user = userEvent.setup();
    const intent = {} as WorkspaceRoomPlanEnd['endIntent'];
    render(
      <Provider store={createApplication().store}>
        <LeavePicker
          chosenKey="one"
          id="leave"
          options={['one', 'two'].map((key) => ({
            key,
            label: `Door ${key}`,
            disabledHint: 'Fill the remaining doors first.',
          }))}
          planEnd={{
            relation: 'end',
            availability: () => ({ available: true }),
            endIntent: intent,
            removeIntent: intent,
          }}
        />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Exit door' }));
    expect(leaveOptionNames(await screen.findByRole('listbox'))).toEqual([
      'Door one (disabled)',
      'Door two (disabled)',
      'End plan here (picked)',
    ]);
  });

  it('offers ending the plan in a room with no way out to pick once the plan up to it is complete', async () => {
    const user = userEvent.setup();
    const intent = {} as WorkspaceRoomPlanEnd['endIntent'];
    render(
      <Provider store={createApplication().store}>
        <LeavePicker
          chosenKey={undefined}
          id="leave"
          options={[]}
          planEnd={{
            availability: () => ({ available: false, reason: 'notSettled' }),
            endIntent: intent,
            removeIntent: intent,
          }}
        />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Exit door' }));
    const options = await screen.findByRole('listbox');
    expect(leaveOptionNames(options)).toEqual(['End plan here (disabled)']);
    expect(hintOf(within(options).getByRole('option'))).toBe(
      'Complete the plan up to this room first.',
    );
  });

  it('resets the visits of a Hub the plan ends in', async () => {
    const { application, user } = renderWorkspace(
      endedAt(loadSurfaceNOPQProject(), 'N', nOccurrenceId('combat05')),
      'Surface',
      'N',
    );
    act(() => {
      application.store.dispatch(semanticOwnerFocused(createHubDecisionAddress(nBiome, 'hub')));
    });
    await user.click(screen.getByRole('tab', { name: 'Hub Timeline' }));
    const reset = screen.getByRole('button', { name: 'Reset visits' });
    expect(reset).toHaveProperty('disabled', false);
    await user.click(reset);
    const workspace = application.store.getState().projectWorkspace;
    if (workspace.kind !== 'openProject') throw new Error('expected an open project');
    const hub = workspace.history.present.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.decisions.find((decision) => decision.kind === 'hub');
    // The visits go; the used fountain stays, moved to Entry.
    expect(hub?.kind === 'hub' ? hub.actions : undefined).toEqual([{ kind: 'useFountain' }]);
  });
});

describe('plan end on the Route panel', () => {
  it('opens the end room and removes the end', async () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectReplaced(endedAt(createGoldenFGHIProject(), 'F', 'golden-f-b5-e1')),
    );
    const { user } = renderPlannerForInteraction({ application });
    const control = screen.getByRole('group', { name: 'Plan end' });

    await user.click(within(control).getByRole('button', { name: 'Open room →' }));
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b5-e1')),
    );

    await user.click(screen.getByRole('button', { name: 'Route' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Plan end' })).getByRole('button', {
        name: 'Remove plan end',
      }),
    );
    expect(currentPlanEnd(application)).toBeUndefined();
    expect(screen.queryByRole('group', { name: 'Plan end' })).toBeNull();
  });
});
