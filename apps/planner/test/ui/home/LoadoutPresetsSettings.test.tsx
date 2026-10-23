// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { catalog } from '@run-planner/hades2-catalog';
import { afterEach, describe, expect, it } from 'vitest';

import { createBrowserLoadoutPresets } from '@planner/persistence/loadoutPresets';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

function presets(stored: object | null) {
  const values = new Map(
    stored === null
      ? []
      : [['run-planner.loadout-presets', JSON.stringify({ version: 1, ...stored })]],
  );
  let ids = 0;
  return createBrowserLoadoutPresets(
    catalog,
    () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    }),
    () => `new-${(ids += 1)}`,
  );
}

async function openSettings(controller: ReturnType<typeof presets>) {
  const rendered = renderPlannerForInteraction({
    startWithProject: false,
    loadoutPresets: controller,
  });
  await rendered.user.click(await screen.findByRole('button', { name: 'Settings' }));
  return rendered;
}

const list = (name: 'Arcana' | 'Vows') => screen.getByRole('list', { name });
const names = (name: 'Arcana' | 'Vows') =>
  within(list(name))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.preset-row-name')?.textContent);

describe('Settings presets', () => {
  afterEach(cleanup);

  it('adds, edits and renames a preset on the same boards the editor uses', async () => {
    const controller = presets({
      arcana: [{ id: 'a', name: 'Arcana preset', cardKeys: [] }],
      vows: [],
    });
    const { user } = await openSettings(controller);
    expect(screen.getByText('No presets yet.')).toBeTruthy();
    // Settings no longer repeats the version, which About shows.
    expect(screen.queryByText(/^Run Planner /)).toBeNull();

    await user.click(screen.getAllByRole('button', { name: 'Add preset' })[0]!);
    let dialog = screen.getByRole('dialog', { name: 'New Arcana preset' });
    expect(within(dialog).getByRole('textbox', { name: 'Preset name' })).toHaveProperty(
      'value',
      'Arcana preset 2',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Death' }));
    await user.click(within(dialog).getByRole('button', { name: 'Persistence' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(names('Arcana')).toEqual(['Arcana preset', 'Arcana preset 2']);
    expect(within(list('Arcana')).getByText('2 cards · 6 Grasp')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Edit Arcana preset 2' }));
    dialog = screen.getByRole('dialog', { name: 'Edit Arcana preset' });
    expect(within(dialog).getByRole('button', { name: 'Death' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Death' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(controller.getSnapshot().arcana[1]!.cardKeys).toEqual(['BonusHealth']);

    await user.click(screen.getByRole('button', { name: 'Rename Arcana preset 2' }));
    const name = screen.getByRole('textbox', { name: 'Preset name' });
    await user.clear(name);
    await user.type(name, 'Survival');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(names('Arcana')).toEqual(['Arcana preset', 'Survival']);

    await user.click(screen.getAllByRole('button', { name: 'Add preset' })[1]!);
    dialog = screen.getByRole('dialog', { name: 'New Vow preset' });
    await user.click(within(dialog).getByRole('button', { name: /^Vow of Pain, rank 0/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(controller.getSnapshot().vows).toEqual([
      { id: 'new-2', name: 'Vow preset', ranks: { EnemyDamageShrineUpgrade: 1 } },
    ]);
  });

  it('deletes a preset with an Undo that puts it back where it was', async () => {
    const controller = presets({
      arcana: [],
      vows: [
        { id: 'a', name: 'First', ranks: {} },
        { id: 'b', name: 'Second', ranks: {} },
        { id: 'c', name: 'Third', ranks: {} },
      ],
    });
    const { user } = await openSettings(controller);
    await user.click(screen.getByRole('button', { name: 'Delete Second' }));
    expect(names('Vows')).toEqual(['First', 'Third']);
    const notice = await screen.findByText('Deleted preset “Second”');
    await user.click(
      within(notice.closest('[role="status"]') as HTMLElement).getByRole('button', {
        name: 'Undo',
      }),
    );
    await waitFor(() => expect(names('Vows')).toEqual(['First', 'Second', 'Third']));
  });

  it('says when stored presets named cards or Vows the planner does not know', async () => {
    await openSettings(
      presets({ arcana: [{ id: 'a', name: 'Old', cardKeys: ['RetiredCard'] }], vows: [] }),
    );
    expect(screen.getByText(/this planner doesn’t know; those were left out/)).toBeTruthy();
  });
});
