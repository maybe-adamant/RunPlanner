import { catalog } from '@run-planner/hades2-catalog';
import type { HexDeclaration, HexLayoutKey } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import {
  defaultHexTalentTree,
  hexCommonColumns,
  hexNodeTalentDomain,
  hexRepeatableCycles,
  validateHexTalentTree,
  type HexTalentTree,
} from '../../src/authored-project/traits/hex-talent-tree';

const LAYOUTS: readonly HexLayoutKey[] = ['Lung', 'Pyramid', 'Maze', 'Nacelle'];
const NO_FINDINGS = { nodes: [], tree: [] };

const CD = 'CooldownDamageTalent';
const GROWTH = 'ChargeRegenTalent';
const PREP = 'PreChargeTalent';
const HUMILITY = 'PolymorphDurationTalent';
const EXPOSURE = 'PolymorphDamageTalent';
const VASTNESS = 'MeteorSizeTalent';
const MAGNITUDE = 'MeteorDamageTalent';

function hex(spellTraitKey: string): HexDeclaration {
  const declaration = catalog.hexes.byKey[spellTraitKey];
  if (declaration === undefined) throw new Error(`missing Hex ${spellTraitKey}`);
  return declaration;
}

function complete(declaration: HexDeclaration, layoutKey: HexLayoutKey): HexTalentTree {
  return defaultHexTalentTree(declaration, layoutKey);
}

function pinAll(nodeKeys: readonly string[], talentKey: string): Record<string, string> {
  return Object.fromEntries(nodeKeys.map((key) => [key, talentKey]));
}

const polymorph = hex('SpellPolymorphTrait');
const meteor = hex('SpellMeteorTrait');

describe('Hex repeatable draw cycles', () => {
  it('refills with talents below MaxCount; only the last cycle is partial', () => {
    const unbounded = { talentKeys: [CD, HUMILITY, EXPOSURE], draws: 3 };
    expect(hexRepeatableCycles(polymorph, 'Lung')).toEqual([
      { talentKeys: [CD, GROWTH, HUMILITY, EXPOSURE], draws: 4 },
      unbounded,
      unbounded,
      unbounded,
    ]);
    expect(hexRepeatableCycles(polymorph, 'Pyramid').at(-1)).toEqual({ ...unbounded, draws: 1 });
    expect(hexRepeatableCycles(meteor, 'Lung')).toEqual([
      { talentKeys: [CD, PREP, VASTNESS, MAGNITUDE], draws: 4 },
      { talentKeys: [CD, PREP, VASTNESS, MAGNITUDE], draws: 4 },
      { talentKeys: [CD, VASTNESS, MAGNITUDE], draws: 3 },
      { talentKeys: [CD, VASTNESS, MAGNITUDE], draws: 2 },
    ]);
  });
});

describe('Hex node talent domain', () => {
  it('limits repeatable nodes to the talents their depth can draw', () => {
    expect(hexNodeTalentDomain(polymorph, 'Lung', '1:4')).toEqual([CD, GROWTH, HUMILITY, EXPOSURE]);
    expect(hexNodeTalentDomain(polymorph, 'Lung', '3:6')).toEqual([CD, HUMILITY, EXPOSURE]);
    expect(hexNodeTalentDomain(polymorph, 'Pyramid', '1:5')).toEqual([
      CD,
      GROWTH,
      HUMILITY,
      EXPOSURE,
    ]);
    expect(hexNodeTalentDomain(polymorph, 'Pyramid', '2:1')).toEqual([CD, HUMILITY, EXPOSURE]);
    expect(hexNodeTalentDomain(meteor, 'Lung', '3:4')).toEqual([CD, PREP, VASTNESS, MAGNITUDE]);
    expect(hexNodeTalentDomain(meteor, 'Lung', '5:2')).toEqual([CD, VASTNESS, MAGNITUDE]);
  });

  it('gives unique and Olympian nodes their whole pool regardless of other nodes', () => {
    expect(hexNodeTalentDomain(polymorph, 'Lung', '4:5')).toEqual(
      polymorph.rareCandidates.values.map((candidate) => candidate.key),
    );
    expect(hexNodeTalentDomain(polymorph, 'Lung', '6:3')).toEqual([
      'PolymorphSandwichTalent',
      'PolymorphCurseTalent',
    ]);
    expect(hexNodeTalentDomain(polymorph, 'Lung', '5:3')).toEqual(['PolymorphZeusTalent']);
  });
});

describe('Hex talent tree legality', () => {
  it('reports a talent its depth cannot draw on the node itself', () => {
    const tree = { ...complete(polymorph, 'Lung'), '1:4': CD, '3:6': GROWTH };
    expect(validateHexTalentTree(polymorph, 'Lung', tree)).toEqual({
      nodes: [{ kind: 'talentNotAtDepth', nodeKey: '3:6', talentKey: GROWTH }],
      tree: [],
    });
  });

  it('names every node of the smallest changes that restore the draw sequence', () => {
    const tree = {
      ...complete(polymorph, 'Pyramid'),
      ...pinAll(['1:1', '1:2', '1:3', '1:4', '1:5'], EXPOSURE),
    };
    expect(validateHexTalentTree(polymorph, 'Pyramid', tree)).toEqual({
      nodes: [],
      tree: [
        {
          kind: 'repeatableSequence',
          nodeKeys: ['1:1', '1:2', '1:3', '1:4', '1:5', '2:2', '3:2', '4:4'],
        },
      ],
    });
  });

  it('tracks a refill cycle that straddles depths', () => {
    // Meteor Lung depth 3 draws a whole cycle plus two of the next; 4:3 draws the third,
    // so a Cooldown there conflicts with the two Cooldowns at depth 3.
    const legal = complete(meteor, 'Lung');
    expect(legal['4:3']).toBe(MAGNITUDE);
    expect(validateHexTalentTree(meteor, 'Lung', legal)).toEqual(NO_FINDINGS);
    expect(validateHexTalentTree(meteor, 'Lung', { ...legal, '4:3': CD })).toEqual({
      nodes: [],
      tree: [{ kind: 'repeatableSequence', nodeKeys: ['3:1', '3:5', '4:3'] }],
    });
    expect(validateHexTalentTree(meteor, 'Lung', { ...legal, '3:3': PREP })).toEqual({
      nodes: [],
      tree: [{ kind: 'repeatableSequence', nodeKeys: ['3:2', '3:3'] }],
    });
  });

  it('reports repeated unique talents and missing nodes', () => {
    const tree = { ...complete(polymorph, 'Lung'), '4:5': 'PolymorphBossDamageTalent' };
    expect(validateHexTalentTree(polymorph, 'Lung', tree)).toEqual({
      nodes: [],
      tree: [
        {
          kind: 'repeatedTalent',
          talentKey: 'PolymorphBossDamageTalent',
          nodeKeys: ['4:1', '4:5'],
        },
      ],
    });
    const missing = Object.fromEntries(
      Object.entries(complete(polymorph, 'Lung')).filter(([key]) => key !== '6:3'),
    );
    expect(validateHexTalentTree(polymorph, 'Lung', missing)).toEqual({
      nodes: [{ kind: 'missingNode', nodeKey: '6:3' }],
      tree: [],
    });
  });
});

describe('Hex talent tree default fill', () => {
  it('fills an unpinned tree from declared candidates and the source draw order', () => {
    expect(complete(polymorph, 'Lung')).toEqual({
      '1:2': CD,
      '1:4': GROWTH,
      '2:2': HUMILITY,
      '2:4': EXPOSURE,
      '3:1': CD,
      '3:2': HUMILITY,
      '3:3': EXPOSURE,
      '3:4': CD,
      '3:5': HUMILITY,
      '3:6': EXPOSURE,
      '4:1': 'PolymorphBossDamageTalent',
      '4:3': CD,
      '4:5': 'PolymorphDeathExplodeTalent',
      '5:2': HUMILITY,
      '5:3': 'PolymorphZeusTalent',
      '5:4': EXPOSURE,
      '6:1': 'OlympianSpellCountTalent',
      '6:3': 'PolymorphSandwichTalent',
    });
  });

  it('fills every spell and layout with a legal tree', () => {
    for (const declaration of catalog.hexes.values)
      for (const layoutKey of LAYOUTS) {
        const layout = declaration.layouts.byKey[layoutKey]!;
        const tree = complete(declaration, layoutKey);
        expect(Object.keys(tree)).toEqual(layout.nodes.values.map((node) => node.key));
        expect(validateHexTalentTree(declaration, layoutKey, tree)).toEqual(NO_FINDINGS);
      }
  });
});

describe('Hex Common column decks', () => {
  const decks = (declaration: HexDeclaration, layoutKey: HexLayoutKey, tree: HexTalentTree) =>
    hexCommonColumns(declaration, layoutKey, tree).map((column) => [
      column.depth,
      column.drawable,
      column.deck?.map((segment) => [segment.deckIndex, segment.draws, segment.talentKeys]),
    ]);

  it('reads whole decks and decks that straddle the next column', () => {
    expect(decks(polymorph, 'Lung', complete(polymorph, 'Lung'))).toEqual([
      [1, true, [[0, 2, [CD, GROWTH, HUMILITY, EXPOSURE]]]],
      [2, true, [[0, 2, [HUMILITY, EXPOSURE]]]],
      [
        3,
        true,
        [
          [1, 3, [CD, HUMILITY, EXPOSURE]],
          [2, 3, [CD, HUMILITY, EXPOSURE]],
        ],
      ],
      [4, true, [[3, 1, [CD, HUMILITY, EXPOSURE]]]],
      [5, true, [[3, 2, [HUMILITY, EXPOSURE]]]],
    ]);
  });

  it('chains decks across every column of a Pyramid and leaves the last deck partly undealt', () => {
    expect(decks(polymorph, 'Pyramid', complete(polymorph, 'Pyramid'))).toEqual([
      [
        1,
        true,
        [
          [0, 4, [CD, GROWTH, HUMILITY, EXPOSURE]],
          [1, 1, [CD, HUMILITY, EXPOSURE]],
        ],
      ],
      [
        2,
        true,
        [
          [1, 2, [HUMILITY, EXPOSURE]],
          [2, 2, [CD, HUMILITY, EXPOSURE]],
        ],
      ],
      [
        3,
        true,
        [
          [2, 1, [EXPOSURE]],
          [3, 1, [CD, HUMILITY, EXPOSURE]],
        ],
      ],
      [4, true, [[3, 2, [HUMILITY, EXPOSURE]]]],
      [5, true, [[4, 1, [CD, HUMILITY, EXPOSURE]]]],
    ]);
  });

  it('drops capped talents from later decks', () => {
    // Preparation reaches its cap after two decks; the last deck deals two of three.
    expect(decks(meteor, 'Lung', complete(meteor, 'Lung'))).toEqual([
      [1, true, [[0, 2, [CD, PREP, VASTNESS, MAGNITUDE]]]],
      [2, true, [[0, 2, [VASTNESS, MAGNITUDE]]]],
      [
        3,
        true,
        [
          [1, 4, [CD, PREP, VASTNESS, MAGNITUDE]],
          [2, 2, [CD, VASTNESS, MAGNITUDE]],
        ],
      ],
      [4, true, [[2, 1, [MAGNITUDE]]]],
      [5, true, [[3, 2, [CD, VASTNESS, MAGNITUDE]]]],
    ]);
  });

  it('reads no deck past a column no draw yields', () => {
    const tree = { ...complete(meteor, 'Lung'), '4:3': CD };
    expect(decks(meteor, 'Lung', tree).slice(3)).toEqual([
      [4, false, [[2, 1, [MAGNITUDE]]]],
      [5, false, undefined],
    ]);
  });

  it('reads every legal default tree as drawable', () => {
    for (const declaration of catalog.hexes.values)
      for (const layoutKey of LAYOUTS)
        expect(
          hexCommonColumns(declaration, layoutKey, complete(declaration, layoutKey)).every(
            (column) => column.drawable,
          ),
        ).toBe(true);
  });
});
