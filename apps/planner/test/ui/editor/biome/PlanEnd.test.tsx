// @vitest-environment jsdom

import { act, screen, waitFor, within } from '@testing-library/react';
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
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { createApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { expandDoors, renderWorkspace } from '@planner-test/support/biome-workbench';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

afterEach(() => cleanup());

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
  it('ends the plan after a room from its doors and removes it again, one step each', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openRoom(
      application,
      createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b3-e1')),
    );
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    await user.click(screen.getByRole('button', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({ biomeKey: 'F', occurrenceId: 'golden-f-b3-e1' });

    // The end room's doors open inside the plan and stay editable.
    expandDoors();
    expect(document.querySelector('.door-body')?.hasAttribute('data-authoring-locked')).toBe(false);
    // Only its exit selection lies past the end; it must not lock the action that removes the end.
    const continuePlanning = screen.getByRole('button', { name: 'Continue planning' });
    expect(continuePlanning.closest('[inert]')).toBeNull();
    await user.click(continuePlanning);
    expect(currentPlanEnd(application)).toBeUndefined();

    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(currentPlanEnd(application)).toEqual({ biomeKey: 'F', occurrenceId: 'golden-f-b3-e1' });
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

  it('keeps a room past the end read-only while its doors can move the end to it', async () => {
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
    // Its Timeline is read-only and its doors, dormant past the end, are not shown.
    expect(roomCard().querySelector('.room-workbench-panel-content')?.hasAttribute('inert')).toBe(
      true,
    );
    expect(within(roomCard()).queryByLabelText('Doors open')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({ biomeKey: 'F', occurrenceId: 'golden-f-b7-e1' });
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
    expect(within(roomCard()).getByRole('listitem', { name: 'Plan ends here' })).toBeTruthy();
    expect(within(roomCard()).queryByRole('listitem', { name: 'Leave room' })).toBeNull();
    expandDoors(roomCard());
    expect(screen.getByRole('button', { name: 'Reset Doors' })).toHaveProperty('disabled', false);
    await user.click(screen.getByRole('button', { name: 'Continue planning' }));
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
    expect(within(roomCard()).getByRole('listitem', { name: 'Plan ends here' })).toBeTruthy();
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
    const leave = within(roomCard()).getByRole('listitem', { name: 'Leave room' });
    await user.click(within(leave).getByRole('button', { name: 'End plan here' }));
    expect(currentPlanEnd(application)).toEqual({
      biomeKey: 'F',
      occurrenceId: 'golden-f-preboss-shop',
    });
  });

  it('ends the plan with a Hub visit from its main room', async () => {
    const { application, user } = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    openRoom(application, createOccurrenceAddress(nBiome, nOccurrenceId('combat02')));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    await user.click(screen.getByRole('button', { name: 'End plan here' }));
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
