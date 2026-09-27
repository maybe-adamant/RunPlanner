import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

import { decodeExecutionPlan, encodeExecutionPlan } from '../../src/execution-plan';
import {
  buildExecutionFixture,
  executionFixturePath,
  executionFixtures,
} from './support/execution-fixtures';

/**
 * Each fixture build produces decoded-plan equality, a wire round trip, and
 * byte stability from one compilation. The game module's Lua tests read these
 * fixtures in place, so formatting and key-order drift matter.
 *
 * `npm run fixtures:execution` rewrites them through the same one code path.
 */
const rewrite = process.env.RUN_PLANNER_WRITE_EXECUTION_FIXTURES === '1';

describe('committed execution fixtures', () => {
  it.each(executionFixtures.map((fixture) => [fixture.name, fixture] as const))(
    'keeps %s byte-identical to its regenerated wire form',
    async (name, fixture) => {
      const built = await buildExecutionFixture(fixture);
      const path = executionFixturePath(name);
      if (rewrite) {
        writeFileSync(path, built.bytes);
        return;
      }
      expect(readFileSync(path, 'utf8')).toBe(built.bytes);
      expect(decodeExecutionPlan(fixture.wire)).toEqual(built.plan);
      expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(built.plan)))).toEqual(built.plan);
    },
  );
});
