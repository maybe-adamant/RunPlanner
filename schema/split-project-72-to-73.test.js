import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  outputPaths,
  OUTPUT_CATALOG_VERSION,
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

function completedBiome(biomeKey) {
  const prebossId = `${biomeKey.toLowerCase()}-preboss`;
  const bossId = `${prebossId}:boss`;
  return {
    biomeKey,
    preservedBiomeState: { marker: biomeKey },
    topology: {
      occurrences: [
        { occurrenceId: prebossId, gameName: `${biomeKey}_PreBoss01`, state: { kind: 'shop' } },
        {
          occurrenceId: bossId,
          gameName: `${biomeKey}_Boss01`,
          state: { preservedBossLeaf: true },
          encounters: { encounterKeyByPhase: {} },
        },
      ],
      fixedRoomLinks: [{ sourceOccurrenceId: prebossId, targetOccurrenceId: bossId }],
    },
  };
}

function completedSource(rank) {
  const source = sourceDocument();
  source.routes[0] = {
    ...source.routes[0],
    loadout: { fearRanks: { BossDifficultyShrineUpgrade: rank } },
    resourcePlacements: { Pickaxe: { biomeKey: 'F', occurrenceId: 'f-preboss:boss' } },
    biomes: [completedBiome('F'), completedBiome('G')],
  };
  return source;
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
      catalogVersion: OUTPUT_CATALOG_VERSION,
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

test('reconciles fixed completion Boss variants from the stored Rivals rank without moving state', () => {
  const source = completedSource(2);
  const before = structuredClone(source);
  const underworld = splitProjectDocument(source).documents.Underworld.route;
  const f = underworld.biomes[0];
  const g = underworld.biomes[1];
  assert.equal(f.topology.occurrences[1].gameName, 'F_Boss02');
  assert.equal(g.topology.occurrences[1].gameName, 'G_Boss02');
  assert.deepEqual(f.topology.occurrences[1], {
    ...before.routes[0].biomes[0].topology.occurrences[1],
    gameName: 'F_Boss02',
  });
  assert.deepEqual(f.topology.fixedRoomLinks, before.routes[0].biomes[0].topology.fixedRoomLinks);
  assert.deepEqual(underworld.resourcePlacements, before.routes[0].resourcePlacements);
  assert.deepEqual(source, before);

  const rankOne = splitProjectDocument(completedSource(1)).documents.Underworld.route;
  assert.equal(rankOne.biomes[0].topology.occurrences[1].gameName, 'F_Boss02');
  assert.equal(rankOne.biomes[1].topology.occurrences[1].gameName, 'G_Boss01');
  const rankZero = splitProjectDocument(completedSource(0)).documents.Underworld.route;
  assert.equal(rankZero.biomes[0].topology.occurrences[1].gameName, 'F_Boss01');
  assert.equal(rankZero.biomes[1].topology.occurrences[1].gameName, 'G_Boss01');
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
