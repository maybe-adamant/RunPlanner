import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';

// `npm run catalog:build` only: the task that builds the plan catalog index.
export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['apps/planner/test/catalog-feed/build-catalog.task.ts'],
      maxWorkers: 1,
    },
  }),
);
