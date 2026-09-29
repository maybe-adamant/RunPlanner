import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-89-to-90.js';

const document = () => ({
  schemaVersion: 89,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Underworld',
    loadout: {
      weaponKey: 'WeaponStaffSwing',
      aspectKey: 'BaseStaffAspect',
      startingKeepsakeKey: 'ManaOverTimeRefundKeepsake',
    },
    biomes: [{ biomeKey: 'F', unrelated: [1, { keep: true }] }],
  },
});

describe('schema 89 to 90 migration', () => {
  it('changes only the schema version, keeping every authored selection', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    assert.equal(migrated.schemaVersion, 90);
    assert.deepEqual({ ...migrated, schemaVersion: 89 }, source);
    assert.notEqual(migrated, source);
    assert.equal(source.schemaVersion, 89);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 88 }),
      /expects schema 89/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-90 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema90.json');
  });
});
