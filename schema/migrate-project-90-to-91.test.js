import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-90-to-91.js';

const pickup = (occurrenceId, generationKey) => ({
  kind: 'interactAcquisitionEntry',
  siteKey: 'hermesShrineDelivery',
  entryKey: `hermesShrineDelivery:${encodeURIComponent(
    JSON.stringify(['Surface', 'N', occurrenceId, generationKey]),
  )}`,
});

const document = () => ({
  schemaVersion: 90,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Surface',
    biomes: [
      {
        biomeKey: 'N',
        topology: {
          occurrences: [
            {
              occurrenceId: 'shrine',
              hermesShrine: {
                offerBySlot: { first: {}, secondLeft: {}, secondRight: {} },
                purchaseBySlot: {
                  secondRight: { delay: 5, rushed: true },
                  first: { delay: 2, rushed: true },
                },
                travelDealRefill: { offer: {}, purchase: { delay: 3, rushed: false } },
              },
              roomActions: {
                order: [
                  { kind: 'useFountain' },
                  pickup('elsewhere', 'initial:first'),
                  pickup('shrine', 'initial:first'),
                  pickup('shrine', 'initial:secondRight'),
                ],
              },
            },
            {
              occurrenceId: 'unpurchased',
              hermesShrine: { offerBySlot: { first: null, secondLeft: null, secondRight: null } },
              roomActions: { order: [{ kind: 'useFountain' }] },
            },
          ],
        },
      },
      { biomeKey: 'O', topology: null },
    ],
  },
});

describe('schema 90 to 91 migration', () => {
  it('moves rush onto slot-ordered purchase actions before the Shrine pickups', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    const [shrine, unpurchased] = migrated.route.biomes[0].topology.occurrences;
    assert.equal(migrated.schemaVersion, 91);
    assert.deepEqual(shrine.hermesShrine.purchaseBySlot, {
      secondRight: { delay: 5 },
      first: { delay: 2 },
    });
    assert.deepEqual(shrine.hermesShrine.travelDealRefill.purchase, { delay: 3 });
    assert.deepEqual(shrine.roomActions.order, [
      { kind: 'useFountain' },
      pickup('elsewhere', 'initial:first'),
      { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first', rushed: true },
      { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondRight', rushed: true },
      { kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill', rushed: false },
      pickup('shrine', 'initial:first'),
      pickup('shrine', 'initial:secondRight'),
    ]);
    assert.deepEqual(unpurchased, source.route.biomes[0].topology.occurrences[1]);
    assert.equal(source.schemaVersion, 90);
  });

  it('appends purchase actions when the Shrine has no ranked pickup', () => {
    const source = document();
    const occurrence = source.route.biomes[0].topology.occurrences[0];
    occurrence.roomActions.order = [{ kind: 'useFountain' }];
    const migrated = migrateProjectDocument(source);
    assert.deepEqual(
      migrated.route.biomes[0].topology.occurrences[0].roomActions.order.map(
        (reference) => reference.generationKey ?? reference.kind,
      ),
      ['useFountain', 'initial:first', 'initial:secondRight', 'travelDealRefill'],
    );
  });

  it('opens an Ephyra side room, whose purchase window precedes combat', () => {
    const source = document();
    const topology = source.route.biomes[0].topology;
    topology.decisions = [
      { kind: 'localVisit', targetsBySlot: { sideDoor1: { occurrenceId: 'shrine' } } },
    ];
    topology.occurrences[0].roomActions.order = [{ kind: 'interactEncounter', phaseKey: 'A' }];
    const migrated = migrateProjectDocument(source);
    assert.deepEqual(
      migrated.route.biomes[0].topology.occurrences[0].roomActions.order.map(
        (reference) => reference.generationKey ?? reference.kind,
      ),
      ['initial:first', 'initial:secondRight', 'travelDealRefill', 'interactEncounter'],
    );
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 89 }),
      /expects schema 90/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-91 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema91.json');
  });
});
