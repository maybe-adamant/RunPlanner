import { availableParallelism } from 'node:os';
import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';
import { heavyTestFiles, testInclude } from './vitest.test-lanes';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [...testInclude],
      exclude: [...heavyTestFiles],
      maxWorkers: Math.min(
        4,
        availableParallelism(),
        Math.max(2, Math.floor(availableParallelism() / 4)),
      ),
    },
  }),
);
