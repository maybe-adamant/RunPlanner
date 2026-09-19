import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATALOG_VERSION, migrateProjectDocument } from './migrate-project-85-to-86.js';

function document(reward) {
  return {
    schemaVersion: 85,
    catalogVersion: CATALOG_VERSION,
    route: {
      loadout: { weaponKey: 'Weapon', aspectKey: 'Aspect' },
      biomes: [
        {
          topology: {
            startOccurrenceId: 'F:start',
            occurrences: [
              {
                occurrenceId: 'F:start',
                state:
                  reward === null ? { kind: 'counted', reward: null } : { kind: 'counted', reward },
              },
              {
                occurrenceId: 'F:later',
                state: { kind: 'counted', reward: { offer: { rewardType: 'Gold' } } },
              },
            ],
          },
        },
      ],
    },
  };
}

test('moves only the first topology start offer and preserves its acquisition payload', () => {
  const reward = {
    offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
    traitOffersByAcquisitionRole: { source: { kind: 'traits', giverKey: 'Poseidon' } },
    dispositionByAcquisitionRole: { source: { kind: 'normal' } },
  };
  const source = document(reward);
  const seaStarDuplicate = {
    offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
    traitOffersByAcquisitionRole: { source: { kind: 'traits', giverKey: 'Poseidon' } },
    dispositionByAcquisitionRole: { source: { kind: 'normal' } },
  };
  source.route.biomes[0].topology.occurrences[0].acquisitionSites = {
    'seaStarDuplicate:source:source': { pickupEntries: { seaStarDuplicate } },
  };
  source.route.biomes[0].topology.occurrences[0].roomActions = {
    order: [
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'seaStarDuplicate:source:source',
        entryKey: 'seaStarDuplicate',
      },
    ],
  };
  const migrated = migrateProjectDocument(source);
  const start = migrated.route.biomes[0].topology.occurrences[0];
  assert.deepEqual(migrated.route.loadout.startingReward, reward.offer);
  assert.deepEqual(start.startingRewardAcquisition, {
    traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
    dispositionByAcquisitionRole: reward.dispositionByAcquisitionRole,
  });
  assert.deepEqual(start.state, { kind: 'none' });
  assert.deepEqual(
    start.acquisitionSites['seaStarDuplicate:source:source'].pickupEntries.seaStarDuplicate,
    seaStarDuplicate,
  );
  assert.equal(
    migrated.route.biomes[0].topology.occurrences[1].state.reward.offer.rewardType,
    'Gold',
  );
});

test('retains null/unconfigured starts as an unset route choice', () => {
  const nullStart = migrateProjectDocument(document(null));
  assert.equal(nullStart.route.loadout.startingReward, null);
  assert.deepEqual(nullStart.route.biomes[0].topology.occurrences[0].state, { kind: 'none' });
  const unconfigured = migrateProjectDocument({
    schemaVersion: 85,
    catalogVersion: CATALOG_VERSION,
    route: { loadout: {}, biomes: [] },
  });
  assert.equal(unconfigured.route.loadout.startingReward, null);
});
