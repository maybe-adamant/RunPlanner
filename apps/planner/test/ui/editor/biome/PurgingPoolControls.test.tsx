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

it('marks the first empty Pool slot picker for a missing fill, not the Pool', () => {
  const { pool } = renderPostboss(withPoolSlot(createUnderworldFPoolCheckpoint(), 'middle', null));
  const middle = within(pool).getByRole('button', { name: 'Pool of Purging Offer 2 Item' });
  expect(middle.dataset.hasFindings).toBe('true');
  expect(
    within(pool).getByRole('button', { name: 'Pool of Purging Offer 3 Item' }).dataset.hasFindings,
  ).toBe('false');
  expect(pool.hasAttribute('data-has-findings')).toBe(false);
});

it('keeps Sold mounted: disabled on an empty unsold slot, removable on a stale sale', async () => {
  const { view, pool } = renderPostboss(
    withPoolSlot(withPoolSlot(createUnderworldFPoolCheckpoint(), 'left', null), 'middle', null),
  );
  const emptySold = within(pool).getByRole('checkbox', { name: 'Sold Offer 2' });
  expect(emptySold).toHaveProperty('disabled', true);
  expect(emptySold).toHaveProperty('checked', false);
  expect(emptySold.closest('label')?.getAttribute('title')).toBe('Choose a trait to sell');

  const staleSold = within(pool).getByRole('checkbox', { name: 'Sold Offer 1' });
  expect(staleSold).toHaveProperty('disabled', false);
  expect(staleSold).toHaveProperty('checked', true);
  await view.user.click(staleSold);
  await waitFor(() => expect(saleOrder(view.application)).toEqual([]));
});

it('marks Interact when the route has no usable Pool', () => {
  renderOccurrenceWorkbench(
    withRetainedFreshFilePostboss(createFreshFileFProject(), { poolSaleTraitKey: null }),
    'FreshFile',
    'F',
    occurrenceById(freshFileFPostbossId),
  );
  openRoomTab('Room Overview');
  const pool = screen.getByRole('group', { name: 'Pool of Purging configuration' });
  expect(
    within(pool).getByRole('checkbox', { name: 'Interact with Pool of Purging' }).dataset
      .hasFindings,
  ).toBe('true');
  expect(pool.hasAttribute('data-has-findings')).toBe(false);
});
