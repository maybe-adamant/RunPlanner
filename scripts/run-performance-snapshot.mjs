import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const requestedOutput = process.env.RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT;
const temporaryOutput = requestedOutput === undefined || requestedOutput.length === 0;
const outputPath = requestedOutput ?? join(tmpdir(), `run-planner-performance-${process.pid}.json`);

const child = spawn(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.performance.config.ts'],
  {
    env: {
      ...process.env,
      RUN_PLANNER_PERFORMANCE_SNAPSHOT: '1',
      RUN_PLANNER_PERFORMANCE_SNAPSHOT_OUTPUT: outputPath,
    },
    stdio: 'inherit',
  },
);

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    resolve(code ?? (signal === null ? 1 : 1));
  });
});

if (temporaryOutput && exitCode === 0) {
  process.stdout.write(readFileSync(outputPath, 'utf8'));
}

if (temporaryOutput) {
  rmSync(outputPath, { force: true });
}

process.exitCode = exitCode;
