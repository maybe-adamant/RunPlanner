import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_VERSION, migrateProjectDocument, outputPath } from './migrate-project-79-to-80.js';

const prefix = 'clockedTraitGenerated:';
function legacyEntryKey(identity, sequence, pickupKey) {
  return `${prefix}${encodeURIComponent(`${identity}:${sequence}`)}:${encodeURIComponent(pickupKey)}`;
}

const sourceIdentity = JSON.stringify([
  'traitOffer',
  'Surface',
  'O',
  JSON.stringify([
    'encounterPhase',
    'Surface',
    'O',
    { kind: 'occurrence', occurrenceId: 'surface-o-combat01' },
    'Combat1',
  ]),
  'selection',
]);

function document() {
  const first = legacyEntryKey(sourceIdentity, 339, 'pom1');
  const second = legacyEntryKey(sourceIdentity, 339, 'pom2');
  return {
    schemaVersion: 79,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      routeKey: 'Surface',
      biomes: [
        {
          biomeKey: 'Q',
          state: {},
          topology: {
            occurrences: [
              {
                acquisitionSites: {
                  roomExit: {
                    pickupEntries: {
                      [first]: {
                        offer: { rewardType: 'StoreRewardRandomStack' },
                        traitOffersByAcquisitionRole: {
                          self: { kind: 'traits', selectedOptionKey: 'option1' },
                        },
                        dispositionByAcquisitionRole: { self: { kind: 'normal' } },
                      },
                      [second]: {
                        offer: { rewardType: 'StoreRewardRandomStack' },
                        traitOffersByAcquisitionRole: {},
                        dispositionByAcquisitionRole: { self: { kind: 'timePiece' } },
                      },
                    },
                  },
                },
                roomActions: {
                  order: [
                    {
                      kind: 'interactIncomingReward',
                      producerPoint: 'roomRewardPickup',
                      acquisitionRole: 'self',
                    },
                    { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: first },
                    { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: second },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

test('rekeys clocked entries and matching actions while preserving authored detail and order', () => {
  const source = document();
  const first = Object.keys(
    source.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries,
  )[0];
  const second = Object.keys(
    source.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries,
  )[1];
  const result = migrateProjectDocument(source);
  const occurrence = result.route.biomes[0].topology.occurrences[0];
  const stableFirst = `${prefix}${encodeURIComponent(sourceIdentity)}:pom1`;
  const stableSecond = `${prefix}${encodeURIComponent(sourceIdentity)}:pom2`;
  assert.equal(result.schemaVersion, 80);
  assert.deepEqual(Object.keys(occurrence.acquisitionSites.roomExit.pickupEntries), [
    stableFirst,
    stableSecond,
  ]);
  assert.deepEqual(
    occurrence.acquisitionSites.roomExit.pickupEntries[stableFirst],
    source.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries[first],
  );
  assert.deepEqual(
    occurrence.acquisitionSites.roomExit.pickupEntries[stableSecond],
    source.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries[second],
  );
  assert.deepEqual(occurrence.roomActions.order, [
    { kind: 'interactIncomingReward', producerPoint: 'roomRewardPickup', acquisitionRole: 'self' },
    { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: stableFirst },
    { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey: stableSecond },
  ]);
  assert.equal(source.schemaVersion, 79);
  assert.equal(source.route.biomes[0].topology.occurrences[0].roomActions.order[1].entryKey, first);
});

test('rejects a true migrated-key collision instead of overwriting an entry', () => {
  const source = document();
  const entries =
    source.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries;
  entries[`${prefix}${encodeURIComponent(sourceIdentity)}:pom1`] = null;
  assert.throws(() => migrateProjectDocument(source), /migrated-key collision/);
});

test('leaves opaque clocked identities ending in a sequence untouched', () => {
  const source = document();
  const opaque = legacyEntryKey('opaque-source', 339, 'unrelated');
  const entries =
    source.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries;
  entries[opaque] = { untouched: true };
  const result = migrateProjectDocument(source);
  assert.deepEqual(
    result.route.biomes[0].topology.occurrences[0].acquisitionSites.roomExit.pickupEntries[opaque],
    { untouched: true },
  );
});

test('rejects stale input schema or catalog', () => {
  assert.throws(() => migrateProjectDocument({ schemaVersion: 80 }), /expects schema 79/);
  assert.throws(
    () => migrateProjectDocument({ schemaVersion: 79, catalogVersion: 'old' }),
    /expects catalog 0\.55\.0-anvil-of-fates/,
  );
});

test('names migrated files with schema 80', () => {
  assert.equal(outputPath('/tmp/plan.json'), '/tmp/plan-schema80.json');
});
