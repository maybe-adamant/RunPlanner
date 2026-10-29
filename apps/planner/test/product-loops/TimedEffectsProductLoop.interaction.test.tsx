// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createSteadyGrowthOutcomeAddress,
  createTargetAddress,
  createTraitOfferAddress,
  createTranscendentEmbryoOutcomeAddress,
  hermesShrineDeliveryEntryKey,
  semanticAddressKey,
  type ProjectCommand,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceScheduledLifecycleCheckpoint,
  loadSurfaceNOHermesShrineDeliveryCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  nBiome,
  pBiome,
  pOccurrenceIds,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createApplication } from '@planner/composition/createApplication';
import {
  findingDestinationLabel,
  nextRepairSelection,
  projectFeedbackHierarchy,
} from '@planner/projections/evaluationProjection';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { findingSelected, semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';
import { workspaceProjection } from '../support/biome-workbench';
import { pickRoomObjectAction } from '@planner-test/support/occurrence-workbench';

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
  await view.user.click(screen.getByRole('tab', { name: 'Combat 1 Timeline' }));
  await pickRoomObjectAction(view.user, 'Hermes Shrine', /^Buy .*· Slot 3$/);
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

/** Opens the scheduled checkpoint with one cleared timed outcome and selects its repair. */
function selectClearedOutcomeRepair(command: ProjectCommand, outcome: SemanticAddress) {
  const project = applyProjectCommand(loadSurfaceScheduledLifecycleCheckpoint(), catalog, command);
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  renderPlannerForInteraction({ application });
  const evaluation = application.store.getState().projectWorkspace.assembly!.evaluation;
  const issue = evaluation.issue;
  expect(issue?.owner).toEqual(outcome);
  const workspace = workspaceProjection(application);
  act(() =>
    application.store.dispatch(
      findingSelected(nextRepairSelection(issue!, workspace.focusByOwner)),
    ),
  );
  const destination = workspace.focusByOwner.get(semanticAddressKey(outcome));
  return {
    application,
    destination,
    feedback: projectFeedbackHierarchy(evaluation).route,
    label: findingDestinationLabel(catalog, outcome, destination, workspace.route),
  };
}

it('opens an N Steady Growth cycle that lands in O at its O room timeline row', () => {
  const outcome = createSteadyGrowthOutcomeAddress(
    createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, createOccurrenceId('surface-n-combat23')),
      'source',
    ),
    1,
  );
  const { application, destination, feedback, label } = selectClearedOutcomeRepair(
    { kind: 'ReplaceSteadyGrowthTarget', outcome, targetTraitKey: null },
    outcome,
  );
  expect(destination).toMatchObject({ biomeKey: 'O', roomTab: 'shipCombat1Actions' });
  expect(application.store.getState().editorSession.activePanel).toEqual({
    kind: 'biome',
    biomeKey: 'O',
  });
  expect(label).toMatch(new RegExp(`^${catalog.biomes.byKey.O!.label}`));
  expect(feedback.biomes.get('O')?.findingCount).toBe(1);
  expect(feedback.biomes.get('N')?.findingCount).toBe(0);
  const row = document
    .getElementById(semanticOwnerControlElementId(outcome))
    ?.closest('[aria-label="Steady Growth"]');
  expect(row).toBeTruthy();
  application.dispose();
});

it('opens a route-start Embryo cycle at its landing room rather than the Loadout', () => {
  const outcome = createTranscendentEmbryoOutcomeAddress(
    createRouteStartKeepsakeSelectionAddress('Surface'),
    1,
  );
  const { application, destination, feedback, label } = selectClearedOutcomeRepair(
    { kind: 'ReplaceTranscendentEmbryoTransformation', outcome, value: null },
    outcome,
  );
  expect(destination).toMatchObject({ biomeKey: 'N', roomTab: 'actions' });
  expect(application.store.getState().editorSession.activePanel).toEqual({
    kind: 'biome',
    biomeKey: 'N',
  });
  expect(label).not.toBe('Loadout');
  expect(feedback.loadout.findingCount).toBe(0);
  expect(feedback.biomes.get('N')?.findingCount).toBe(1);
  const row = document
    .getElementById(semanticOwnerControlElementId(outcome))
    ?.closest('[aria-label="Transcendent Embryo"]');
  expect(row).toBeTruthy();
  application.dispose();
});
