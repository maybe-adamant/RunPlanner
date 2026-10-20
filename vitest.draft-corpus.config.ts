import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';

const draftCorpusTestFiles = 'packages/planner-engine/test/draft-corpus/**/*.test.ts';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: [draftCorpusTestFiles],
      globalSetup: ['./packages/planner-engine/test/draft-corpus/summary.ts'],
    },
  }),
);
