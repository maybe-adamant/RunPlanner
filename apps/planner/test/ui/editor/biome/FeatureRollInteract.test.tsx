// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, createOccurrenceId } from '@run-planner/engine/authored-project';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createBiomeAddress, createOccurrenceAddress } from '@run-planner/engine/authored-project';

import type { PlannerApplication } from '@planner/composition/createApplication';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { completionOccurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import { hintOf } from '@planner-test/support/hints';

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

function roomOrder(application: PlannerApplication) {
  return application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
      (room) => room.occurrenceId === postbossId,
    )!.roomActions.order;
}

it('rerolls the Well from its Timeline entry and buys a restocked slot with its item', async () => {
  const view = renderOccurrenceWorkbench(
    withScreenRerolls(),
    'Underworld',
    'F',
    completionOccurrenceById(postbossId),
  );
  openRoomTab('Room Overview');
  const well = screen.getByRole('group', { name: 'Stygian Well configuration' });
  expect(within(well).queryByRole('checkbox', { name: /^Purchased/ })).toBeNull();
  // The Well's entry above the optional actions opens what it can do next.
  openRoomTab('Room Timeline');
  const interact = () => screen.getByRole('button', { name: 'Stygian Well' });

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
  expect(screen.getByRole('button', { name: /^Move Buy .+ · roll 2$/ })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: /^Remove Reroll Well · roll 2 from timeline$/ }),
  ).not.toHaveProperty('disabled', true);
});

it('drops an abandoned blank-slot pick and disables the entry once everything is bought', async () => {
  const view = renderOccurrenceWorkbench(
    withScreenRerolls(),
    'Underworld',
    'F',
    completionOccurrenceById(postbossId),
  );
  openRoomTab('Room Timeline');
  const interact = () => screen.getByRole('button', { name: 'Stygian Well' });
  await view.user.click(interact());
  await view.user.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name: /^Reroll · costs 1/ }),
  );
  await view.user.click(interact());
  await view.user.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name: /^Buy Offer 1…/ }),
  );
  expect(interact().textContent).toContain('Buy Offer 1…');
  await view.user.click(screen.getByRole('button', { name: 'Item bought' }));
  await screen.findByRole('listbox');
  await view.user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Item bought' })).toBeNull());
  expect(interact().textContent).toContain('Stygian Well ▸');
  cleanup();

  // Without the card no reroll is offered; once the only offer is bought nothing is left.
  const room = createOccurrenceAddress(createBiomeAddress('Underworld', 'F'), postbossId);
  const bought = applyProjectCommand(
    withScreenRerolls(['CastCount', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff']),
    catalog,
    {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'initial:healing',
      purchased: true,
    },
  );
  renderOccurrenceWorkbench(bought, 'Underworld', 'F', completionOccurrenceById(postbossId));
  openRoomTab('Room Timeline');
  const entry = interact() as HTMLButtonElement;
  expect(entry.disabled).toBe(true);
  expect(hintOf(entry)).toBe('Everything here is bought.');
});
