import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  migrateProjectDocument,
  outputPath,
  planNameFromPath,
} from './migrate-project-97-to-98.js';

const document = () => ({
  schemaVersion: 97,
  schemaRevision: 3,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: { routeKey: 'Underworld', biomes: [] },
});

describe('schema 97 to 98 migration', () => {
  it('names the plan after the given name, right after its id, and drops the old revision', () => {
    const source = document();
    const migrated = migrateProjectDocument(source, { name: '  Staff practice ' });
    assert.deepEqual(migrated, {
      schemaVersion: 98,
      projectId: 'run-plan-1',
      name: 'Staff practice',
      catalogVersion: '0.55.0-anvil-of-fates',
      route: { routeKey: 'Underworld', biomes: [] },
    });
    assert.equal(source.schemaVersion, 97);
  });

  it('takes the default name when none or a blank one is given', () => {
    assert.equal(migrateProjectDocument(document()).name, 'New plan');
    assert.equal(migrateProjectDocument(document(), { name: '   ' }).name, 'New plan');
  });

  it('bounds a long name to 200 code points', () => {
    const name = migrateProjectDocument(document(), { name: '🎲'.repeat(250) }).name;
    assert.equal(Array.from(name).length, 200);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 96 }),
      /expects schema 97/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('names the plan from the input file and writes a sibling schema-98 file', () => {
    assert.equal(planNameFromPath('/plans/My run.runplanner.json'), 'My run');
    assert.equal(planNameFromPath('/plans/v1.2 run.json'), 'v1.2 run');
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema98.json');
  });
});
