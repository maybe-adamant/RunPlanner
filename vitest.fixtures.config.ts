import { mergeConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';
import { sharedVitestConfig } from './vitest.shared';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['test/fixtures/authored-project/checkpoints/check.test.ts'],
      maxWorkers: 1,
    },
  }),
);
