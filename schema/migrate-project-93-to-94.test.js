import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument, outputPath } from './migrate-project-93-to-94.js';

const offer = (hexTree) => ({
  kind: 'traits',
  giverKey: 'SpellDrop',
  options: [{ traitKey: 'SpellPolymorphTrait' }],
  selectedOptionKey: 'option1',
  rarificationActions: [],
  hexTree,
});

const document = () => ({
  schemaVersion: 93,
  projectId: 'run-plan-1',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    routeKey: 'Surface',
    loadout: {
      weaponKey: 'WeaponStaffSwing',
      aspectKey: 'SuitHexAspect',
      aspectHexTree: {
        layoutKey: 'Nacelle',
        rareTalentKeys: [
          'MoonBeamConsecutiveDamageTalent',
          'MoonBeamDefenseTalent',
          'MoonBeamPrimaryTalent',
        ],
        epicTalentKeys: ['MoonBeamTargetTalent', 'MoonBeamExBeamBonusTalent'],
      },
    },
    biomes: [
      {
        biomeKey: 'N',
        rewards: [
          offer({
            layoutKey: 'Lung',
            rareTalentKeys: ['PolymorphTauntTalent', 'PolymorphHealthCrushTalent'],
            epicTalentKeys: ['PolymorphCurseTalent'],
          }),
        ],
      },
    ],
  },
});

describe('schema 93 to 94 migration', () => {
  it('generates each complete tree with the Rare and Epic picks in layout order', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    assert.equal(migrated.schemaVersion, 94);
    const aspect = migrated.route.loadout.aspectHexTree;
    assert.deepEqual(Object.keys(aspect), ['layoutKey', 'nodes']);
    assert.equal(aspect.layoutKey, 'Nacelle');
    assert.equal(Object.keys(aspect.nodes).length, 18);
    assert.deepEqual(
      ['3:2', '3:4', '4:3', '6:2', '6:4'].map((key) => aspect.nodes[key]),
      [
        'MoonBeamConsecutiveDamageTalent',
        'MoonBeamDefenseTalent',
        'MoonBeamPrimaryTalent',
        'MoonBeamTargetTalent',
        'MoonBeamExBeamBonusTalent',
      ],
    );
    // Repeatable nodes take the default fill: Sky Fall draws Growth first.
    assert.equal(aspect.nodes['1:2'], 'ChargeRegenTalent');
    const offer = migrated.route.biomes[0].rewards[0].hexTree;
    assert.deepEqual(Object.keys(offer.nodes), [
      '1:2',
      '1:4',
      '2:2',
      '2:4',
      '3:1',
      '3:2',
      '3:3',
      '3:4',
      '3:5',
      '3:6',
      '4:1',
      '4:3',
      '4:5',
      '5:2',
      '5:4',
      '6:3',
    ]);
    assert.deepEqual(
      [offer.nodes['4:1'], offer.nodes['4:5'], offer.nodes['6:3'], offer.nodes['1:2']],
      [
        'PolymorphTauntTalent',
        'PolymorphHealthCrushTalent',
        'PolymorphCurseTalent',
        'CooldownDamageTalent',
      ],
    );
    const restored = structuredClone(migrated);
    restored.schemaVersion = 93;
    restored.route.loadout.aspectHexTree = source.route.loadout.aspectHexTree;
    restored.route.biomes[0].rewards[0].hexTree = source.route.biomes[0].rewards[0].hexTree;
    assert.deepEqual(restored, source);
    assert.equal(source.schemaVersion, 93);
  });

  it('rejects a tree whose picks do not fill its layout', () => {
    const source = document();
    source.route.loadout.aspectHexTree.rareTalentKeys.pop();
    assert.throws(() => migrateProjectDocument(source), /must hold 3 talents/);
  });

  it('rejects another source schema or catalog', () => {
    assert.throws(
      () => migrateProjectDocument({ ...document(), schemaVersion: 92 }),
      /expects schema 93/,
    );
    assert.throws(
      () => migrateProjectDocument({ ...document(), catalogVersion: 'other' }),
      /expects catalog/,
    );
  });

  it('writes a sibling schema-94 file name', () => {
    assert.equal(outputPath('/plans/run.runplanner.json'), '/plans/run.runplanner-schema94.json');
  });
});
