import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  migrateProjectDocument,
  OUTPUT_CATALOG_VERSION,
  SOURCE_CATALOG_VERSION,
} from './migrate-project-75-to-76.js';

function sourceDocument() {
  return {
    schemaVersion: 75,
    projectId: 'migration-test',
    catalogVersion: SOURCE_CATALOG_VERSION,
    route: {
      biomes: [
        {
          biomeKey: 'G',
          topology: {
            occurrences: [
              {
                occurrenceId: 'shop',
                gameName: 'G_Shop01',
                state: {
                  kind: 'shop',
                  shop: {
                    profileKey: 'WorldShop',
                    offers: {
                      first: {
                        reward: {
                          offer: { rewardType: 'ChaosWeaponUpgrade' },
                          traitOffersByAcquisitionRole: {},
                          dispositionByAcquisitionRole: { self: { kind: 'normal' } },
                        },
                      },
                      second: { reward: null },
                    },
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

test('preserves authored Anvil purchase and leaves its result unresolved', () => {
  const source = sourceDocument();
  const migrated = migrateProjectDocument(source);
  assert.equal(migrated.schemaVersion, 76);
  assert.equal(migrated.catalogVersion, OUTPUT_CATALOG_VERSION);
  assert.equal(
    migrated.route.biomes[0].topology.occurrences[0].state.shop.offers.first.anvilResult,
    null,
  );
  assert.equal(
    source.route.biomes[0].topology.occurrences[0].state.shop.offers.first.anvilResult,
    undefined,
  );
  assert.deepEqual(migrated.route.biomes[0].topology.occurrences[0].state.shop.offers.second, {
    reward: null,
  });
});

test('does not overwrite an existing result and rejects stale inputs', () => {
  const source = sourceDocument();
  source.route.biomes[0].topology.occurrences[0].state.shop.offers.first.anvilResult = null;
  assert.equal(
    migrateProjectDocument(source).route.biomes[0].topology.occurrences[0].state.shop.offers.first
      .anvilResult,
    null,
  );
  assert.throws(
    () => migrateProjectDocument({ ...sourceDocument(), schemaVersion: 74 }),
    /expects schema 75/,
  );
  assert.throws(
    () => migrateProjectDocument({ ...sourceDocument(), catalogVersion: 'stale' }),
    /expects catalog/,
  );
});
