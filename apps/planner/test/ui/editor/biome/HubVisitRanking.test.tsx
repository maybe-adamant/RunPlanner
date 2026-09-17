// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import {
  hubCard,
  hubCardPointerHit,
  hubDragHandle,
  hubNextVisitPointerHit,
  hubNextVisitTarget,
  hubRoster,
  hubTailSlotKeys,
  invalidTenDoorHubProject,
  nHubState,
  representativeHubProject,
  replaceBrowserProperty,
  selectHubTab,
  setHubPointerHitTarget,
  startHubPointerDrag,
  twoVisitHubProject,
  withRetainedHubBehindMissingLink,
} from '@planner-test/support/hub-workbench';
import {
  renderHubDecisionWorkbench,
  renderStaticHubDecisionWorkbench,
  workspaceBiome,
} from '@planner-test/support/biome-workbench';

describe('HubVisitRanking', () => {
  it('renders one ranked open-room board without the superseded visit timeline', () => {
    renderStaticHubDecisionWorkbench(representativeHubProject);

    selectHubTab('Hub Timeline');

    expect(screen.getByRole('region', { name: 'Ephyra Hub' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hub visit order' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ranked Ephyra rooms' })).toBeNull();
    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(9);
    expect(document.querySelector('.hub-visit-timeline')).toBeNull();
    expect(document.querySelectorAll('.hub-visit-row')).toHaveLength(0);
    expect(screen.queryByText('Pylon visit order')).toBeNull();
    expect(screen.queryByText('Clear from here')).toBeNull();
    expect(screen.queryByRole('button', { name: /Clear visits from Visit/ })).toBeNull();
    expect(
      screen.getByRole('group', {
        name: 'Visit order controls for Combat 05; Planned visit 1 of 6',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('group', {
        name: /Visit order controls for Combat 01; Remaining room \d+ of \d+; not in visit order/,
      }),
    ).toBeTruthy();
  });

  it('renders every open room exactly once across the authored prefix and declaration tail', () => {
    renderStaticHubDecisionWorkbench(representativeHubProject);
    selectHubTab('Hub Timeline');

    const closedDisclosure = document.querySelector<HTMLDetailsElement>(
      '.hub-closed-room-disclosure',
    );
    const openCards = Array.from(document.querySelectorAll<HTMLElement>('.hub-open-room-card'));
    const prefix = document.querySelector<HTMLElement>('.hub-ranked-visit-prefix');
    const tail = document.querySelector<HTMLElement>('.hub-ranked-tail');

    expect(openCards).toHaveLength(9);
    expect(prefix?.querySelectorAll('.hub-open-room-card')).toHaveLength(6);
    expect(tail?.querySelectorAll('.hub-open-room-card')).toHaveLength(3);
    expect(new Set(openCards.map((card) => card.dataset.hubSlotKey)).size).toBe(openCards.length);
    expect(screen.getByText('Visit order ends here')).toBeTruthy();
    expect(screen.getByText('6 rooms traverse the pylons')).toBeTruthy();
    expect(document.querySelectorAll('.hub-closed-room-option')).toHaveLength(0);
    expect(closedDisclosure).toBeNull();
    expect(screen.getByText('9 open · 9–10 required')).toBeTruthy();
    expect(screen.getByText('6 of 6 planned')).toBeTruthy();
    expect(document.querySelector('.hub-slot-grid')).toBeNull();
    expect(screen.queryByText(/^Door \d/)).toBeNull();
    const firstVisit = screen.getByRole('article', { name: 'Combat 05 Hub room' });
    const firstRemaining = screen.getByRole('article', { name: 'Combat 01 Hub room' });

    expect(within(firstVisit).queryByText('Visit 1')).toBeNull();
    expect(within(firstVisit).queryByText('Entered')).toBeNull();
    expect(within(firstVisit).queryByText('Combat')).toBeNull();
    expect(within(firstRemaining).queryByText('Not in visit order')).toBeNull();

    for (const card of document.querySelectorAll<HTMLElement>('.hub-open-room-card')) {
      const handle = card.querySelector<HTMLElement>('[data-hub-roster-drag-handle]');
      expect(card.querySelector('.hub-roster-primary')).not.toBeNull();
      const preview = card.querySelector('.hub-roster-primary > .hub-timeline-reward-preview');
      expect(preview).not.toBeNull();
      expect(preview?.querySelector('strong')?.textContent).toBeTruthy();
      expect(handle?.getAttribute('aria-hidden')).toBe('true');
      expect(handle?.hasAttribute('tabindex')).toBe(false);
      expect(within(card).queryByRole('button', { name: 'Reward' })).toBeNull();
      expect(card.textContent).not.toContain('Evaluated');
    }
  });

  it('publishes the same timeline roster regions for every room card', () => {
    renderStaticHubDecisionWorkbench(representativeHubProject);
    selectHubTab('Hub Timeline');

    const expectedRegions = ['drag-handle', 'rank', 'identity', 'reward', 'reorder-controls'];
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.hub-open-room-card'));
    expect(cards.length).toBeGreaterThan(1);

    for (const card of cards) {
      expect(
        Array.from(card.querySelector('.hub-roster-primary')?.children ?? [])
          .map((child) => child.getAttribute('data-hub-roster-region'))
          .filter((region): region is string => region !== null),
      ).toEqual(expectedRegions);
    }
  });

  it('keeps unplanned visit owners in one compact next-visit target', () => {
    const project = twoVisitHubProject();
    renderStaticHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const prefix = document.querySelector<HTMLElement>('.hub-ranked-visit-prefix');
    const tail = document.querySelector<HTMLElement>('.hub-ranked-tail');

    expect(screen.getByText('2 of 6 planned')).toBeTruthy();
    expect(prefix?.querySelectorAll('.hub-open-room-card')).toHaveLength(2);
    expect(prefix?.querySelectorAll('.hub-empty-visit-position')).toHaveLength(0);
    expect(tail?.querySelectorAll('.hub-open-room-card')).toHaveLength(7);
    const nextVisitTarget = hubNextVisitTarget();
    expect(nextVisitTarget.classList).toContain('hub-next-visit-target');
    expect(nextVisitTarget.getAttribute('aria-label')).toBe(
      'Visit 3 is not planned; Visits 4–6 remain unplanned.',
    );
    expect(nextVisitTarget.textContent).toContain('Drop a room here for Visit 3');
    expect(nextVisitTarget.textContent).toContain('Visits 4–6 remain unplanned');
    expect(screen.getByRole('article', { name: 'Combat 05 Hub room' }).dataset.visitPosition).toBe(
      '1',
    );
    expect(
      screen.getByRole('article', { name: 'Satyr Champion Hub room' }).dataset.visitPosition,
    ).toBe('2');

    for (const visitPosition of [3, 4, 5, 6]) {
      const marker = nextVisitTarget.querySelector<HTMLElement>(
        `[data-semantic-owner='${semanticAddressKey(
          createHubVisitAddress(nBiome, 'hub', visitPosition),
        )}']`,
      );
      expect(marker).not.toBeNull();
      expect(marker?.closest('.hub-next-visit-target')).toBe(nextVisitTarget);
    }
  });

  it('keeps every positional visit marker in its exact ranked prefix card', () => {
    renderStaticHubDecisionWorkbench(loadSurfaceNOPQProject());
    selectHubTab('Hub Timeline');

    const prefixCards = Array.from(
      document.querySelectorAll<HTMLElement>('.hub-ranked-visit-prefix .hub-open-room-card'),
    );
    expect(prefixCards).toHaveLength(6);
    for (const [index, card] of prefixCards.entries()) {
      expect(card.getAttribute('data-semantic-owner')).toBe(
        semanticAddressKey(createHubVisitAddress(nBiome, 'hub', index + 1)),
      );
    }
  });

  it('uses the keyboard rank fallback to dispatch one full ReplaceHubVisitOrder proposal', async () => {
    const project = twoVisitHubProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const addAsVisitThree = within(hubCard('combat01')).getByRole('button', {
      name: 'Add Combat 01 as visit 3',
    });
    act(() => addAsVisitThree.focus());
    await view.user.keyboard('{Enter}');

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat01',
      ]),
    );
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', 'combat01'],
        kind: 'ReplaceHubVisitOrder',
      }),
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(['combat05', 'miniBoss01']),
    );
  });

  it('adds and removes an open room through explicit visited-room controls', async () => {
    const project = twoVisitHubProject();
    const view = renderHubDecisionWorkbench(project);
    const add = within(hubCard('combat01')).getByRole('button', {
      name: 'Add Combat 01 as visit 3',
    });

    await view.user.click(add);

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat01',
      ]),
    );
    const remove = within(hubCard('combat01')).getByRole('button', {
      name: 'Remove Combat 01 from visited rooms',
    });
    await waitFor(() => expect(document.activeElement).toBe(remove));

    await view.user.click(remove);

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(['combat05', 'miniBoss01']),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(hubCard('combat01')).getByRole('button', {
          name: 'Add Combat 01 as visit 3',
        }),
      ),
    );
  });

  it('uses the Timeline map for direct append and named full-prefix replacement', async () => {
    const partial = renderHubDecisionWorkbench(twoVisitHubProject());
    selectHubTab('Hub Timeline');
    const timelineView = screen.getByRole('group', { name: 'Hub Timeline view' });
    await partial.user.click(within(timelineView).getByRole('button', { name: 'Map' }));
    const append = screen.getByRole('button', {
      name: 'Combat 01: not visited. Edit visit order.',
    });
    await partial.user.click(append);
    await waitFor(() =>
      expect(nHubState(partial.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat01',
      ]),
    );
    expect(screen.getByRole('button', { name: 'Combat 01: Visit 3. Edit visit order.' })).toBe(
      append,
    );
    expect(screen.getByText('Visit 3')).toBeTruthy();
    partial.unmount();

    const full = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    selectHubTab('Hub Timeline');
    await full.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'Map',
      }),
    );
    await full.user.click(
      screen.getByRole('button', { name: 'Combat 01: not visited. Edit visit order.' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Choose visit to replace with Combat 01' }),
    ).toBeTruthy();
    await full.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(nHubState(full.application).decision.visitOrder).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat23',
      'combat09',
    ]);

    await full.user.click(
      screen.getByRole('button', { name: 'Combat 05: Visit 1. Edit visit order.' }),
    );
    await full.user.click(
      screen.getByRole('button', { name: 'Combat 02: Visit 3. Edit visit order.' }),
    );
    const secondMapChooser = screen.getByRole('dialog', {
      name: 'Edit Combat 02 visit order',
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(secondMapChooser).getByRole('button', { name: 'Close' }),
      ),
    );
  });

  it('moves a visited Map room to an exact position by shifting the intervening visits', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    selectHubTab('Hub Timeline');
    await view.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'Map',
      }),
    );
    await view.user.click(
      screen.getByRole('button', { name: 'Combat 11: Visit 4. Edit visit order.' }),
    );
    await view.user.click(
      within(screen.getByRole('dialog', { name: 'Edit Combat 11 visit order' })).getByRole(
        'button',
        { name: 'Move to 1' },
      ),
    );
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat11',
        'combat05',
        'miniBoss01',
        'combat02',
        'combat23',
        'combat09',
      ]),
    );
    const reorderedChooser = screen.getByRole('dialog', { name: 'Edit Combat 11 visit order' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(reorderedChooser).getByRole('button', { name: 'Close' }),
      ),
    );
    await view.user.click(within(reorderedChooser).getByRole('button', { name: 'Move to 4' }));
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat02',
        'combat11',
        'combat23',
        'combat09',
      ]),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(screen.getByRole('dialog', { name: 'Edit Combat 11 visit order' })).getByRole(
          'button',
          { name: 'Close' },
        ),
      ),
    );
  });

  it('keeps later Map sequence controls ready when the first visited room has an unresolved child', async () => {
    const incompleteFirstVisit = applyProjectCommand(
      loadSurfaceNCompleteHubFrontierProject(),
      catalog,
      {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      },
    );
    const view = renderHubDecisionWorkbench(incompleteFirstVisit);
    selectHubTab('Hub Timeline');
    expect(
      screen.getByRole('button', { name: 'Move Combat 11 earlier' }).getAttribute('disabled'),
    ).toBeNull();
    await view.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'Map',
      }),
    );
    const laterMarker = screen.getByRole('button', {
      name: 'Combat 11: Visit 4. Edit visit order.',
    });
    expect(laterMarker.getAttribute('disabled')).toBeNull();
    await view.user.click(laterMarker);
    await view.user.click(
      within(screen.getByRole('dialog', { name: 'Edit Combat 11 visit order' })).getByRole(
        'button',
        { name: 'Move to 1' },
      ),
    );
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder.slice(0, 4)).toEqual([
        'combat11',
        'combat05',
        'miniBoss01',
        'combat02',
      ]),
    );
  });

  it('resets visits in one undoable edit and rebuilds the order by clicking map rooms', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    expect(screen.queryByRole('button', { name: 'Reset visits' })).toBeNull();
    selectHubTab('Hub Exit');
    await view.user.click(screen.getByRole('button', { name: 'Open next room' }));
    await waitFor(() =>
      expect(
        nHubState(view.application).topology.decisions.some(
          (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
        ),
      ).toBe(true),
    );
    expect(screen.queryByRole('button', { name: 'Reset visits' })).toBeNull();
    const before = nHubState(view.application);
    const openRooms = before.topology.occurrences.filter((room) =>
      before.decision.openTargets.some((target) => target.occurrenceId === room.occurrenceId),
    );
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    selectHubTab('Hub Timeline');
    await view.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'Map',
      }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Reset visits' }));
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toEqual([]));
    const after = nHubState(view.application);
    expect(after.decision.openTargets).toEqual(before.decision.openTargets);
    for (const room of openRooms) {
      expect(
        after.topology.occurrences.find((item) => item.occurrenceId === room.occurrenceId),
      ).toEqual(room);
    }
    expect(
      after.topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    expect(screen.getByRole('button', { name: 'Reset visits' })).toHaveProperty('disabled', true);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual(before.decision.visitOrder),
    );
    expect(nHubState(view.application).topology).toEqual(before.topology);
    await view.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'List',
      }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Reset visits' }));
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toEqual([]));
    await view.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'Map',
      }),
    );
    for (const room of ['Combat 11', 'Combat 02', 'Combat 05', 'Combat 23']) {
      await view.user.click(
        screen.getByRole('button', { name: `${room}: not visited. Edit visit order.` }),
      );
    }
    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat11',
        'combat02',
        'combat05',
        'combat23',
      ]),
    );
  });

  it('removes a completed Map visit through engine handoff cleanup and Undo restores it', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    selectHubTab('Hub Exit');
    await view.user.click(screen.getByRole('button', { name: 'Open next room' }));
    await waitFor(() =>
      expect(
        nHubState(view.application).topology.decisions.some(
          (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
        ),
      ).toBe(true),
    );

    selectHubTab('Hub Timeline');
    await view.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'Map',
      }),
    );
    await view.user.click(
      screen.getByRole('button', { name: 'Combat 09: Visit 6. Edit visit order.' }),
    );
    await view.user.click(
      within(screen.getByRole('dialog', { name: 'Edit Combat 09 visit order' })).getByRole(
        'button',
        { name: 'Remove visit' },
      ),
    );
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toHaveLength(5));
    expect(screen.queryByRole('dialog', { name: 'Edit Combat 09 visit order' })).toBeNull();
    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(nHubState(view.application).decision.visitOrder).toHaveLength(6));
    expect(
      nHubState(view.application).topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(true);
  });

  it('clears a vanished Timeline marker selection before Undo makes its slot reappear', async () => {
    const view = renderHubDecisionWorkbench(invalidTenDoorHubProject);
    selectHubTab('Hub Timeline');
    await view.user.click(
      within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
        name: 'Map',
      }),
    );
    await view.user.click(
      screen.getByRole('button', { name: 'Combat 01: not visited. Edit visit order.' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Choose visit to replace with Combat 01' }),
    ).toBeTruthy();

    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'CloseHubSlot',
          slot: createHubSlotAddress(nBiome, 'hub', 'combat01'),
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Combat 01: not visited. Edit visit order.' }),
      ).toBeNull(),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(screen.getByRole('group', { name: 'Hub Timeline view' })).getByRole('button', {
          name: 'Map',
        }),
      ),
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Combat 01: not visited. Edit visit order.' }),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Choose visit to replace with Combat 01' }),
    ).toBeNull();
  });

  it('keeps a keyboard tail-only move out of semantic history and command dispatch', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const authoredBefore = [...nHubState(view.application).decision.visitOrder];
    const tailKeys = (): readonly string[] =>
      Array.from(document.querySelectorAll<HTMLElement>('.hub-ranked-tail [data-hub-slot-key]'))
        .map((card) => card.dataset.hubSlotKey)
        .filter((slotKey): slotKey is string => slotKey !== undefined);
    const tailBefore = tailKeys();
    if (tailBefore.length < 2 || tailBefore[0] === undefined || tailBefore[1] === undefined) {
      throw new Error('The complete Hub fixture must expose at least two tail rooms.');
    }

    const moveLater = within(hubCard('combat01')).getByRole('button', {
      name: 'Move Combat 01 later among remaining rooms',
    });
    act(() => moveLater.focus());
    await view.user.keyboard('{Enter}');
    await waitFor(() =>
      expect(tailKeys()).toEqual([tailBefore[1], tailBefore[0], ...tailBefore.slice(2)]),
    );
    expect(nHubState(view.application).decision.visitOrder).toEqual(authoredBefore);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);
  });

  it('names the full-prefix visit before replacing it', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const moved = screen.getByRole('button', { name: 'Choose a visit for Combat 01 to replace' });

    await view.user.click(moved);
    expect(
      screen.getByRole('dialog', { name: 'Choose visit to replace with Combat 01' }),
    ).toBeTruthy();
    expect(nHubState(view.application).decision.visitOrder).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat23',
      'combat09',
    ]);
    await view.user.click(screen.getByRole('button', { name: 'Visit 6: Combat 09' }));

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        'combat02',
        'combat11',
        'combat23',
        'combat01',
      ]),
    );
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    const movedCard = screen.getByRole('article', { name: 'Combat 01 Hub room' });
    expect(movedCard.dataset.visitPosition).toBe('6');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        movedCard.querySelector('[data-hub-rank-action="removeFromVisits"]'),
      ),
    );
  });

  it('keeps the newly opened List replacement chooser active when switching rooms', async () => {
    const view = renderHubDecisionWorkbench(loadSurfaceNCompleteHubFrontierProject());
    selectHubTab('Hub Timeline');

    await view.user.click(
      screen.getByRole('button', { name: 'Choose a visit for Combat 01 to replace' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Choose visit to replace with Combat 01' }),
    ).toBeTruthy();

    const secondTrigger = screen.getByRole('button', {
      name: 'Choose a visit for Combat 03 to replace',
    });
    await view.user.click(secondTrigger);

    expect(
      screen.queryByRole('dialog', { name: 'Choose visit to replace with Combat 01' }),
    ).toBeNull();
    const chooser = screen.getByRole('dialog', { name: 'Choose visit to replace with Combat 03' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(chooser).getByRole('button', { name: 'Visit 1: Combat 05' }),
      ),
    );
  });

  it('does not publish when a remaining room drops into the full prefix', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(
      'combat01',
      hubCardPointerHit('combat05', 'beforeSlot'),
    );

    await waitFor(() => expect(hubCard('combat01').dataset.dragging).toBe('true'));
    expect(document.querySelector('.hub-roster-drag-preview')).not.toBeNull();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);

    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    expect(nHubState(view.application).decision.visitOrder).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat23',
      'combat09',
    ]);
    expect(hubCard('combat01').dataset.visitPosition).toBeUndefined();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);
    expect(board.dataset.dragging).toBeUndefined();
    expect(document.querySelector('.hub-roster-drag-preview')).toBeNull();
  });

  it('keeps a tail-only roster drag out of semantic history and command dispatch', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const authoredBefore = [...nHubState(view.application).decision.visitOrder];
    const tailBefore = hubTailSlotKeys();
    const [sourceSlotKey, targetSlotKey] = tailBefore;
    if (sourceSlotKey === undefined || targetSlotKey === undefined) {
      throw new Error('The complete Hub fixture must expose two tail rooms.');
    }
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(
      sourceSlotKey,
      hubCardPointerHit(targetSlotKey, 'afterSlot'),
    );

    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(hubTailSlotKeys()).toEqual([targetSlotKey, sourceSlotKey, ...tailBefore.slice(2)]),
    );
    expect(nHubState(view.application).decision.visitOrder).toEqual(authoredBefore);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);
  });

  it('appends a tail room through the compact next-visit drop target', async () => {
    const project = twoVisitHubProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const sourceSlotKey = hubTailSlotKeys()[0];
    if (sourceSlotKey === undefined) throw new Error('partial Hub fixture has no remaining room');
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(sourceSlotKey, hubNextVisitPointerHit());

    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat05',
        'miniBoss01',
        sourceSlotKey,
      ]),
    );
    expect(hubCard(sourceSlotKey).dataset.visitPosition).toBe('3');
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', sourceSlotKey],
        kind: 'ReplaceHubVisitOrder',
      }),
    );
  });

  it('cancels a roster drag without changing the authored or transient order', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const authoredBefore = [...nHubState(view.application).decision.visitOrder];
    const tailBefore = hubTailSlotKeys();
    dispatch.mockClear();
    const { board, pointerId } = startHubPointerDrag(
      'combat09',
      hubCardPointerHit('combat11', 'afterSlot'),
    );

    await waitFor(() => expect(hubCard('combat09').dataset.dragging).toBe('true'));
    fireEvent.pointerCancel(board, { isPrimary: true, pointerId, pointerType: 'mouse' });

    await waitFor(() => {
      expect(board.dataset.dragging).toBeUndefined();
      expect(hubCard('combat09').dataset.dragging).toBeUndefined();
      expect(document.querySelector('.hub-roster-drag-preview')).toBeNull();
    });
    expect(nHubState(view.application).decision.visitOrder).toEqual(authoredBefore);
    expect(hubTailSlotKeys()).toEqual(tailBefore);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);
  });

  it('keeps the original pointer source when a non-primary pointer begins during an active drag', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    dispatch.mockClear();
    const { board, pointerId, x, y } = startHubPointerDrag(
      'combat01',
      hubCardPointerHit('combat05', 'beforeSlot'),
    );

    await waitFor(() => expect(hubCard('combat01').dataset.dragging).toBe('true'));
    fireEvent.pointerDown(hubDragHandle('combat03'), {
      button: 0,
      clientX: 16,
      clientY: 16,
      isPrimary: false,
      pointerId: 42,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(board, {
      clientX: x,
      clientY: y,
      isPrimary: false,
      pointerId: 42,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: false,
      pointerId: 42,
      pointerType: 'touch',
    });

    expect(hubCard('combat01').dataset.dragging).toBe('true');
    expect(hubCard('combat03').dataset.dragging).toBeUndefined();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toHaveLength(0);

    fireEvent.pointerUp(board, {
      clientX: x,
      clientY: y,
      isPrimary: true,
      pointerId,
      pointerType: 'mouse',
    });

    expect(nHubState(view.application).decision.visitOrder).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat23',
      'combat09',
    ]);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
  });

  it('attempts document-flow edge scrolling while a narrow-layout roster drag remains active', async () => {
    const pageScrollRoot = document.createElement('div');
    replaceBrowserProperty(document, 'scrollingElement', pageScrollRoot);
    replaceBrowserProperty(pageScrollRoot, 'scrollHeight', 1_200);
    replaceBrowserProperty(window, 'innerHeight', 400);
    const windowScrollBy = vi.fn();
    replaceBrowserProperty(window, 'scrollBy', windowScrollBy);
    let scheduledFrame: FrameRequestCallback | undefined;
    replaceBrowserProperty(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      scheduledFrame = callback;
      return 1;
    });
    replaceBrowserProperty(window, 'cancelAnimationFrame', () => undefined);

    const project = loadSurfaceNCompleteHubFrontierProject();
    renderHubDecisionWorkbench(project);
    const board = hubRoster();
    const pointerId = 53;
    setHubPointerHitTarget(hubCardPointerHit('combat05', 'beforeSlot').target);
    fireEvent.pointerDown(hubDragHandle('combat01'), {
      button: 0,
      clientX: 12,
      clientY: 350,
      isPrimary: true,
      pointerId,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: 390,
      isPrimary: true,
      pointerId,
      pointerType: 'touch',
    });

    if (scheduledFrame === undefined) {
      throw new Error('edge drag did not schedule document-flow scrolling');
    }
    act(() => scheduledFrame?.(0));
    expect(windowScrollBy).toHaveBeenCalledWith({ top: 18 });

    fireEvent.pointerCancel(board, { isPrimary: true, pointerId, pointerType: 'touch' });
  });

  it('keeps ranked cards and move controls visible at an invalid authored boundary', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat05', 'miniBoss01', 'combat02'],
      kind: 'ReplaceHubVisitOrder',
    });
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');

    expect(screen.getAllByLabelText(/Hub room$/)).toHaveLength(9);
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const invalidRewardMarker = screen
      .getByRole('article', { name: 'Combat 10 Hub room' })
      .querySelector<HTMLElement>(
        `[data-semantic-owner='${semanticAddressKey(
          createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
        )}']`,
      );
    expect(invalidRewardMarker).toBeNull();
    const destination = view.application
      .selectStructuredWorkspace(view.application.store.getState())!
      .focusByOwner.get(
        semanticAddressKey(createIncomingRewardAddress(nBiome, nOccurrenceId('combat10'))),
      )!;
    const repairTarget = screen.getByRole('region', { name: 'Ephyra Hub' });
    expect(repairTarget.getAttribute('data-semantic-owner')).toBe(
      semanticAddressKey(destination.focusAddress),
    );
    expect(repairTarget.getAttribute('data-has-findings')).toBe('true');
    expect(document.querySelectorAll('.hub-ranked-visit-prefix .hub-open-room-card')).toHaveLength(
      3,
    );
    expect(document.querySelectorAll('.hub-empty-visit-position')).toHaveLength(0);
    const nextVisitTarget = hubNextVisitTarget();
    expect(nextVisitTarget.getAttribute('aria-label')).toBe(
      'Visit 4 is not planned; Visits 5–6 remain unplanned.',
    );
    for (const visitPosition of [4, 5, 6]) {
      expect(
        nextVisitTarget.querySelector(
          `[data-semantic-owner='${semanticAddressKey(
            createHubVisitAddress(nBiome, 'hub', visitPosition),
          )}']`,
        ),
      ).not.toBeNull();
    }
    expect(document.querySelectorAll('.hub-ranked-tail .hub-open-room-card')).toHaveLength(6);
    expect(document.querySelector('.hub-visit-timeline')).toBeNull();
    const firstTail = document.querySelector<HTMLElement>('.hub-ranked-tail .hub-open-room-card');
    if (firstTail === null) throw new Error('invalid Hub fixture has no remaining room');
    expect(within(firstTail).getByRole('button', { name: /^Add .+ as visit 4$/ })).toBeTruthy();
  });

  it('keeps authored ranks and assessment visible before a room is evaluated', () => {
    const view = renderHubDecisionWorkbench(
      withRetainedHubBehindMissingLink(loadSurfaceNOPQProject()),
    );
    const hub = workspaceBiome(view.application, 'Surface', 'N').nodes.find(
      (node) => node.kind === 'hubDecision',
    );
    if (hub?.kind !== 'hubDecision') throw new Error('N Hub workspace node is missing');
    const laterVisit = hub.slots.find((slot) => slot.hubSlotKey === 'combat02');
    if (laterVisit?.room === undefined) throw new Error('Combat 02 Hub room is missing');

    expect(laterVisit.visited).toBe(true);
    expect(laterVisit.room.detailsActive).toBe(true);
    expect(laterVisit.room.entered).toBe(false);
    selectHubTab('Hub Timeline');
    const retainedCard = screen.getByRole('article', { name: 'Combat 02 Hub room' });
    expect(retainedCard.dataset.visitPosition).toBe('3');
    expect(retainedCard.querySelector('.hub-roster-rank')?.textContent).toBe('3');
    expect(retainedCard.querySelector('.hub-slot-heading [data-assessment]')).not.toBeNull();
  });
});
