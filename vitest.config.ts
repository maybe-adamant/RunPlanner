import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
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
