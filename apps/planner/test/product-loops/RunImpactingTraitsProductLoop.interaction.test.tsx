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
    const pickupRow = (entryKey: string) =>
      document.querySelector<HTMLElement>(`[data-room-action-key*="${entryKey}"]`);
    await view.user.click(roomButton('Opening'));
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await waitFor(() => expect(pickupRow('quickBuckGold')).not.toBeNull());

    application.store.dispatch(authoredProjectReplaced(loadSurfaceNBuriedTreasureCheckpoint()));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(roomButton('Pre-Hub'));
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await waitFor(() =>
      expect(
        ['smallGold', 'tinyGold1', 'tinyGold2', 'minorHeal1', 'minorHeal2', 'bones'].every(
          (entryKey) => pickupRow(entryKey) !== null,
        ),
      ).toBe(true),
    );
    application.dispose();
  });
});
