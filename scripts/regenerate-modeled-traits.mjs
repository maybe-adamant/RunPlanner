import { spawn } from 'node:child_process';
import process from 'node:process';

/** Rewrites the game module's modelled-traits file through its drift test. */
const child = spawn(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'packages/planner-engine/test/execution-plan/modeled-traits.test.ts',
  ],
  {
    env: { ...process.env, RUN_PLANNER_WRITE_MODELED_TRAITS: '1' },
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
