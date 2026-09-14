import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_VERSION, migrateProjectDocument } from './migrate-project-82-to-83.js';

function document(reward, purchased = false) {
  return {
    schemaVersion: 82,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      biomes: [
        {
          topology: {
            occurrences: [
              {
                state: { kind: 'shop', shop: { profileKey: 'WorldShop', offers: {} } },
                acquisitionSites: { roomExit: { pickupEntries: { travelDealRefill: reward } } },
                roomActions: {
                  order: purchased
                    ? [
                        {
                          kind: 'interactAcquisitionEntry',
                          siteKey: 'roomExit',
                          entryKey: 'travelDealRefill',
                        },
                      ]
                    : [],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

test('moves ordinary Travel inventory with its unambiguous option and retains action order', () => {
  const reward = {
    offer: { rewardType: 'MaxHealthDrop' },
    traitOffersByAcquisitionRole: {},
    dispositionByAcquisitionRole: {},
  };
  const result = migrateProjectDocument(document(reward, true));
  const occurrence = result.route.biomes[0].topology.occurrences[0];
  assert.equal(result.schemaVersion, 83);
  assert.deepEqual(occurrence.state.shop.travelDealRefill, { optionKey: 'MaxHealthDrop', reward });
  assert.equal(occurrence.acquisitionSites.roomExit.pickupEntries.travelDealRefill, undefined);
  assert.deepEqual(occurrence.roomActions.order, [
    { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: 'travelDealRefill' },
  ]);
});

test('keeps a purchased Mystery child and drops an unpurchased one', () => {
  const mystery = {
    offer: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    traitOffersByAcquisitionRole: { hiddenSource: null },
    dispositionByAcquisitionRole: {},
  };
  const purchased = migrateProjectDocument(document(mystery, true));
  assert.equal(
    purchased.route.biomes[0].topology.occurrences[0].state.shop.travelDealRefill.optionKey,
    'BlindBoxLoot',
  );
  assert.deepEqual(
    purchased.route.biomes[0].topology.occurrences[0].state.shop.travelDealRefill.reward.offer,
    { rewardType: 'BlindBoxLoot' },
  );
  assert.deepEqual(
    purchased.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries
      .travelDealRefill,
    mystery,
  );
  const dormant = migrateProjectDocument(document(mystery));
  assert.equal(
    dormant.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries
      .travelDealRefill,
    undefined,
  );
});

test('preserves unresolved and dormant children, leaving ambiguous option identities repairable', () => {
  for (const [profileKey, rewardType] of [
    ['WorldShop', 'WeaponUpgradeDrop'],
    ['I_WorldShop', 'RandomLoot'],
    ['Q_WorldShop', 'RandomLoot'],
  ]) {
    const reward = {
      offer: { rewardType },
      traitOffersByAcquisitionRole: { self: null },
      dispositionByAcquisitionRole: {},
    };
    const source = document(reward);
    source.route.biomes[0].topology.occurrences[0].state.shop.profileKey = profileKey;
    const original = structuredClone(source);
    const migrated = migrateProjectDocument(source).route.biomes[0].topology.occurrences[0];
    assert.deepEqual(migrated.state.shop.travelDealRefill, { optionKey: null, reward });
    assert.deepEqual(migrated.roomActions.order, []);
    assert.deepEqual(source, original);
  }
  assert.deepEqual(
    migrateProjectDocument(document(null)).route.biomes[0].topology.occurrences[0].state.shop
      .travelDealRefill,
    { optionKey: null, reward: null },
  );
});

test('preserves non-Mystery resolution children and leaves Wells and Shrines untouched', () => {
  const reward = {
    offer: { rewardType: 'StackUpgrade' },
    traitOffersByAcquisitionRole: {},
    dispositionByAcquisitionRole: {},
    levelResolutionsByAcquisitionRole: {
      self: {
        kind: 'choice',
        offeredTraitKeys: ['HeraWeaponBoon'],
        selectedTraitKey: 'HeraWeaponBoon',
      },
    },
  };
  const source = document(reward, true);
  const room = source.route.biomes[0].topology.occurrences[0];
  room.stygianWell = {
    travelDealRefillKey: 'RandomStoreItem',
    twistResultKeyBySlot: { travelDealRefill: 'TemporaryDiscountTrait' },
  };
  room.hermesShrine = {
    travelDealRefill: { offer: { rewardType: 'ArmorBoost' }, purchase: { rushed: true } },
  };
  const migrated = migrateProjectDocument(source).route.biomes[0].topology.occurrences[0];
  assert.deepEqual(migrated.state.shop.travelDealRefill.reward, reward);
  assert.deepEqual(migrated.stygianWell, room.stygianWell);
  assert.deepEqual(migrated.hermesShrine, room.hermesShrine);
  room.state.shop.travelDealRefill = { optionKey: null, reward: null };
  assert.throws(() => migrateProjectDocument(source), /collision/);
});
