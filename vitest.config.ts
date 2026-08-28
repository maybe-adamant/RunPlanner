import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from './vitest.shared';

const performanceTestFile = 'apps/planner/test/product-loops/UnifiedBiomePerformance.test.ts';
const correctnessTestInclude = [
  'packages/*/test/**/*.test.ts',
  'apps/*/src/**/*.test.{ts,tsx}',
  'apps/*/test/**/*.test.{ts,tsx}',
];

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: correctnessTestInclude,
      exclude: [performanceTestFile],
    },
  }),
);
