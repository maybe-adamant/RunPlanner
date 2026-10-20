// @vitest-environment jsdom
import { act, cleanup, screen, within } from '@testing-library/react';
import { createProjectDocument, decodeProjectDocument } from '@run-planner/engine/authored-project';
import { afterEach, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { createFakeProfileFiles } from '@planner-test/fixtures/profileFiles';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

afterEach(cleanup);

it('keeps draft settings in the project through Undo, save and reload', async () => {
  const files = createFakeProfileFiles();
  const application = createApplication({ profileFile: files.adapter });
  const { catalog, store } = application;
  await files.openSaved(
    application,
    createProjectDocument(catalog, {
      projectId: 'run-plan',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    }),
    'draft.runplanner.json',
  );
  const { user } = renderPlannerForInteraction({ application });
  const draftPanel = () => user.click(screen.getByRole('button', { name: 'Draft' }));
  const present = () => store.getState().projectWorkspace.history!.present;
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
    basketTraitKeys: ['ZeusWeaponBoon'],
    rackKeepsakeByBiome: { G: 'DecayingBoostKeepsake' },
  });
  expect(Object.values(authored.fieldNpcsByBiome).flat()).toHaveLength(1);

  await act(async () => {
    expect((await application.projectOperations.saveProfile()).status).toBe('success');
  });
  const saved = decodeProjectDocument(JSON.parse(files.writes.at(-1)!.json), catalog);
  expect(saved.route.draft).toEqual(authored);
  await act(async () => {
    await files.openSaved(application, saved, 'draft.runplanner.json');
  });
  // Opening a document returns the workspace to Route.
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
