import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument } from '../apps/planner/src/persistence/project-99-to-100.js';

const offer = (rewardType) => ({ optionKey: null, reward: { offer: { rewardType } } });
const document = (occurrences) => ({
  schemaVersion: 99,
  schemaRevision: 1,
  projectId: 'run-plan-1',
  name: 'Run',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: { routeKey: 'Underworld', biomes: [{ biomeKey: 'G', topology: { occurrences } }] },
});
const shopPreboss = (contract, order, entries) => ({
  occurrenceId: 'shop',
  gameName: 'G_PreBoss01',
  state: {
    kind: 'shop',
    shop: {
      profileKey: 'WorldShop',
      offers: { Boon: offer('RandomLoot'), infernalContractReward: contract },
    },
  },
  roomActions: { order },
  acquisitionSites: { roomExit: { pickupEntries: entries } },
});

describe('schema 99 to 100 migration', () => {
  it('moves a Shop-owned pedestal item, its collect action and its Mystery source to the Preboss', () => {
    const mystery = offer('BlindBoxLoot');
    const source = { offer: { rewardType: 'BlindBoxLoot', payload: { source: 'ZeusUpgrade' } } };
    const migrated = migrateProjectDocument(
      document([
        shopPreboss(
          mystery,
          [
            { kind: 'interactShopOffer', offerKey: 'Boon' },
            { kind: 'interactShopOffer', offerKey: 'infernalContractReward' },
          ],
          { infernalContractReward: source },
        ),
      ]),
    );
    const [room] = migrated.route.biomes[0].topology.occurrences;
    assert.equal(migrated.schemaVersion, 100);
    assert.equal('schemaRevision' in migrated, false);
    assert.deepEqual(Object.keys(room.state.shop.offers), ['Boon']);
    assert.deepEqual(room.infernalContractPedestal, mystery);
    assert.deepEqual(room.roomActions.order, [
      { kind: 'interactShopOffer', offerKey: 'Boon' },
      { kind: 'interactInfernalContractPedestal' },
    ]);
    assert.deepEqual(room.acquisitionSites, {
      roomExit: { pickupEntries: {} },
      infernalContractPedestal: { pickupEntries: { infernalContractReward: source } },
    });
  });

  it('gives the boon form and an unentered Shop form the default pedestal', () => {
    const migrated = migrateProjectDocument(
      document([
        {
          occurrenceId: 'peer',
          gameName: 'G_PreBoss01',
          state: { kind: 'freeReward', reward: null },
        },
        { occurrenceId: 'unentered', gameName: 'Q_PreBoss01', state: { kind: 'shop' } },
        {
          occurrenceId: 'combat',
          gameName: 'G_Combat01',
          state: { kind: 'counted', reward: null },
        },
      ]),
    );
    const [peer, unentered, combat] = migrated.route.biomes[0].topology.occurrences;
    assert.deepEqual(peer.infernalContractPedestal, { optionKey: null, reward: null });
    assert.deepEqual(unentered.infernalContractPedestal, { optionKey: null, reward: null });
    assert.equal('infernalContractPedestal' in combat, false);
  });

  it('leaves its source unchanged and rejects another source schema or catalog', () => {
    const source = document([shopPreboss({ optionKey: null, reward: null }, [], {})]);
    migrateProjectDocument(source);
    assert.ok(
      source.route.biomes[0].topology.occurrences[0].state.shop.offers.infernalContractReward,
    );
    assert.throws(
      () => migrateProjectDocument({ ...source, schemaVersion: 98 }),
      /expects schema 99/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...source, catalogVersion: 'other' }),
      /expects catalog/,
    );
  });
});
