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

test('53 -> 54 preserves Gorgon trigger values and removes generic DD fields', () => {
  const source = {
    schemaVersion: 53,
    catalogVersion: '0.35.0-nemesis-random-events',
    routes: [
      {
        generic: { deathDefianceConditionMet: true },
        biomes: [
          {
            topology: {
              occurrences: [
                {
                  deathDefianceConditionMet: false,
                  encounters: {
                    gorgonResultByPhase: {
                      Combat: { deathDefianceConditionMet: true },
                      Encounter: { deathDefianceConditionMet: false },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const result = migrateProjectDocument(source);
  const occurrence = result.document.routes[0].biomes[0].topology.occurrences[0];
  assert.deepEqual(occurrence.encounters.gorgonResultByPhase, {
    Combat: { athenaTriggerConditionMet: true },
    Encounter: { athenaTriggerConditionMet: false },
  });
  assert.equal('deathDefianceConditionMet' in result.document.routes[0].generic, false);
  assert.equal('deathDefianceConditionMet' in occurrence, false);
  assert.deepEqual(result.changes['53->54'], {
    gorgonTriggersRenamed: 2,
    genericConditionsRemoved: 2,
  });
  assert.deepEqual(result.changes['54->55'], { completionOccurrencesAdded: 0 });
});

test('54 -> 55 relocates completion sidecars into exact automatic occurrences', () => {
  const source = {
    schemaVersion: 54,
    catalogVersion: '0.36.0-runtime-offer-fallback',
    routes: [
      {
        biomes: [
          {
            biomeKey: 'F',
            bossCompletionArcanaKeys: ['TheSorceress'],
            bossCompletionSteadyGrowthTarget: 'Attack',
            postbossKeepsakeDisposition: { kind: 'replace', keepsakeKey: 'JeweledPom' },
            postbossRoomActions: { order: [{ kind: 'useFountain' }] },
            keepsakeEquipResults: { jeweledPom: { traitKey: 'LastGasp' } },
          },
        ],
      },
    ],
  };
  const result = migrateProjectDocument(source);
  const [boss, postboss] = result.document.routes[0].biomes[0].completionOccurrences;
  assert.equal(boss.gameName, 'F_Boss01');
  assert.deepEqual(boss.encounters.judgmentArcanaKeysByPhase, { Encounter: ['TheSorceress'] });
  assert.deepEqual(boss.encounters.steadyGrowthTargetByPhase, { Encounter: 'Attack' });
  assert.equal(postboss.gameName, 'F_PostBoss01');
  assert.deepEqual(postboss.keepsakeRack.disposition, {
    kind: 'replace',
    keepsakeKey: 'JeweledPom',
  });
  assert.deepEqual(postboss.roomActions, { order: [{ kind: 'useFountain' }] });
  assert.equal('postbossRoomActions' in result.document.routes[0].biomes[0], false);
  assert.deepEqual(result.changes['54->55'], { completionOccurrencesAdded: 2 });
});

test('51 -> current preserves prior route content and adds resource placements', () => {
  const source = schema49Project();
  source.schemaVersion = 51;
  source.catalogVersion = '0.31.0-chaos-traits';
  const result = migrateProjectDocument(source);
  assert.equal(result.document.schemaVersion, 56);
  assert.equal(result.document.catalogVersion, '0.38.0-selected-resource-successes');
  assert.deepEqual(result.changes['51->52'], {});
  assert.deepEqual(result.changes['52->53'], {
    catalogMigrations: [
      '0.32.0-run-impacting-traits->0.32.1-run-impacting-traits',
      '0.32.1-run-impacting-traits->0.33.0-generated-trait-pickups',
      '0.33.0-generated-trait-pickups->0.34.0-sea-star',
    ],
    generatedPickupSitesMoved: 0,
  });
  assert.deepEqual(result.changes['53->54'], {
    gorgonTriggersRenamed: 0,
    genericConditionsRemoved: 0,
  });
  assert.deepEqual(result.changes['54->55'], { completionOccurrencesAdded: 0 });
  assert.deepEqual(result.changes['55->56'], { routePlacementsAdded: 1 });
  assert.deepEqual(result.steps, ['51->52', '52->53', '53->54', '54->55', '55->56']);
});

test('55 -> 56 adds empty route-owned selected resource placements', () => {
  const source = schema49Project();
  source.schemaVersion = 55;
  source.catalogVersion = '0.37.0-automatic-completion-occurrences';
  const result = migrateProjectDocument(source);
  assert.equal(result.document.schemaVersion, 56);
  assert.equal(result.document.catalogVersion, '0.38.0-selected-resource-successes');
  assert.deepEqual(result.document.routes[0].resourcePlacements, {
    Pickaxe: null,
    Exorcism: null,
    Shovel: null,
    Fishing: null,
  });
  assert.deepEqual(result.changes['55->56'], { routePlacementsAdded: 1 });
});

test('52 -> current preserves the earlier schema-52 catalog migration ledger and adds resource placements', () => {
  const source = schema49Project();
  source.schemaVersion = 52;
  source.catalogVersion = '0.32.0-run-impacting-traits';
  const result = migrateProjectDocument(source);
  assert.equal(result.document.schemaVersion, 56);
  assert.equal(result.document.catalogVersion, '0.38.0-selected-resource-successes');
  assert.deepEqual(result.document.routes, [
    {
      ...source.routes[0],
      resourcePlacements: { Pickaxe: null, Exorcism: null, Shovel: null, Fishing: null },
    },
  ]);
  assert.deepEqual(result.changes['52->53'], {
    catalogMigrations: [
      '0.32.0-run-impacting-traits->0.32.1-run-impacting-traits',
      '0.32.1-run-impacting-traits->0.33.0-generated-trait-pickups',
      '0.33.0-generated-trait-pickups->0.34.0-sea-star',
    ],
    generatedPickupSitesMoved: 0,
  });
  assert.deepEqual(result.changes['53->54'], {
    gorgonTriggersRenamed: 0,
    genericConditionsRemoved: 0,
  });
  assert.deepEqual(result.changes['54->55'], { completionOccurrencesAdded: 0 });
  assert.deepEqual(result.changes['55->56'], { routePlacementsAdded: 1 });
  assert.deepEqual(result.steps, ['52->53', '53->54', '54->55', '55->56']);
});

test('52 -> current advances the prior run-impacting-traits catalog metadata', () => {
  const source = schema49Project();
  source.schemaVersion = 52;
  source.catalogVersion = '0.32.1-run-impacting-traits';
  const result = migrateProjectDocument(source);
  assert.equal(result.document.catalogVersion, '0.38.0-selected-resource-successes');
  assert.deepEqual(result.changes['52->53'], {
    catalogMigrations: [
      '0.32.1-run-impacting-traits->0.33.0-generated-trait-pickups',
      '0.33.0-generated-trait-pickups->0.34.0-sea-star',
    ],
    generatedPickupSitesMoved: 0,
  });
  assert.deepEqual(result.changes['53->54'], {
    gorgonTriggersRenamed: 0,
    genericConditionsRemoved: 0,
  });
  assert.deepEqual(result.changes['54->55'], { completionOccurrencesAdded: 0 });
  assert.deepEqual(result.changes['55->56'], { routePlacementsAdded: 1 });
  assert.deepEqual(result.steps, ['52->53', '53->54', '54->55', '55->56']);
});

test('current schema 52 -> current advances catalog metadata and adds resource placements', () => {
  const source = schema49Project();
  source.schemaVersion = 52;
  source.catalogVersion = '0.34.0-sea-star';
  const result = migrateProjectDocument(source);
  assert.equal(result.document.schemaVersion, 56);
  assert.equal(result.document.catalogVersion, '0.38.0-selected-resource-successes');
  assert.deepEqual(result.document.routes, [
    {
      ...source.routes[0],
      resourcePlacements: { Pickaxe: null, Exorcism: null, Shovel: null, Fishing: null },
    },
  ]);
  assert.deepEqual(result.changes['52->53'], {
    catalogMigrations: [],
    generatedPickupSitesMoved: 0,
  });
  assert.deepEqual(result.changes['53->54'], {
    gorgonTriggersRenamed: 0,
    genericConditionsRemoved: 0,
  });
  assert.deepEqual(result.changes['54->55'], { completionOccurrencesAdded: 0 });
  assert.deepEqual(result.changes['55->56'], { routePlacementsAdded: 1 });
  assert.deepEqual(result.steps, ['52->53', '53->54', '54->55', '55->56']);
});
