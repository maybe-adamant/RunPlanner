// @vitest-environment jsdom

import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';
import { addGroupButton, openAddGroup } from '@planner-test/support/timeline-rows';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('run-impacting trait product loops', () => {
  it('loads the manifest-backed generated-pickup workflows through existing Room Action rows', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNQuickBuckCheckpoint()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    const roomButton = (label: string) => {
      const ephyraStructure = screen.getByRole('region', { name: 'Ephyra route structure' });
      const button = Array.from(
        ephyraStructure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
      ).find((candidate) => candidate.textContent?.includes(label));
      if (button === undefined) throw new Error(`Ephyra ${label} room is missing`);
      return button;
    };
    // An unplaced optional pickup is offered in the Add area under its source trait.
    const offeredPickups = async (trait: string) => {
      const menu = await openAddGroup(view.user, trait);
      const keys = [...menu.querySelectorAll<HTMLElement>('[data-room-add-action]')].map(
        (action) => action.dataset.roomAddAction ?? '',
      );
      await view.user.keyboard('{Escape}');
      return keys;
    };
    const offers = (keys: readonly string[], entryKey: string) =>
      keys.some((key) => key.includes(entryKey));
    await view.user.click(roomButton('Opening'));
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await waitFor(() => expect(addGroupButton('Quick Buck')).toBeTruthy());
    expect(offers(await offeredPickups('Quick Buck'), 'quickBuckGold')).toBe(true);

    application.store.dispatch(authoredProjectReplaced(loadSurfaceNBuriedTreasureCheckpoint()));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(roomButton('Pre-Hub'));
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await waitFor(() => expect(addGroupButton('Buried Treasure')).toBeTruthy());
    const treasure = await offeredPickups('Buried Treasure');
    expect(
      ['smallGold', 'tinyGold1', 'tinyGold2', 'minorHeal1', 'minorHeal2', 'bones'].every(
        (entryKey) => offers(treasure, entryKey),
      ),
    ).toBe(true);
    application.dispose();
  });
});
