import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CURRENT_SCHEMA_VERSION,
  OLDEST_SCHEMA_VERSION,
  TRANSITIONS,
  migrateProjectDocumentTo,
  outputPath,
  planNameFromPath,
} from './migrate-project.js';

const document = (schemaVersion) => ({
  schemaVersion,
  schemaRevision: 1,
  projectId: 'run-plan-1',
  name: 'Run',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Underworld',
    biomes: [
      {
        biomeKey: 'F',
        topology: {
          occurrences: [
            {
              occurrenceId: 'a',
              encounters: {
                encounterKeyByPhase: { Combat: 'GeneratedF' },
                steadyGrowthTargetByPhase: { Combat: 'ZeusWeaponBoon' },
              },
            },
          ],
        },
      },
    ],
  },
});

describe('project schema migration runner', () => {
  it('chains every supported transition from the floor to the current schema', () => {
    assert.equal(OLDEST_SCHEMA_VERSION, 86);
    assert.equal(CURRENT_SCHEMA_VERSION, 100);
    assert.equal(TRANSITIONS.length, CURRENT_SCHEMA_VERSION - OLDEST_SCHEMA_VERSION);
    TRANSITIONS.forEach((transition, index) => {
      assert.equal(transition.source, OLDEST_SCHEMA_VERSION + index);
      assert.equal(transition.target, transition.source + 1);
    });
  });

  it('migrates a document from its own schema to the current one', () => {
    const source = document(98);
    const migrated = migrateProjectDocumentTo(source);
    assert.equal(migrated.schemaVersion, 100);
    assert.equal(migrated.schemaRevision, undefined);
    assert.equal(
      migrated.route.biomes[0].topology.occurrences[0].encounters.steadyGrowthTargetByPhase,
      undefined,
    );
    assert.equal(source.schemaVersion, 98);
  });

  it('stops at an explicit target schema', () => {
    const migrated = migrateProjectDocumentTo(document(97), {
      target: 98,
      context: { name: 'Named' },
    });
    assert.equal(migrated.schemaVersion, 98);
    assert.equal(migrated.name, 'Named');
    assert.ok(
      migrated.route.biomes[0].topology.occurrences[0].encounters.steadyGrowthTargetByPhase,
    );
  });

  it('leaves a current document unchanged', () => {
    const source = document(100);
    assert.equal(migrateProjectDocumentTo(source), source);
  });

  it('rejects documents outside the supported range', () => {
    assert.throws(
      () => migrateProjectDocumentTo(document(85)),
      /older than the supported floor 86/,
    );
    assert.throws(() => migrateProjectDocumentTo(document(101)), /already newer than 100/);
    assert.throws(
      () => migrateProjectDocumentTo(document(98), { target: 101 }),
      /newer than the current schema 100/,
    );
    assert.throws(
      () => migrateProjectDocumentTo(document(98), { target: 97 }),
      /already newer than 97/,
    );
    assert.throws(
      () => migrateProjectDocumentTo({ catalogVersion: 'x' }),
      /no integer schemaVersion/,
    );
    assert.throws(() => migrateProjectDocumentTo([]), /must be an object/);
  });

  it('names the sibling output after the target schema and the plan after the file stem', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema100.json');
    assert.equal(
      outputPath('/plans/run.runplanner.json', 90),
      '/plans/run.runplanner-schema90.json',
    );
    assert.equal(planNameFromPath('/plans/My run.runplanner.json'), 'My run');
    assert.equal(planNameFromPath('/plans/v1.2 run.json'), 'v1.2 run');
  });
});
