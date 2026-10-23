// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { catalog } from '@run-planner/hades2-catalog';
import { afterEach, describe, expect, it } from 'vitest';

import { createBrowserLoadoutPresets } from '@planner/persistence/loadoutPresets';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import { selectPresentProject } from '@planner/state/store';
import {
  createOpenTestApplication,
  renderPlannerForInteraction,
} from '@planner-test/fixtures/renderPlanner';

function presets(stored: object) {
  const values = new Map([
    ['run-planner.loadout-presets', JSON.stringify({ version: 1, ...stored })],
  ]);
  return createBrowserLoadoutPresets(catalog, () => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  }));
}

const HEAVY = ['StartingGold', 'RarityBoost', 'ManaOverTime'];

describe('editor preset chips', () => {
  afterEach(cleanup);

  it('replaces the Arcana or Vows in one undoable step, and says why a preset does not fit', async () => {
    const application = createOpenTestApplication();
    const { user } = renderPlannerForInteraction({
      application,
      loadoutPresets: presets({
        arcana: [
          { id: 'light', name: 'Light', cardKeys: ['LastStand', 'BonusHealth'] },
          { id: 'heavy', name: 'Heavy', cardKeys: HEAVY },
        ],
        vows: [
          {
            id: 'void',
            name: 'Void practice',
            ranks: { EnemyDamageShrineUpgrade: 2, LimitGraspShrineUpgrade: 2 },
          },
        ],
      }),
    });
    const loadout = () => selectPresentProject(application.store.getState())!.route.loadout;
    await user.click(screen.getByRole('button', { name: 'Loadout' }));

    await user.click(screen.getByRole('button', { name: 'Edit Fear' }));
    let chips = screen.getByRole('group', { name: 'Vow presets' });
    await user.click(within(chips).getByRole('button', { name: 'Void practice' }));
    expect(loadout().fearRanks).toMatchObject({
      EnemyDamageShrineUpgrade: 2,
      LimitGraspShrineUpgrade: 2,
    });
    expect(
      within(chips).getByRole('button', { name: 'Void practice' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Edit Arcana' }));
    chips = screen.getByRole('group', { name: 'Arcana presets' });
    await user.click(within(chips).getByRole('button', { name: 'Heavy' }));
    expect(screen.getByText('Heavy: Needs 15 Grasp; your Vows allow 12.')).toBeTruthy();
    expect(loadout().manualArcanaKeys).toEqual([]);
    await user.click(within(chips).getByRole('button', { name: 'Light' }));
    expect(loadout().manualArcanaKeys).toEqual(['BonusHealth', 'LastStand']);
    expect(document.querySelector('.preset-chip-reason')?.textContent).toBe('');

    // Each preset was one step: two Undos return to the plan as it started.
    application.store.dispatch(authoredProjectUndoRequested());
    expect(loadout().manualArcanaKeys).toEqual([]);
    application.store.dispatch(authoredProjectUndoRequested());
    expect(loadout().fearRanks.EnemyDamageShrineUpgrade).toBe(0);
    expect(loadout().fearRanks.LimitGraspShrineUpgrade).toBe(0);
  });

  it('shows no chip row for a kind without presets', async () => {
    const { user } = renderPlannerForInteraction({
      loadoutPresets: presets({ arcana: [{ id: 'a', name: 'A', cardKeys: [] }], vows: [] }),
    });
    await user.click(screen.getByRole('button', { name: 'Loadout' }));
    await user.click(screen.getByRole('button', { name: 'Edit Fear' }));
    expect(screen.queryByRole('group', { name: 'Vow presets' })).toBeNull();
    expect(document.querySelector('.preset-chips')).toBeNull();
  });

  it('offers no presets on Fresh File, whose loadout is fixed', async () => {
    const { user } = renderPlannerForInteraction({
      application: createOpenTestApplication('FreshFile'),
      loadoutPresets: presets({
        arcana: [{ id: 'a', name: 'A', cardKeys: ['LastStand'] }],
        vows: [{ id: 'v', name: 'V', ranks: { EnemyDamageShrineUpgrade: 1 } }],
      }),
    });
    await user.click(screen.getByRole('button', { name: 'Loadout' }));
    expect(screen.queryByRole('button', { name: 'Edit Arcana' })).toBeNull();
    expect(document.querySelector('.preset-chips')).toBeNull();
  });
});
