import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';
import { migrateProjectDocumentToComplete, outputPath } from './migrate-project.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const checkpoint = JSON.parse(
  readFileSync(
    join(root, 'test/fixtures/authored-project/checkpoints/nemesis-f-trait-trade.runplanner.json'),
    'utf8',
  ),
);

/** Every stored kill-race outcome, by occurrence and phase. */
function outcomes(document) {
  return Object.fromEntries(
    document.route.biomes.flatMap((biome) =>
      (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
        Object.entries(occurrence.encounters?.nemesisBetOutcomeByPhase ?? {}).map(
          ([phase, outcome]) => [`${occurrence.occurrenceId}:${phase}`, outcome],
        ),
      ),
    ),
  );
}

/** The checkpoint with the given outcomes and every other stored outcome omitted. */
function sparse(kept) {
  const copy = structuredClone(checkpoint);
  for (const biome of copy.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      const stored = occurrence.encounters?.nemesisBetOutcomeByPhase;
      if (stored === undefined) continue;
      for (const phase of Object.keys(stored)) {
        const value = kept[`${occurrence.occurrenceId}:${phase}`];
        if (value === undefined) delete stored[phase];
        else stored[phase] = value;
      }
      if (Object.keys(stored).length === 0) delete occurrence.encounters.nemesisBetOutcomeByPhase;
    }
  return copy;
}

describe('offline migration to a complete schema 100', () => {
  let engine;
  let directory;
  before(async () => {
    ({ module: engine } = await runnerImport(
      fileURLToPath(new URL('./test-support/strict-decode.js', import.meta.url)),
      { configFile: false, logLevel: 'silent' },
    ));
    directory = mkdtempSync(join(tmpdir(), 'run-planner-schema-'));
  });
  after(() => rmSync(directory, { recursive: true, force: true }));
  const decode = (document) =>
    engine.parseProjectDocument(JSON.stringify(document), engine.catalog);

  it('writes a strictly decodable file from a schema-99 document, every kill race a win', () => {
    const legacy = { ...engine.legacySchema99Body(checkpoint), schemaVersion: 99 };
    assert.equal(Object.keys(outcomes(legacy)).length, 0);
    const input = join(directory, 'legacy.runplanner.json');
    writeFileSync(input, JSON.stringify(legacy));
    const run = spawnSync(process.execPath, [join(root, 'schema/migrate-project.js'), input], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    const written = JSON.parse(readFileSync(outputPath(input), 'utf8'));
    assert.equal(written.schemaVersion, 100);
    assert.doesNotThrow(() => decode(written));
    const filled = outcomes(written);
    assert.deepEqual(Object.keys(filled).sort(), Object.keys(outcomes(checkpoint)).sort());
    assert.ok(Object.values(filled).every((outcome) => outcome === 'win'));
  });

  it('keeps a stored tie or loss and fills only the omitted wins of a schema-100 document', async () => {
    const [tie, loss] = Object.keys(outcomes(checkpoint));
    const document = sparse({ [tie]: 'tie', [loss]: 'loss' });
    assert.throws(() => decode(document), /nemesisBetOutcomeByPhase/);
    const completed = await migrateProjectDocumentToComplete(document);
    assert.doesNotThrow(() => decode(completed));
    assert.deepEqual(outcomes(completed), {
      ...outcomes(checkpoint),
      [tie]: 'tie',
      [loss]: 'loss',
    });
  });

  it('leaves a document migrated to an older schema without completion', async () => {
    const legacy = { ...engine.legacySchema99Body(checkpoint), schemaVersion: 99 };
    delete legacy.name;
    legacy.schemaVersion = 97;
    const migrated = await migrateProjectDocumentToComplete(legacy, { target: 98 });
    assert.equal(migrated.schemaVersion, 98);
    assert.deepEqual(outcomes(migrated), {});
  });
});
