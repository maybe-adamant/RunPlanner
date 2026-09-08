import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_VERSION, migrateProjectDocument } from './migrate-project-78-to-79.js';

function mysteryReward(source = 'ApolloUpgrade') {
  return {
    offer: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source } },
    traitOffersByAcquisitionRole: {
      hiddenSource: { kind: 'traits', giverKey: 'Apollo', options: [], selectedOptionKey: null },
    },
    dispositionByAcquisitionRole: { hiddenSource: { kind: 'normal' } },
  };
}

function document() {
  return {
    schemaVersion: 78,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      routeKey: 'Surface',
      biomes: [
        {
          biomeKey: 'O',
          state: {},
          topology: {
            occurrences: [
              {
                state: {
                  kind: 'shop',
                  shop: {
                    offers: {
                      Boon: { reward: mysteryReward() },
                      Minor: { reward: { offer: { rewardType: 'MaxHealthDrop' } } },
                      Unpurchased: { reward: mysteryReward('HeraUpgrade') },
                    },
                  },
                },
                acquisitionSites: { roomExit: { pickupEntries: { existing: null } } },
                roomActions: {
                  order: [{ kind: 'interactShopOffer', offerKey: 'Boon' }],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

test('moves only a purchased Shop Mystery source into its acquisition entry', () => {
  const result = migrateProjectDocument(document());
  const occurrence = result.route.biomes[0].topology.occurrences[0];
  assert.equal(result.schemaVersion, 79);
  assert.deepEqual(occurrence.state.shop.offers.Boon.reward, {
    offer: { rewardType: 'BlindBoxLoot' },
    traitOffersByAcquisitionRole: {},
    dispositionByAcquisitionRole: {},
  });
  assert.deepEqual(occurrence.state.shop.offers.Unpurchased.reward, {
    offer: { rewardType: 'BlindBoxLoot' },
    traitOffersByAcquisitionRole: {},
    dispositionByAcquisitionRole: {},
  });
  assert.equal(
    occurrence.acquisitionSites.roomExit.pickupEntries.Boon.offer.payload.source,
    'ApolloUpgrade',
  );
  assert.equal(occurrence.acquisitionSites.roomExit.pickupEntries.Unpurchased, undefined);
  assert.equal(occurrence.acquisitionSites.roomExit.pickupEntries.existing, null);
  assert.deepEqual(occurrence.state.shop.offers.Minor.reward, {
    offer: { rewardType: 'MaxHealthDrop' },
  });
});
