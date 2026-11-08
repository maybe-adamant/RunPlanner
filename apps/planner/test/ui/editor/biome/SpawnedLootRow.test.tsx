// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { renderOccurrenceWorkbench, workspaceBiome } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';

afterEach(cleanup);

const combat03 = 'surface-p-1-1-p_combat03';

function render() {
  const view = renderOccurrenceWorkbench(
    loadSurfaceScheduledLifecycleCheckpoint(),
    'Surface',
    'P',
    occurrenceById(combat03),
  );
  openRoomTab('Room Timeline');
  return view;
}

function spawnedItems(): HTMLButtonElement[] {
  return within(screen.getByRole('listitem', { name: 'Spawned' })).getAllByRole('button');
}

function roomActions(view: ReturnType<typeof render>) {
  const node = workspaceBiome(view.application, 'Surface', 'P').nodes.find(
    (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === combat03,
  );
  return node!.room.roomActions!;
}

describe('spawn notice items', () => {
  it('focuses the Timeline row of a placed item', async () => {
    const view = render();
    const reward = roomActions(view).rows.find(
      (row) => row.reference.kind === 'interactIncomingReward' && !row.stale,
    )!;
    await view.user.click(spawnedItems()[0]!);
    expect(document.activeElement?.getAttribute('data-room-action-key')).toBe(reward.key);
  });

  it('places an unplaced optional item in one edit', async () => {
    const view = render();
    const unplaced = () =>
      roomActions(view).rows.filter(
        (row) => row.rank === null && row.sourceFamily?.kind === 'trait' && !row.stale,
      );
    expect(unplaced()).toHaveLength(1);
    const drop = spawnedItems().at(-1)!;
    expect(drop.hasAttribute('data-spawn-placed')).toBe(false);
    await view.user.click(drop);
    await waitFor(() => expect(unplaced()).toHaveLength(0));
    expect(spawnedItems().at(-1)!.hasAttribute('data-spawn-placed')).toBe(true);
    expect(
      drop.closest('[data-spawned-loot]')?.querySelector('[aria-live="polite"]')?.textContent,
    ).toMatch(/added to the timeline\.$/);
  });

  it('opens a placed Pom Slice’s Pom choice at once', async () => {
    const view = render();
    expect(
      within(screen.getByRole('listitem', { name: 'Spawned' })).getByRole('group', {
        name: 'Supply Chain',
      }),
    ).toBeTruthy();
    await view.user.click(spawnedItems().at(-1)!);
    await waitFor(() =>
      expect(view.application.store.getState().editorSession.levelResolutionDialogTarget).toEqual(
        expect.objectContaining({ kind: 'levelResolution' }),
      ),
    );
  });

  it('leaves spawned pickups out of the Optional actions', () => {
    render();
    const optional = screen.getByRole('region', { name: 'Optional actions' });
    expect(within(optional).queryByRole('button', { name: /Supply Chain/ })).toBeNull();
    expect(within(optional).getByText('Nothing optional to add here')).toBeTruthy();
  });
});
