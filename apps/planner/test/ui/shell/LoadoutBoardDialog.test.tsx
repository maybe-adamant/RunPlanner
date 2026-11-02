// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { selectPresentProject } from '@planner/state/store';
import {
  createOpenTestApplication,
  renderPlannerForInteraction,
} from '@planner-test/fixtures/renderPlanner';

describe('loadout Arcana and Fear dialogs', () => {
  afterEach(cleanup);

  it('edit a draft that Cancel discards and Save commits as one Undo step', async () => {
    const application = createOpenTestApplication();
    const { user } = renderPlannerForInteraction({ application });
    const ranks = () => selectPresentProject(application.store.getState())!.route.loadout.fearRanks;
    const history = () => application.store.getState().projectWorkspace.history!.past.length;
    await user.click(screen.getByRole('button', { name: 'Loadout' }));
    const before = history();

    await user.click(screen.getByRole('button', { name: 'Edit Fear' }));
    let dialog = screen.getByRole('dialog', { name: 'Fear' });
    const save = () => within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Save' });
    expect(save().disabled).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Vow of Pain, rank 0 of 3' }));
    expect(save().disabled).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(ranks().EnemyDamageShrineUpgrade).toBe(0);
    expect(history()).toBe(before);

    await user.click(screen.getByRole('button', { name: 'Edit Fear' }));
    dialog = screen.getByRole('dialog', { name: 'Fear' });
    expect(within(dialog).getByRole('button', { name: 'Vow of Pain, rank 0 of 3' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Vow of Pain, rank 0 of 3' }));
    await user.click(within(dialog).getByRole('button', { name: 'Vow of Grit, rank 0 of 3' }));
    expect(ranks().EnemyDamageShrineUpgrade).toBe(0);
    await user.click(save());
    expect(ranks()).toMatchObject({ EnemyDamageShrineUpgrade: 1, EnemyHealthShrineUpgrade: 1 });
    expect(history()).toBe(before + 1);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(ranks()).toMatchObject({ EnemyDamageShrineUpgrade: 0, EnemyHealthShrineUpgrade: 0 });
  });

  it('returns a toggled-back Arcana draft to rest', async () => {
    const { user } = renderPlannerForInteraction({ application: createOpenTestApplication() });
    await user.click(screen.getByRole('button', { name: 'Loadout' }));
    await user.click(screen.getByRole('button', { name: 'Edit Arcana' }));
    const dialog = screen.getByRole('dialog', { name: 'Arcana' });
    const save = () => within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Save' });
    await user.click(within(dialog).getByRole('button', { name: 'Death' }));
    expect(save().disabled).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Death' }));
    expect(save().disabled).toBe(true);
  });
});
