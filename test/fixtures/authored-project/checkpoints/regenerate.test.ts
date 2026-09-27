import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { checkpointManifest } from './manifest';
import { recipeBackedCheckpoints } from './recipes';

const checkpointDirectory = resolve(process.cwd(), 'test/fixtures/authored-project/checkpoints');
const rewrite = process.env.RUN_PLANNER_WRITE_RECIPE_CHECKPOINTS === '1';

describe('recipe-backed checkpoint regeneration', () => {
  it.each(recipeBackedCheckpoints)(
    'keeps $id canonical through its command recipe',
    ({ id, create }) => {
      const entry = checkpointManifest.find((candidate) => candidate.id === id);
      if (entry === undefined) throw new Error(`missing checkpoint manifest entry for ${id}`);
      const path = resolve(checkpointDirectory, entry.file);
      const regenerated = encodeProjectDocument(create());
      if (!rewrite) {
        expect(regenerated, `${id} drifted from its command recipe`).toBe(
          readFileSync(path, 'utf8'),
        );
        return;
      }
      writeFileSync(path, regenerated);
      expect(readFileSync(path, 'utf8')).toBe(regenerated);
    },
  );
});
