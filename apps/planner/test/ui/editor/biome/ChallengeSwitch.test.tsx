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

/** Adds the switch from its toggle, then sets its type when the first one is not wanted. */
async function addSwitch(user: ReturnType<typeof renderWorkspace>['user'], kind: string) {
  await user.click(screen.getByRole('button', { name: 'Challenge Switch' }));
  const type = screen.getByRole('button', { name: 'Challenge Switch type' });
  if (type.textContent?.includes(kind) === true) return;
  await user.click(type);
  await user.click(screen.getByRole('option', { name: kind }));
}

describe('challenge switch rows on the room Overview', () => {
  it('adds a switch, changes its type, stands it on an anchor and removes it again', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    // The toggle adds the first type the room can roll, which the game places.
    await user.click(screen.getByRole('button', { name: 'Challenge Switch' }));
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');
    expect(hostRoom(application).challengeSwitch?.anchorId).toBeUndefined();

    // Its type changes in place.
    await user.click(screen.getByRole('button', { name: 'Challenge Switch type' }));
    await user.click(screen.getByRole('option', { name: 'Unseen Sigil' }));
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe(
      'PerfectClearChallengeSwitch_Pom',
    );

    // Its anchor is picked among the free ones.
    await user.click(screen.getByRole('button', { name: 'Switch spot' }));
    await user.click(screen.getByRole('option', { name: 'A1' }));
    expect(hostRoom(application).challengeSwitch?.anchorId).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Unseen Sigil' }));
    expect(hostRoom(application).challengeSwitch).toBeUndefined();
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe(
      'PerfectClearChallengeSwitch_Pom',
    );
  });

  it('refuses a second object on a one-spot room until the first leaves', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Stygian Well' }));
    expect(room().stygianWell).toBeDefined();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Challenge Switch' }).disabled,
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Stygian Well' }));
    expect(room().stygianWell).toBeUndefined();
    await addSwitch(user, 'Infernal Trove');
    expect(room().challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');
  });

  it("adds the observed switch's use from its object entry", async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    await addSwitch(user, 'Infernal Trove');
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
    await addSwitch(user, 'Unseen Sigil');
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
