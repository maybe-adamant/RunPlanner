import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';
import { migrateProjectDocumentTo } from './migrate-project.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = { configFile: false, logLevel: 'silent' };
const checkpoint = (id) =>
  JSON.parse(
    readFileSync(
      join(root, `test/fixtures/authored-project/checkpoints/${id}.runplanner.json`),
      'utf8',
    ),
  );
const at102 = (current, revision = 1) => ({
  ...current,
  schemaVersion: 102,
  schemaRevision: revision,
});

/** The G opening's action keys; the checkpoint keeps a pickup of a role its reward lost. */
const gOpening = (document) =>
  document.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((occurrence) => occurrence.occurrenceId === 'golden-g-b1-e1')
    .roomActions.order.map((action) => JSON.stringify(action));
const stalePickup = JSON.stringify({
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
});

describe('schema 102 to 103 migration', () => {
  let step;
  let engine;
  before(async () => {
    ({ module: step } = await runnerImport(
      join(root, 'apps/planner/src/persistence/project-102-to-103.js'),
      runner,
    ));
    ({ module: engine } = await runnerImport(
      fileURLToPath(new URL('./test-support/strict-decode.js', import.meta.url)),
      runner,
    ));
  });

  it('changes only the version', () => {
    const current = checkpoint('underworld-fg');
    const migrated = step.migrateProjectDocument(at102(current));
    assert.equal(migrated.schemaVersion, 103);
    assert.equal('schemaRevision' in migrated, false);
    assert.deepEqual(migrated, current);
  });

  it('rejects another schema, a later revision or another catalog', () => {
    const legacy = at102(checkpoint('underworld-fg'));
    assert.throws(
      () => step.migrateProjectDocument({ ...legacy, schemaVersion: 101 }),
      /expects schema 102/,
    );
    assert.throws(
      () => step.migrateProjectDocument({ ...legacy, schemaRevision: 2 }),
      /schema 102\.2 is newer than schema 102's final revision 1/,
    );
    assert.throws(
      () => step.migrateProjectDocument({ ...legacy, catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('settles a schema 102 plan offline as opening it does', () => {
    const current = checkpoint('underworld-fg');
    assert.ok(gOpening(current).includes(stalePickup));
    const migrated = migrateProjectDocumentTo(at102(current));
    assert.equal(migrated.schemaVersion, 103);
    assert.deepEqual(
      gOpening(migrated),
      gOpening(current).filter((action) => action !== stalePickup),
    );
    const settled = step.settleUpgradedProject(
      engine.parseProjectDocument(JSON.stringify(current), engine.catalog),
      engine.catalog,
    );
    assert.equal(
      engine.encodeProjectDocument(settled.assembly.project),
      `${JSON.stringify(migrated, null, 2)}\n`,
    );
  });
});
