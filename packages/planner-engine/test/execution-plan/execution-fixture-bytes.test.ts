import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

import {
  executionFixtureBytes,
  executionFixturePath,
  executionFixtures,
} from './support/execution-fixtures';

/**
 * `keeps the %s product byte-stable` in the compiler suite compares decoded
 * plans, so it accepts a committed fixture whose bytes no longer match what the
 * encoder emits — key order and formatting can drift invisibly. These fixtures
 * are mirrored byte-for-byte to the Plan Executor, so that drift matters.
 * This suite compares the bytes themselves.
 *
 * `npm run fixtures:execution` rewrites them through the same one code path.
 */
const rewrite = process.env.RUN_PLANNER_WRITE_EXECUTION_FIXTURES === '1';

describe('committed execution fixtures', () => {
  it.each(executionFixtures.map((fixture) => [fixture.name, fixture] as const))(
    'keeps %s byte-identical to its regenerated wire form',
    async (name, fixture) => {
      const bytes = await executionFixtureBytes(name, fixture.project());
      const path = executionFixturePath(name);
      if (rewrite) {
        writeFileSync(path, bytes);
        return;
      }
      expect(readFileSync(path, 'utf8')).toBe(bytes);
    },
  );
});
