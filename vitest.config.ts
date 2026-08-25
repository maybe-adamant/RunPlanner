import { availableParallelism } from 'node:os';
import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';
import { performanceTestFiles, testInclude } from './vitest.test-lanes';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      // Simulation-heavy editor fixtures time out when Vitest fans out across every host core.
      maxWorkers: Math.min(2, availableParallelism()),
      include: [...testInclude],
      exclude: [...performanceTestFiles],
    },
  }),
);
