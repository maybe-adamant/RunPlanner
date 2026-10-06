// @vitest-environment jsdom
import { catalog } from '@run-planner/hades2-catalog';
import { semanticAddressKey, type ProjectDocument } from '@run-planner/engine/authored-project';
import {
  loadNemesisPomSeaStarCheckpoint,
  loadUnderworldFMidshopPomFrontierCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNNaturalSelectionFrontierCheckpoint,
  loadSurfaceNTenOpenInvalidCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { cleanup, render, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, expect, it } from 'vitest';
import { renderWorkspace, workspaceProjection } from '@planner-test/support/biome-workbench';
import { ProjectFindings } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

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
  'marks the %s launcher while navigation keeps its Timeline row',
  async (_family, load, routeKey, biomeKey, launcherName) => {
    const view = renderWorkspace(load(), routeKey, biomeKey);
    const row = await openFirstFinding(view);
    const launcher = within(row).getByRole('button', { name: launcherName });
    expect(launcher.dataset.hasFindings).toBe('true');
    expect(launcher.getAttribute('aria-description')).not.toBeNull();
    expect(row.dataset.hasFindings).toBe('false');
    expect(row.getAttribute('aria-description')).toBeNull();
  },
);

it('marks a Hub main reward picker while navigation keeps the Hub board', async () => {
  const view = renderWorkspace(loadSurfaceNTenOpenInvalidCheckpoint(), 'Surface', 'N');
  const board = await openFirstFinding(view);
  const card = within(board).getByRole('article', { name: 'Combat 04 Hub room' });
  const picker = within(card).getByRole('button', { name: 'Reward' });
  expect(picker.dataset.hasFindings).toBe('true');
  expect(board.dataset.hasFindings).toBe('false');
});
