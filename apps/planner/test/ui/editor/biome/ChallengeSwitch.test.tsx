// @vitest-environment jsdom

import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import { renderWorkspace } from '@planner-test/support/biome-workbench';
import { pickRoomObjectAction } from '@planner-test/support/occurrence-workbench';

afterEach(() => cleanup());

const hostId = createOccurrenceId('golden-f-b5-e1');
const oneSpotId = createOccurrenceId('golden-h-combat05');

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

async function pick(
  user: ReturnType<typeof renderWorkspace>['user'],
  spot: string,
  option: string | RegExp,
) {
  // Spots name what they hold; empty ones are interchangeable.
  await user.click(screen.getAllByRole('button', { name: spot })[0]!);
  await user.click(screen.getByRole('option', { name: option }));
}

describe('challenge switch rows on the room Overview', () => {
  it('observes one switch type at a time and clears it again', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    // An empty spot offers each switch type the room can roll, and stands it there.
    await pick(user, 'Empty spot', /Unseen Sigil/);
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe(
      'PerfectClearChallengeSwitch_Pom',
    );
    expect(hostRoom(application).challengeSwitch?.anchorId).toBeDefined();

    // The switch's spot changes its type in place.
    await pick(user, 'Unseen Sigil', /Infernal Trove/);
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Customize infernal trove encounter',
      }).disabled,
    ).toBe(false);

    await pick(user, 'Infernal Trove', 'Remove');
    expect(hostRoom(application).challengeSwitch).toBeUndefined();
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');
  });

  it('replaces the Well with a switch on a one-spot room as one Undo step', async () => {
    const { application, user } = renderWorkspace(
      loadUnderworldFGHICheckpoint(),
      'Underworld',
      'H',
    );
    const room = () => {
      const workspace = application.store.getState().projectWorkspace;
      if (workspace.kind !== 'openProject') throw new Error('expected an open project');
      return workspace.history.present.route.biomes
        .find((biome) => biome.biomeKey === 'H')!
        .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === oneSpotId)!;
    };
    act(() => {
      application.store.dispatch(
        semanticOwnerFocused(
          createOccurrenceAddress(createBiomeAddress('Underworld', 'H'), oneSpotId),
        ),
      );
    });
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    await pick(user, 'Empty spot', /Stygian Well/);
    expect(room().stygianWell).toBeDefined();

    await pick(user, 'Stygian Well', /Infernal Trove/);
    expect(room().stygianWell).toBeUndefined();
    expect(room().challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');

    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(room().stygianWell).toBeDefined();
    expect(room().challengeSwitch).toBeUndefined();
  });

  it("adds the observed switch's use from its object entry", async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    await pick(user, 'Empty spot', /Infernal Trove/);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    await pickRoomObjectAction(user, 'Infernal Trove', 'Use Infernal Trove');
    expect(
      hostRoom(application).roomActions.order.some(
        (reference) => reference.kind === 'interactChallengeSwitch',
      ),
    ).toBe(true);
  });

  it("picks a pressed switch's outcome with or without its Nectar on its Timeline row", async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    await pick(user, 'Empty spot', /Unseen Sigil/);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await pickRoomObjectAction(user, 'Unseen Sigil', 'Use Unseen Sigil');

    await user.click(screen.getByRole('button', { name: 'Switch outcome: succeed' }));
    await user.click(screen.getByRole('option', { name: 'succeed with Nectar' }));
    expect(hostRoom(application).challengeSwitch).toMatchObject({
      outcome: 'hitless',
      nectarDropped: true,
    });

    await user.click(screen.getByRole('button', { name: 'Switch outcome: succeed with Nectar' }));
    await user.click(screen.getByRole('option', { name: 'fail' }));
    expect(hostRoom(application).challengeSwitch).toMatchObject({
      outcome: 'failed',
      nectarDropped: false,
    });
  });
});
