// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceId,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNEntryFrontierProject,
  loadSurfaceNProject,
  nBiome,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  invalidTenDoorHubProject,
  nHubOccurrence,
  nHubState,
} from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench } from '@planner-test/support/biome-workbench';

describe('HubMembershipBoard', () => {
  it('keeps keyboard membership selection in its source batch after the Hub is authored', async () => {
    let project = loadSurfaceNEntryFrontierProject();
    project = applyProjectCommand(project, catalog, {
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.preHub,
      }),
      hub: createHubDecisionAddress(nBiome, 'hub'),
      kind: 'ReplaceWithHubDecision',
    });
    const view = renderHubDecisionWorkbench(project);
    await waitFor(() => expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(26));
    const firstClosed = screen.getByLabelText('Combat 01 open');
    act(() => firstClosed.focus());
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat01',
        ),
      ).toBe(true),
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Combat 01 open'));
  });

  it('scopes a provisional opening identity to activation, cancellation, and projection replacement', async () => {
    const project = loadSurfaceNProject();
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const allocatedThrough = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        createOccurrenceId(`hub-opening-attempt-${index + 1}`),
      );
    const application = createApplication({
      allocateOccurrenceId: () => {
        const occurrenceId = createOccurrenceId(`hub-opening-attempt-${allocated.length + 1}`);
        allocated.push(occurrenceId);
        return occurrenceId;
      },
    });
    renderHubDecisionWorkbench(project, 'Surface', 'N', application);
    const opening = screen.getByRole('checkbox', { name: 'Combat 04 open' });

    expect(allocated).toEqual([]);
    act(() => opening.focus());
    expect(allocated).toEqual([]);
    fireEvent.pointerDown(opening);
    expect(allocated).toEqual(allocatedThrough(3));
    expect(opening.closest('label')?.dataset.openingAttempt).toBe('active');
    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceFearVowRank',
          route: createRouteAddress('Surface'),
          vowKey: 'EnemyDamageShrineUpgrade',
          rank: 1,
        }),
      ),
    );
    await waitFor(() => expect(opening.closest('label')?.dataset.openingAttempt).toBeUndefined());
    fireEvent.pointerDown(opening);
    expect(allocated).toEqual(allocatedThrough(6));
    fireEvent.blur(opening);
    expect(opening.closest('label')?.dataset.openingAttempt).toBeUndefined();

    fireEvent.pointerDown(opening);
    expect(allocated).toEqual(allocatedThrough(9));
    const historyBeforeOpen = application.store.getState().projectWorkspace.history!.past.length;
    fireEvent.click(opening);
    await waitFor(() =>
      expect(nHubOccurrence(application, 'combat04').occurrenceId).toBe(
        createOccurrenceId('hub-opening-attempt-7'),
      ),
    );
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBeforeOpen + 1,
    );
    expect(application.store.getState().editorSession.focusedSemanticOwner).toBeNull();

    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    const restored = await screen.findByRole('checkbox', { name: 'Combat 04 open' });
    expect((restored as HTMLInputElement).checked).toBe(false);
    fireEvent.pointerDown(restored);
    expect(allocated).toEqual(allocatedThrough(12));
    fireEvent.blur(restored);
  });

  it('keeps keyboard opening in the closed-room batch at the maximum', async () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const opening = screen.getByRole('checkbox', { name: 'Combat 04 open' });
    act(() => opening.focus());
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(document.activeElement).toBe(
      within(openedCard).getByRole('checkbox', { name: 'Combat 04 open' }),
    );
  });

  it('loads a ten-door invalid board picker without offering a singleton already on a peer', async () => {
    const view = renderHubDecisionWorkbench(invalidTenDoorHubProject);
    const editedCard = screen.getByRole('article', { name: 'Combat 09 Hub room' });

    await view.user.click(within(editedCard).getByLabelText('Reward'));

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: /Big Max Health/ })).toBeNull();
  });
});
