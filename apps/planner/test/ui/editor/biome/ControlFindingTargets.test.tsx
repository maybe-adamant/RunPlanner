// @vitest-environment jsdom
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createNemesisRandomEventAddress,
  createOccurrenceId,
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
import { cleanup, render, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, expect, it } from 'vitest';
import { renderWorkspace, workspaceProjection } from '@planner-test/support/biome-workbench';
import { ProjectFindings } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);

/** Opens the first findings-panel entry and returns its rendered navigation target. */
async function openFirstFinding(view: ReturnType<typeof renderWorkspace>): Promise<HTMLElement> {
  const workspace = workspaceProjection(view.application);
  const issue = view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
  const findings = render(
    <Provider store={view.application.store}>
      <ProjectFindings catalog={catalog} issue={issue} focusByOwner={workspace.focusByOwner} />
    </Provider>,
  );
  await view.user.click(findings.container.querySelector('button')!);
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

it('marks a Hub main reward picker while navigation keeps the Hub board', async () => {
  const view = renderWorkspace(loadSurfaceNTenOpenInvalidCheckpoint(), 'Surface', 'N');
  const board = await openFirstFinding(view);
  const card = within(board).getByRole('article', { name: 'Combat 04 Hub room' });
  const picker = within(card).getByRole('button', { name: 'Reward' });
  expect(picker.dataset.hasFindings).toBe('true');
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

it('rings every pickable door of a missing selection and focuses the first', async () => {
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
  const radios = [...document.querySelectorAll<HTMLInputElement>('.exit-list input[type="radio"]')];
  expect(radios.length).toBeGreaterThan(1);
  expect(paintedFindings()).toEqual(radios.filter((radio) => !radio.disabled));
  expect(document.querySelector('.exit-list')?.hasAttribute('data-has-findings')).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(radios.find((radio) => !radio.disabled)));
});

it('marks the Overview requirement box for an incomplete Hub open set', async () => {
  const biome = createBiomeAddress('Surface', 'N');
  const project = applyProjectCommand(loadSurfaceNEntryFrontierResolvedProject(), catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    }),
    hub: createHubDecisionAddress(biome, 'hub'),
  });
  const view = renderWorkspace(project, 'Surface', 'N');
  const box = await openFirstFinding(view);
  expect(box.getAttribute('role')).toBe('status');
  expect(box.textContent).toMatch(/^Open 9–10 rooms · \d+ open$/);
  expect(paintedFindings()).toEqual([box]);
  await waitFor(() => expect(document.activeElement).toBe(box));
});

it('marks the Timeline requirement box for an incomplete Hub visit order', async () => {
  const view = renderWorkspace(loadSurfaceNPartialHubCheckpoint(), 'Surface', 'N');
  const box = await openFirstFinding(view);
  expect(box.getAttribute('role')).toBe('status');
  expect(box.textContent).toBe('Visit 6 rooms · 3 planned · Fountain used');
  expect(paintedFindings()).toEqual([box]);
  await waitFor(() => expect(document.activeElement).toBe(box));
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
  const move = within(row).getByRole('button', { name: /^Move / });
  expect(paintedFindings()).toEqual([move]);
  await waitFor(() => expect(document.activeElement).toBe(move));
});
