import type { Reporter, TestModule, TestSpecification } from 'vitest/node';

export const testHeartbeatIntervalMs = 30_000;
export const slowestFileCount = 5;

type TimerHandle = unknown;

export interface TestProgressReporterOptions {
  readonly output?: (message: string) => void;
  readonly clock?: () => number;
  readonly setInterval?: (callback: () => void, delayMs: number) => TimerHandle;
  readonly clearInterval?: (handle: TimerHandle) => void;
  readonly heartbeatIntervalMs?: number;
  readonly slowestFileCount?: number;
}

interface ActiveModule {
  readonly module: TestModule;
  readonly startedAt: number;
}

export class TestProgressReporter implements Reporter {
  private readonly output: (message: string) => void;
  private readonly clock: () => number;
  private readonly setInterval: (callback: () => void, delayMs: number) => TimerHandle;
  private readonly clearInterval: (handle: TimerHandle) => void;
  private readonly heartbeatIntervalMs: number;
  private readonly slowestFileCount: number;
  private completed = 0;
  private total = 0;
  private heartbeatHandle: TimerHandle | undefined;
  private readonly activeModules = new Map<string, ActiveModule>();

  constructor(options: TestProgressReporterOptions = {}) {
    this.output = options.output ?? ((message) => process.stdout.write(message));
    this.clock = options.clock ?? (() => Date.now());
    this.setInterval =
      options.setInterval ?? ((callback, delayMs) => setInterval(callback, delayMs));
    this.clearInterval =
      options.clearInterval ?? ((handle) => clearInterval(handle as NodeJS.Timeout));
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? testHeartbeatIntervalMs;
    this.slowestFileCount = options.slowestFileCount ?? slowestFileCount;
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>): void {
    this.disposeHeartbeat();
    this.completed = 0;
    this.total = specifications.length;
    this.activeModules.clear();
    this.output(`[tests] 0/${this.total} files complete\n`);
    this.heartbeatHandle = this.setInterval(() => this.reportHeartbeat(), this.heartbeatIntervalMs);
  }

  onTestModuleStart(testModule: TestModule): void {
    this.activeModules.set(testModule.relativeModuleId, {
      module: testModule,
      startedAt: this.clock(),
    });
    this.output(`[tests] START ${testModule.relativeModuleId}\n`);
  }

  onTestModuleEnd(testModule: TestModule): void {
    this.activeModules.delete(testModule.relativeModuleId);
    this.completed += 1;
    const durationMs = Math.round(testModule.diagnostic().duration);
    const state = testModule.state();
    const result = state === 'passed' ? 'PASS' : state === 'failed' ? 'FAIL' : state.toUpperCase();
    this.output(
      `[tests] ${this.completed}/${this.total} ${result} ${testModule.relativeModuleId} (${durationMs}ms)\n`,
    );
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    this.disposeHeartbeat();
    const slowest = testModules
      .map((module) => ({ module, durationMs: Math.round(module.diagnostic().duration) }))
      .sort(
        (left, right) =>
          right.durationMs - left.durationMs ||
          left.module.relativeModuleId.localeCompare(right.module.relativeModuleId),
      )
      .slice(0, this.slowestFileCount);
    if (slowest.length > 0) {
      this.output(
        `[tests] SLOWEST ${slowest
          .map(({ module, durationMs }) => `${module.relativeModuleId} (${durationMs}ms)`)
          .join(', ')}\n`,
      );
    }
  }

  private reportHeartbeat(): void {
    for (const { module, startedAt } of this.activeModules.values()) {
      const elapsedMs = Math.max(0, Math.round(this.clock() - startedAt));
      this.output(`[tests] HEARTBEAT ${module.relativeModuleId} (${elapsedMs}ms active)\n`);
    }
  }

  private disposeHeartbeat(): void {
    if (this.heartbeatHandle === undefined) return;
    this.clearInterval(this.heartbeatHandle);
    this.heartbeatHandle = undefined;
  }
}
