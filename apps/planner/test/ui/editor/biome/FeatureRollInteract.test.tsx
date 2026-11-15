// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, createOccurrenceId } from '@run-planner/engine/authored-project';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import type { PlannerApplication } from '@planner/composition/createApplication';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { completionOccurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import { takeLive } from '@planner-test/support/live-row';

afterEach(cleanup);

const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');

/** The F Postboss Well, its Boss Judgment holding the screen-reroll card unless replaced. */
function withScreenRerolls(
  arcanaKeys: readonly string[] = [
    'ScreenReroll',
    'StartingGold',
    'HealthRegen',
    'BonusDodge',
    'TradeOff',
  ],
) {
  const held = applyProjectCommand(loadUnderworldFStygianWellCheckpoint(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Underworld' },
    arcanaKeys: ['DoorReroll'],
  });
  return applyProjectCommand(held, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: {
      kind: 'judgmentArcana',
      routeKey: 'Underworld',
      biomeKey: 'F',
      occurrenceId: createOccurrenceId('golden-f-preboss-shop:boss'),
      phaseKey: 'Encounter',
    },
    arcanaKeys: [...arcanaKeys],
  });
}

function postbossRoom(application: PlannerApplication) {
  return application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
      (room) => room.occurrenceId === postbossId,
    )!;
}

function roomOrder(application: PlannerApplication) {
  return postbossRoom(application).roomActions.order;
}

it('rerolls the Well from the live row', async () => {
  const view = renderOccurrenceWorkbench(
    withScreenRerolls(),
    'Underworld',
    'F',
    completionOccurrenceById(postbossId),
  );
  openRoomTab('Room Overview');
  const well = screen.getByRole('group', { name: 'Stygian Well configuration' });
  expect(within(well).queryByRole('checkbox', { name: /^Purchased/ })).toBeNull();
  openRoomTab('Room Timeline');
  await takeLive(view.user, 'Stygian Well', 'Reroll');
  await waitFor(() =>
    expect(roomOrder(view.application).at(-1)).toMatchObject({ kind: 'rerollStygianWell' }),
  );
  expect(
    screen.getByRole('button', { name: /^Remove Reroll Well from timeline$/ }),
  ).not.toHaveProperty('disabled', true);
});
