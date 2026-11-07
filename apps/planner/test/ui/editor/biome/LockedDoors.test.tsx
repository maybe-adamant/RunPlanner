// @vitest-environment jsdom

import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(() => cleanup());

// G_Combat01: its second door can lock.
const hostId = createOccurrenceId('golden-g-b1-e1');

function hostRoom(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.history.present.route.biomes
    .find((biome) => biome.biomeKey === 'G')!
    .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === hostId)!;
}

function openHost(application: PlannerApplication) {
  act(() => {
    application.store.dispatch(semanticOwnerFocused(createOccurrenceAddress(goldenGBiome, hostId)));
  });
}

describe('locked doors', () => {
  it('locks a door on the Overview, presses it from the Doors object and leaves through it', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'G');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    expect(screen.queryByRole('checkbox', { name: 'Door 2 locked' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lock Doors' }));
    // The gate only shows the doors; Door 1 never locks.
    expect(hostRoom(application).lockedExits).toBeUndefined();
    expect(screen.queryByRole('checkbox', { name: 'Door 1 locked' })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Door 2 locked' }));
    expect(hostRoom(application).lockedExits).toEqual(['exit2']);

    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    const summary = () => screen.getByRole('list', { name: 'Door summary' });
    expect(within(summary()).getByRole('listitem', { name: /^Door 2 .* Locked$/ })).toBeTruthy();
    // A door still locked is not offered for leaving.
    const exitDoors = () => screen.getByRole('group', { name: 'Exit door' });
    expect(within(exitDoors()).queryByRole('button', { name: /Door 2/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Doors' }));
    await user.click(await screen.findByRole('option', { name: 'Unlock Door 2' }));
    expect(hostRoom(application).roomActions.order.at(-1)).toEqual({
      kind: 'unlockExit',
      exitKey: 'exit2',
    });
    expect(screen.getByRole('button', { name: /Customize locked door fight/ })).toBeTruthy();

    expect(within(exitDoors()).getByRole('button', { name: /Door 2/ })).toBeTruthy();
  });

  it('unlocks every door as one edit when the gate is unticked', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'G');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));
    await user.click(screen.getByRole('button', { name: 'Lock Doors' }));
    await user.click(screen.getByRole('checkbox', { name: 'Door 2 locked' }));
    const gate = screen.getByRole('button', { name: 'Lock Doors' });
    expect(gate.getAttribute('aria-pressed')).toBe('true');

    await user.click(gate);
    expect(hostRoom(application).lockedExits).toBeUndefined();
    expect(screen.queryByRole('checkbox', { name: 'Door 2 locked' })).toBeNull();
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(hostRoom(application).lockedExits).toEqual(['exit2']);
    expect(
      (screen.getByRole('checkbox', { name: 'Door 2 locked' }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('opens the door editor when the room is left through a door still locked', async () => {
    const { application, user } = renderWorkspace(createGoldenFGHIProject(), 'Underworld', 'G');
    openHost(application);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    const disclosure = () => screen.getByRole('button', { name: 'Door details' });
    if (disclosure().getAttribute('aria-expanded') === 'true') await user.click(disclosure());
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');

    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceLockedExit',
          occurrence: createOccurrenceAddress(goldenGBiome, hostId),
          exitKey: 'exit2',
          locked: true,
        }),
      );
    });
    // A lock alone needs nothing of the doors.
    expect(disclosure().getAttribute('aria-expanded')).toBe('false');
    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'SetExitSelection',
          selection: createExitSelectionAddress(goldenGBiome, {
            kind: 'occurrence',
            occurrenceId: hostId,
          }),
          value: { kind: 'normal', exitKey: 'exit2' },
        }),
      );
    });
    expect(disclosure().getAttribute('aria-expanded')).toBe('true');
  });
});
