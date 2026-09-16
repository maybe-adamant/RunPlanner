import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_VERSION, migrateProjectDocument } from './migrate-project-83-to-84.js';

function document() {
  return {
    schemaVersion: 83,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      biomes: [
        {
          topology: {
            occurrences: [
              {
                encounters: {
                  nemesisRandomEventByPhase: {
                    Encounter: {
                      kind: 'traitTrade',
                      traitKey: 'ApolloSpecialBoon',
                      response: 'accept',
                    },
                  },
                },
                acquisitionSites: {
                  'nemesisGenerated:Encounter': {
                    pickupEntries: {
                      result: {
                        offer: { rewardType: 'RoomMoneyTripleDrop' },
                        traitOffersByAcquisitionRole: { self: null },
                        dispositionByAcquisitionRole: { self: { kind: 'timePiece' } },
                      },
                    },
                  },
                },
                roomActions: {
                  order: [
                    { kind: 'interactEncounter', phaseKey: 'Encounter' },
                    {
                      kind: 'interactAcquisitionEntry',
                      siteKey: 'nemesisGenerated:Encounter',
                      entryKey: 'result',
                    },
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

test('preserves complete Nemesis outcomes, result children, and action identity', () => {
  const source = document();
  const original = structuredClone(source);
  const migrated = migrateProjectDocument(source);
  assert.equal(migrated.schemaVersion, 84);
  migrated.schemaVersion = 83;
  assert.deepEqual(migrated, source);
  assert.deepEqual(source, original);
});

test('preserves declined and failed dormant detail', () => {
  for (const outcome of [
    { kind: 'goldTrade', response: 'decline' },
    { kind: 'damageContest', result: 'failure' },
  ]) {
    const source = document();
    source.route.biomes[0].topology.occurrences[0].encounters.nemesisRandomEventByPhase.Encounter =
      outcome;
    assert.deepEqual(
      migrateProjectDocument(source).route.biomes[0].topology.occurrences[0].encounters
        .nemesisRandomEventByPhase.Encounter,
      outcome,
    );
  }
});
