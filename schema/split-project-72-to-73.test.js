import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  outputPaths,
  SOURCE_CATALOG_VERSION,
  splitProjectDocument,
} from './split-project-72-to-73.js';

function sourceDocument() {
  return {
    schemaVersion: 72,
    projectId: 'split-test',
    catalogVersion: SOURCE_CATALOG_VERSION,
    routes: [
      {
        routeKey: 'Underworld',
        loadout: { keepsake: 'UnderworldKeepsake' },
        resourcePlacements: { Pickaxe: null },
        biomes: [{ biomeKey: 'F', topology: { decisions: [] } }],
      },
      {
        routeKey: 'Surface',
        loadout: { keepsake: 'SurfaceKeepsake' },
        resourcePlacements: { Fishing: null },
        biomes: [{ biomeKey: 'N', topology: { decisions: [] } }],
      },
    ],
  };
}

test('splits both routes, preserves exact subtrees, and leaves the source immutable', () => {
  const source = sourceDocument();
  const before = structuredClone(source);
  const result = splitProjectDocument(source);

  assert.deepEqual(source, before);
  assert.deepEqual(result.documents.Underworld.route, before.routes[0]);
  assert.deepEqual(result.documents.Surface.route, before.routes[1]);
  assert.equal(result.documents.Underworld.schemaVersion, 73);
  assert.equal(result.documents.Surface.schemaVersion, 73);
  assert.equal('routes' in result.documents.Underworld, false);
  assert.equal('routes' in result.documents.Surface, false);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(result.documents.Underworld).filter(([key]) => key !== 'route'),
    ),
    {
      schemaVersion: 73,
      projectId: before.projectId,
      catalogVersion: before.catalogVersion,
    },
  );
});

test('rejects non-boundary schemas, wrong catalogs, and malformed route sets', () => {
  assert.throws(
    () => splitProjectDocument({ ...sourceDocument(), schemaVersion: 71 }),
    /expects schema 72/,
  );
  assert.throws(
    () => splitProjectDocument({ ...sourceDocument(), catalogVersion: 'stale' }),
    /expects catalog/,
  );
  assert.throws(
    () =>
      splitProjectDocument({ ...sourceDocument(), routes: sourceDocument().routes.slice(0, 1) }),
    /exactly 2 routes/,
  );
  assert.throws(
    () =>
      splitProjectDocument({
        ...sourceDocument(),
        routes: [sourceDocument().routes[0], { ...sourceDocument().routes[0] }],
      }),
    /route Underworld exactly once/,
  );
});

test('CLI writes both outputs and preflights existing siblings', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'run-planner-split-'));
  try {
    const inputPath = join(directory, 'project.json');
    await writeFile(inputPath, JSON.stringify(sourceDocument()), 'utf8');
    const paths = outputPaths(inputPath);
    const { spawnSync } = await import('node:child_process');
    const first = spawnSync(process.execPath, ['schema/split-project-72-to-73.js', inputPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /Wrote Underworld:/);
    assert.match(first.stdout, /Wrote Surface:/);
    assert.equal(JSON.parse(await readFile(paths.Underworld, 'utf8')).route.routeKey, 'Underworld');
    assert.equal(JSON.parse(await readFile(paths.Surface, 'utf8')).route.routeKey, 'Surface');

    const second = spawnSync(process.execPath, ['schema/split-project-72-to-73.js', inputPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /refusing to overwrite existing output/);

    const missing = spawnSync(
      process.execPath,
      ['schema/split-project-72-to-73.js', join(directory, 'missing.json')],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /ENOENT/);

    for (const flag of ['--output', '--in-place']) {
      const flagged = spawnSync(
        process.execPath,
        ['schema/split-project-72-to-73.js', flag, join(directory, 'ignored.json'), inputPath],
        { cwd: process.cwd(), encoding: 'utf8' },
      );
      assert.notEqual(flagged.status, 0);
      assert.match(flagged.stderr, /exactly one input file is required/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
