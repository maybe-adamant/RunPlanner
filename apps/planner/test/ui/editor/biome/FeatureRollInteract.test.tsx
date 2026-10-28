// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, createOccurrenceId } from '@run-planner/engine/authored-project';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import type { PlannerApplication } from '@planner/composition/createApplication';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { completionOccurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');

/** The F Postboss Well, its Boss Judgment holding the screen-reroll card. */
function withScreenRerolls() {
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
    arcanaKeys: ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
  });
}

function roomOrder(application: PlannerApplication) {
  return application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
      (room) => room.occurrenceId === postbossId,
    )!.roomActions.order;
}

it('rerolls the Well from Interact and buys a restocked slot with its item', async () => {
  const view = renderOccurrenceWorkbench(
    withScreenRerolls(),
    'Underworld',
    'F',
    completionOccurrenceById(postbossId),
  );
  openRoomTab('Room Overview');
  const well = screen.getByRole('group', { name: 'Stygian Well configuration' });
  expect(within(well).queryByRole('checkbox', { name: /^Purchased/ })).toBeNull();
  const interact = () => within(well).getByRole('button', { name: 'Interact with Well' });

  await view.user.click(interact());
  await view.user.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name: /^Reroll · costs 1/ }),
  );
  await waitFor(() =>
    expect(roomOrder(view.application).at(-1)).toMatchObject({ kind: 'rerollStygianWell' }),
  );

  // An unpinned restocked slot is bought with the item chosen next.
  await view.user.click(interact());
  await view.user.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name: /^Buy Offer 1…/ }),
  );
  await view.user.click(screen.getByRole('button', { name: 'Item bought' }));
  const [item] = within(await screen.findByRole('listbox')).getAllByRole('option');
  await view.user.click(item!);
  await waitFor(() =>
    expect(roomOrder(view.application).at(-1)).toEqual({
      kind: 'purchaseStygianWellOffer',
      generationKey: 'r1:healing',
    }),
  );

  // The item is pinned on its reroll in the same edit.
  expect(
    roomOrder(view.application).find((reference) => reference.kind === 'rerollStygianWell'),
  ).toMatchObject({ offerKeyBySlot: { healing: expect.any(String) } });
  openRoomTab('Room Timeline');
  expect(screen.getByRole('button', { name: /^Move Buy .+ · roll 2$/ })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: /^Remove Reroll Well · roll 2 from timeline$/ }),
  ).not.toHaveProperty('disabled', true);
});
