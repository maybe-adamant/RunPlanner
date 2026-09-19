import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOG_VERSION, migrateProjectDocument } from './migrate-project-84-to-85.js';

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function document(routeKey = 'Underworld') {
  return {
    schemaVersion: 84,
    projectId: 'fixture',
    catalogVersion: CATALOG_VERSION,
    route: {
      routeKey,
      loadout: { weaponKey: 'WeaponStaff' },
      biomes: [
        {
          biomeKey: routeKey === 'Surface' ? 'N' : 'F',
          topology: {
            occurrences: [
              {
                occurrenceId: 'preserved-occurrence',
                encounters: {
                  selection: {
                    giverKey: 'Circe',
                    options: [
                      {
                        traitKey: 'CirceRemoveShrineUpgrade',
                        circeResolution: {
                          kind: 'disableFear',
                          vowKey: 'EnemyDamageShrineUpgrade',
                        },
                      },
                    ],
                  },
                },
                acquisitionSites: {
                  roomExit: {
                    pickupEntries: {
                      retained: {
                        traitOffersByAcquisitionRole: {
                          self: {
                            kind: 'traits',
                            giverKey: 'Icarus',
                            options: [
                              {
                                traitKey: 'UpgradeHammerBoon',
                                targetTraitKey: 'StaffDoubleAttackTrait',
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
                roomActions: { order: [{ kind: 'interactEncounter', phaseKey: 'selection' }] },
              },
            ],
          },
        },
      ],
    },
  };
}

test('initializes the ordinary full itinerary and translates only legacy singleton payloads', () => {
  const source = document();
  const original = structuredClone(source);
  const migrated = migrateProjectDocument(source);
  const occurrence = migrated.route.biomes[0].topology.occurrences[0];
  assert.equal(migrated.schemaVersion, 85);
  assert.deepEqual(Object.keys(migrated.route).slice(0, 2), ['routeKey', 'itineraryBiomeKeys']);
  assert.deepEqual(migrated.route.itineraryBiomeKeys, ['F', 'G', 'H', 'I']);
  assert.equal(occurrence.occurrenceId, 'preserved-occurrence');
  assert.deepEqual(occurrence.encounters.selection.options[0].circeResolution, {
    kind: 'disableFear',
    vowKeys: ['EnemyDamageShrineUpgrade'],
  });
  assert.deepEqual(
    occurrence.acquisitionSites.roomExit.pickupEntries.retained.traitOffersByAcquisitionRole.self
      .options[0],
    { traitKey: 'UpgradeHammerBoon', icarusHammerTargets: ['StaffDoubleAttackTrait'] },
  );
  assert.deepEqual(source, original);
});

test('preserves ordinary Surface prefixes and representative schema-84 checkpoint inputs', async () => {
  const source = document('Surface');
  source.route.biomes.push({ biomeKey: 'O', topology: null });
  assert.deepEqual(migrateProjectDocument(source).route.itineraryBiomeKeys, ['N', 'O', 'P', 'Q']);
  for (const name of [
    'underworld-fghi-schema84.runplanner.json',
    'surface-nopq-schema84.runplanner.json',
  ]) {
    const baseline = JSON.parse(await readFile(join(fixtureDirectory, name), 'utf8'));
    const migrated = migrateProjectDocument(baseline);
    assert.equal(migrated.schemaVersion, 85);
    assert.deepEqual(
      migrated.route.itineraryBiomeKeys,
      migrated.route.routeKey === 'Underworld' ? ['F', 'G', 'H', 'I'] : ['N', 'O', 'P', 'Q'],
    );
    assert.deepEqual(migrated.route.biomes, baseline.route.biomes);
  }
});

test('rejects stale catalog/schema and routes whose itinerary cannot be inferred', () => {
  assert.throws(
    () => migrateProjectDocument({ ...document(), schemaVersion: 83 }),
    /expects schema 84/,
  );
  assert.throws(
    () => migrateProjectDocument({ ...document(), catalogVersion: 'stale' }),
    /expects catalog/,
  );
  assert.throws(() => migrateProjectDocument(document('Dream')), /cannot infer an itinerary/);
});

test('preserves an incomplete Fear choice as the final repairable empty selection', () => {
  const source = document();
  source.route.biomes[0].topology.occurrences[0].encounters.selection.options[0].circeResolution = {
    kind: 'disableFear',
    vowKey: null,
  };
  assert.deepEqual(
    migrateProjectDocument(source).route.biomes[0].topology.occurrences[0].encounters.selection
      .options[0].circeResolution,
    { kind: 'disableFear', vowKeys: [] },
  );
});
