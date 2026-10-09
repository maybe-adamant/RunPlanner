import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-94-to-95.js';

const document = () => ({
  schemaVersion: 94,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Surface',
    biomes: [
      {
        biomeKey: 'N',
        rewards: [
          {
            offer: { rewardType: 'TalentDrop' },
            traitOffersByAcquisitionRole: {},
            dispositionByAcquisitionRole: { self: { kind: 'normal' } },
          },
        ],
      },
    ],
  },
});

describe('schema 94 to 95 migration', () => {
  it('leaves every Path of Stars screen unresolved and changes nothing else', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    assert.equal(migrated.schemaVersion, 95);
    assert.deepEqual({ ...migrated, schemaVersion: 94 }, source);
    assert.equal(source.schemaVersion, 94);
  });

  it('rejects a schema 94 document that already carries a Path selection', () => {
    const source = document();
    source.route.biomes[0].rewards[0].hexActivationsByAcquisitionRole = {
      self: { selectedNodeKeys: ['1:2'] },
    };
    assert.throws(() => migrateProjectDocument(source), /not a schema 94 field/);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 93 }),
      /expects schema 94/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-95 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema95.json');
  });
});
