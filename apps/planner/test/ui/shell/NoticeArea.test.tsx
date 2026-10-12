// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import type { CommunityEventController, EventNotice } from '@planner/workspace/communityEvents';
import { NoticeArea } from '@planner/ui/shell/NoticeArea';
import { eventPlan } from '@planner-test/fixtures/communityEventHost';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    getSnapshot: () => notice,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    development: undefined,
  } satisfies CommunityEventController;
  return controller;
}

const { event } = eventPlan('{}');

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
        communityEvents={eventController({ kind: 'active', event })}
        installLabel="Install and restart"
        releaseUpdates={releaseUpdates}
      />,
    );
    expect(screen.getByText(/^Event: Week 42: Staff sprint · ends/)).toBeTruthy();
    releaseUpdates.checkAutomatically();
    expect(await screen.findByText('Run Planner 1.2.3 is available.')).toBeTruthy();
    expect(screen.queryByText(/^Event:/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.getByText(/^Event: Week 42: Staff sprint/)).toBeTruthy();
  });

  it('shows details, opens the project, copies its link and dismisses', async () => {
    const controller = eventController({ kind: 'active', event });
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
    expect(await within(notice).findByText('Link copied.')).toBeTruthy();

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
    expect(
      screen.getByText(
        'Event ended: Week 42: Staff sprint. The next run uses Slot 1 — choose another slot in the Game panel or in game.',
      ),
    ).toBeTruthy();
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
    expect(
      screen.getByText('The event ended. The next run has no plan until you choose a slot.'),
    ).toBeTruthy();
  });

  it('asks before an event project replaces unsaved work', async () => {
    const controller = eventController({ kind: 'active', event });
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
});
