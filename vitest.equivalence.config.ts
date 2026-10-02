import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';

const equivalenceTestFile = 'packages/planner-engine/test/equivalence/equivalence.test.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [equivalenceTestFile],
    },
  }),
);
