import assert from 'node:assert/strict';
import { test } from 'node:test';

import { migrateProjectDocument } from './migrate-project.js';

function schema67CompletionSource(routeKey, biomeKeys, resourcePlacements = {}) {
  return {
    schemaVersion: 67,
    projectId: `schema-67-${routeKey.toLowerCase()}`,
    catalogVersion: '0.48.0-hex-talent-layouts',
    routes: [
      {
        routeKey,
        resourcePlacements,
        biomes: biomeKeys.map((biomeKey) => ({
          biomeKey,
          topology: {
            startOccurrenceId: `${biomeKey.toLowerCase()}-preboss`,
            occurrences: [
              {
                occurrenceId: `${biomeKey.toLowerCase()}-preboss`,
                gameName: `${biomeKey}_PreBoss01`,
              },
            ],
            decisions: [],
          },
          completionOccurrences: [
            { occurrenceId: `completion:${biomeKey}:boss`, gameName: `${biomeKey}_Boss01` },
            {
              occurrenceId: `completion:${biomeKey}:postboss`,
              gameName: `${biomeKey}_PostBoss01`,
            },
          ],
        })),
      },
    ],
  };
}

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

test('66 -> 67 removes retained rack no-ops and compacts replacement racks', () => {
  const source = {
    schemaVersion: 66,
    projectId: 'keepsake-rack-migration',
    catalogVersion: '0.48.0-hex-talent-layouts',
    routes: [
      {
        completionOccurrences: [
          {
            keepsakeRack: { disposition: { kind: 'retain' } },
          },
          {
            keepsakeRack: {
              disposition: { kind: 'replace', keepsakeKey: 'TempHammerKeepsake' },
              equipResults: { experimentalHammer: { kind: 'exhausted' } },
            },
          },
        ],
      },
    ],
  };
  const result = migrateProjectDocument(source, 67);
  assert.equal(result.document.schemaVersion, 67);
  assert.equal('keepsakeRack' in result.document.routes[0].completionOccurrences[0], false);
  assert.deepEqual(result.document.routes[0].completionOccurrences[1].keepsakeRack, {
    keepsakeKey: 'TempHammerKeepsake',
    equipResults: { experimentalHammer: { kind: 'exhausted' } },
  });
  assert.deepEqual(result.steps, ['66->67']);
  assert.deepEqual(result.changes['66->67'], {
    retainedRacksRemoved: 1,
    replacementRacksCompacted: 1,
  });
});

test('61 -> 62 updates the Concave Stone catalog boundary without rewriting authored state', () => {
  const source = {
    schemaVersion: 61,
    projectId: 'concave-stone-migration',
    catalogVersion: '0.43.0-crystal-figurine',
    routes: [{ preserved: { nested: true } }],
  };
  const result = migrateProjectDocument(source, 62);

  assert.deepEqual(source, {
    schemaVersion: 61,
    projectId: 'concave-stone-migration',
    catalogVersion: '0.43.0-crystal-figurine',
    routes: [{ preserved: { nested: true } }],
  });
  assert.deepEqual(result.document, {
    schemaVersion: 62,
    projectId: 'concave-stone-migration',
    catalogVersion: '0.44.0-concave-stone',
    routes: [{ preserved: { nested: true } }],
  });
  assert.deepEqual(result.steps, ['61->62']);
  assert.deepEqual(result.changes['61->62'], {});
});

test('62 -> 63 updates the Transcendent Embryo catalog boundary without rewriting authored state', () => {
  const source = {
    schemaVersion: 62,
    projectId: 'transcendent-embryo-migration',
    catalogVersion: '0.44.0-concave-stone',
    routes: [{ preserved: { nested: true } }],
  };
  const result = migrateProjectDocument(source, 63);

  assert.deepEqual(source, {
    schemaVersion: 62,
    projectId: 'transcendent-embryo-migration',
    catalogVersion: '0.44.0-concave-stone',
    routes: [{ preserved: { nested: true } }],
  });
  assert.deepEqual(result.document, {
    schemaVersion: 63,
    projectId: 'transcendent-embryo-migration',
    catalogVersion: '0.46.0-vow-forfeit-red-onion',
    routes: [{ preserved: { nested: true } }],
  });
  assert.deepEqual(result.steps, ['62->63']);
  assert.deepEqual(result.changes['62->63'], {});
});

test('63 -> 64 updates the Persephone catalog boundary without inventing optional bonuses', () => {
  const source = {
    schemaVersion: 63,
    projectId: 'persephone-effective-levels-migration',
    catalogVersion: '0.46.0-vow-forfeit-red-onion',
    routes: [
      {
        biomes: [
          {
            topology: {
              occurrences: [
                {
                  encounters: {
                    traitOffersByPhase: {
                      Encounter: {
                        Boon: {
                          options: [
                            { traitKey: 'AphroditeAttackBoon' },
                            { traitKey: 'AphroditeSpecialBoon' },
                            { traitKey: 'AphroditeCastBoon' },
                          ],
                        },
                      },
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

  const result = migrateProjectDocument(source, 67);

  assert.deepEqual(source, {
    schemaVersion: 63,
    projectId: 'persephone-effective-levels-migration',
    catalogVersion: '0.46.0-vow-forfeit-red-onion',
    routes: [
      {
        biomes: [
          {
            topology: {
              occurrences: [
                {
                  encounters: {
                    traitOffersByPhase: {
                      Encounter: {
                        Boon: {
                          options: [
                            { traitKey: 'AphroditeAttackBoon' },
                            { traitKey: 'AphroditeSpecialBoon' },
                            { traitKey: 'AphroditeCastBoon' },
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.deepEqual(result.document, {
    ...source,
    schemaVersion: 67,
    catalogVersion: '0.48.0-hex-talent-layouts',
  });
  assert.deepEqual(result.steps, ['63->64', '64->65', '65->66', '66->67']);
  assert.deepEqual(result.changes['63->64'], {});
  assert.deepEqual(result.changes['64->65'], {
    spellHexTreesDefaulted: 0,
    aspectHexTreesDefaulted: 0,
  });
  assert.deepEqual(result.changes['65->66'], { chaosOffersMigrated: 0 });
  assert.deepEqual(result.changes['66->67'], {
    retainedRacksRemoved: 0,
    replacementRacksCompacted: 0,
  });
  assert.equal(
    'persephoneLevelBonus' in
      result.document.routes[0].biomes[0].topology.occurrences[0].encounters.traitOffersByPhase
        .Encounter.Boon.options[0],
    false,
  );
});

test('64 -> 65 defaults every resolved SpellDrop role and only the route-owned Selene loadout', () => {
  const source = {
    schemaVersion: 64,
    projectId: 'hex-tree-migration',
    catalogVersion: '0.47.0-persephone-effective-levels',
    routes: [
      {
        loadout: { aspectKey: 'SuitHexAspect' },
        biomes: [
          {
            topology: {
              occurrences: [
                {
                  aspectKey: 'SuitHexAspect',
                  aspectHexTree: { preserved: true },
                  encounters: {
                    spellDrop: {
                      offer: { rewardType: 'SpellDrop' },
                      traitOffersByAcquisitionRole: {
                        self: {
                          kind: 'traits',
                          giverKey: 'SpellDrop',
                          options: [
                            { traitKey: 'SpellPolymorphTrait' },
                            { traitKey: 'SpellMeteorTrait' },
                            { traitKey: 'SpellTransformTrait' },
                          ],
                          selectedOptionKey: 'option1',
                        },
                        gift: {
                          kind: 'traits',
                          giverKey: 'SpellDrop',
                          options: [
                            { traitKey: 'SpellMeteorTrait' },
                            { traitKey: 'SpellTransformTrait' },
                            { traitKey: 'SpellLeapTrait' },
                          ],
                          selectedOptionKey: 'option2',
                        },
                        echo: {
                          kind: 'traits',
                          giverKey: 'SpellDrop',
                          options: [
                            { traitKey: 'SpellLaserTrait' },
                            { traitKey: 'SpellSummonTrait' },
                            { traitKey: 'SpellPotionTrait' },
                          ],
                          selectedOptionKey: 'option3',
                        },
                        unresolved: null,
                      },
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

  const result = migrateProjectDocument(source, 65);
  const roles =
    result.document.routes[0].biomes[0].topology.occurrences[0].encounters.spellDrop
      .traitOffersByAcquisitionRole;
  for (const role of ['self', 'gift', 'echo']) {
    assert.deepEqual(roles[role].hexTree, {
      layoutKey: 'Lung',
      rareTalentKeys: expectRareDefaults(roles[role].selectedOptionKey, roles[role].options),
      epicTalentKeys: expectEpicDefaults(roles[role].selectedOptionKey, roles[role].options),
    });
  }
  assert.equal(roles.unresolved, null);
  assert.deepEqual(result.document.routes[0].loadout.aspectHexTree, {
    layoutKey: 'Lung',
    rareTalentKeys: ['MoonBeamConsecutiveDamageTalent', 'MoonBeamDefenseTalent'],
    epicTalentKeys: ['MoonBeamTargetTalent'],
  });
  assert.deepEqual(result.document.routes[0].biomes[0].topology.occurrences[0].aspectHexTree, {
    preserved: true,
  });
  assert.deepEqual(result.changes['64->65'], {
    spellHexTreesDefaulted: 3,
    aspectHexTreesDefaulted: 1,
  });
});

function expectRareDefaults(selectedOptionKey, options) {
  const traitKey = options[{ option1: 0, option2: 1, option3: 2 }[selectedOptionKey]].traitKey;
  return {
    SpellPolymorphTrait: ['PolymorphBossDamageTalent', 'PolymorphDeathExplodeTalent'],
    SpellMeteorTrait: ['MeteorVulnerabilityDecalTalent', 'MeteorSlowDecalTalent'],
    SpellTransformTrait: ['TransformCastDamageTalent', 'TransformLastStandRechargeTalent'],
    SpellLeapTrait: ['LeapLaunchAoETalent', 'LeapAoETalent'],
    SpellLaserTrait: ['LaserAoETalent', 'LaserStartAoETalent'],
    SpellSummonTrait: ['SummonSpeedTalent', 'SummonTeleportTalent'],
    SpellPotionTrait: ['DamageBuffTalent', 'ShieldTalent'],
  }[traitKey];
}

function expectEpicDefaults(selectedOptionKey, options) {
  const traitKey = options[{ option1: 0, option2: 1, option3: 2 }[selectedOptionKey]].traitKey;
  return {
    SpellPolymorphTrait: ['PolymorphSandwichTalent'],
    SpellMeteorTrait: ['MeteorInvulnerableChargeTalent'],
    SpellTransformTrait: ['TransformPrimaryTalent'],
    SpellLeapTrait: ['LeapShieldTalent'],
    SpellLaserTrait: ['LaserTripleTalent'],
    SpellSummonTrait: ['SummonDamageSplitTalent'],
    SpellPotionTrait: ['ClearCastTalent'],
  }[traitKey];
}

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
  const result = migrateProjectDocument(source, 58);
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
  assert.deepEqual(result.changes['55->56'], { routePlacementsAdded: 1 });
  assert.deepEqual(result.changes['56->57'], { poolsAdded: 0 });
  assert.deepEqual(result.changes['57->58'], { shrinesAdded: 0 });
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
  const result = migrateProjectDocument(source, 55);
  const [boss, postboss] = result.document.routes[0].biomes[0].completionOccurrences;
  assert.equal(boss.gameName, 'F_Boss01');
  assert.deepEqual(boss.encounters.judgmentArcanaKeysByPhase, { Encounter: ['TheSorceress'] });
  assert.deepEqual(boss.encounters.steadyGrowthTargetByPhase, { Encounter: 'Attack' });
  assert.equal(postboss.gameName, 'F_PostBoss01');
  assert.deepEqual(postboss.keepsakeRack, {
    disposition: { kind: 'replace', keepsakeKey: 'JeweledPom' },
    equipResults: { jeweledPom: { traitKey: 'LastGasp' } },
  });
  assert.deepEqual(postboss.roomActions, { order: [{ kind: 'useFountain' }] });
  assert.equal('postbossRoomActions' in result.document.routes[0].biomes[0], false);
  assert.deepEqual(result.changes['54->55'], { completionOccurrencesAdded: 2 });
});

test('51 -> current preserves prior route content and adds resource placements', () => {
  const source = schema49Project();
  source.schemaVersion = 51;
  source.catalogVersion = '0.31.0-chaos-traits';
  const result = migrateProjectDocument(source, 67);
  assert.equal(result.document.schemaVersion, 67);
  assert.equal(result.document.catalogVersion, '0.48.0-hex-talent-layouts');
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
  assert.deepEqual(result.changes['56->57'], { poolsAdded: 0 });
  assert.deepEqual(result.changes['57->58'], { shrinesAdded: 0 });
  assert.deepEqual(result.steps, [
    '51->52',
    '52->53',
    '53->54',
    '54->55',
    '55->56',
    '56->57',
    '57->58',
    '58->59',
    '59->60',
    '60->61',
    '61->62',
    '62->63',
    '63->64',
    '64->65',
    '65->66',
    '66->67',
  ]);
  assert.deepEqual(result.changes['63->64'], {});
  assert.deepEqual(result.changes['64->65'], {
    spellHexTreesDefaulted: 0,
    aspectHexTreesDefaulted: 0,
  });
  assert.deepEqual(result.changes['65->66'], { chaosOffersMigrated: 0 });
});

test('50 -> current advances the full external migration chain through the Hermes Shrine boundary', () => {
  const source = schema49Project();
  source.schemaVersion = 50;
  source.catalogVersion = '0.30.0-boon-rarity-ledger';
  source.routes[0].nestedReward.traitOffersByAcquisitionRole.self = null;

  const result = migrateProjectDocument(source, 67);

  assert.equal(result.document.schemaVersion, 67);
  assert.equal(result.document.catalogVersion, '0.48.0-hex-talent-layouts');
  assert.deepEqual(result.steps, [
    '50->51',
    '51->52',
    '52->53',
    '53->54',
    '54->55',
    '55->56',
    '56->57',
    '57->58',
    '58->59',
    '59->60',
    '60->61',
    '61->62',
    '62->63',
    '63->64',
    '64->65',
    '65->66',
    '66->67',
  ]);
  assert.deepEqual(result.changes['65->66'], { chaosOffersMigrated: 0 });
  assert.deepEqual(result.changes['50->51'], { unresolvedTrialUpgradesAdded: 0 });
  assert.deepEqual(result.changes['57->58'], { shrinesAdded: 0 });
});

test('55 -> 56 adds empty route-owned selected resource placements', () => {
  const source = schema49Project();
  source.schemaVersion = 55;
  source.catalogVersion = '0.37.0-automatic-completion-occurrences';
  const result = migrateProjectDocument(source, 56);
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
  const result = migrateProjectDocument(source, 67);
  assert.equal(result.document.schemaVersion, 67);
  assert.equal(result.document.catalogVersion, '0.48.0-hex-talent-layouts');
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
  assert.deepEqual(result.changes['56->57'], { poolsAdded: 0 });
  assert.deepEqual(result.changes['57->58'], { shrinesAdded: 0 });
  assert.deepEqual(result.steps, [
    '52->53',
    '53->54',
    '54->55',
    '55->56',
    '56->57',
    '57->58',
    '58->59',
    '59->60',
    '60->61',
    '61->62',
    '62->63',
    '63->64',
    '64->65',
    '65->66',
    '66->67',
  ]);
  assert.deepEqual(result.changes['65->66'], { chaosOffersMigrated: 0 });
});

test('52 -> current advances the prior run-impacting-traits catalog metadata', () => {
  const source = schema49Project();
  source.schemaVersion = 52;
  source.catalogVersion = '0.32.1-run-impacting-traits';
  const result = migrateProjectDocument(source, 67);
  assert.equal(result.document.catalogVersion, '0.48.0-hex-talent-layouts');
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
  assert.deepEqual(result.changes['56->57'], { poolsAdded: 0 });
  assert.deepEqual(result.changes['57->58'], { shrinesAdded: 0 });
  assert.deepEqual(result.steps, [
    '52->53',
    '53->54',
    '54->55',
    '55->56',
    '56->57',
    '57->58',
    '58->59',
    '59->60',
    '60->61',
    '61->62',
    '62->63',
    '63->64',
    '64->65',
    '65->66',
    '66->67',
  ]);
  assert.deepEqual(result.changes['65->66'], { chaosOffersMigrated: 0 });
});

test('current schema 52 -> current advances catalog metadata and adds resource placements', () => {
  const source = schema49Project();
  source.schemaVersion = 52;
  source.catalogVersion = '0.34.0-sea-star';
  const result = migrateProjectDocument(source, 67);
  assert.equal(result.document.schemaVersion, 67);
  assert.equal(result.document.catalogVersion, '0.48.0-hex-talent-layouts');
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
  assert.deepEqual(result.changes['56->57'], { poolsAdded: 0 });
  assert.deepEqual(result.changes['57->58'], { shrinesAdded: 0 });
  assert.deepEqual(result.steps, [
    '52->53',
    '53->54',
    '54->55',
    '55->56',
    '56->57',
    '57->58',
    '58->59',
    '59->60',
    '60->61',
    '61->62',
    '62->63',
    '63->64',
    '64->65',
    '65->66',
    '66->67',
  ]);
  assert.deepEqual(result.changes['65->66'], { chaosOffersMigrated: 0 });
});

test('57 -> 58 seeds Shrine shells only on exact forced Surface Postboss identities', () => {
  const source = {
    schemaVersion: 57,
    catalogVersion: '0.39.0-purging-pool',
    projectId: 'hermes-migration',
    routes: [
      {
        routeKey: 'Surface',
        preserved: { nested: true },
        biomes: [
          {
            biomeKey: 'N',
            completionOccurrences: [
              { occurrenceId: 'completion:N:postboss', gameName: 'N_PostBoss01' },
              { occurrenceId: 'completion:N:notpostboss', gameName: 'N_PostBoss01' },
            ],
            topology: {
              occurrences: [{ occurrenceId: 'ordinary:fake', gameName: 'N_PostBoss01' }],
            },
          },
          {
            biomeKey: 'O',
            completionOccurrences: [
              {
                occurrenceId: 'completion:O:postboss',
                gameName: 'O_PostBoss01',
                hermesShrine: { malformedRetainedState: true },
              },
            ],
          },
          {
            biomeKey: 'P',
            completionOccurrences: [
              { occurrenceId: 'completion:P:postboss', gameName: 'P_PostBoss01' },
              { occurrenceId: 'completion:P:postboss', gameName: 'N_PostBoss01' },
            ],
          },
          {
            biomeKey: 'Q',
            completionOccurrences: [
              { occurrenceId: 'completion:N:postboss', gameName: 'N_PostBoss01' },
            ],
          },
        ],
      },
      {
        routeKey: 'Underworld',
        biomes: [
          {
            biomeKey: 'N',
            completionOccurrences: [
              { occurrenceId: 'completion:N:postboss', gameName: 'N_PostBoss01' },
            ],
          },
        ],
      },
    ],
  };

  const result = migrateProjectDocument(source, 58);
  const biomes = result.document.routes[0].biomes;
  assert.equal(result.document.schemaVersion, 58);
  assert.equal(result.document.catalogVersion, '0.40.0-hermes-shrine');
  assert.deepEqual(result.steps, ['57->58']);
  assert.deepEqual(result.changes['57->58'], { shrinesAdded: 2 });
  for (const [biomeIndex, occurrenceIndex] of [
    [0, 0],
    [2, 0],
  ]) {
    assert.deepEqual(biomes[biomeIndex].completionOccurrences[occurrenceIndex].hermesShrine, {
      offerBySlot: { first: null, secondLeft: null, secondRight: null },
    });
  }
  assert.equal('hermesShrine' in biomes[0].completionOccurrences[1], false);
  assert.equal('hermesShrine' in biomes[0].topology.occurrences[0], false);
  assert.equal('hermesShrine' in biomes[2].completionOccurrences[1], false);
  assert.deepEqual(biomes[1].completionOccurrences[0].hermesShrine, {
    malformedRetainedState: true,
  });
  assert.equal('hermesShrine' in biomes[3].completionOccurrences[0], false);
  assert.equal(
    'hermesShrine' in result.document.routes[1].biomes[0].completionOccurrences[0],
    false,
  );
  assert.deepEqual(result.document.routes[0].preserved, { nested: true });
});

test('57 -> 58 rejects a document from the wrong prior catalog', () => {
  assert.throws(
    () =>
      migrateProjectDocument({
        schemaVersion: 57,
        catalogVersion: '0.38.0-selected-resource-successes',
        routes: [],
      }),
    /schema 57 migration expects catalog 0\.39\.0-purging-pool/,
  );
});

test('68 -> 69 narrows Shrine inventory and preserves rushed pickup detail at acquisition', () => {
  const oldReward = {
    offer: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'Apollo' } },
    traitOffersByAcquisitionRole: { self: null },
    dispositionByAcquisitionRole: { self: { kind: 'normal' } },
  };
  const source = {
    schemaVersion: 68,
    catalogVersion: '0.49.0-completion-topology',
    projectId: 'shrine-acquisition-boundary',
    routes: [
      {
        routeKey: 'Surface',
        biomes: [
          {
            biomeKey: 'N',
            topology: {
              occurrences: [
                {
                  occurrenceId: 'n-postboss',
                  gameName: 'N_PostBoss01',
                  hermesShrine: {
                    offerBySlot: {
                      first: oldReward,
                      secondLeft: null,
                      secondRight: null,
                    },
                    purchaseBySlot: { first: { delay: 2, rushed: true } },
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
  const entryKey = `hermesShrineDelivery:${encodeURIComponent(
    JSON.stringify(['Surface', 'N', 'n-postboss', 'initial:first']),
  )}`;
  assert.equal(result.document.schemaVersion, 69);
  assert.deepEqual(occurrence.hermesShrine.offerBySlot.first, {
    rewardType: 'BlindBoxLoot',
  });
  assert.deepEqual(
    occurrence.acquisitionSites.hermesShrineDelivery.pickupEntries[entryKey],
    oldReward,
  );
  assert.deepEqual(result.changes['68->69'], {
    inventoryOffersNarrowed: 1,
    rushedDeliveriesMoved: 1,
  });
});

test('58 -> 59 seeds Well shells only on exact forced Underworld Postboss identities', () => {
  const source = {
    schemaVersion: 58,
    catalogVersion: '0.40.0-hermes-shrine',
    projectId: 'well-migration',
    routes: [
      {
        routeKey: 'Underworld',
        biomes: [
          {
            biomeKey: 'F',
            completionOccurrences: [
              {
                occurrenceId: 'completion:F:postboss',
                gameName: 'F_PostBoss01',
                additionalExits: [],
              },
              { occurrenceId: 'completion:F:notpostboss', gameName: 'F_PostBoss01' },
            ],
          },
          {
            biomeKey: 'G',
            completionOccurrences: [
              {
                occurrenceId: 'completion:G:postboss',
                gameName: 'G_PostBoss01',
                stygianWell: { malformedRetainedState: true },
              },
            ],
          },
          {
            biomeKey: 'H',
            completionOccurrences: [
              { occurrenceId: 'completion:H:postboss', gameName: 'H_PostBoss01' },
            ],
          },
          {
            biomeKey: 'I',
            completionOccurrences: [
              { occurrenceId: 'completion:I:postboss', gameName: 'I_PostBoss01' },
            ],
          },
        ],
      },
      {
        routeKey: 'Surface',
        biomes: [
          {
            biomeKey: 'F',
            completionOccurrences: [
              { occurrenceId: 'completion:F:postboss', gameName: 'F_PostBoss01' },
            ],
          },
        ],
      },
    ],
  };

  const result = migrateProjectDocument(source, 59);
  const biomes = result.document.routes[0].biomes;
  assert.equal(result.document.schemaVersion, 59);
  assert.equal(result.document.catalogVersion, '0.41.0-stygian-well');
  assert.deepEqual(result.steps, ['58->59']);
  assert.deepEqual(result.changes['58->59'], { wellsAdded: 2 });
  for (const [biomeIndex, occurrenceIndex] of [
    [0, 0],
    [2, 0],
  ]) {
    assert.deepEqual(biomes[biomeIndex].completionOccurrences[occurrenceIndex].stygianWell, {
      interacted: false,
      offerKeyBySlot: { healing: null, secondLeft: null, secondRight: null },
    });
  }
  assert.equal('stygianWell' in biomes[0].completionOccurrences[1], false);
  assert.deepEqual(biomes[1].completionOccurrences[0].stygianWell, {
    malformedRetainedState: true,
  });
  assert.equal('stygianWell' in biomes[3].completionOccurrences[0], false);
  assert.equal(
    'stygianWell' in result.document.routes[1].biomes[0].completionOccurrences[0],
    false,
  );
});

test('58 -> 59 rejects a document from the wrong prior catalog', () => {
  assert.throws(
    () =>
      migrateProjectDocument({
        schemaVersion: 58,
        catalogVersion: '0.39.0-purging-pool',
        routes: [],
      }),
    /schema 58 migration expects catalog 0\.40\.0-hermes-shrine/,
  );
});

test('67 -> current moves a Surface completion chain and rewrites its resource placement', () => {
  const source = schema67CompletionSource('Surface', ['N'], {
    Shovel: { biomeKey: 'N', occurrenceId: 'completion:N:postboss' },
  });
  const result = migrateProjectDocument(source);
  const route = result.document.routes.find((candidate) => candidate.routeKey === 'Surface');
  const biome = route.biomes.find((candidate) => candidate.biomeKey === 'N');
  const completion = biome.topology.occurrences.filter((occurrence) =>
    ['N_Boss01', 'N_PostBoss01'].includes(occurrence.gameName),
  );

  assert.equal(result.document.schemaVersion, 69);
  assert.equal(result.document.catalogVersion, '0.49.0-completion-topology');
  assert.equal('completionOccurrences' in biome, false);
  assert.deepEqual(
    completion.map((occurrence) => [occurrence.occurrenceId, occurrence.gameName]),
    [
      ['n-preboss:boss', 'N_Boss01'],
      ['n-preboss:postboss', 'N_PostBoss01'],
    ],
  );
  assert.equal(route.resourcePlacements.Shovel.occurrenceId, 'n-preboss:postboss');
  assert.deepEqual(result.changes['67->68'], {
    completionOccurrencesMoved: 2,
    completionOccurrencesRetired: 0,
    fixedRoomLinksAdded: 2,
    routePlacementsRewritten: 1,
    routePlacementsRetired: 0,
    terminalPostbossOccurrencesRetired: 0,
    dormantCompletionOccurrencesRetired: 0,
  });
});

test('67 -> 68 retires a terminal Postboss and clears its resource placement', () => {
  const source = schema67CompletionSource('Underworld', ['F', 'G', 'H', 'I'], {
    Pickaxe: { biomeKey: 'I', occurrenceId: 'completion:I:postboss' },
  });

  const result = migrateProjectDocument(source);
  const biome = routeFor(result.document, 'Underworld').biomes.find(
    (candidate) => candidate.biomeKey === 'I',
  );
  assert.equal(
    biome.topology.occurrences.some((occurrence) => occurrence.gameName === 'I_PostBoss01'),
    false,
  );
  assert.equal(routeFor(result.document, 'Underworld').resourcePlacements.Pickaxe, null);
  assert.deepEqual(result.changes['67->68'], {
    completionOccurrencesMoved: 7,
    completionOccurrencesRetired: 1,
    fixedRoomLinksAdded: 7,
    routePlacementsRewritten: 0,
    routePlacementsRetired: 1,
    terminalPostbossOccurrencesRetired: 1,
    dormantCompletionOccurrencesRetired: 0,
  });
});

function routeFor(document, routeKey) {
  const route = document.routes.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) throw new Error(`missing ${routeKey} route`);
  return route;
}
