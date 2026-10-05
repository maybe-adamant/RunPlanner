import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-91-to-92.js';

const anvil = (extra = {}) => ({
  offer: { rewardType: 'ChaosWeaponUpgrade' },
  traitOffersByAcquisitionRole: {},
  ...extra,
  dispositionByAcquisitionRole: { self: { kind: 'normal' } },
});
const result = {
  kind: 'anvilOfFates',
  removedTraitKey: 'StaffDoubleAttackTrait',
  addedTraitKeys: ['StaffDashAttackTrait', 'StaffTripleShotTrait'],
};

const document = () => ({
  schemaVersion: 91,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Underworld',
    biomes: [
      {
        biomeKey: 'I',
        topology: {
          occurrences: [
            {
              occurrenceId: 'shop',
              state: {
                kind: 'shop',
                shop: {
                  profileKey: 'I_WorldShop',
                  offers: {
                    PremiumProgress: {
                      optionKey: 'ChaosWeaponUpgrade',
                      reward: anvil(),
                      anvilResult: result,
                    },
                    Survival: {
                      optionKey: 'HealBigDrop',
                      reward: {
                        offer: { rewardType: 'HealBigDrop' },
                        traitOffersByAcquisitionRole: {},
                        dispositionByAcquisitionRole: { self: { kind: 'normal' } },
                      },
                    },
                    MetaProgress: { optionKey: null, reward: null },
                  },
                },
              },
              acquisitionSites: { roomExit: { pickupEntries: { echoDoubleShopReward: anvil() } } },
            },
          ],
        },
      },
      { biomeKey: 'O', topology: null },
    ],
  },
});

describe('schema 91 to 92 migration', () => {
  it('moves a Shop Anvil result onto its reward role and leaves other rewards unchanged', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    const [shop] = migrated.route.biomes[0].topology.occurrences;
    const sourceShop = source.route.biomes[0].topology.occurrences[0];
    assert.equal(migrated.schemaVersion, 92);
    assert.deepEqual(shop.state.shop.offers.PremiumProgress, {
      optionKey: 'ChaosWeaponUpgrade',
      reward: anvil({ anvilResultsByAcquisitionRole: { self: result } }),
    });
    assert.deepEqual(shop.state.shop.offers.Survival, sourceShop.state.shop.offers.Survival);
    assert.deepEqual(shop.state.shop.offers.MetaProgress, { optionKey: null, reward: null });
    assert.equal(source.schemaVersion, 91);
    assert.equal(sourceShop.state.shop.offers.PremiumProgress.anvilResult, result);
  });

  it('adds an unauthored result to a Gold duplicate carrying an Anvil', () => {
    const migrated = migrateProjectDocument(document());
    assert.deepEqual(
      migrated.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries
        .echoDoubleShopReward,
      anvil({ anvilResultsByAcquisitionRole: { self: null } }),
    );
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 90 }),
      /expects schema 91/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-92 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema92.json');
  });
});
