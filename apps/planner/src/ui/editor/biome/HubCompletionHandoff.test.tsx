// @vitest-environment jsdom

import { createExitDecisionAddress } from '@run-planner/engine/authored-project';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import { loadSurfaceNCompleteHubFrontierProject, nBiome } from '@run-planner/test-fixtures/surface';
import { nHubState, selectHubTab, twoVisitHubProject } from '@planner-test/support/hub-workbench';
import {
  renderHubDecisionWorkbench,
  renderStaticHubDecisionWorkbench,
} from '@planner-test/support/biome-workbench';

describe('HubCompletionHandoff', () => {
  it('keeps the fixed Hub Preboss exit visible and locked before the handoff is ready', () => {
    renderStaticHubDecisionWorkbench(twoVisitHubProject());
    selectHubTab('Hub Exit');

    const door = screen.getByRole('article', { name: 'Preboss room offer' });
    expect(door.dataset.available).toBe('false');
    expect(within(door).getByText('Locked')).toBeTruthy();
    expect(within(door).getByRole('button', { name: 'Open next room' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(door).queryByRole('button', { name: /Configure Room Offers/i })).toBeNull();
  });

  it('creates and undoes the completed-Hub handoff through its bound intent', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Exit');
    const handoff = document.querySelector<HTMLElement>('[data-hub-exit-door="true"]');
    if (handoff === null) throw new Error('completed Hub handoff control is missing');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(within(handoff).getByRole('button'));
    const owner = createExitDecisionAddress(nBiome, {
      decisionKey: 'hub',
      kind: 'hubDecision',
    });
    await waitFor(() =>
      expect(
        nHubState(view.application).topology.decisions.some(
          (decision) =>
            decision.kind === 'exit' &&
            decision.source.kind === 'hubDecision' &&
            decision.source.decisionKey === 'hub',
        ),
      ).toBe(true),
    );
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    const openedDoor = document.querySelector<HTMLElement>('[data-hub-exit-door="true"]');
    if (openedDoor === null) throw new Error('opened Hub exit door is missing');
    expect(openedDoor.dataset.hubExitState).toBe('opened');
    expect(within(openedDoor).getByText('Opened')).toBeTruthy();
    const historyAfterCreation =
      view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(within(openedDoor).getByRole('button', { name: 'Open next room' }));
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyAfterCreation,
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
  });
});
