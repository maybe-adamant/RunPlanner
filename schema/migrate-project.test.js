import assert from 'node:assert/strict';
import { test } from 'node:test';

import { migrateProjectDocument } from './migrate-project.js';

function schema49Project() {
  return {
    schemaVersion: 49,
    projectId: 'migration-test',
    catalogVersion: '0.27.0-arcana-fear-loadout',
    routes: [
      {
        nestedReward: {
          offer: { rewardType: 'SpellDrop' },
          traitOffersByAcquisitionRole: {},
          dispositionByAcquisitionRole: { self: { kind: 'normal' } },
        },
      },
    ],
  };
}

test('49 -> 50 preserves the document and adds an unresolved SpellDrop child', () => {
  const source = schema49Project();
  const result = migrateProjectDocument(source, 50);

  assert.equal(source.schemaVersion, 49);
  assert.equal(result.document.schemaVersion, 50);
  assert.equal(result.document.catalogVersion, '0.30.0-boon-rarity-ledger');
  assert.equal(result.document.routes[0].nestedReward.traitOffersByAcquisitionRole.self, null);
  assert.deepEqual(result.steps, ['49->50']);
  assert.deepEqual(result.changes['49->50'], { unresolvedSpellDropsAdded: 1 });
});

test('49 -> 50 retains an already-authored SpellDrop child', () => {
  const source = schema49Project();
  const authored = { kind: 'traits', giverKey: 'SpellDrop' };
  source.routes[0].nestedReward.traitOffersByAcquisitionRole.self = authored;

  const result = migrateProjectDocument(source, 50);

  assert.deepEqual(
    result.document.routes[0].nestedReward.traitOffersByAcquisitionRole.self,
    authored,
  );
  assert.deepEqual(result.changes['49->50'], { unresolvedSpellDropsAdded: 0 });
});

test('50 -> 51 retains a TrialUpgrade as an explicit unresolved Chaos child', () => {
  const source = schema49Project();
  source.schemaVersion = 50;
  source.catalogVersion = '0.30.0-boon-rarity-ledger';
  source.routes[0].nestedReward.offer = { rewardType: 'TrialUpgrade' };
  const result = migrateProjectDocument(source, 51);
  assert.equal(result.document.schemaVersion, 51);
  assert.equal(result.document.catalogVersion, '0.31.0-chaos-traits');
  assert.equal(result.document.routes[0].nestedReward.traitOffersByAcquisitionRole.self, null);
  assert.deepEqual(result.changes['50->51'], { unresolvedTrialUpgradesAdded: 1 });
});

test('fails closed when a required migration step is absent', () => {
  const source = schema49Project();
  source.schemaVersion = 48;

  assert.throws(() => migrateProjectDocument(source), /no migration is registered for schema 48/);
});

test('51 -> 52 changes only schema and catalog metadata', () => {
  const source = schema49Project();
  source.schemaVersion = 51;
  source.catalogVersion = '0.31.0-chaos-traits';
  const result = migrateProjectDocument(source);
  assert.equal(result.document.schemaVersion, 52);
  assert.equal(result.document.catalogVersion, '0.32.1-run-impacting-traits');
  assert.deepEqual(result.changes['51->52'], {});
  assert.deepEqual(result.steps, [
    '51->52',
    '0.32.0-run-impacting-traits->0.32.1-run-impacting-traits',
  ]);
});

test('52 catalog migration changes only catalog metadata', () => {
  const source = schema49Project();
  source.schemaVersion = 52;
  source.catalogVersion = '0.32.0-run-impacting-traits';
  const result = migrateProjectDocument(source);
  assert.equal(result.document.schemaVersion, 52);
  assert.equal(result.document.catalogVersion, '0.32.1-run-impacting-traits');
  assert.deepEqual(result.document.routes, source.routes);
  assert.deepEqual(result.steps, ['0.32.0-run-impacting-traits->0.32.1-run-impacting-traits']);
});
