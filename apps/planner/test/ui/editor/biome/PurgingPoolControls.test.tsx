// @vitest-environment jsdom
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createUnderworldFPoolCheckpoint,
  goldenFBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  createFreshFileFProject,
  freshFileFPostbossId,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import {
  completionOccurrenceById,
  occurrenceById,
  openRoomTab,
} from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
const postboss = createOccurrenceAddress(goldenFBiome, postbossId);

function withPoolSlot(
  project: ProjectDocument,
  slotKey: 'left' | 'middle' | 'right',
  traitKey: string | null,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePurgingPoolSlot',
    occurrence: postboss,
    slotKey,
    traitKey,
  });
}

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

it('leaves a blank Pool slot native, with no finding', () => {
  const { pool } = renderPostboss(withPoolSlot(createUnderworldFPoolCheckpoint(), 'middle', null));
  const middle = within(pool).getByRole('button', { name: 'Pool of Purging Offer 2 Item' });
  expect(middle.dataset.hasFindings).toBe('false');
  expect(
    within(pool).getByRole('button', { name: 'Pool of Purging Offer 3 Item' }).dataset.hasFindings,
  ).toBe('false');
  expect(pool.hasAttribute('data-has-findings')).toBe(false);
});

it('sells each slot still on the list from Interact, and removes a stale sale on its row', async () => {
  const { view, pool } = renderPostboss(
    withPoolSlot(withPoolSlot(createUnderworldFPoolCheckpoint(), 'left', null), 'middle', null),
  );
  expect(within(pool).queryByRole('checkbox', { name: /^Sold/ })).toBeNull();
  // Interact offers every slot still on the list, blank ones included.
  await view.user.click(within(pool).getByRole('button', { name: 'Interact with Pool' }));
  const options = within(await screen.findByRole('listbox')).getAllByRole('option');
  expect(options.map((option) => option.textContent?.startsWith('Sell '))).toEqual([true, true]);
  await view.user.keyboard('{Escape}');

  openRoomTab('Room Timeline');
  await view.user.click(screen.getByRole('button', { name: /^Remove Sell .* from timeline$/ }));
  await waitFor(() => expect(saleOrder(view.application)).toEqual([]));
});

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
