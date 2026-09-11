import test from 'node:test';
import assert from 'node:assert/strict';

import { CATALOG_VERSION, migrateProjectDocument, outputPath } from './migrate-project-80-to-81.js';

function shop(profileKey, biomeKey, offers) {
  return {
    schemaVersion: 80,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      routeKey: biomeKey === 'I' ? 'Underworld' : 'Surface',
      biomes: [
        {
          biomeKey,
          state: {},
          topology: {
            occurrences: [{ state: { kind: 'shop', shop: { profileKey, offers } } }],
          },
        },
      ],
    },
  };
}

function reward(rewardType) {
  return { reward: { offer: { rewardType } } };
}

test('distinguishes the I boosted slots from its ordinary mixed Boon', () => {
  const result = migrateProjectDocument(
    shop('I_WorldShop', 'I', {
      BoostedBoon: reward('RandomLoot'),
      MixedProgress: reward('RandomLoot'),
      PremiumProgress: reward('RandomLoot'),
    }),
  );
  const offers = result.route.biomes[0].topology.occurrences[0].state.shop.offers;
  assert.equal(offers.BoostedBoon.optionKey, 'BoostedRandomLoot');
  assert.equal(offers.MixedProgress.optionKey, 'RandomLoot');
  assert.equal(offers.PremiumProgress.optionKey, 'BoostedRandomLoot');
});

test('retains ambiguous Q mixed Boons for repair and infers its dedicated boosted slot', () => {
  const result = migrateProjectDocument(
    shop('Q_WorldShop', 'Q', {
      MixedProgress1: reward('RandomLoot'),
      MixedProgress2: reward('RandomLoot'),
      PremiumProgress: reward('RandomLoot'),
    }),
  );
  const offers = result.route.biomes[0].topology.occurrences[0].state.shop.offers;
  assert.equal(offers.MixedProgress1.optionKey, null);
  assert.equal(offers.MixedProgress2.optionKey, null);
  assert.equal(offers.PremiumProgress.optionKey, 'BoostedRandomLoot');
});

test('preserves null inventory and leaves ambiguous Hammer identity unresolved', () => {
  const result = migrateProjectDocument(
    shop('WorldShop', 'F', {
      Boon: reward('BlindBoxLoot'),
      MajorNonBoon: reward('WeaponUpgradeDrop'),
      Minor: { reward: null },
    }),
  );
  const offers = result.route.biomes[0].topology.occurrences[0].state.shop.offers;
  assert.equal(offers.Boon.optionKey, 'BlindBoxLoot');
  assert.equal(offers.MajorNonBoon.optionKey, null);
  assert.equal(offers.Minor.optionKey, null);
  assert.equal(offers.Minor.reward, null);
});

test('preserves an unmaterialized Shop room', () => {
  const source = shop('WorldShop', 'P', {});
  source.route.biomes[0].topology.occurrences[0].state = { kind: 'shop' };

  const result = migrateProjectDocument(source);

  assert.deepEqual(result.route.biomes[0].topology.occurrences[0].state, { kind: 'shop' });
});

test('rejects stale input schema or catalog', () => {
  assert.throws(() => migrateProjectDocument({ schemaVersion: 81 }), /expects schema 80/);
  assert.throws(
    () => migrateProjectDocument({ schemaVersion: 80, catalogVersion: 'old' }),
    /expects catalog 0\.55\.0-anvil-of-fates/,
  );
});

test('names migrated files with schema 81', () => {
  assert.equal(outputPath('/tmp/plan.json'), '/tmp/plan-schema81.json');
});
