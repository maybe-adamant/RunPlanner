import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-92-to-93.js';

const document = () => ({
  schemaVersion: 92,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Underworld',
    loadout: {
      weaponKey: 'WeaponStaffSwing',
      aspectKey: 'BaseStaffAspect',
      startingKeepsakeKey: 'ManaOverTimeRefundKeepsake',
    },
    biomes: [
      {
        biomeKey: 'F',
        offer: { options: [{ traitKey: 'HiddenMaxHealthBoon', rarity: 'Rare' }] },
      },
    ],
  },
});

describe('schema 92 to 93 migration', () => {
  it('equips the default familiar after the starting keepsake and keeps every other field', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    assert.equal(migrated.schemaVersion, 93);
    assert.deepEqual(Object.keys(migrated.route.loadout), [
      'weaponKey',
      'aspectKey',
      'startingKeepsakeKey',
      'familiarKey',
    ]);
    assert.equal(migrated.route.loadout.familiarKey, 'FrogFamiliar');
    const loadout = { ...migrated.route.loadout };
    delete loadout.familiarKey;
    assert.deepEqual(
      { ...migrated, schemaVersion: 92, route: { ...migrated.route, loadout } },
      source,
    );
    assert.equal(source.schemaVersion, 92);
    assert.equal('familiarKey' in source.route.loadout, false);
  });

  it('gives a Fresh File route no familiar', () => {
    const source = document();
    source.route.routeKey = 'FreshFile';
    source.route.loadout = { weaponKey: null, aspectKey: null, startingKeepsakeKey: null };
    assert.equal(migrateProjectDocument(source).route.loadout.familiarKey, null);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 91 }),
      /expects schema 92/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-93 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema93.json');
  });
});
