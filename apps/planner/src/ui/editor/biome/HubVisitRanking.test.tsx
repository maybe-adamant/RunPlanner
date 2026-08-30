// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    expect(within(firstVisit).getByText('Entered')).toBeTruthy();
    expect(within(firstRemaining).queryByText('Not in visit order')).toBeNull();

    for (const card of document.querySelectorAll<HTMLElement>('.hub-open-room-card')) {
      const handle = card.querySelector<HTMLElement>('[data-hub-roster-drag-handle]');
      expect(card.querySelector('.hub-roster-primary')).not.toBeNull();
      expect(card.querySelector('.hub-roster-primary + .hub-main-reward')).not.toBeNull();
      expect(handle?.getAttribute('aria-hidden')).toBe('true');
      expect(handle?.hasAttribute('tabindex')).toBe(false);
      expect(card.querySelector('.hub-main-reward')).not.toBeNull();
      expect(card.textContent).not.toContain('Evaluated');
    }
  });

  it('publishes the same timeline roster regions for every room card', () => {
    renderStaticHubDecisionWorkbench(representativeHubProject);
    selectHubTab('Hub Timeline');

    const expectedRegions = [
      'drag-handle',
      'rank',
      'identity',
      'visit-meta',
      'room-details',
      'reorder-controls',
    ];
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.hub-open-room-card'));
    expect(cards.length).toBeGreaterThan(1);

    for (const card of cards) {
      expect(
        Array.from(card.querySelector('.hub-roster-primary')?.children ?? [])
          .map((child) => child.getAttribute('data-hub-roster-region'))
          .filter((region): region is string => region !== null),
      ).toEqual(expectedRegions);
      expect(card.querySelector('[data-hub-roster-region="room-details"]')).not.toBeNull();
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
      const marker = card.querySelector<HTMLElement>(
        `[data-semantic-owner='${semanticAddressKey(
          createHubVisitAddress(nBiome, 'hub', index + 1),
        )}']`,
      );
      expect(marker).not.toBeNull();
      expect(marker?.closest('.hub-open-room-card')).toBe(card);
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
      name: 'Add Combat 01 to visited rooms',
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
          name: 'Add Combat 01 to visited rooms',
        }),
      ),
    );
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
      name: 'Move Combat 01 later',
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

  it('moves a room across the cutoff with one full order and preserves focus', async () => {
    const project = loadSurfaceNCompleteHubFrontierProject();
    const view = renderHubDecisionWorkbench(project);
    selectHubTab('Hub Timeline');
    const dispatch = vi.spyOn(view.application.store, 'dispatch');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const moved = screen.getByRole('button', { name: 'Move Combat 01 into visit 6' });

    await view.user.click(moved);

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
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat01'],
        kind: 'ReplaceHubVisitOrder',
      }),
    );
    const movedCard = screen.getByRole('article', { name: 'Combat 01 Hub room' });
    expect(movedCard.dataset.visitPosition).toBe('6');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        movedCard.querySelector('[data-hub-rank-action="moveEarlier"]'),
      ),
    );
  });

  it('publishes a complete Hub order when a remaining room drops into the full prefix', async () => {
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

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat01',
        'combat05',
        'miniBoss01',
        'combat02',
        'combat11',
        'combat23',
      ]),
    );
    expect(hubCard('combat01').dataset.visitPosition).toBe('1');
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      dispatch.mock.calls.map(([action]) => action).filter(authoredProjectCommandDispatched.match),
    ).toContainEqual(
      authoredProjectCommandDispatched({
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: ['combat01', 'combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23'],
        kind: 'ReplaceHubVisitOrder',
      }),
    );
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

    await waitFor(() =>
      expect(nHubState(view.application).decision.visitOrder).toEqual([
        'combat01',
        'combat05',
        'miniBoss01',
        'combat02',
        'combat11',
        'combat23',
      ]),
    );
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
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
    expect(invalidRewardMarker?.dataset.hasFindings).toBe('true');
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

  it('uses the rank for authored selection and reserves Entered for evaluated entry', () => {
    const entered = renderStaticHubDecisionWorkbench(loadSurfaceNOPQProject());
    const enteredCard = within(entered.container).getByRole('article', {
      name: 'Combat 05 Hub room',
    });
    expect(enteredCard.dataset.visitPosition).toBe('1');
    expect(within(enteredCard).queryByText('Visit 1')).toBeNull();
    expect(within(enteredCard).getByText('Entered')).toBeTruthy();
    cleanup();

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
    const retainedCard = screen.getByRole('article', { name: 'Combat 02 Hub room' });
    expect(retainedCard.dataset.visitPosition).toBe('3');
    expect(within(retainedCard).queryByText('Visit 3')).toBeNull();
    expect(within(retainedCard).queryByText('Entered')).toBeNull();
    expect(
      within(retainedCard).getByRole('button', {
        name: 'Open details for Combat 02',
      }),
    ).toBeTruthy();
  });
});
