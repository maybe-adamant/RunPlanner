import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

import { TestProgressReporter } from './vitest.progress-reporter';

export const correctnessTestTimeoutMs = 120_000;
export const correctnessHookTimeoutMs = 120_000;
export const correctnessTeardownTimeoutMs = 30_000;
export const correctnessMaxWorkers = 8;

export const sharedVitestConfig = defineConfig({
  resolve: {
    alias: [
      {
        find: '@run-planner/test-fixtures/checkpoints/manifest',
        replacement: fileURLToPath(
          new URL('./test/fixtures/authored-project/checkpoints/manifest.ts', import.meta.url),
        ),
      },
      {
        find: '@run-planner/test-fixtures/checkpoints/underworld',
        replacement: fileURLToPath(
          new URL('./test/fixtures/authored-project/checkpoints/underworld.ts', import.meta.url),
        ),
      },
      {
        find: '@run-planner/test-fixtures/checkpoints/surface',
        replacement: fileURLToPath(
          new URL('./test/fixtures/authored-project/checkpoints/surface.ts', import.meta.url),
        ),
      },
      {
        find: '@run-planner/test-fixtures/shared',
        replacement: fileURLToPath(
          new URL('./test/fixtures/authored-project/shared.ts', import.meta.url),
        ),
      },
      {
        find: '@run-planner/test-fixtures/underworld',
        replacement: fileURLToPath(
          new URL('./test/fixtures/authored-project/routes/underworld.ts', import.meta.url),
        ),
      },
      {
        find: '@run-planner/test-fixtures/surface',
        replacement: fileURLToPath(
          new URL('./test/fixtures/authored-project/routes/surface.ts', import.meta.url),
        ),
      },
      {
        find: '@run-planner/test-config/progress-reporter',
        replacement: fileURLToPath(new URL('./vitest.progress-reporter.ts', import.meta.url)),
      },
      {
        find: '@run-planner/test-fixtures',
        replacement: fileURLToPath(
          new URL('./test/fixtures/authored-project/index.ts', import.meta.url),
        ),
      },
      {
        find: '@planner',
        replacement: fileURLToPath(new URL('./apps/planner/src', import.meta.url)),
      },
      {
        find: '@planner-test',
        replacement: fileURLToPath(new URL('./apps/planner/test', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    testTimeout: correctnessTestTimeoutMs,
    hookTimeout: correctnessHookTimeoutMs,
    teardownTimeout: correctnessTeardownTimeoutMs,
    maxWorkers: correctnessMaxWorkers,
    retry: 0,
    // WSL can leave forked Vitest workers in teardown after their tests finish.
    // Threads retain the same isolation here and let the aggregate command exit reliably.
    pool: 'threads',
    reporters: ['default', new TestProgressReporter()],
    setupFiles: ['./apps/planner/test/setup.ts'],
  },
});
