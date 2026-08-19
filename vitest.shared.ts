import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export const sharedVitestConfig = defineConfig({
  resolve: {
    alias: {
      '@planner': fileURLToPath(new URL('./apps/planner/src', import.meta.url)),
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
    setupFiles: ['./apps/planner/test/setup.ts'],
  },
});
