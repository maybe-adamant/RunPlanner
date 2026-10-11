import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-95-to-96.js';

const document = (decisions) => ({
  schemaVersion: 95,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Surface',
    itineraryBiomeKeys: ['N', 'O', 'P', 'Q'],
    loadout: { fearRanks: { BossDifficultyShrineUpgrade: 0 } },
    biomes: [
      {
        biomeKey: 'N',
        topology: {
          startOccurrenceId: 'opening',
          occurrences: [{ occurrenceId: 'opening' }, { occurrenceId: 'prehub' }],
          decisions,
          fixedRoomLinks: [],
        },
      },
    ],
  },
});

const hub = {
  kind: 'hub',
  hubKey: 'hub',
  source: { kind: 'occurrence', occurrenceId: 'prehub' },
  openTargets: [],
  actions: [],
};

describe('schema 95 to 96 migration', () => {
  it('gives a Hub without its completed exit the Preboss, Boss and Postboss chain', () => {
    const source = document([hub]);
    const migrated = migrateProjectDocument(source);
    const topology = migrated.route.biomes[0].topology;
    assert.equal(migrated.schemaVersion, 96);
    assert.deepEqual(
      topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence.gameName]),
      [
        ['opening', undefined],
        ['prehub', undefined],
        ['N:preboss', 'N_PreBoss01'],
        ['N:preboss:boss', 'N_Boss01'],
        ['N:preboss:postboss', 'N_PostBoss01'],
      ],
    );
    assert.deepEqual(topology.decisions[1].normal.targets, [
      { exitKey: 'preboss', occurrenceId: 'N:preboss' },
    ]);
    assert.deepEqual(topology.fixedRoomLinks, [
      { sourceOccurrenceId: 'N:preboss', targetOccurrenceId: 'N:preboss:boss' },
      { sourceOccurrenceId: 'N:preboss:boss', targetOccurrenceId: 'N:preboss:postboss' },
    ]);
    assert.equal(source.schemaVersion, 95);
  });

  it('leaves a document without a Hub unchanged apart from its version', () => {
    const source = document([]);
    assert.deepEqual({ ...migrateProjectDocument(source), schemaVersion: 95 }, source);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document([]), schemaVersion: 94 }),
      /expects schema 95/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document([]), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-96 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema96.json');
  });
});
