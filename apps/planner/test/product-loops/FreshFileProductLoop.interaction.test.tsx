// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(() => {
  cleanup();
});

describe('Fresh File product loop', () => {
  it('creates a Fresh File, shows its fixed loadout and edits onward from the empty opening', async () => {
    const { application, user } = renderPlannerForInteraction({ startWithProject: false });
    const project = () => application.store.getState().projectWorkspace.history!.present;

    await user.click(screen.getByRole('button', { name: 'Fresh File' }));
    expect(project().route).toMatchObject({
      routeKey: 'FreshFile',
      loadout: { weaponKey: null, aspectKey: null, startingKeepsakeKey: null },
    });

    await user.click(screen.getByRole('button', { name: 'Loadout' }));
    expect(screen.getByRole('heading', { name: 'Fresh File Loadout' })).toBeTruthy();
    const facts = screen.getByLabelText('Fixed starting loadout');
    expect(within(facts).getByText("Witch's Staff, no Aspect")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Arcana' })).toBeNull();
    expect(screen.queryByLabelText('Starting reward')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Erebus' }));
    expect(project().route.biomes[0]?.topology?.occurrences[0]?.gameName).toBe('F_Opening01');
    await user.click(screen.getByRole('tab', { name: 'Room Doors' }));
    await user.click(screen.getByLabelText('Reward Pool'));
    await user.click(within(screen.getByRole('listbox')).getByText('Minor Reward'));
    const decisions = () => project().route.biomes[0]!.topology!.decisions;
    expect(decisions()).toHaveLength(1);
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(1);

    await user.click(screen.getByText('Select a room'));
    await user.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]!);
    const occurrences = () => project().route.biomes[0]!.topology!.occurrences;
    expect(occurrences()).toHaveLength(2);
    expect(occurrences()[1]?.gameName).toMatch(/^F_/);

    application.store.dispatch(authoredProjectUndoRequested());
    expect(occurrences()).toHaveLength(1);
    expect(decisions()).toHaveLength(1);
    application.store.dispatch(authoredProjectUndoRequested());
    expect(decisions()).toHaveLength(0);
    application.store.dispatch(authoredProjectRedoRequested());
    application.store.dispatch(authoredProjectRedoRequested());
    expect(occurrences()).toHaveLength(2);

    expect(application.projectOperations.inspectCurrentGamePlan()).toMatchObject({
      kind: 'unavailable',
    });
  });
});
