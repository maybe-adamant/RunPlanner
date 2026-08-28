import { spawn } from 'node:child_process';
import process from 'node:process';

const child = spawn(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.performance.config.ts'],
  {
    env: {
      ...process.env,
      RUN_PLANNER_PERFORMANCE_ENFORCE_ABSOLUTE: '1',
    },
    stdio: 'inherit',
  },
);

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve(code ?? (signal === null ? 1 : 1)));
});

process.exitCode = exitCode;
