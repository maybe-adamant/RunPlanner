import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserAutosaveRecoveryAdapter,
  createBrowserAutosaveScheduler,
} from './browserAutosaveRecoveryAdapter';

describe('browser autosave recovery adapter', () => {
  it('owns one browser-local recovery value', () => {
    const storage = {
      getItem: vi.fn(() => '{"recovered":true}'),
      removeItem: vi.fn(() => {}),
      setItem: vi.fn(() => {}),
    };
    const adapter = createBrowserAutosaveRecoveryAdapter({ storage: () => storage });

    expect(adapter.read()).toBe('{"recovered":true}');
    adapter.write('{"next":true}');
    adapter.clear();

    expect(storage.getItem).toHaveBeenCalledWith('run-planner.autosave-recovery');
    expect(storage.setItem).toHaveBeenCalledWith('run-planner.autosave-recovery', '{"next":true}');
    expect(storage.removeItem).toHaveBeenCalledWith('run-planner.autosave-recovery');
  });

  it('defers browser storage access to each guarded recovery operation', () => {
    const adapter = createBrowserAutosaveRecoveryAdapter({
      storage: () => {
        throw new Error('storage unavailable');
      },
    });

    expect(() => adapter.read()).toThrow('storage unavailable');
    expect(() => adapter.write('{}')).toThrow('storage unavailable');
    expect(() => adapter.clear()).toThrow('storage unavailable');
  });

  it('adapts an injected timer and exposes deterministic cancellation', () => {
    const clearTimeout = vi.fn<(handle: number) => void>(() => {});
    const setTimeout = vi.fn<(_task: () => void, _delayMs: number) => number>(() => 17);
    const scheduler = createBrowserAutosaveScheduler({ clearTimeout, setTimeout });
    const task = vi.fn();

    const cancel = scheduler.schedule(250, task);
    expect(setTimeout).toHaveBeenCalledWith(task, 250);
    cancel();
    expect(clearTimeout).toHaveBeenCalledWith(17);
  });
});
