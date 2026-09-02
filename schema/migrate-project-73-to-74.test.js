import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  migrateProjectDocument,
  OUTPUT_CATALOG_VERSION,
  outputPath,
  SOURCE_CATALOG_VERSION,
} from './migrate-project-73-to-74.js';

function sourceDocument() {
  return {
    schemaVersion: 73,
    projectId: 'migration-test',
    catalogVersion: SOURCE_CATALOG_VERSION,
    route: {
      routeKey: 'Underworld',
      biomes: [
        {
          biomeKey: 'F',
          topology: {
            occurrences: [
              {
                occurrenceId: 'combat',
                gameName: 'F_Combat01',
                roomActions: { order: [{ kind: 'useFountain' }] },
              },
              {
                occurrenceId: 'boss',
                gameName: 'F_Boss01',
                roomActions: {
                  order: [{ kind: 'interactAcquisitionEntry', entryKey: 'delivery' }],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

test('adds the Boss pickup without changing other chronology or mutating the source', () => {
  const source = sourceDocument();
  const before = structuredClone(source);
  const migrated = migrateProjectDocument(source);

  assert.deepEqual(source, before);
  assert.equal(migrated.schemaVersion, 74);
  assert.equal(migrated.catalogVersion, OUTPUT_CATALOG_VERSION);
  assert.deepEqual(migrated.route.biomes[0].topology.occurrences[0].roomActions, {
    order: [{ kind: 'useFountain' }],
  });
  assert.deepEqual(migrated.route.biomes[0].topology.occurrences[1].roomActions.order, [
    { kind: 'interactAcquisitionEntry', entryKey: 'delivery' },
    { kind: 'collectRequiredReward' },
  ]);
});

test('rejects stale inputs and malformed Boss chronology', () => {
  assert.throws(
    () => migrateProjectDocument({ ...sourceDocument(), schemaVersion: 72 }),
    /expects schema 73/,
  );
  assert.throws(
    () => migrateProjectDocument({ ...sourceDocument(), catalogVersion: 'stale' }),
    /expects catalog/,
  );
  const malformed = sourceDocument();
  delete malformed.route.biomes[0].topology.occurrences[1].roomActions;
  assert.throws(() => migrateProjectDocument(malformed), /roomActions must be an object/);
});

test('CLI writes one sibling and refuses to overwrite it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'run-planner-migration-'));
  try {
    const inputPath = join(directory, 'project.json');
    await writeFile(inputPath, JSON.stringify(sourceDocument()), 'utf8');
    const { spawnSync } = await import('node:child_process');
    const first = spawnSync(process.execPath, ['schema/migrate-project-73-to-74.js', inputPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(first.status, 0, first.stderr);
    const output = outputPath(inputPath);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).schemaVersion, 74);

    const second = spawnSync(process.execPath, ['schema/migrate-project-73-to-74.js', inputPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /refusing to overwrite existing output/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
