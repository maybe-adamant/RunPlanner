// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createPhantomExitAddress,
  semanticAddressKey,
  type OccurrenceId,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { loadSurfaceNOPQProject, nBiome, nOccurrenceId } from '@run-planner/test-fixtures/surface';
import { renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(cleanup);

const combat05 = nOccurrenceId('combat05');

function authoredExit(application: PlannerApplication, occurrenceId: OccurrenceId) {
  return application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'N')
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.phantomExit;
}

async function openDoors(view: ReturnType<typeof renderWorkspace>, occurrenceId: OccurrenceId) {
  act(() =>
    view.application.store.dispatch(
      semanticOwnerFocused(createOccurrenceAddress(nBiome, occurrenceId)),
    ),
  );
  const details = screen.getByRole('complementary', { name: 'Details' });
  await view.user.click(within(details).getByRole('tab', { name: 'Room Doors' }));
  return within(details).getByRole('article', { name: 'Hidden return door' });
}

async function choose(view: ReturnType<typeof renderWorkspace>, picker: HTMLElement, name: RegExp) {
  await view.user.click(picker);
  await view.user.click(
    await within(await screen.findByRole('listbox')).findByRole('option', { name }),
  );
}

describe('PhantomExitDoor', () => {
  it('pins a main room’s hidden door room and reward, then returns it to Auto', async () => {
    const view = renderWorkspace(loadSurfaceNOPQProject(), 'Surface', 'N');
    let door = await openDoors(view, combat05);
    const room = within(door).getByRole('button', { name: 'Room' });
    expect(room.textContent).toContain('Auto · Preboss');
    // The settled room draws nothing, so there is no reward to choose.
    const reward = within(door).getByRole('button', { name: 'Reward' });
    expect(reward.textContent).toContain('No reward');
    expect(reward.hasAttribute('disabled') || reward.getAttribute('aria-disabled') === 'true').toBe(
      true,
    );

    await choose(view, room, /^Combat 13/);
    await waitFor(() =>
      expect(authoredExit(view.application, combat05)).toEqual({
        placeholderRoomGameName: 'N_Combat13',
        rewardType: null,
      }),
    );
    door = screen.getByRole('article', { name: 'Hidden return door' });
    await choose(view, within(door).getByRole('button', { name: 'Reward' }), /^Boon/);
    await waitFor(() =>
      expect(authoredExit(view.application, combat05)).toEqual({
        placeholderRoomGameName: 'N_Combat13',
        rewardType: 'Boon',
      }),
    );

    door = screen.getByRole('article', { name: 'Hidden return door' });
    await choose(view, within(door).getByRole('button', { name: 'Room' }), /^Auto/);
    await waitFor(() =>
      expect(authoredExit(view.application, combat05)).toEqual({
        placeholderRoomGameName: null,
        rewardType: null,
      }),
    );
  });

  it('navigates an unavailable pinned room to its picker in Room Doors', async () => {
    const combat02 = nOccurrenceId('combat02');
    const exit = createPhantomExitAddress(nBiome, combat02);
    const view = renderWorkspace(
      applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
        kind: 'ReplacePhantomExit',
        exit,
        value: { placeholderRoomGameName: 'N_MiniBoss01', rewardType: null },
      }),
      'Surface',
      'N',
    );
    const finding = view.application.store
      .getState()
      .projectWorkspace.assembly?.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'phantomExitPlaceholderUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(exit),
      );
    if (finding === undefined) throw new Error('missing hidden door finding');
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Room Doors' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const door = screen.getByRole('article', { name: 'Hidden return door' });
    const room = within(door).getByRole('button', { name: 'Room' });
    expect(room.getAttribute('data-selected-finding')).toBe('true');
    expect(document.activeElement).toBe(room);
    expect(
      within(door).getByRole('button', { name: 'Reward' }).getAttribute('data-has-findings'),
    ).toBe('false');
  });
});
