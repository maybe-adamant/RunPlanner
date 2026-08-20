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
      // Four workers is the highest stable cold setting on the WSL host. Higher
      // fan-out produces fixture contention and default five-second test timeouts.
      maxWorkers: Math.min(4, availableParallelism()),
    },
  }),
);
