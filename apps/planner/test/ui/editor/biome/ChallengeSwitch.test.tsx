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
  it('observes one switch kind at a time and clears it again', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Elite Enemy Switch' }).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'Gold Switch' }));
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');

    // Ticking another kind replaces the observed one.
    await user.click(screen.getByRole('checkbox', { name: 'Perfect Clear Switch' }));
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe(
      'PerfectClearChallengeSwitch_Pom',
    );
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Gold Switch' }).checked).toBe(
      false,
    );
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Customize perfect clear switch encounter',
      }).disabled,
    ).toBe(false);

    await user.click(screen.getByRole('checkbox', { name: 'Perfect Clear Switch' }));
    expect(hostRoom(application).challengeSwitch).toBeUndefined();
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe(
      'PerfectClearChallengeSwitch_Pom',
    );
  });

  it("adds the observed switch's use to the Timeline in one click", async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    await user.click(screen.getByRole('checkbox', { name: 'Gold Switch' }));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    await user.click(screen.getByRole('button', { name: 'Use Gold Switch' }));
    expect(
      hostRoom(application).roomActions.order.some(
        (reference) => reference.kind === 'interactChallengeSwitch',
      ),
    ).toBe(true);
  });
});
