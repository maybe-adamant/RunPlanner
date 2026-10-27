import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

/**
 * Rewrites one engine run-record fixture from a capture folder outside the
 * repository: `npm run fixtures:run-record -- <capture-dir> <fixture-name>`.
 */
const [captureDirectory, fixtureName] = process.argv.slice(2);
if (
  captureDirectory === undefined ||
  fixtureName === undefined ||
  !/^[a-z0-9-]+$/.test(fixtureName)
) {
  process.stderr.write('usage: regenerate-run-record-fixture.mjs <capture-dir> <fixture-name>\n');
  process.exit(2);
}
const child = spawn(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'apps/planner/test/workspace/run-recording/runRecordFixtureGeneration.test.ts',
  ],
  {
    env: {
      ...process.env,
      RUN_PLANNER_RUN_RECORD_CAPTURE: resolve(captureDirectory),
      RUN_PLANNER_RUN_RECORD_FIXTURE: fixtureName,
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
