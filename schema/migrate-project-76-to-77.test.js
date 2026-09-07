import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATALOG_VERSION, migrateProjectDocument } from './migrate-project-76-to-77.js';

test('advances a schema-76 project without changing its authored route', () => {
  const source = {
    schemaVersion: 76,
    projectId: 'carrier-migration',
    catalogVersion: CATALOG_VERSION,
    route: { routeKey: 'Surface', biomes: [] },
  };
  const migrated = migrateProjectDocument(source);
  assert.equal(migrated.schemaVersion, 77);
  assert.deepEqual(migrated.route, source.route);
  assert.notEqual(migrated, source);
});

test('rejects a stale schema or catalog', () => {
  const source = {
    schemaVersion: 76,
    projectId: 'carrier-migration',
    catalogVersion: CATALOG_VERSION,
    route: { routeKey: 'Surface', biomes: [] },
  };
  assert.throws(
    () => migrateProjectDocument({ ...source, schemaVersion: 75 }),
    /expects schema 76/,
  );
  assert.throws(
    () => migrateProjectDocument({ ...source, catalogVersion: 'stale' }),
    /expects catalog/,
  );
});
