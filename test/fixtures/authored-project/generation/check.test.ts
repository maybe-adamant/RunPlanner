import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { checkpointManifest } from '../checkpoints/manifest';
import {
  loadSurfaceNCheckpoint,
  loadSurfaceNOCheckpoint,
  loadSurfaceNOPCheckpoint,
  loadSurfaceNOPQCheckpoint,
} from '../checkpoints/surface';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFGHCheckpoint,
  loadUnderworldFGHICheckpoint,
} from '../checkpoints/underworld';
import { nFixedOccurrenceIds, nOccurrenceIds } from '../routes/surface';
import { createCompleteFGProject } from '../routes/underworld';

const checkpointDirectory = resolve(process.cwd(), 'test/fixtures/authored-project/checkpoints');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function checkpointPath(id: string): string {
  return resolve(checkpointDirectory, `${id}.runplanner.json`);
}

function loadedCheckpoints(): readonly ProjectDocument[] {
  return [
    loadUnderworldFGCheckpoint(),
    loadUnderworldFGHCheckpoint(),
    loadUnderworldFGHICheckpoint(),
    loadSurfaceNCheckpoint(),
    loadSurfaceNOCheckpoint(),
    loadSurfaceNOPCheckpoint(),
    loadSurfaceNOPQCheckpoint(),
  ];
}

describe('authored-project checkpoint integrity', () => {
  it('decodes, canonically re-encodes, and attests every immutable checkpoint', () => {
    const first = loadedCheckpoints();
    const second = loadedCheckpoints();
    for (const [index, document] of first.entries()) {
      expect(document).toBe(second[index]);
      const entry = checkpointManifest[index];
      expect(entry).toBeDefined();
      const encoded = encodeProjectDocument(document);
      expect(sha256(encoded)).toBe(entry!.sha256);
      expect(document.schemaVersion).toBe(entry!.schemaVersion);
      expect(document.catalogVersion).toBe(entry!.catalogVersion);
      expect(document.routes.find((route) => route.routeKey === entry!.route)).toBeDefined();
      expect(Object.isFrozen(document)).toBe(true);
      expect(JSON.parse(encoded)).toEqual(
        JSON.parse(readFileSync(checkpointPath(entry!.id), 'utf8')),
      );
      expect(decodeProjectDocument(JSON.parse(encoded), catalog)).toBeDefined();
    }
  });

  it('keeps the fixed N occurrence alias equal to canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
    const n = loadSurfaceNCheckpoint();
    const occurrenceIds = n.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes[0]?.topology?.occurrences.map((occurrence) => occurrence.occurrenceId);
    expect(occurrenceIds).toContain('surface-n-opening');
    expect(occurrenceIds).toContain('surface-n-prehub');
  });

  it('keeps the default Underworld route helper on the canonical checkpoint identity', () => {
    expect(createCompleteFGProject()).toBe(loadUnderworldFGCheckpoint());
  });
});
