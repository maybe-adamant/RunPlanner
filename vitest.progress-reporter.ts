import type { Reporter, TestModule, TestSpecification } from 'vitest/node';

export class TestProgressReporter implements Reporter {
  private completed = 0;
  private total = 0;

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>): void {
    this.completed = 0;
    this.total = specifications.length;
    process.stdout.write(`[tests] 0/${this.total} files complete\n`);
  }

  onTestModuleStart(testModule: TestModule): void {
    process.stdout.write(`[tests] START ${testModule.relativeModuleId}\n`);
  }

  onTestModuleEnd(testModule: TestModule): void {
    this.completed += 1;
    const durationMs = Math.round(testModule.diagnostic().duration);
    const state = testModule.state();
    const result = state === 'passed' ? 'PASS' : state === 'failed' ? 'FAIL' : state.toUpperCase();
    process.stdout.write(
      `[tests] ${this.completed}/${this.total} ${result} ${testModule.relativeModuleId} (${durationMs}ms)\n`,
    );
  }
}
