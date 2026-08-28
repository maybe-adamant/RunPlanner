import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';

const performanceTestFile = 'apps/planner/test/product-loops/UnifiedBiomePerformance.test.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [performanceTestFile],
      // Wall-clock budgets are meaningful only without competing test workers.
      maxWorkers: 1,
    },
  }),
);
