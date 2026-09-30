// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import {
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { createFreshFileFProject, freshFileFBiome } from '@run-planner/test-fixtures/fresh-file';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import {
  levelResolutionDialogOpened,
  traitOfferDialogOpened,
} from '@planner/state/editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';

afterEach(cleanup);

const apolloToPoseidon = (biome: typeof freshFileFBiome, occurrenceId: string) =>
  authoredProjectCommandDispatched({
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId(occurrenceId)),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });

describe('a dialog whose context is lost closes and needs an explicit reopen', () => {
  it('closes the trait offer dialog and clears its target', async () => {
    const view = renderOccurrenceWorkbench(
      createFreshFileFProject(),
      'FreshFile',
      'F',
      occurrenceById(createOccurrenceId('fresh-3-0')),
    );
    const store = view.application.store;
    const target = createTraitOfferAddress(
      createIncomingRewardAddress(freshFileFBiome, createOccurrenceId('fresh-3-0')),
      'source',
    );
    act(() => store.dispatch(traitOfferDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    // Replacing the first room's boon leaves its trait offer unresolved upstream.
    act(() => store.dispatch(apolloToPoseidon(freshFileFBiome, 'fresh-0-0')));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(store.getState().editorSession.traitDialogTarget ?? null).toBeNull();
    act(() => store.dispatch(authoredProjectUndoRequested()));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => store.dispatch(traitOfferDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('closes the Pom dialog and clears its target', async () => {
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(createOccurrenceId('golden-f-b4-e1')),
    );
    const store = view.application.store;
    const target = createLevelResolutionAddress(
      createIncomingRewardAddress(goldenFBiome, createOccurrenceId('golden-f-b4-e1')),
      'self',
    );
    act(() => store.dispatch(levelResolutionDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    act(() => store.dispatch(apolloToPoseidon(goldenFBiome, String(goldenFOccurrenceId(1, 1)))));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(store.getState().editorSession.levelResolutionDialogTarget ?? null).toBeNull();
    act(() => store.dispatch(authoredProjectUndoRequested()));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => store.dispatch(levelResolutionDialogOpened(target)));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('closes the encounter customization dialog', async () => {
    const view = renderOccurrenceWorkbench(
      createFreshFileFProject(),
      'FreshFile',
      'F',
      occurrenceById(createOccurrenceId('fresh-4-0')),
    );
    const store = view.application.store;
    openRoomTab('Room Timeline');
    const trigger = () => screen.getByRole('button', { name: 'Customize encounter' });
    await view.user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeTruthy();
    act(() => store.dispatch(apolloToPoseidon(freshFileFBiome, 'fresh-0-0')));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    act(() => store.dispatch(authoredProjectUndoRequested()));
    expect(screen.queryByRole('dialog')).toBeNull();
    await view.user.click(trigger());
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
