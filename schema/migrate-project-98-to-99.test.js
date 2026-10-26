import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-98-to-99.js';

const occurrence = (encounters) => ({ occurrenceId: 'a', encounters });
const document = (encounters) => ({
  schemaVersion: 98,
  schemaRevision: 1,
  projectId: 'run-plan-1',
  name: 'Run',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Underworld',
    biomes: [{ biomeKey: 'F', topology: { occurrences: [occurrence(encounters)] } }],
  },
});

describe('schema 98 to 99 migration', () => {
  it('drops phase-keyed Steady Growth and Embryo outcomes and the old revision', () => {
    const source = document({
      encounterKeyByPhase: { Combat: 'GeneratedF' },
      steadyGrowthTargetByPhase: { Combat: 'ZeusWeaponBoon' },
      transcendentEmbryoBlessingByPhase: {
        Combat: { blessingKey: 'ChaosBlessingAlpha', blessingValues: {} },
      },
    });
    const migrated = migrateProjectDocument(source);
    const { schemaRevision, ...expected } = document({
      encounterKeyByPhase: { Combat: 'GeneratedF' },
    });
    void schemaRevision;
    assert.deepEqual(migrated, { ...expected, schemaVersion: 99 });
    assert.equal(Object.keys(migrated)[0], 'schemaVersion');
    assert.equal(source.schemaVersion, 98);
    assert.ok(source.route.biomes[0].topology.occurrences[0].encounters.steadyGrowthTargetByPhase);
  });

  it('keeps a document without outcomes unchanged but for its version', () => {
    const migrated = migrateProjectDocument(document({ encounterKeyByPhase: {} }));
    assert.equal(migrated.schemaVersion, 99);
    assert.deepEqual(migrated.route, document({ encounterKeyByPhase: {} }).route);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document({}), schemaVersion: 97 }),
      /expects schema 98/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document({}), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-99 file', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema99.json');
  });
});
