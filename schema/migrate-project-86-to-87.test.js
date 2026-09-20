import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CATALOG_VERSION,
  migrateProjectDocument,
  OUTPUT_SCHEMA_VERSION,
} from './migrate-project-86-to-87.js';

function document(options) {
  return {
    schemaVersion: 86,
    catalogVersion: CATALOG_VERSION,
    route: {
      loadout: { weaponKey: 'WeaponLob', aspectKey: 'LobImpulseAspect' },
      biomes: [{ topology: { occurrences: [{ encounters: { offer: { options } } }] } }],
    },
  };
}

test('converts positive bonus approximations to native rolls and retains zero or omission', () => {
  const migrated = migrateProjectDocument(
    document([
      { traitKey: 'ApolloWeaponBoon', persephoneLevelBonus: 5 },
      { traitKey: 'ApolloSpecialBoon', persephoneLevelBonus: 0 },
      { traitKey: 'ApolloCastBoon' },
    ]),
  );
  const options = migrated.route.biomes[0].topology.occurrences[0].encounters.offer.options;
  assert.equal(migrated.schemaVersion, OUTPUT_SCHEMA_VERSION);
  assert.deepEqual(options[0], { traitKey: 'ApolloWeaponBoon', persephoneRoll: 6 });
  assert.deepEqual(options[1], { traitKey: 'ApolloSpecialBoon', persephoneRoll: 0 });
  assert.deepEqual(options[2], { traitKey: 'ApolloCastBoon' });
});

test('rejects malformed legacy Persephone values and wrong boundary versions', () => {
  assert.throws(() => migrateProjectDocument(document([{ persephoneLevelBonus: '5' }])));
  assert.throws(() =>
    migrateProjectDocument({ schemaVersion: 85, catalogVersion: CATALOG_VERSION }),
  );
  assert.throws(() => migrateProjectDocument({ schemaVersion: 86, catalogVersion: 'wrong' }));
});
