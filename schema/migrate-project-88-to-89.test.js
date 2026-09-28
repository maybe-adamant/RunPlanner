import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-88-to-89.js';

const document = (projectId) => ({
  schemaVersion: 88,
  projectId,
  catalogVersion: '0.55.0-anvil-of-fates',
  route: { routeKey: 'Underworld', biomes: [{ biomeKey: 'F', unrelated: [1, { keep: true }] }] },
});

describe('schema 88 to 89 migration', () => {
  it('replaces the shared default identity with a unique one and changes nothing else', () => {
    const source = document('run-plan');
    const first = migrateProjectDocument(source);
    const second = migrateProjectDocument(source);
    for (const migrated of [first, second]) {
      assert.match(
        migrated.projectId,
        /^run-plan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      assert.equal(migrated.schemaVersion, 89);
      assert.deepEqual(Object.keys(migrated), Object.keys(source));
      assert.deepEqual({ ...migrated, schemaVersion: 88, projectId: 'run-plan' }, source);
    }
    assert.notEqual(first.projectId, second.projectId);
    assert.equal(source.projectId, 'run-plan');
    assert.equal(source.schemaVersion, 88);
  });

  it('keeps every other identity, including earlier unique ones', () => {
    for (const projectId of ['my-plan', 'run-plan-older-copy', 'Run-Plan']) {
      const source = document(projectId);
      assert.deepEqual(migrateProjectDocument(source), { ...source, schemaVersion: 89 });
    }
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document('x'), schemaVersion: 87 }),
      /expects schema 88/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document('x'), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-89 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema89.json');
  });
});
