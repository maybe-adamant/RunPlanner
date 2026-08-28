// @vitest-environment jsdom

import {
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNProject,
  loadSurfaceNStoryBoardProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import {
  hubRoomDetailProject,
  nHubOccurrence,
  nHubState,
} from '@planner-test/support/hub-workbench';
import { renderHubDecisionWorkbench, workspaceBiome } from '@planner-test/support/biome-workbench';

describe('HubRoomCards', () => {
  it('opens, edits, and closes an unvisited room through its compact card', async () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const closedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    const open = within(closedCard).getByRole('checkbox', { name: 'Combat 04 open' });
    const overviewSlotOrder = (): readonly string[] =>
      Array.from(
        screen
          .getByRole('group', { name: 'Hub room set' })
          .querySelectorAll<HTMLElement>('[data-hub-slot-key]'),
      ).flatMap((card) => (card.dataset.hubSlotKey === undefined ? [] : [card.dataset.hubSlotKey]));
    const slotOrderBefore = overviewSlotOrder();
    expect(closedCard.querySelector('[data-assessment]')).toBeNull();
    expect(within(closedCard).getByText('Open this room to edit its reward.')).toBeTruthy();

    await view.user.pointer({ keys: '[MouseLeft]', target: open });
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );

    const openedCard = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    expect(overviewSlotOrder()).toEqual(slotOrderBefore);
    expect(within(openedCard).getByLabelText('Reward')).toBeTruthy();
    expect(within(openedCard).queryByText('Open this room to edit its reward.')).toBeNull();
    expect(within(openedCard).queryByText(/Closing this slot removes/)).toBeNull();
    expect(document.activeElement).not.toBe(openedCard);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(screen.getByText('10 open · 9–10 required')).toBeTruthy();
    const beforeReward = nHubOccurrence(view.application, 'combat04').state;
    await view.user.click(within(openedCard).getByLabelText('Reward'));
    const rewardTypes = within(await screen.findByRole('listbox')).getAllByRole('option');
    const replacementType =
      rewardTypes.find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      ) ??
      rewardTypes.find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') === 'true' &&
          option.textContent?.includes('Boon') === true,
      );
    if (replacementType === undefined) {
      throw new Error('Combat 04 has no editable alternative reward type');
    }
    await view.user.click(replacementType);
    if (replacementType.textContent?.includes('Boon')) {
      const boonSources = within(await screen.findByRole('listbox')).getAllByRole('option');
      const replacementSource = boonSources.find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      );
      if (replacementSource === undefined) {
        throw new Error('Combat 04 has no editable alternative Boon source');
      }
      await view.user.click(replacementSource);
    }
    await waitFor(() =>
      expect(nHubOccurrence(view.application, 'combat04').state).not.toEqual(beforeReward),
    );

    expect(
      within(openedCard).queryByRole('button', { name: 'Open details for Combat 04' }),
    ).toBeNull();

    const close = within(screen.getByRole('article', { name: 'Combat 04 Hub room' })).getByRole(
      'checkbox',
      { name: 'Combat 04 open' },
    );
    act(() => close.focus());
    const historyBeforeClose =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(false),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeClose + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Hub room set' }).contains(document.activeElement),
    ).toBe(true);
    expect(screen.getByText('9 open · 9–10 required')).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Combat 04 Hub room' })).getByText(
        'Open this room to edit its reward.',
      ),
    ).toBeTruthy();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(
        nHubState(view.application).decision.openTargets.some(
          (target) => target.hubSlotKey === 'combat04',
        ),
      ).toBe(true),
    );
  });

  it('offers direct Room details for every visited Hub room workbench', async () => {
    const project = hubRoomDetailProject();
    const view = renderHubDecisionWorkbench(project);

    const sideRoomCombat = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const miniboss = screen.getByRole('article', { name: 'Satyr Champion Hub room' });
    const ordinaryCombat = screen.getByRole('article', { name: 'Combat 07 Hub room' });
    const unvisitedCombat = screen.getByRole('article', { name: 'Combat 10 Hub room' });
    const detail = within(sideRoomCombat).getByRole('button', {
      name: 'Open details for Combat 05',
    });
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const ordinarySlot = hub.slots.find((slot) => slot.hubSlotKey === 'combat07');
    if (ordinarySlot?.room === undefined) throw new Error('Combat 07 Hub room is missing');

    expect(detail.closest('.hub-slot-meta')).not.toBeNull();
    expect(sideRoomCombat.querySelector('.hub-main-reward')?.nextElementSibling).not.toBe(detail);
    expect(unvisitedCombat.querySelector('.hub-slot-meta')).not.toBeNull();
    expect(ordinarySlot.visited).toBe(true);
    expect(ordinarySlot.room.encounterPhases).toEqual(
      expect.arrayContaining([expect.objectContaining({ customizable: true })]),
    );
    expect(ordinarySlot.room.workbench).toMatchObject({
      kind: 'standard',
      encounterPhases: expect.arrayContaining([expect.objectContaining({ customizable: true })]),
    });
    expect(
      within(miniboss).getByRole('button', { name: 'Open details for Satyr Champion' }),
    ).toBeTruthy();
    expect(
      within(ordinaryCombat).getByRole('button', { name: 'Open details for Combat 07' }),
    ).toBeTruthy();
    expect(within(unvisitedCombat).queryByRole('button', { name: /Open details/ })).toBeNull();
    await view.user.click(detail);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, nHubOccurrence(view.application, 'combat05').occurrenceId),
    );
  });

  it('keeps a visited Medea encounter trait offer out of the Hub room card', () => {
    const project = loadSurfaceNStoryBoardProject();
    renderHubDecisionWorkbench(project);
    const story = screen.getByRole('article', { name: 'Medea Hub room' });

    expect(within(story).queryByRole('button', { name: /^Edit Trait/ })).toBeNull();
    expect(within(story).getByRole('button', { name: 'Open details for Medea' })).toBeTruthy();
  });

  it('keeps exact closed-slot focus visible in the complete Overview set without authoring history', () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createHubSlotAddress(nBiome, 'hub', 'combat04')),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('article', { name: 'Combat 04 Hub room' }).dataset.open).toBe('false');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
  });

  it('keeps the board-owned reward as the exact reward focus destination', () => {
    const project = loadSurfaceNProject();
    const view = renderHubDecisionWorkbench(project);
    const combatCard = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const rewardOwner = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));

    expect(document.querySelector('.hub-visit-timeline')).toBeNull();
    expect(combatCard.dataset.focusedMainReward).toBeUndefined();

    act(() => view.application.store.dispatch(semanticOwnerFocused(rewardOwner)));

    expect(combatCard.dataset.focusedMainReward).toBe('true');
    expect(
      combatCard.querySelector('.hub-main-reward')?.getAttribute('data-hub-main-reward-owner'),
    ).toBe(semanticAddressKey(rewardOwner));
    expect(document.activeElement).toBe(within(combatCard).getByRole('button', { name: 'Reward' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
