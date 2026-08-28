import type { TestModule, TestSpecification } from 'vitest/node';
import { describe, expect, it, vi } from 'vitest';

import {
  TestProgressReporter,
  testHeartbeatIntervalMs,
} from '@run-planner/test-config/progress-reporter';

function fakeModule(
  relativeModuleId: string,
  duration: number,
  state: 'passed' | 'failed',
): TestModule {
  return {
    relativeModuleId,
    diagnostic: () => ({ duration }),
    state: () => state,
  } as unknown as TestModule;
}

describe('TestProgressReporter', () => {
  it('reports active files at the heartbeat interval and disposes its timer after a passing run', () => {
    const output: string[] = [];
    const setInterval = vi.fn<(callback: () => void, delayMs: number) => object>(() => ({}));
    const clearInterval = vi.fn<(handle: unknown) => void>();
    let heartbeat: (() => void) | undefined;
    setInterval.mockImplementation((callback, delayMs) => {
      expect(delayMs).toBe(testHeartbeatIntervalMs);
      heartbeat = callback;
      return {};
    });
    let now = 100;
    const module = fakeModule('apps/planner/example.test.ts', 41, 'passed');
    const reporter = new TestProgressReporter({
      output: (message) => output.push(message),
      clock: () => now,
      setInterval,
      clearInterval,
    });

    reporter.onTestRunStart([{} as TestSpecification]);
    reporter.onTestModuleStart(module);
    now += testHeartbeatIntervalMs;
    heartbeat?.();
    reporter.onTestModuleEnd(module);
    reporter.onTestRunEnd([module]);

    expect(output).toContain('[tests] HEARTBEAT apps/planner/example.test.ts (30000ms active)\n');
    expect(output).toContain('[tests] 1/1 PASS apps/planner/example.test.ts (41ms)\n');
    expect(output.at(-1)).toBe('[tests] SLOWEST apps/planner/example.test.ts (41ms)\n');
    expect(clearInterval).toHaveBeenCalledTimes(1);
  });

  it('orders and limits the slowest-file summary deterministically', () => {
    const output: string[] = [];
    const reporter = new TestProgressReporter({
      output: (message) => output.push(message),
      slowestFileCount: 2,
      setInterval: () => ({ token: true }),
      clearInterval: () => undefined,
    });
    const modules = [
      fakeModule('b.test.ts', 100, 'passed'),
      fakeModule('a.test.ts', 300, 'passed'),
      fakeModule('c.test.ts', 200, 'passed'),
    ];

    reporter.onTestRunStart([]);
    reporter.onTestRunEnd(modules);

    expect(output.at(-1)).toBe('[tests] SLOWEST a.test.ts (300ms), c.test.ts (200ms)\n');
  });

  it('disposes the heartbeat timer after a failed run', () => {
    const clearInterval = vi.fn<(handle: unknown) => void>();
    const handle = {};
    const reporter = new TestProgressReporter({
      output: () => undefined,
      setInterval: () => handle,
      clearInterval,
    });
    const module = fakeModule('failed.test.ts', 5, 'failed');

    reporter.onTestRunStart([{} as TestSpecification]);
    reporter.onTestRunEnd([module]);

    expect(clearInterval).toHaveBeenCalledWith(handle);
  });
});
