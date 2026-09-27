import { spawn } from 'node:child_process';
import process from 'node:process';

const child = spawn(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.fixtures.config.ts',
    'test/fixtures/authored-project/checkpoints/regenerate.test.ts',
  ],
  {
    env: { ...process.env, RUN_PLANNER_WRITE_RECIPE_CHECKPOINTS: '1' },
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
