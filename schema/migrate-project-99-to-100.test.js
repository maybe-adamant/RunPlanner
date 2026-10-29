import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  migrateProjectDocument,
  normalizeUnpushedSchema100,
} from '../apps/planner/src/persistence/project-99-to-100.js';

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

  it('gives every Ephyra combat, Mini-Boss and side room an unpinned phantom exit', () => {
    const occurrences = ['N_Combat01', 'N_MiniBoss02', 'N_Sub15', 'N_Story01', 'N_PreHub01'].map(
      (gameName) => ({
        occurrenceId: gameName,
        gameName,
        state: { kind: 'freeReward', reward: null },
      }),
    );
    const migrated = migrateProjectDocument(document(occurrences));
    assert.deepEqual(
      migrated.route.biomes[0].topology.occurrences.map((occurrence) => occurrence.phantomExit),
      [
        { placeholderRoomGameName: null, rewardType: null },
        { placeholderRoomGameName: null, rewardType: null },
        { placeholderRoomGameName: null, rewardType: null },
        undefined,
        undefined,
      ],
    );
    assert.throws(
      () =>
        migrateProjectDocument(
          document([{ ...occurrences[0], phantomExit: { placeholderRoomGameName: null } }]),
        ),
      /already has a schema 100 phantom exit/,
    );
  });

  it('rejects a document that already carries a schema 100 pedestal', () => {
    assert.throws(
      () =>
        migrateProjectDocument(
          document([
            {
              occurrenceId: 'peer',
              gameName: 'G_PreBoss01',
              state: { kind: 'freeReward', reward: null },
              infernalContractPedestal: { optionKey: null, reward: null },
            },
          ]),
        ),
      /already has a schema 100 pedestal/,
    );
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

describe('schema 99 Well and Pool interaction', () => {
  it('drops the flag, keeping an interacted stock and clearing an uninteracted one', () => {
    const migrated = migrateProjectDocument(
      document([
        {
          occurrenceId: 'postboss',
          gameName: 'G_PostBoss01',
          stygianWell: {
            interacted: false,
            offerKeyBySlot: { healing: 'HealDropRange', secondLeft: null, secondRight: null },
            travelDealRefillKey: null,
          },
          purgingPool: {
            interacted: true,
            traitKeyBySlot: { left: 'ApolloWeaponBoon', middle: null, right: null },
          },
          roomActions: { order: [] },
        },
      ]),
    );
    const [room] = migrated.route.biomes[0].topology.occurrences;
    assert.deepEqual(room.stygianWell, {
      offerKeyBySlot: { healing: null, secondLeft: null, secondRight: null },
    });
    assert.deepEqual(room.purgingPool, {
      traitKeyBySlot: { left: 'ApolloWeaponBoon', middle: null, right: null },
    });
  });
});

describe('unpushed schema 100 reroll counts', () => {
  it('turns Well and Pool counts into unpinned rerolls at the end of the room', () => {
    const room = {
      occurrenceId: 'postboss',
      gameName: 'F_PostBoss01',
      stygianWell: {
        interacted: true,
        offerKeyBySlot: { healing: 'HealDropRange' },
        rerollCount: 2,
      },
      purgingPool: {
        interacted: false,
        traitKeyBySlot: { left: 'ApolloWeaponBoon', middle: null },
        rerollCount: 1,
      },
      roomActions: { order: [{ kind: 'useFountain' }] },
    };
    const source = { ...document([room]), schemaVersion: 100 };
    const normalized = normalizeUnpushedSchema100(source);
    const [migrated] = normalized.route.biomes[0].topology.occurrences;
    // An interacted Well keeps its stock; an uninteracted Pool's slots go native.
    assert.deepEqual(migrated.stygianWell, { offerKeyBySlot: { healing: 'HealDropRange' } });
    assert.deepEqual(migrated.purgingPool, { traitKeyBySlot: { left: null, middle: null } });
    assert.deepEqual(migrated.roomActions.order, [
      { kind: 'useFountain' },
      { kind: 'rerollStygianWell', rerollId: 'r1', offerKeyBySlot: {} },
      { kind: 'rerollStygianWell', rerollId: 'r2', offerKeyBySlot: {} },
    ]);
    assert.equal(room.stygianWell.rerollCount, 2);
    const plain = { ...document([]), schemaVersion: 100 };
    assert.equal(normalizeUnpushedSchema100(plain), plain);
  });

  it('turns trait, Chaos and Pom screen counts into unauthored earlier screens', () => {
    const traits = { kind: 'traits', giverKey: 'Zeus', options: [], rerollCount: 2 };
    const chaos = { kind: 'chaos', giverKey: 'Chaos', curseOptions: [], rerollCount: 1 };
    const pom = { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null, rerollCount: 3 };
    const room = {
      occurrenceId: 'combat',
      gameName: 'F_Combat01',
      state: {
        kind: 'counted',
        reward: {
          traitOffersByAcquisitionRole: { source: traits, chaos },
          levelResolutionsByAcquisitionRole: { self: pom },
        },
      },
      roomActions: { order: [] },
    };
    const normalized = normalizeUnpushedSchema100({ ...document([room]), schemaVersion: 100 });
    const [migrated] = normalized.route.biomes[0].topology.occurrences;
    const reward = migrated.state.reward;
    assert.deepEqual(reward.traitOffersByAcquisitionRole.source, {
      kind: 'traits',
      giverKey: 'Zeus',
      options: [],
      rerolledScreens: [null, null],
    });
    assert.deepEqual(reward.traitOffersByAcquisitionRole.chaos.rerolledScreens, [null]);
    assert.deepEqual(reward.levelResolutionsByAcquisitionRole.self.rerolledScreens, [
      null,
      null,
      null,
    ]);
    assert.equal(traits.rerollCount, 2);
  });

  it('moves each Shrine purchase delay onto its item and gives unbought items the default', () => {
    const shrineRoom = () => ({
      occurrenceId: 'shrine',
      gameName: 'N_Combat01',
      hermesShrine: {
        offerBySlot: {
          first: { rewardType: 'HealBigDrop' },
          secondLeft: { rewardType: 'MaxHealthDrop' },
          secondRight: null,
        },
        purchaseBySlot: { first: { delay: 6 } },
        travelDealRefill: { offer: { rewardType: 'MaxManaDrop' }, purchase: { delay: 4 } },
      },
      roomActions: {
        order: [
          { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first', rushed: true },
        ],
      },
    });
    const expected = {
      offerBySlot: {
        first: { rewardType: 'HealBigDrop', delay: 6 },
        secondLeft: { rewardType: 'MaxHealthDrop', delay: 2 },
        secondRight: null,
      },
      travelDealRefill: { offer: { rewardType: 'MaxManaDrop', delay: 4 } },
    };
    const migrated = migrateProjectDocument(document([shrineRoom()]));
    assert.deepEqual(migrated.route.biomes[0].topology.occurrences[0].hermesShrine, expected);
    const source = { ...document([shrineRoom()]), schemaVersion: 100 };
    const normalized = normalizeUnpushedSchema100(source);
    const [room] = normalized.route.biomes[0].topology.occurrences;
    assert.deepEqual(room.hermesShrine, expected);
    assert.deepEqual(room.roomActions, shrineRoom().roomActions);
    assert.equal(normalizeUnpushedSchema100(normalized), normalized);
  });
});
