// @vitest-environment jsdom

import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createOccurrenceAddress, createOccurrenceId } from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import { renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(() => cleanup());

const hostId = createOccurrenceId('golden-f-b5-e1');

function hostRoom(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.history.present.route.biomes
    .find((biome) => biome.biomeKey === 'F')!
    .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === hostId)!;
}

function openHost(application: PlannerApplication) {
  act(() => {
    application.store.dispatch(semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, hostId)));
  });
}

describe('challenge switch rows on the room Overview', () => {
  it('observes one switch type at a time and clears it again', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    // Ticking the row observes the first type the room can roll.
    await user.click(screen.getByRole('checkbox', { name: 'Challenge Switch' }));
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe(
      'PerfectClearChallengeSwitch_Pom',
    );

    // Picking another type replaces the observed one.
    await user.click(screen.getByRole('button', { name: 'Switch type' }));
    await user.click(screen.getByRole('option', { name: /Infernal Trove/ }));
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Customize infernal trove encounter',
      }).disabled,
    ).toBe(false);

    await user.click(screen.getByRole('checkbox', { name: 'Challenge Switch' }));
    expect(hostRoom(application).challengeSwitch).toBeUndefined();
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');
  });

  it("adds the observed switch's use to the Timeline in one click", async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    // The type picker appears once the switch is ticked.
    expect(screen.queryByRole('button', { name: 'Switch type' })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Challenge Switch' }));
    await user.click(screen.getByRole('button', { name: /Switch type/ }));
    await user.click(screen.getByRole('option', { name: /Infernal Trove/ }));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    await user.click(screen.getByRole('button', { name: 'Use Infernal Trove' }));
    expect(
      hostRoom(application).roomActions.order.some(
        (reference) => reference.kind === 'interactChallengeSwitch',
      ),
    ).toBe(true);
  });

  it("edits a pressed switch's outcome and Nectar on its Timeline row", async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    await user.click(screen.getByRole('checkbox', { name: 'Challenge Switch' }));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await user.click(screen.getByRole('button', { name: 'Use Unseen Sigil' }));

    await user.click(screen.getByRole('checkbox', { name: 'Nectar dropped' }));
    expect(hostRoom(application).challengeSwitch?.nectarDropped).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Switch outcome: Hitless' }));
    await user.click(screen.getByRole('option', { name: 'Failed' }));
    expect(hostRoom(application).challengeSwitch).toMatchObject({
      outcome: 'failed',
      nectarDropped: false,
    });
    expect(screen.queryByRole('checkbox', { name: 'Nectar dropped' })).toBeNull();
  });
});
