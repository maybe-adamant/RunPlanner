// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import { createProjectDocument } from '@run-planner/engine/authored-project';
import { afterEach, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

afterEach(cleanup);

it('drafts a zero-finding route as one undoable edit', async () => {
  const application = createApplication({ draftSeed: () => 3 });
  const { catalog, store } = application;
  store.dispatch(
    newProjectCreated(
      createProjectDocument(catalog, {
        projectId: 'run-plan',
        routeKey: 'Underworld',
        configuredBiomeCount: 0,
      }),
    ),
  );
  const before = store.getState().projectWorkspace.history!.present;
  const { user } = renderPlannerForInteraction({ application });
  await user.click(screen.getByRole('button', { name: 'Draft' }));
  const gods = screen.getByRole('group', { name: 'Gods' });
  for (const god of ['Zeus', 'Hera', 'Apollo'])
    await user.click(within(gods).getByRole('button', { name: god }));
  await user.click(screen.getByRole('button', { name: 'Edit basket' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: catalog.traits.byKey.ZeusWeaponBoon!.label,
    }),
  );
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));

  const settled = new Promise<void>((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (store.getState().draftSession.run.kind === 'running') return;
      unsubscribe();
      resolve();
    });
  });
  const actions = document.querySelector('.draft-action-row') as HTMLElement;
  await user.click(within(actions).getByRole('button', { name: 'Draft' }));
  await act(() => settled);

  const workspace = store.getState().projectWorkspace;
  expect(store.getState().draftSession.run.kind).toBe('drafted');
  expect(workspace.history!.past).toEqual([before]);
  expect(workspace.assembly!.evaluation.status).toBe('valid');
  expect(workspace.assembly!.evaluation.findings).toEqual([]);
  expect(workspace.history!.present.route.biomes).toHaveLength(4);
  expect(screen.getByRole('region', { name: 'Draft report' })).toBeTruthy();
  expect(screen.getByRole('note').textContent).toBe('Drafting replaces the current route plan.');

  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(store.getState().projectWorkspace.history!.present).toBe(before);
});
