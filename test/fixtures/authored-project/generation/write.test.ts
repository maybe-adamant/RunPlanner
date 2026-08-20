import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { generatedCheckpoints } from './canonical';
import { canonicalCheckpointMatches } from './integrity';
import { checkpointDirectory, writeCanonicalCheckpoints } from './writer';

describe('authored-project checkpoint writer', () => {
  it('writes canonical checkpoints from generation-only builders', () => {
    writeCanonicalCheckpoints();
    for (const generated of generatedCheckpoints) {
      expect(
        readFileSync(join(checkpointDirectory, `${generated.id}.runplanner.json`), 'utf8'),
      ).toBe(encodeProjectDocument(generated.project));
    }
  });

  it('detects a stale fixture in a temporary write-then-check contact', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'runplanner-fixture-'));
    try {
      const generated = generatedCheckpoints[0]!;
      const stalePath = join(temporaryDirectory, `${generated.id}.runplanner.json`);
      const canonical = encodeProjectDocument(generated.project);
      writeFileSync(stalePath, `${canonical}\n`);
      expect(canonicalCheckpointMatches(generated.project, stalePath)).toBe(false);
      writeFileSync(stalePath, canonical);
      expect(canonicalCheckpointMatches(generated.project, stalePath)).toBe(true);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
