// @vitest-environment jsdom
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubRerollAddress,
  createIncomingRewardAddress,
  createNemesisRandomEventAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  createStaleSurfaceHermesDeliveryPlacement,
  loadSurfaceNEntryFrontierResolvedProject,
  loadSurfaceNProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  loadNemesisPomSeaStarCheckpoint,
  loadUnderworldFMidshopPomFrontierCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNNaturalSelectionFrontierCheckpoint,
  loadSurfaceNPartialHubCheckpoint,
  loadSurfaceNTenOpenInvalidCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  artemisSourceAnomalyProject,
  cageBeforeAthenaProject,
} from '@planner-test/support/finding-states';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, expect, it } from 'vitest';
import { renderWorkspace, workspaceProjection } from '@planner-test/support/biome-workbench';
import { ProjectFindings } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);

/** Opens the first findings-panel entry. */
async function selectFirstFinding(view: ReturnType<typeof renderWorkspace>): Promise<void> {
  const workspace = workspaceProjection(view.application);
  const issue = view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
  const findings = render(
    <Provider store={view.application.store}>
      <ProjectFindings catalog={catalog} issue={issue} focusByOwner={workspace.focusByOwner} />
    </Provider>,
  );
  await view.user.click(findings.container.querySelector('button')!);
}

/** Opens the first findings-panel entry and returns its rendered navigation target. */
async function openFirstFinding(view: ReturnType<typeof renderWorkspace>): Promise<HTMLElement> {
  const workspace = workspaceProjection(view.application);
  const issue = view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
  await selectFirstFinding(view);
  const focused = view.application.store.getState().editorSession.focusedSemanticOwner;
  expect(focused).toEqual(
    workspace.focusByOwner.get(semanticAddressKey(issue!.owner))!.focusAddress,
  );
  const target = document.getElementById(semanticOwnerControlElementId(focused!));
  if (target === null) throw new Error('finding navigation target is not rendered');
  expect(target.dataset.selectedFinding).toBe('true');
  return target;
}

it.each([
  ['trait offer', loadSurfaceNBuriedTreasureCheckpoint, 'Surface', 'N', /^Edit Trait · Buried/],
  [
    'Natural Selection',
    loadSurfaceNNaturalSelectionFrontierCheckpoint,
    'Surface',
    'N',
    /^Edit Trait · Natural Selection/,
  ],
  ['Pom', loadNemesisPomSeaStarCheckpoint, 'Underworld', 'F', /^Edit Pom/],
  ['Pom Slice', loadUnderworldFMidshopPomFrontierCheckpoint, 'Underworld', 'F', /^Edit Pom/],
] as const satisfies readonly (readonly [string, () => ProjectDocument, string, string, RegExp])[])(
  'marks and focuses the %s launcher inside its navigated Timeline row',
  async (_family, load, routeKey, biomeKey, launcherName) => {
    const view = renderWorkspace(load(), routeKey, biomeKey);
    const row = await openFirstFinding(view);
    const launcher = within(row).getByRole('button', { name: launcherName });
    expect(launcher.dataset.hasFindings).toBe('true');
    expect(launcher.getAttribute('aria-description')).not.toBeNull();
    expect(row.hasAttribute('data-has-findings')).toBe(false);
    // A row's description is only its own hint; findings describe the launcher.
    expect(row.getAttribute('aria-description')).toBe(hintOf(row));
    await waitFor(() => expect(document.activeElement).toBe(launcher));
  },
);

it('marks a Hub door row’s reward picker while navigation keeps the Hub board', async () => {
  const view = renderWorkspace(loadSurfaceNTenOpenInvalidCheckpoint(), 'Surface', 'N');
  const board = await openFirstFinding(view);
  const row = within(board).getByRole('listitem', { name: 'Combat 04' });
  const picker = within(row).getByRole('button', { name: 'Reward' });
  expect(paintedFindings()).toEqual([picker]);
  expect(board.hasAttribute('data-has-findings')).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(picker));
});

/** Every element that paints a finding inside the rendered workspace. */
function paintedFindings(): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-has-findings="true"]')];
}

it('marks the Nemesis interaction choice its action row needs, not the row', async () => {
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
    'Encounter',
  );
  let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'SelectEncounter',
    phase,
    encounterKey: 'NemesisRandomEvent',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SelectNemesisRandomEventFamily',
    event: createNemesisRandomEventAddress(phase),
    family: 'freeItem',
  });
  const view = renderWorkspace(project, 'Underworld', 'F');
  const row = await openFirstFinding(view);
  expect(row.hasAttribute('data-has-findings')).toBe(false);
  const reward = within(row).getByRole('button', { name: 'Reward' });
  expect(paintedFindings()).toEqual([reward]);
  await waitFor(() => expect(document.activeElement).toBe(reward));
});

it('marks Delete on a Timeline action that should not exist', async () => {
  const { project, host } = createStaleSurfaceHermesDeliveryPlacement();
  const view = renderWorkspace(project, host.routeKey, host.biomeKey);
  const row = await openFirstFinding(view);
  expect(row.hasAttribute('data-has-findings')).toBe(false);
  const remove = within(row).getByRole('button', { name: /^Remove .* from timeline$/ });
  expect(paintedFindings()).toEqual([remove]);
  await waitFor(() => expect(document.activeElement).toBe(remove));
});

it('marks the exit picker of a missing selection and focuses it', async () => {
  const project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-f-b1-e1'),
    }),
    value: { kind: 'unresolved' },
  });
  const view = renderWorkspace(project, 'Underworld', 'F');
  const workspace = workspaceProjection(view.application);
  const issue = view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
  const findings = render(
    <Provider store={view.application.store}>
      <ProjectFindings catalog={catalog} issue={issue} focusByOwner={workspace.focusByOwner} />
    </Provider>,
  );
  await view.user.click(findings.container.querySelector('button')!);
  // The exit is picked on the room's last row; its picker carries the mark and takes focus.
  const leave = screen.getByRole('listitem', { name: 'Leave room' });
  const exit = within(leave).getByRole('button', { name: 'Exit door' });
  expect(paintedFindings()).toEqual([exit]);
  expect(leave.hasAttribute('data-has-findings')).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(exit));
});

it('marks the Overview status line for an incomplete Hub open set', async () => {
  const biome = createBiomeAddress('Surface', 'N');
  const project = applyProjectCommand(loadSurfaceNEntryFrontierResolvedProject(), catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    }),
    hub: createHubDecisionAddress(biome, 'hub'),
    prebossOccurrenceId: createOccurrenceId('control-n-preboss'),
  });
  const view = renderWorkspace(project, 'Surface', 'N');
  const line = await openFirstFinding(view);
  // Below the board's least door count, the status line stands in for the rows.
  expect(line.getAttribute('role')).toBe('status');
  expect(
    within(screen.getByRole('region', { name: 'Hub door rewards' })).queryByRole('list'),
  ).toBeNull();
  expect(paintedFindings()).toEqual([line]);
  await waitFor(() => expect(document.activeElement).toBe(line));
});

it('marks the next visit’s room picker for an incomplete Hub visit order', async () => {
  const view = renderWorkspace(loadSurfaceNPartialHubCheckpoint(), 'Surface', 'N');
  await selectFirstFinding(view);
  expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
    'true',
  );
  const picker = screen.getByRole('button', { name: 'Visit 4 room' });
  expect(picker.dataset.selectedFinding).toBe('true');
  expect(paintedFindings()).toEqual([picker]);
  await waitFor(() => expect(document.activeElement).toBe(picker));
});

it('marks the visit reward’s repair for a rerolled reward its Hub rerolls no longer reach', async () => {
  const hub = createHubDecisionAddress(nBiome, 'hub');
  const reward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));
  const held = applyProjectCommand(loadSurfaceNProject(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Surface' },
    arcanaKeys: ['DoorReroll'],
  });
  const view = renderWorkspace(
    applyProjectCommand(held, catalog, {
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat05',
      reward: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
      index: 0,
    }),
    'Surface',
    'N',
  );
  // The visit picks the rerolled Boon, then its press goes and the pick stays for repair.
  act(() => {
    view.application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'source'),
        value: {
          kind: 'traits',
          giverKey: 'Ares',
          options: [
            { traitKey: 'AresWeaponBoon', rarity: 'Common' },
            { traitKey: 'AresSpecialBoon', rarity: 'Common' },
            { traitKey: 'AresCastBoon', rarity: 'Common' },
          ],
          selectedOptionKey: 'option1',
          rarificationActions: [],
        },
      }),
    );
    view.application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'RemoveHubReroll',
        reroll: createHubRerollAddress(nBiome, 'hub', 'r1'),
      }),
    );
  });
  const finding = view.application.store
    .getState()
    .projectWorkspace.assembly!.evaluation.findings.find(
      (candidate) => candidate.code === 'rerolledRewardMismatch',
    );
  if (finding === undefined) throw new Error('the rerolled reward finding is missing');
  expect(finding.origin).toEqual(reward);
  act(() =>
    view.application.store.dispatch(
      findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
    ),
  );
  expect(screen.getByRole('tab', { name: 'Hub Timeline' }).getAttribute('aria-selected')).toBe(
    'true',
  );
  const visits = screen.getByRole('region', { name: 'Ephyra Hub timeline' });
  const repair = within(visits).getByRole('button', {
    name: /^Drop rerolled reward for Combat 05/,
  });
  expect(paintedFindings()).toEqual([repair]);
  await waitFor(() => expect(document.activeElement).toBe(repair));
});

it('marks Restore on an Anomaly its source cannot produce', async () => {
  const view = renderWorkspace(artemisSourceAnomalyProject(), 'Underworld', 'G');
  const door = await openFirstFinding(view);
  expect(paintedFindings()).toEqual([within(door).getByRole('button', { name: /^Restore / })]);
});

it('renders a Fields cage with an ordering issue as a movable row', async () => {
  const view = renderWorkspace(cageBeforeAthenaProject(), 'Underworld', 'H');
  const row = await openFirstFinding(view);
  expect(row.tagName).toBe('LI');
  const move = within(row).getByRole('button', { name: /^Reorder / });
  expect(paintedFindings()).toEqual([move]);
  await waitFor(() => expect(document.activeElement).toBe(move));
});
