import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import { encodeRunRecord } from '@run-planner/engine/run-record';
import { buildRunRecord } from '@planner/workspace/run-recording/runRecordBuilder';
import { extractSaveCheckpoint } from '@planner/workspace/run-recording/saveCheckpoint';
import { decodeSaveFile } from '@planner/workspace/run-recording/saveFile';

const captureDirectory = process.env.RUN_PLANNER_RUN_RECORD_CAPTURE;
const fixtureName = process.env.RUN_PLANNER_RUN_RECORD_FIXTURE;
const fixtureDirectory = fileURLToPath(
  new URL('../../../../../packages/planner-engine/test/run-record/fixtures/', import.meta.url),
);

/**
 * Writes one engine run-record fixture from a capture folder of numbered save
 * writes (`NNN-Profile1_Temp.sav`, `NNN-Profile1.sav`). Raw saves never enter
 * the repository; only `npm run fixtures:run-record` sets the inputs.
 */
describe.skipIf(captureDirectory === undefined || fixtureName === undefined)(
  'run record fixture generation',
  () => {
    it('writes the capture record through the engine codec', async () => {
      const files = readdirSync(captureDirectory!)
        .filter((name) => /^\d+-Profile1(_Temp)?\.sav$/.test(name))
        .sort();
      const saves = files.map((name) =>
        extractSaveCheckpoint(
          decodeSaveFile(new Uint8Array(readFileSync(join(captureDirectory!, name)))),
          name.endsWith('_Temp.sav'),
        ),
      );
      const start = saves.find((save) => save.kind === 'entry' && save.history.length === 0);
      if (start === undefined) throw new Error('the capture holds no run start');
      const run = saves.filter((save) => save.runCount === start.runCount);
      const checkpoints = run.filter((save) => save.kind !== 'hub');
      const end = run.find((save) => save.kind === 'hub' && save.run.heroDead);
      const record = buildRunRecord(checkpoints, end);
      const filepath = join(fixtureDirectory, `${fixtureName!}.run-record.json`);
      const options = await resolveConfig(filepath);
      writeFileSync(filepath, await format(encodeRunRecord(record), { ...options, filepath }));
      expect(record.rooms.length).toBeGreaterThan(0);
    });
  },
);
