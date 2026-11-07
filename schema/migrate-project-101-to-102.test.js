import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = { configFile: false, logLevel: 'silent' };
const checkpoint = (id) =>
  JSON.parse(
    readFileSync(
      join(root, `test/fixtures/authored-project/checkpoints/${id}.runplanner.json`),
      'utf8',
    ),
  );

/** Every Fields room's entry, by occurrence: the spatial one at 101, the layout one at 102. */
function entries(document) {
  return Object.fromEntries(
    document.route.biomes.flatMap((biome) =>
      (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
        occurrence.state?.kind === 'fieldsCombat'
          ? [
              [
                occurrence.occurrenceId,
                occurrence.state.spatial.entryStartPointId ??
                  occurrence.layout?.entryStartPointId ??
                  null,
              ],
            ]
          : [],
      ),
    ),
  );
}

describe('schema 101 to 102 migration', () => {
  let step;
  let engine;
  before(async () => {
    ({ module: step } = await runnerImport(
      join(root, 'apps/planner/src/persistence/project-101-to-102.js'),
      runner,
    ));
    ({ module: engine } = await runnerImport(
      fileURLToPath(new URL('./test-support/strict-decode.js', import.meta.url)),
      runner,
    ));
  });
  const decode = (document) =>
    engine.parseProjectDocument(JSON.stringify(document), engine.catalog);
  const canonical = (document) => engine.encodeProjectDocument(decode(document));
  const at101 = (current, revision = 2) => ({
    ...engine.legacySchema101Body(current),
    schemaVersion: 101,
    schemaRevision: revision,
  });

  it("moves each Fields room's entry point to its layout and changes nothing else", () => {
    const current = checkpoint('nemesis-h-fields');
    const legacy = at101(current);
    const before = entries(legacy);
    assert.ok(Object.values(before).some((entry) => entry !== null));
    assert.throws(() => decode(legacy));
    const migrated = step.migrateProjectDocument(legacy);
    assert.equal(migrated.schemaVersion, 102);
    assert.equal('schemaRevision' in migrated, false);
    assert.deepEqual(entries(migrated), before);
    assert.equal(canonical(migrated), canonical(current));
    assert.equal(legacy.schemaVersion, 101);
  });

  it('omits an unset entry instead of writing an empty layout', () => {
    const legacy = at101(checkpoint('nemesis-h-fields'), 0);
    const fields = legacy.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.state?.kind === 'fieldsCombat');
    fields.state.spatial.entryStartPointId = null;
    const migrated = step.migrateProjectDocument(legacy);
    const moved = migrated.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === fields.occurrenceId);
    assert.equal('layout' in moved, false);
    assert.equal('entryStartPointId' in moved.state.spatial, false);
    decode(migrated);
  });

  it('rejects another schema, a later revision or another catalog', () => {
    const legacy = at101(checkpoint('nemesis-h-fields'));
    assert.throws(
      () => step.migrateProjectDocument({ ...legacy, schemaVersion: 100 }),
      /expects schema 101/,
    );
    assert.throws(
      () => step.migrateProjectDocument({ ...legacy, schemaRevision: 3 }),
      /schema 101\.3 is newer than schema 101's final revision 2/,
    );
    assert.throws(
      () => step.migrateProjectDocument({ ...legacy, catalogVersion: 'other' }),
      /expects catalog/,
    );
  });
});
