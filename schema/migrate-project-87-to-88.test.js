import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument } from './migrate-project-87-to-88.js';

const hub = (visitOrder) => ({
  kind: 'hub',
  hubKey: 'hub',
  source: { kind: 'occurrence', occurrenceId: 'prehub' },
  openTargets: [{ hubSlotKey: 'combat01', occurrenceId: 'combat01' }],
  visitOrder,
});

const document = (decisions = []) => ({
  schemaVersion: 87,
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    biomes: [
      {
        topology: {
          occurrences: [
            {
              occurrenceId: 'retained',
              unrelatedNumber: 7,
              state: {
                encounters: {
                  customizationByPhase: {
                    ordinary: { other: { kind: 'single', choiceKey: 'keep' } },
                  },
                },
              },
            },
          ],
          decisions,
        },
      },
    ],
  },
});

describe('schema 87 to 88 migration', () => {
  it('changes only the schema version of a document without a Hub', () => {
    const source = document([{ kind: 'exit', unrelated: true }]);
    const migrated = migrateProjectDocument(source);
    assert.equal(migrated.schemaVersion, 88);
    assert.equal(source.schemaVersion, 87);
    assert.deepEqual({ ...migrated, schemaVersion: 87 }, source);
  });

  it('places the Hub fountain use before retained room visits without a Phial target', () => {
    const migrated = migrateProjectDocument(document([hub(['combat01', 'combat02'])]));
    assert.deepEqual(migrated.route.biomes[0].topology.decisions[0], {
      kind: 'hub',
      hubKey: 'hub',
      source: { kind: 'occurrence', occurrenceId: 'prehub' },
      openTargets: [{ hubSlotKey: 'combat01', occurrenceId: 'combat01' }],
      actions: [
        { kind: 'useFountain' },
        { kind: 'roomVisit', hubSlotKey: 'combat01' },
        { kind: 'roomVisit', hubSlotKey: 'combat02' },
      ],
    });
    assert.deepEqual(Object.keys(migrated.route.biomes[0].topology.decisions[0]), [
      'kind',
      'hubKey',
      'source',
      'openTargets',
      'actions',
    ]);
  });

  it('places the fountain use on an empty legacy visit order too', () => {
    const migrated = migrateProjectDocument(document([hub([])]));
    assert.deepEqual(migrated.route.biomes[0].topology.decisions[0].actions, [
      { kind: 'useFountain' },
    ]);
  });

  it('rejects a legacy Hub without its room visit order', () => {
    const { visitOrder, ...withoutOrder } = hub([]);
    void visitOrder;
    assert.throws(() => migrateProjectDocument(document([withoutOrder])), /visit order/);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 86 }),
      /expects schema 87/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });
});
