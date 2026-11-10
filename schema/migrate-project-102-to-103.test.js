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
  const migrate = (document) => step.migrateProjectDocument(document, { catalog: engine.catalog });

  it('lifts by the version alone', () => {
    const current = checkpoint('underworld-fg');
    const lifted = step.liftProjectDocument(at102(current));
    assert.equal(lifted.schemaVersion, 103);
    assert.equal('schemaRevision' in lifted, false);
    assert.deepEqual(lifted, current);
  });

  it('rejects another schema, a later revision or another catalog', () => {
    const legacy = at102(checkpoint('underworld-fg'));
    for (const transform of [step.liftProjectDocument, migrate]) {
      assert.throws(() => transform({ ...legacy, schemaVersion: 101 }), /expects schema 102/);
      assert.throws(
        () => transform({ ...legacy, schemaRevision: 2 }),
        /schema 102\.2 is newer than schema 102's final revision 1/,
      );
      assert.throws(() => transform({ ...legacy, catalogVersion: 'other' }), /expects catalog/);
    }
  });

  it('settles a plan saved under the earlier rules', () => {
    const current = checkpoint('underworld-fg');
    assert.ok(gOpening(current).includes(stalePickup));
    for (const revision of [0, 1]) {
      const migrated = migrate(at102(current, revision));
      assert.equal(migrated.schemaVersion, 103);
      assert.deepEqual(
        gOpening(migrated),
        gOpening(current).filter((action) => action !== stalePickup),
      );
      assert.doesNotThrow(() =>
        engine.parseProjectDocument(JSON.stringify(migrated), engine.catalog),
      );
    }
    // The offline tool runs the same chain.
    assert.deepEqual(migrateProjectDocumentTo(at102(current)), migrate(at102(current)));
  });

  it('lifts by the version alone a plan its settlement leaves as it was', () => {
    const current = checkpoint('surface-n');
    assert.deepEqual(migrate(at102(current)), current);
  });

  it('keeps the bare lift when the plan does not decode or its settlement throws', () => {
    const undecodable = { ...at102(checkpoint('underworld-fg')), route: 'not a route' };
    assert.deepEqual(migrate(undecodable), step.liftProjectDocument(undecodable));
    // A catalog the plan decodes against but its evaluation cannot read makes the settlement throw.
    const legacy = at102(checkpoint('underworld-fg'));
    const catalog = { ...engine.catalog, heroMaxStats: undefined };
    assert.doesNotThrow(() =>
      engine.parseProjectDocument(JSON.stringify(step.liftProjectDocument(legacy)), catalog),
    );
    assert.deepEqual(
      step.migrateProjectDocument(legacy, { catalog }),
      step.liftProjectDocument(legacy),
    );
  });
});
