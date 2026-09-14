import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_VERSION, migrateProjectDocument } from './migrate-project-81-to-82.js';

function document(reward, purchased = false) {
  return {
    schemaVersion: 81,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      biomes: [
        {
          topology: {
            occurrences: [
              {
                state: { kind: 'shop', shop: { offers: {} } },
                acquisitionSites: {
                  roomExit: { pickupEntries: { infernalContractReward: reward } },
                },
                roomActions: {
                  order: purchased
                    ? [
                        { kind: 'interactShopOffer', offerKey: 'Boon' },
                        {
                          kind: 'interactAcquisitionEntry',
                          siteKey: 'roomExit',
                          entryKey: 'infernalContractReward',
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

test('moves ordinary Contract inventory and its outcome into the Shop slot', () => {
  const reward = {
    offer: { rewardType: 'StackUpgrade' },
    traitOffersByAcquisitionRole: {},
    dispositionByAcquisitionRole: {},
    levelResolutionsByAcquisitionRole: {
      self: {
        kind: 'choice',
        offeredTraitKeys: ['ApolloWeaponBoon'],
        selectedTraitKey: 'ApolloWeaponBoon',
      },
    },
  };
  const source = document(reward, true);
  const original = structuredClone(source);
  const result = migrateProjectDocument(source);
  const occurrence = result.route.biomes[0].topology.occurrences[0];
  assert.equal(result.schemaVersion, 82);
  assert.deepEqual(occurrence.state.shop.offers.infernalContractReward, {
    optionKey: 'StackUpgrade',
    reward,
  });
  assert.deepEqual(source, original);
  assert.equal(
    occurrence.acquisitionSites.roomExit.pickupEntries.infernalContractReward,
    undefined,
  );
});

test('retains a purchased Mystery source at its existing acquisition entry', () => {
  const source = {
    offer: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    traitOffersByAcquisitionRole: {
      self: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    },
    dispositionByAcquisitionRole: {},
  };
  const result = migrateProjectDocument(document(source, true));
  const occurrence = result.route.biomes[0].topology.occurrences[0];
  assert.deepEqual(occurrence.state.shop.offers.infernalContractReward.reward.offer, {
    rewardType: 'BlindBoxLoot',
  });
  assert.deepEqual(
    occurrence.acquisitionSites.roomExit.pickupEntries.infernalContractReward,
    source,
  );
  assert.deepEqual(occurrence.roomActions.order, [
    { kind: 'interactShopOffer', offerKey: 'Boon' },
    { kind: 'interactShopOffer', offerKey: 'infernalContractReward' },
  ]);
});
