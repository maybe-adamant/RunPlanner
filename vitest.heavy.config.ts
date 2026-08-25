import { availableParallelism } from 'node:os';
import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';
import { heavyTestFiles } from './vitest.test-lanes';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [...heavyTestFiles],
      // These integration-heavy fixture consumers clip their own bounded test
      // timeouts under four-way CPU contention. Two workers keep the lane
      // parallel without turning host scheduling into a test verdict.
      maxWorkers: Math.min(2, availableParallelism()),
    },
  }),
);
