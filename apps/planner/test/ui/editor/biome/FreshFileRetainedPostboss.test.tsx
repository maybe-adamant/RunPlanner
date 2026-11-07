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
  it('removes a retained Well from its chip and keeps the retained Pool editable', async () => {
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
    await view.user.click(screen.getByRole('button', { name: 'Stygian Well' }));
    await view.user.click(screen.getByRole('option', { name: 'None' }));
    expect(postbossOccurrence(view.application)?.stygianWell).toBeUndefined();

    // The Pool has no Interact gate: its slots stay editable.
    expect(screen.queryByRole('checkbox', { name: 'Interact with Pool of Purging' })).toBeNull();
  });
});
