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
  await user.click(screen.getByRole('button', { name: spot }));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('challenge switch rows on the room Overview', () => {
  it('observes one switch type at a time and clears it again', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'F');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    // An empty spot offers each switch type the room can roll.
    await pick(user, 'Spot 1', /Unseen Sigil/);
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe(
      'PerfectClearChallengeSwitch_Pom',
    );

    // The switch's spot changes its type in place.
    await pick(user, 'Spot 1', /Infernal Trove/);
    expect(hostRoom(application).challengeSwitch?.variantKey).toBe('TimeChallengeSwitch_Money');
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Customize infernal trove encounter',
      }).disabled,
    ).toBe(false);

    await pick(user, 'Spot 1', 'None');
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
    await pick(user, 'Spot', /Stygian Well/);
    expect(room().stygianWell).toBeDefined();

    await pick(user, 'Spot', /Infernal Trove/);
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
    await pick(user, 'Spot 1', /Infernal Trove/);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    await user.click(screen.getByRole('button', { name: 'Infernal Trove ▸' }));
    await user.click(await screen.findByRole('button', { name: 'Use Infernal Trove' }));
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
    await pick(user, 'Spot 1', /Unseen Sigil/);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    await user.click(screen.getByRole('button', { name: 'Unseen Sigil ▸' }));
    await user.click(await screen.findByRole('button', { name: 'Use Unseen Sigil' }));

    await user.click(screen.getByRole('button', { name: 'Nectar dropped' }));
    expect(hostRoom(application).challengeSwitch?.nectarDropped).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Switch outcome: Hitless' }));
    await user.click(screen.getByRole('option', { name: 'Failed' }));
    expect(hostRoom(application).challengeSwitch).toMatchObject({
      outcome: 'failed',
      nectarDropped: false,
    });
    expect(screen.queryByRole('button', { name: 'Nectar dropped' })).toBeNull();
  });
});
