// @vitest-environment jsdom
import { createOccurrenceId, type ProjectDocument } from '@run-planner/engine/authored-project';
import { createUnderworldFPoolCheckpoint } from '@run-planner/test-fixtures/underworld';
import {
  createFreshFileFProject,
  freshFileFPostbossId,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { liveChip } from '@planner-test/support/live-row';
import {
  completionOccurrenceById,
  occurrenceById,
  openRoomTab,
} from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');

function renderPostboss(project: ProjectDocument) {
  const view = renderOccurrenceWorkbench(
    project,
    'Underworld',
    'F',
    completionOccurrenceById(postbossId),
  );
  openRoomTab('Room Overview');
  return { view, pool: screen.getByRole('group', { name: 'Pool of Purging configuration' }) };
}

function saleOrder(application: PlannerApplication) {
  return application.store
    .getState()
    .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
    ?.topology?.occurrences.find((room) => room.occurrenceId === postbossId)
    ?.roomActions.order.filter((reference) => reference.kind === 'sellPurgingPoolTrait');
}

it('shows the draw of a reached Pool slot and offers no blank', async () => {
  const { view, pool } = renderPostboss(createUnderworldFPoolCheckpoint());
  const middle = within(pool).getByRole('button', { name: 'Pool of Purging Offer 2 Item' });
  expect(middle.dataset.unknown).toBeUndefined();
  await view.user.click(middle);
  const options = within(await screen.findByRole('listbox')).getAllByRole('option');
  expect(options.some((option) => option.textContent === 'Unresolved')).toBe(false);
});

it('sells a slot still on the list from the live row, and removes a sale on its row', async () => {
  const { view, pool } = renderPostboss(createUnderworldFPoolCheckpoint());
  expect(within(pool).queryByRole('checkbox', { name: /^Sold/ })).toBeNull();
  // The Pool on the live row sells what its list can still show.
  openRoomTab('Room Timeline');
  await view.user.click(liveChip('Pool of Purging'));
  const options = within(await screen.findByRole('listbox')).getAllByRole('option');
  expect(options.every((option) => option.textContent?.startsWith('Sell'))).toBe(true);
  await view.user.keyboard('{Escape}');

  await view.user.click(screen.getByRole('button', { name: /^Remove Sell .* from timeline$/ }));
  await waitFor(() => expect(saleOrder(view.application)).toEqual([]));
});

// Fresh File hosts no Pool, so the anchor product leaves the retained one out of the Overview.
it('reports an unusable Pool only once it is used', () => {
  renderOccurrenceWorkbench(
    withRetainedFreshFilePostboss(createFreshFileFProject(), { poolSaleTraitKey: null }),
    'FreshFile',
    'F',
    occurrenceById(freshFileFPostbossId),
  );
  openRoomTab('Room Overview');
  const pool = screen.getByRole('group', { name: 'Pool of Purging configuration' });
  expect(
    within(pool).queryByRole('checkbox', { name: 'Interact with Pool of Purging' }),
  ).toBeNull();
  expect(pool.hasAttribute('data-has-findings')).toBe(false);
});
