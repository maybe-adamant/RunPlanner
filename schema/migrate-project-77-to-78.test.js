import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_VERSION, migrateProjectDocument, outputPath } from './migrate-project-77-to-78.js';

function document(state) {
  return {
    schemaVersion: 77,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      routeKey: 'Underworld',
      biomes: [{ biomeKey: 'H', state: {}, topology: { occurrences: [{ state }] } }],
    },
  };
}

test('adds unresolved spatial leaves to Fields occurrences', () => {
  const result = migrateProjectDocument(
    document({
      kind: 'fieldsCombat',
      cages: { cage1: null, cage2: null },
      optionalRewards: { optional1: null },
    }),
  );
  assert.equal(result.schemaVersion, 78);
  assert.deepEqual(result.route.biomes[0].topology.occurrences[0].state.spatial, {
    entryStartPointId: null,
    cagePointIdBySlot: { cage1: null, cage2: null },
    optionalPointIdBySlot: { optional1: null },
    nemesisPointId: null,
  });
});

test('leaves non-Fields state and existing spatial state unchanged', () => {
  const state = { kind: 'none' };
  const existing = {
    kind: 'fieldsCombat',
    cages: {},
    optionalRewards: {},
    spatial: { entryStartPointId: 1 },
  };
  const result = migrateProjectDocument(document(state));
  assert.deepEqual(result.route.biomes[0].topology.occurrences[0].state, state);
  const preserved = migrateProjectDocument(document(existing));
  assert.deepEqual(preserved.route.biomes[0].topology.occurrences[0].state, existing);
});

test('rejects the wrong source schema and catalog', () => {
  assert.throws(() => migrateProjectDocument({ schemaVersion: 78 }), /expects schema 77/);
  assert.throws(
    () => migrateProjectDocument({ schemaVersion: 77, catalogVersion: 'old' }),
    /expects catalog 0\.55\.0-anvil-of-fates/,
  );
});

test('names migrated files with schema 78', () => {
  assert.equal(outputPath('/tmp/plan.json'), '/tmp/plan-schema78.json');
});
