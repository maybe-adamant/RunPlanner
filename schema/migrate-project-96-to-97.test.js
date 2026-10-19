import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-96-to-97.js';

const postboss = (gameName, extra = {}) => ({
  occurrenceId: `${gameName}:occurrence`,
  gameName,
  roomActions: { order: [{ kind: 'useFountain' }] },
  ...extra,
});

const document = ({ routeKey = 'Underworld', occurrences = [], runModifiers } = {}) => ({
  schemaVersion: 96,
  schemaRevision: 2,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey,
    itineraryBiomeKeys: ['F', 'G', 'H', 'I'],
    loadout: { fearRanks: {}, ...(runModifiers === undefined ? {} : { runModifiers }) },
    resourcePlacements: {},
    biomes: [
      {
        biomeKey: 'F',
        topology: {
          startOccurrenceId: 'opening',
          occurrences: [{ occurrenceId: 'opening', gameName: 'F_Opening01' }, ...occurrences],
          decisions: [],
          fixedRoomLinks: [],
        },
      },
      { biomeKey: 'G', topology: null },
    ],
  },
});

describe('schema 96 to 97 migration', () => {
  it('adds the empty draft spec after the route head and drops the old revision', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    assert.equal(migrated.schemaVersion, 97);
    assert.equal('schemaRevision' in migrated, false);
    assert.deepEqual(migrated.route.draft, {
      godKeys: [],
      storyNpcByBiome: {},
      fieldNpcsByBiome: {},
      basketTraitKeys: [],
      rackKeepsakeByBiome: {},
      seed: 1,
    });
    assert.deepEqual(Object.keys(migrated.route), [
      'routeKey',
      'itineraryBiomeKeys',
      'loadout',
      'resourcePlacements',
      'draft',
      'biomes',
    ]);
    assert.equal(source.schemaVersion, 96);
  });

  it('gives every rack an unchanged keepsake ranked last and keeps an authored one', () => {
    const migrated = migrateProjectDocument(
      document({
        occurrences: [
          postboss('F_PostBoss01'),
          postboss('G_PostBoss01', {
            keepsakeRack: { keepsakeKey: 'GoldPurse' },
            roomActions: { order: [{ kind: 'interactKeepsakeRack' }, { kind: 'useFountain' }] },
          }),
          { occurrenceId: 'combat', gameName: 'F_Combat01', roomActions: { order: [] } },
        ],
      }),
    );
    const [, unchanged, authored, combat] = migrated.route.biomes[0].topology.occurrences;
    assert.deepEqual(unchanged.keepsakeRack, { keepsakeKey: null });
    assert.deepEqual(unchanged.roomActions.order, [
      { kind: 'useFountain' },
      { kind: 'interactKeepsakeRack' },
    ]);
    assert.deepEqual(authored.keepsakeRack, { keepsakeKey: 'GoldPurse' });
    assert.deepEqual(authored.roomActions.order, [
      { kind: 'interactKeepsakeRack' },
      { kind: 'useFountain' },
    ]);
    assert.equal('keepsakeRack' in combat, false);
  });

  it('ranks a new rack right after the fountain on every route that has racks', () => {
    for (const [routeKey, gameName] of [
      ['Surface', 'N_PostBoss01'],
      ['Dream', 'Dream_PostBoss02'],
    ]) {
      const purchase = { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first' };
      const migrated = migrateProjectDocument(
        document({
          routeKey,
          occurrences: [
            postboss(gameName, { roomActions: { order: [{ kind: 'useFountain' }, purchase] } }),
          ],
        }),
      );
      const room = migrated.route.biomes[0].topology.occurrences[1];
      assert.deepEqual(room.keepsakeRack, { keepsakeKey: null });
      assert.deepEqual(room.roomActions.order, [
        { kind: 'useFountain' },
        { kind: 'interactKeepsakeRack' },
        purchase,
      ]);
    }
  });

  it('adds no second action for a ranked rack and keeps a keyed rack with its equip results', () => {
    const keyed = {
      keepsakeKey: 'RandomBlessingKeepsake',
      equipResults: {
        transcendentEmbryo: { blessingKey: 'ChaosHealthBlessing', blessingValues: {} },
      },
    };
    const migrated = migrateProjectDocument(
      document({
        occurrences: [
          postboss('F_PostBoss01', {
            roomActions: { order: [{ kind: 'interactKeepsakeRack' }, { kind: 'useFountain' }] },
          }),
          postboss('G_PostBoss01', {
            keepsakeRack: keyed,
            roomActions: { order: [{ kind: 'useFountain' }, { kind: 'interactKeepsakeRack' }] },
          }),
        ],
      }),
    );
    const [, ranked, withResults] = migrated.route.biomes[0].topology.occurrences;
    assert.deepEqual(ranked.keepsakeRack, { keepsakeKey: null });
    assert.deepEqual(ranked.roomActions.order, [
      { kind: 'interactKeepsakeRack' },
      { kind: 'useFountain' },
    ]);
    assert.deepEqual(withResults.keepsakeRack, keyed);
    assert.deepEqual(withResults.roomActions.order, [
      { kind: 'useFountain' },
      { kind: 'interactKeepsakeRack' },
    ]);
  });

  it('removes a rack retained on a route that has none', () => {
    const migrated = migrateProjectDocument(
      document({
        routeKey: 'FreshFile',
        occurrences: [
          postboss('F_PostBoss01', {
            keepsakeRack: { keepsakeKey: 'GoldPurse' },
            roomActions: { order: [{ kind: 'useFountain' }, { kind: 'interactKeepsakeRack' }] },
          }),
        ],
      }),
    );
    const rack = migrated.route.biomes[0].topology.occurrences[1];
    assert.equal('keepsakeRack' in rack, false);
    assert.deepEqual(rack.roomActions.order, [{ kind: 'useFountain' }]);
  });

  it('moves the Practice start point out of the run modifiers', () => {
    const startPoint = { biomeKey: 'G', point: 'preboss', gold: 300 };
    const alone = migrateProjectDocument(document({ runModifiers: { startPoint } }));
    assert.deepEqual(alone.route.practiceStart, startPoint);
    assert.equal('runModifiers' in alone.route.loadout, false);
    assert.deepEqual(Object.keys(alone.route).slice(3, 6), [
      'resourcePlacements',
      'practiceStart',
      'draft',
    ]);
    const shared = migrateProjectDocument(
      document({ runModifiers: { startPoint, enemyGoldDropChance: 40 } }),
    );
    assert.deepEqual(shared.route.loadout.runModifiers, { enemyGoldDropChance: 40 });
    assert.equal('practiceStart' in migrateProjectDocument(document()).route, false);
    // A malformed or null start point moves as written; the codec heals it on load.
    for (const malformed of [null, { biomeKey: 'G', point: 'hub' }])
      assert.deepEqual(
        migrateProjectDocument(document({ runModifiers: { startPoint: malformed } })).route
          .practiceStart,
        malformed,
      );
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 95 }),
      /expects schema 96/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-97 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema97.json');
  });
});
