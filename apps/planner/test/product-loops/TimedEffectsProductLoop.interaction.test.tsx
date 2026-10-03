// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import {
  createOccurrenceAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceId,
  createTargetAddress,
  hermesShrineDeliveryEntryKey,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceScheduledLifecycleCheckpoint,
  loadSurfaceNOHermesShrineDeliveryCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { pBiome, pOccurrenceIds, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(cleanup);

it('preserves scheduled timed choices through an equivalent room picker edit and one Undo', async () => {
  const project = loadSurfaceScheduledLifecycleCheckpoint();
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  const view = renderPlannerForInteraction({ application });
  const owner = createOccurrenceAddress(pBiome, createOccurrenceId('surface-p-1-1-p_combat03'));
  const before = project.route.biomes
    .find((biome) => biome.biomeKey === 'P')!
    .topology!.occurrences.find((room) => room.occurrenceId === owner.occurrenceId)!;
  act(() =>
    application.store.dispatch(
      semanticOwnerNavigated(
        createTargetAddress(
          pBiome,
          { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
          'exit1',
        ),
      ),
    ),
  );
  await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
  await view.user.click(await screen.findByRole('option', { name: /Combat 05/ }));
  const history = application.store.getState().projectWorkspace.history!;
  const after = history.present.route.biomes
    .find((biome) => biome.biomeKey === 'P')!
    .topology!.occurrences.find((room) => room.occurrenceId === owner.occurrenceId)!;
  expect(after.gameName).toBe('P_Combat05');
  expect(after.acquisitionSites).toEqual(before.acquisitionSites);
  expect(after.roomActions.order).toEqual(before.roomActions.order);
  expect(history.past).toHaveLength(1);
  act(() => application.store.dispatch(semanticOwnerNavigated(owner)));
  await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
  expect(screen.queryByRole('button', { name: 'Restore delivery' })).toBeNull();
  expect(screen.getByText(/Collect.*Delivery/)).toBeTruthy();
  await view.user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(application.store.getState().projectWorkspace.history!.present).toBe(project);
  application.dispose();
});

it('inserts a purchased Hermes delivery automatically with Move and one Undo', async () => {
  const project = loadSurfaceNOHermesShrineDeliveryCheckpoint();
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  const view = renderPlannerForInteraction({ application });
  const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
  act(() => application.store.dispatch(semanticOwnerNavigated(source)));
  await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Hermes Shrine Offer 3' }));
  const history = application.store.getState().projectWorkspace.history!;
  expect(history.past).toHaveLength(1);
  const key = hermesShrineDeliveryEntryKey(source, 'initial:secondRight');
  const host = history.present.route.biomes
    .find((biome) => biome.biomeKey === 'O')!
    .topology!.occurrences.find((room) =>
      room.roomActions.order.some(
        (reference) => reference.kind === 'interactAcquisitionEntry' && reference.entryKey === key,
      ),
    );
  expect(host).toBeDefined();
  act(() =>
    application.store.dispatch(
      semanticOwnerNavigated(
        createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(
            createOccurrenceAddress(oBiome, host!.occurrenceId),
            'hermesShrineDelivery',
          ),
          key,
        ),
      ),
    ),
  );
  const row = screen.getByText('Collect Max Magick · Delivery').closest('li');
  if (row === null) throw new Error('Automatic delivery row missing');
  expect(within(row).getByRole('button', { name: /Move Collect Max Magick/ })).toBeTruthy();
  expect(within(row).queryByRole('button', { name: 'Restore delivery' })).toBeNull();
  expect(within(row).queryByRole('button', { name: 'Remove action' })).toBeNull();
  await view.user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(application.store.getState().projectWorkspace.history!.present).toBe(project);
  application.dispose();
});
