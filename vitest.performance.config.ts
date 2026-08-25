import { defineConfig, mergeConfig } from 'vitest/config';

import { performanceTestFiles } from './vitest.test-lanes';
import { sharedVitestConfig } from './vitest.shared';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [...performanceTestFiles],
      // Wall-clock budgets are meaningful only without competing test workers.
      maxWorkers: 1,
    },
  }),
);
