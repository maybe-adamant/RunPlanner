import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

// The step's recovery half reaches the engine, a TypeScript source.
const { module: step } = await runnerImport(
  fileURLToPath(new URL('../apps/planner/src/persistence/project-98-to-99.js', import.meta.url)),
  { configFile: false, logLevel: 'silent' },
);
const { migrateProjectDocument, readLegacyTimedOutcomes } = step;

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

  it('reads each phase-keyed outcome with the room and phase it landed at', () => {
    const blessing = { blessingKey: 'ChaosBlessingAlpha', blessingValues: { Amount: 2 } };
    const source = document({
      steadyGrowthTargetByPhase: { Combat: 'ZeusWeaponBoon' },
      transcendentEmbryoBlessingByPhase: { Combat: blessing },
    });
    assert.deepEqual(readLegacyTimedOutcomes(source), [
      {
        biomeKey: 'F',
        occurrenceId: 'a',
        phaseKey: 'Combat',
        kind: 'steadyGrowth',
        targetTraitKey: 'ZeusWeaponBoon',
      },
      {
        biomeKey: 'F',
        occurrenceId: 'a',
        phaseKey: 'Combat',
        kind: 'transcendentEmbryo',
        blessing,
      },
    ]);
    assert.deepEqual(readLegacyTimedOutcomes(document({ encounterKeyByPhase: {} })), []);
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
});
