import { availableParallelism } from 'node:os';
import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';
import { heavyTestFiles } from './vitest.test-lanes';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [...heavyTestFiles],
      maxWorkers: Math.min(2, availableParallelism()),
    },
  }),
);
