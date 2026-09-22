import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * Rewrites every committed execution fixture from its owning builder through
 * the production wire encoder and Prettier. The byte-stability suite owns the
 * one code path; this only runs it in rewrite mode, so a regenerated fixture
 * can never be produced by a route the guard does not also check.
 */
const child = spawn(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'packages/planner-engine/test/execution-plan/execution-fixture-bytes.test.ts',
  ],
  {
    env: { ...process.env, RUN_PLANNER_WRITE_EXECUTION_FIXTURES: '1' },
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
