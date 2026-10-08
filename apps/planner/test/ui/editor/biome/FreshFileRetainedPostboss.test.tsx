// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { renderOccurrenceWorkbench, renderWorkspace } from '@planner-test/support/biome-workbench';
import {
  createFreshFileFProject,
  freshFileFBiome,
  freshFileFPostbossId,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);

const keepsakeKey = catalog.keepsakes.values[0]!.key;

function postbossOccurrence(application: PlannerApplication) {
  const project: ProjectDocument | undefined =
    application.store.getState().projectWorkspace.history?.present;
  return project?.route.biomes[0]?.topology?.occurrences.find(
    (occurrence) => occurrence.occurrenceId === freshFileFPostbossId,
  );
}

describe('Fresh File retained Postboss controls', () => {
  it('shows a retained rack keepsake as removal-only and removes it', () => {
    const view = renderWorkspace(
      withRetainedFreshFilePostboss(createFreshFileFProject(), { rackKeepsakeKey: keepsakeKey }),
      'FreshFile',
      'F',
    );
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(
          createPostbossKeepsakeSelectionAddress(
            createOccurrenceAddress(freshFileFBiome, freshFileFPostbossId),
          ),
        ),
      ),
    );
    const timeline = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(timeline).queryByText(/no Keepsake Rack on this route/)).toBeNull();
    const keepsakePicker = within(timeline).getByRole('button', { name: 'Choose Keepsake' });
    expect(keepsakePicker).toHaveProperty('disabled', true);
    expect(hintOf(keepsakePicker)).toBe('No Keepsake Rack on this route.');
    fireEvent.click(
      within(timeline).getByRole('button', {
        name: 'Remove Change Keepsake from timeline',
      }),
    );
    expect(postbossOccurrence(view.application)?.keepsakeRack).toBeUndefined();
  });

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
