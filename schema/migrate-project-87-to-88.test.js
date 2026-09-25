import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument } from './migrate-project-87-to-88.js';

const document = () => ({
  schemaVersion: 87,
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    biomes: [
      {
        topology: {
          occurrences: [
            {
              occurrenceId: 'retained',
              unrelatedNumber: 7,
              state: {
                encounters: {
                  customizationByPhase: {
                    ordinary: { other: { kind: 'single', choiceKey: 'keep' } },
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
});

describe('schema 87 to 88 migration', () => {
  it('changes only the schema version', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    assert.equal(migrated.schemaVersion, 88);
    assert.equal(source.schemaVersion, 87);
    assert.deepEqual({ ...migrated, schemaVersion: 87 }, document());
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 86 }),
      /expects schema 87/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });
});
