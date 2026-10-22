import { describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { libraryWriteFailed } from '@planner/state/librarySessionSlice';
import {
  createCloseRequestController,
  unloadNeedsConfirmation,
} from '@planner/workspace/closeRequest';

const success = { status: 'success', message: 'Saved the plan.' } as const;
const failure = { status: 'failure', message: 'Could not save the plan: disk full' } as const;

describe('close request', () => {
  it('closes silently once pending edits are written', async () => {
    const flush = vi.fn(() => Promise.resolve(success));
    const holdOpen = vi.fn(() => Promise.resolve());
    const controller = createCloseRequestController(flush);
    await expect(controller.request(holdOpen)).resolves.toBe(true);
    expect(flush).toHaveBeenCalledOnce();
    expect(holdOpen).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ kind: 'idle' });
  });

  it('asks only when the write still fails, holding the window open while it asks', async () => {
    const controller = createCloseRequestController(() => Promise.resolve(failure));
    const holdOpen = vi.fn(() => Promise.resolve());
    const keep = controller.request(holdOpen);
    await vi.waitFor(() =>
      expect(controller.getSnapshot()).toEqual({ kind: 'confirming', message: failure.message }),
    );
    expect(holdOpen).toHaveBeenCalledOnce();
    controller.answer(false);
    await expect(keep).resolves.toBe(false);
    expect(controller.getSnapshot()).toEqual({ kind: 'idle' });

    const close = controller.request(holdOpen);
    await vi.waitFor(() => expect(controller.getSnapshot().kind).toBe('confirming'));
    controller.answer(true);
    await expect(close).resolves.toBe(true);
  });

  it('asks before a page unloads only while a write failure stands', () => {
    const application = createApplication();
    expect(unloadNeedsConfirmation(application.store)).toBe(false);
    application.store.dispatch(libraryWriteFailed({ message: 'Could not save the plan: full' }));
    expect(unloadNeedsConfirmation(application.store)).toBe(true);
  });
});
