import { availableParallelism } from 'node:os';
import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';
import { heavyTestFiles } from './vitest.test-lanes';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [...heavyTestFiles],
      // Heavy fixture consumers are stable at four workers after checkpoint
      // loading; higher fan-out is not part of this lane's contract.
      maxWorkers: Math.min(4, availableParallelism()),
    },
  }),
);
