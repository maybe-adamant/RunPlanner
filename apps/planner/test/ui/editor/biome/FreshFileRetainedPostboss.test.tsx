// @vitest-environment jsdom

import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import {
  createFreshFileFProject,
  freshFileFPostbossId,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';

afterEach(cleanup);

function postbossOccurrence(application: PlannerApplication) {
  const project: ProjectDocument | undefined =
    application.store.getState().projectWorkspace.history?.present;
  return project?.route.biomes[0]?.topology?.occurrences.find(
    (occurrence) => occurrence.occurrenceId === freshFileFPostbossId,
  );
}

describe('Fresh File retained Postboss controls', () => {
  it('removes a retained Well and stops interacting with a retained Pool', async () => {
    const view = renderOccurrenceWorkbench(
      withRetainedFreshFilePostboss(createFreshFileFProject(), {
        well: true,
        poolSaleTraitKey: 'ApolloWeaponBoon',
      }),
      'FreshFile',
      'F',
      (biome) =>
        biome.nodes.find(
          (node): node is WorkspaceOccurrenceWorkbenchNode =>
            node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === freshFileFPostbossId,
        ),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Room Overview' }));
    const presence = screen.getByRole('checkbox', { name: 'Stygian Well present' });
    expect(presence).toHaveProperty('checked', true);
    expect(presence).toHaveProperty('disabled', false);
    await view.user.click(presence);
    expect(postbossOccurrence(view.application)?.stygianWell).toBeUndefined();

    const pool = screen.getByRole('checkbox', { name: 'Interact with Pool of Purging' });
    expect(pool).toHaveProperty('checked', true);
    await view.user.click(pool);
    expect(postbossOccurrence(view.application)?.purgingPool?.interacted).toBe(false);
    expect(
      postbossOccurrence(view.application)?.roomActions.order.some(
        (reference) => reference.kind === 'sellPurgingPoolTrait',
      ),
    ).toBe(false);
  });
});
