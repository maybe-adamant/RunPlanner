// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import { createProjectDocument } from '@run-planner/engine/authored-project';
import { afterEach, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';

afterEach(cleanup);

it('drafts a zero-finding route as one undoable edit, and rerolls as one more', async () => {
  const application = createApplication({ rerollSeed: () => 3 });
  const { catalog, store } = application;
  store.dispatch(
    authoredProjectReplaced(
      createProjectDocument(catalog, {
        projectId: 'run-plan',
        routeKey: 'Underworld',
        configuredBiomeCount: 0,
      }),
    ),
  );
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

  const run = async (name: 'Draft' | 'Reroll') => {
    const settled = new Promise<void>((resolve) => {
      const unsubscribe = store.subscribe(() => {
        if (store.getState().draftSession.run.kind === 'running') return;
        unsubscribe();
        resolve();
      });
    });
    const actions = document.querySelector('.draft-action-row') as HTMLElement;
    await user.click(within(actions).getByRole('button', { name }));
    await act(() => settled);
  };
  const present = () => store.getState().projectWorkspace.history!.present;
  // The draft settings are ordinary edits; drafting is one more.
  const before = present();
  await run('Draft');

  const workspace = store.getState().projectWorkspace;
  expect(store.getState().draftSession.run.kind).toBe('drafted');
  expect(workspace.history!.past.at(-1)).toBe(before);
  expect(workspace.assembly!.evaluation.status).toBe('valid');
  expect(workspace.assembly!.evaluation.findings).toEqual([]);
  expect(workspace.history!.present.route.biomes).toHaveLength(4);
  const actionRow = document.querySelector('.draft-action-row') as HTMLElement;
  expect(within(actionRow).getByText(/^\d+ of \d+ targets met\.$/)).toBeTruthy();
  expect(screen.getByRole('note').textContent).toBe('Drafting replaces the current route plan.');

  expect(present().route.draft).toBe(before.route.draft);

  // Reroll saves its new seed with the drafted route: one Undo reverts both.
  const drafted = present();
  await run('Reroll');
  expect(store.getState().draftSession.run.kind).toBe('drafted');
  expect(present().route.draft.seed).toBe(3);
  expect(present().route.draft.seed).not.toBe(drafted.route.draft.seed);
  expect(present().route.biomes).not.toBe(drafted.route.biomes);
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(present()).toBe(drafted);

  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(present()).toBe(before);
});
