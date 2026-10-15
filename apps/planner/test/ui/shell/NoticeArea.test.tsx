// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGameStatusController } from '@planner/persistence/gameModuleHost';
import { createReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import type { CommunityEventController, EventNotice } from '@planner/workspace/communityEvents';
import { NoticeArea } from '@planner/ui/shell/NoticeArea';
import { communityEvent } from '@planner-test/fixtures/communityEventHost';
import {
  createFakeGameModuleHost,
  eventSlot,
  gameModuleStatus,
} from '@planner-test/fixtures/gameModuleHost';
import type { GameActiveSlot } from '@planner/persistence/gameModuleHost';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function eventController(initial: EventNotice) {
  let notice = initial;
  const listeners = new Set<() => void>();
  const controller = {
    sync: vi.fn(() => Promise.resolve()),
    dismiss: vi.fn(() => {
      notice = { kind: 'none' };
      for (const listener of listeners) listener();
    }),
    openProject: vi.fn<CommunityEventController['openProject']>(() =>
      Promise.resolve({ operation: 'openCopy', status: 'success', message: 'Opened.' }),
    ),
    playEvent: vi.fn<CommunityEventController['playEvent']>(() => Promise.resolve(null)),
    dispose: vi.fn(),
    getSnapshot: () => notice,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    development: undefined,
  } satisfies CommunityEventController;
  return controller;
}

const event = communityEvent();

describe('Notice area', () => {
  it('shows an available app update before the event notice', async () => {
    const releaseUpdates = createReleaseUpdateController({
      buildIdentity: { build: 'abc123def456', commit: 'a'.repeat(40), version: '1.0.0' },
      host: {
        checkForUpdate: () => Promise.resolve({ version: '1.2.3' }),
        installUpdate: () => new Promise(() => undefined),
      },
      saveBeforeInstall: () => Promise.resolve({ status: 'success', message: 'Saved.' }),
      skipPreference: { read: () => undefined, write: vi.fn() },
    })!;
    const user = userEvent.setup();
    render(
      <NoticeArea
        communityEvents={eventController({ kind: 'active', event, problem: null })}
        installLabel="Install and restart"
        releaseUpdates={releaseUpdates}
      />,
    );
    expect(screen.getByText('Event: Week 42: Staff sprint')).toBeTruthy();
    releaseUpdates.checkAutomatically();
    expect(await screen.findByText('Run Planner 1.2.3 is available.')).toBeTruthy();
    expect(screen.queryByText(/^Event:/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.getByText(/^Event: Week 42: Staff sprint/)).toBeTruthy();
  });

  it('shows details, opens the project, copies its link and dismisses', async () => {
    const controller = eventController({ kind: 'active', event, problem: null });
    const user = userEvent.setup();
    render(
      <NoticeArea
        communityEvents={controller}
        installLabel="Install and restart"
        releaseUpdates={undefined}
      />,
    );
    const notice = screen.getByRole('complementary', { name: 'Community event' });
    expect(within(notice).getByText('ends', { exact: false }).querySelector('time')?.dateTime).toBe(
      '2026-10-19T00:00:00Z',
    );
    expect(within(notice).queryByText('Clear the Surface.')).toBeNull();
    await user.click(within(notice).getByRole('button', { name: 'Details' }));
    expect(within(notice).getByText('Clear the Surface.')).toBeTruthy();
    expect(within(notice).getByText('Fear 8.')).toBeTruthy();

    await user.click(within(notice).getByRole('button', { name: 'Open project' }));
    expect(controller.openProject).toHaveBeenCalledTimes(1);
    controller.openProject.mockResolvedValueOnce({
      operation: 'openCopy',
      status: 'failure',
      message: 'offline',
    });
    await user.click(within(notice).getByRole('button', { name: 'Open project' }));
    expect(await within(notice).findByText('Couldn’t open the project: offline')).toBeTruthy();

    await user.click(within(notice).getByRole('button', { name: 'Copy link' }));
    // user-event provides the clipboard.
    expect(await globalThis.navigator.clipboard.readText()).toBe(event.projectUrl);

    await user.click(within(notice).getByRole('button', { name: 'Dismiss' }));
    expect(controller.dismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('complementary', { name: 'Community event' })).toBeNull();
  });

  it('says when the event ended and slot 1 took over', async () => {
    const controller = eventController({
      kind: 'ended',
      title: 'Week 42: Staff sprint',
      fallbackSlotHasPlan: true,
    });
    const user = userEvent.setup();
    render(
      <NoticeArea
        communityEvents={controller}
        installLabel="Install and restart"
        releaseUpdates={undefined}
      />,
    );
    const notice = screen.getByRole('status', { name: 'Community event' });
    const title = within(notice).getByText('Event ended: Week 42: Staff sprint.');
    // The ended notice shares the active notice's truncated headline and actions row.
    expect(title.className).toBe('event-notice-title');
    expect(title.getAttribute('data-hint')).toBeNull();
    expect(notice.querySelector('.event-notice-body')?.contains(title)).toBe(true);
    expect(
      within(notice).getByText(
        'The next run uses Slot 1 — choose another slot in the Game panel or in game.',
      ),
    ).toBeTruthy();
    expect(
      notice
        .querySelector('.release-update-actions')
        ?.contains(within(notice).getByRole('button', { name: 'Dismiss' })),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Event ended/)).toBeNull();
  });

  it('says the next run has no plan when slot 1 is empty', () => {
    render(
      <NoticeArea
        communityEvents={eventController({
          kind: 'ended',
          title: null,
          fallbackSlotHasPlan: false,
        })}
        installLabel="Install and restart"
        releaseUpdates={undefined}
      />,
    );
    expect(screen.getByText('The event ended.')).toBeTruthy();
    expect(screen.getByText('The next run has no plan until you choose a slot.')).toBeTruthy();
  });

  it('says why the event cannot be played and offers no Set as active', () => {
    render(
      <NoticeArea
        communityEvents={eventController({
          kind: 'active',
          event,
          problem: 'Update the planner to play this event.',
        })}
        installLabel="Install and restart"
        releaseUpdates={undefined}
      />,
    );
    const notice = screen.getByRole('complementary', { name: 'Community event' });
    expect(within(notice).getByText('Update the planner to play this event.')).toBeTruthy();
    expect(within(notice).queryByRole('button', { name: 'Set as active' })).toBeNull();
    expect(within(notice).getByRole('button', { name: 'Open project' })).toBeTruthy();
  });

  it('asks before an event project replaces unsaved work', async () => {
    const controller = eventController({ kind: 'active', event, problem: null });
    const user = userEvent.setup();
    render(
      <NoticeArea
        communityEvents={controller}
        confirmOpenProject
        installLabel="Install and restart"
        releaseUpdates={undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open project' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace the open project?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(controller.openProject).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Open project' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Replace the open project?' })).getByRole(
        'button',
        { name: 'Open project' },
      ),
    );
    expect(controller.openProject).toHaveBeenCalledTimes(1);
  });

  it('copies the link in place, without inserting a row, then restores the label', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    render(
      <NoticeArea
        communityEvents={eventController({
          kind: 'active',
          event: { ...event, title: 'x'.repeat(80) },
          problem: null,
        })}
        installLabel="Install and restart"
        releaseUpdates={undefined}
      />,
    );
    const notice = screen.getByRole('complementary', { name: 'Community event' });
    // A long title is truncated in place without a hover; Details opens with the whole title.
    const title = within(notice).getByText(`Event: ${'x'.repeat(80)}`);
    expect(title.className).toBe('event-notice-title');
    expect(title.getAttribute('data-hint')).toBeNull();
    await user.click(within(notice).getByRole('button', { name: 'Details' }));
    expect(notice.querySelector('.event-notice-details')?.firstElementChild?.textContent).toBe(
      'x'.repeat(80),
    );
    await user.click(within(notice).getByRole('button', { name: 'Details' }));
    const body = notice.querySelector('.event-notice-body')!;
    const rows = body.childElementCount;
    await user.click(within(notice).getByRole('button', { name: 'Copy link' }));
    const copied = await within(notice).findByRole('button', { name: 'Copied' });
    expect(body.childElementCount).toBe(rows);
    expect(within(notice).queryByRole('status')).toBeNull();
    act(() => vi.advanceTimersByTime(2_000));
    expect(copied.textContent).toContain('Copy link');
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Copy link' })).toBe(copied),
    );

    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });
    await user.click(copied);
    expect(await within(notice).findByRole('button', { name: 'Copy failed' })).toBe(copied);
    expect(body.childElementCount).toBe(rows);
  });

  it('sets the event as active through the controller and then says it is active', async () => {
    const game = createFakeGameModuleHost();
    const gameStatus = createGameStatusController(game.host);
    const controller = eventController({ kind: 'active', event, problem: null });
    const user = userEvent.setup();
    const eventHeld = (activeSlot: GameActiveSlot) =>
      gameModuleStatus({
        inspection: { eventSlot: eventSlot({ state: 'present', routeKey: 'Surface' }), activeSlot },
      });
    gameStatus.publish(eventHeld({ state: 'present', slot: 3 }));
    controller.playEvent.mockImplementation(() => {
      gameStatus.publish(eventHeld({ state: 'present', slot: 0 }));
      return Promise.resolve(null);
    });
    render(
      <NoticeArea
        communityEvents={controller}
        gameStatus={gameStatus}
        installLabel="Install and restart"
        releaseUpdates={undefined}
      />,
    );
    const notice = screen.getByRole('complementary', { name: 'Community event' });
    const play = within(notice).getByRole('button', { name: 'Set as active' });
    await user.click(play);
    expect(controller.playEvent).toHaveBeenCalledTimes(1);
    // The same control turns into the state, so focus stays on it.
    expect(await within(notice).findByRole('button', { name: 'Active' })).toBe(play);
    expect(document.activeElement).toBe(play);
    expect(play.getAttribute('aria-disabled')).toBe('true');
    expect(play.getAttribute('aria-live')).toBe('polite');
    await user.click(play);
    expect(controller.playEvent).toHaveBeenCalledTimes(1);

    // A file naming the event slot without a plan there does not say it is active.
    act(() =>
      gameStatus.publish(
        gameModuleStatus({ inspection: { activeSlot: { state: 'present', slot: 0 } } }),
      ),
    );
    expect(within(notice).getByRole('button', { name: 'Set as active' })).toBe(play);

    // A failed write is reported in place, and the file as read still decides the state.
    act(() =>
      gameStatus.publish(gameModuleStatus({ inspection: { activeSlot: { state: 'missing' } } })),
    );
    controller.playEvent.mockResolvedValueOnce('Slot 0 is locked.');
    await user.click(within(notice).getByRole('button', { name: 'Set as active' }));
    expect(await within(notice).findByRole('alert')).toHaveProperty(
      'textContent',
      'Not made active: Slot 0 is locked.',
    );
  });
});
