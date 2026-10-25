// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import { createProjectDocument, decodeProjectDocument } from '@run-planner/engine/authored-project';
import { afterEach, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

afterEach(cleanup);

it('keeps draft settings in the project through Undo, save and reload', async () => {
  const library = createMemoryProjectLibrary();
  const application = createApplication({ projectLibrary: library.adapter });
  const { catalog } = application;
  const key = await library.file(
    createProjectDocument(catalog, {
      projectId: 'run-plan',
      routeKey: 'Underworld',
      configuredBiomeCount: 2,
    }),
  );
  await application.projectOperations.openPlan(key);
  let { user } = renderPlannerForInteraction({ application });
  let current = application;
  const draftPanel = () => user.click(screen.getByRole('button', { name: 'Draft' }));
  const present = () => current.store.getState().projectWorkspace.history!.present;
  await draftPanel();

  const gods = () => screen.getByRole('group', { name: 'Gods' });
  for (const god of ['Zeus', 'Hera', 'Apollo'])
    await user.click(within(gods()).getByRole('button', { name: god }));
  const fieldNpcName = document
    .querySelector('.draft-npc-field button')!
    .getAttribute('aria-label')!;
  await user.click(screen.getByRole('button', { name: fieldNpcName }));
  await user.click(screen.getByRole('button', { name: 'Edit basket' }));
  const zeusBoon = catalog.traits.byKey.ZeusWeaponBoon!.label;
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: zeusBoon }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
  const rack = () => screen.getByRole('button', { name: 'After Oceanus' });
  await user.click(rack());
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Lion Fang' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
  expect(rack().textContent).toBe('Lion Fang');

  // Each settings edit is one Undo step.
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(rack().textContent).toBe('Silver Wheel (Unchanged)');
  expect(present().route.draft.rackKeepsakeByBiome).toEqual({});
  await user.click(screen.getByRole('button', { name: 'Redo' }));
  expect(rack().textContent).toBe('Lion Fang');
  const authored = present().route.draft;
  expect(authored).toMatchObject({
    godKeys: ['Zeus', 'Hera', 'Apollo'],
    basketByGiver: { Zeus: ['ZeusWeaponBoon'] },
    rackKeepsakeByBiome: { G: 'DecayingBoostKeepsake' },
  });
  expect(Object.values(authored.fieldNpcsByBiome).flat()).toHaveLength(1);

  await act(async () => {
    expect((await application.projectOperations.flush()).status).toBe('success');
  });
  const saved = decodeProjectDocument(JSON.parse(library.writes.at(-1)!.json), catalog);
  expect(saved.route.draft).toEqual(authored);
  // A later start opens the plan from the library on Route.
  application.dispose();
  cleanup();
  current = createApplication({ projectLibrary: library.adapter });
  await current.startupReady;
  expect((await current.projectOperations.openPlan(key)).status).toBe('success');
  ({ user } = renderPlannerForInteraction({ application: current }));
  await draftPanel();
  for (const god of ['Zeus', 'Hera', 'Apollo'])
    expect(within(gods()).getByRole('button', { name: god }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  expect(screen.getByRole('button', { name: fieldNpcName }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(
    within(screen.getByRole('list', { name: 'Zeus basket traits' })).getByRole('listitem', {
      name: zeusBoon,
    }),
  ).toBeTruthy();
  expect(rack().textContent).toBe('Lion Fang');
  expect(present().route.draft).toEqual(authored);
});
