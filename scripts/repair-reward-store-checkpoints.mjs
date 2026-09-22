import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * Re-authors every golden checkpoint under the run-scoped reward-store
 * controller. The checkpoints are byte-attested saves, so they are repaired the
 * way a user's save is: load, apply the per-checkpoint command list in
 * `reward-store-repair.ts`, re-encode through the production wire encoder and
 * overwrite. The attestation suite owns the one code path; this only runs it in
 * rewrite mode, so a regenerated checkpoint can never be produced by a route the
 * guard does not also check.
 */
const child = spawn(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.fixtures.config.ts',
    'test/fixtures/authored-project/checkpoints/reward-store-repair.test.ts',
  ],
  {
    env: { ...process.env, RUN_PLANNER_WRITE_CHECKPOINT_REPAIRS: '1' },
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
