import { describe, expect, it, vi } from 'vitest';

import { createProjectAddress } from '@run-planner/engine/authored-project';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import {
  createManualSaveScheduler,
  createMemoryProjectLibrary,
} from '@planner-test/support/memoryProjectLibrary';
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

  it('asks before a page unloads while a write failure stands', () => {
    const application = createApplication();
    const ops = application.projectOperations;
    expect(unloadNeedsConfirmation(application.store, ops)).toBe(false);
    application.store.dispatch(libraryWriteFailed({ message: 'Could not save the plan: full' }));
    expect(unloadNeedsConfirmation(application.store, ops)).toBe(true);
  });

  it('asks before a page unloads while a write is pending or under way', async () => {
    const library = createMemoryProjectLibrary();
    const saves = createManualSaveScheduler();
    const application = createApplication({
      projectLibrary: library.adapter,
      saveScheduler: saves.scheduler,
    });
    const ops = application.projectOperations;
    await ops.createNew('Underworld');
    expect(unloadNeedsConfirmation(application.store, ops)).toBe(false);
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'RenameProject',
        project: createProjectAddress(),
        name: 'Edited',
      }),
    );
    // Debounced and not yet started.
    expect(unloadNeedsConfirmation(application.store, ops)).toBe(true);
    saves.run();
    // Started and not yet finished.
    expect(unloadNeedsConfirmation(application.store, ops)).toBe(true);
    await ops.flush();
    expect(unloadNeedsConfirmation(application.store, ops)).toBe(false);
  });
});
