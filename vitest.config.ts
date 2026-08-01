import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@planner-test': fileURLToPath(new URL('./apps/planner/test', import.meta.url)),
      '@run-planner/test-fixtures': fileURLToPath(
        new URL('./test/fixtures/authored-project/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    // WSL can leave forked Vitest workers in teardown after their tests finish.
    // Threads retain the same isolation here and let the aggregate command exit reliably.
    pool: 'threads',
    // Simulation-heavy editor fixtures time out when Vitest fans out across every host core.
    maxWorkers: Math.min(2, availableParallelism()),
    setupFiles: ['./apps/planner/test/setup.ts'],
    include: [
      'packages/*/test/**/*.test.ts',
      'apps/*/src/**/*.test.{ts,tsx}',
      'apps/*/test/**/*.test.{ts,tsx}',
    ],
  },
});
