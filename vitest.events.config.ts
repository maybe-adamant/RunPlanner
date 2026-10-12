import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';

// `npm run events:build` only: the task that builds the community event feed.
export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['apps/planner/test/events/build-events.task.ts'],
      maxWorkers: 1,
    },
  }),
);
