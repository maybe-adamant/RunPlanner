import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  migrateProjectDocument,
  OUTPUT_CATALOG_VERSION,
  SOURCE_CATALOG_VERSION,
} from './migrate-project-74-to-75.js';

function sourceDocument() {
  return {
    schemaVersion: 74,
    projectId: 'migration-test',
    catalogVersion: SOURCE_CATALOG_VERSION,
    route: {
      routeKey: 'Underworld',
      loadout: {
        keepsakeEquipResults: { transcendentEmbryo: { blessingKey: 'ChaosWeaponBlessing' } },
      },
      biomes: [
        {
          biomeKey: 'F',
          echoKeepsakeReplayResults: {
            transcendentEmbryo: { blessingKey: 'ChaosHealthBlessing' },
          },
          topology: {
            occurrences: [
              {
                occurrenceId: 'postboss',
                gameName: 'F_PostBoss01',
                keepsakeRack: {
                  equipResults: {
                    transcendentEmbryo: { blessingKey: 'ChaosElementalBlessing' },
                  },
                },
                encounters: {
                  transcendentEmbryoBlessingByPhase: {
                    Encounter: 'ChaosMoneyBlessing',
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
}

test('preserves Embryo identities and adds repairable empty operand records', () => {
  const source = sourceDocument();
  const migrated = migrateProjectDocument(source);
  assert.deepEqual(source.route.loadout.keepsakeEquipResults.transcendentEmbryo, {
    blessingKey: 'ChaosWeaponBlessing',
  });
  assert.equal(migrated.schemaVersion, 75);
  assert.equal(migrated.catalogVersion, OUTPUT_CATALOG_VERSION);
  assert.deepEqual(migrated.route.loadout.keepsakeEquipResults.transcendentEmbryo, {
    blessingKey: 'ChaosWeaponBlessing',
    blessingValues: {},
  });
  assert.deepEqual(migrated.route.biomes[0].echoKeepsakeReplayResults.transcendentEmbryo, {
    blessingKey: 'ChaosHealthBlessing',
    blessingValues: {},
  });
  assert.deepEqual(
    migrated.route.biomes[0].topology.occurrences[0].keepsakeRack.equipResults.transcendentEmbryo,
    { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
  );
  assert.deepEqual(
    migrated.route.biomes[0].topology.occurrences[0].encounters.transcendentEmbryoBlessingByPhase
      .Encounter,
    { blessingKey: 'ChaosMoneyBlessing', blessingValues: {} },
  );
});

test('rejects non-74 or stale-catalog input', () => {
  assert.throws(
    () => migrateProjectDocument({ ...sourceDocument(), schemaVersion: 73 }),
    /expects schema 74/,
  );
  assert.throws(
    () => migrateProjectDocument({ ...sourceDocument(), catalogVersion: 'stale' }),
    /expects catalog/,
  );
});
