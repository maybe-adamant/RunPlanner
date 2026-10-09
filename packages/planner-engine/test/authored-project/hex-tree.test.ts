import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  applyAuthoredHexTreeEdit,
  assessAuthoredHexTree,
  authoredHexCommonDecks,
  authoredHexNodeEditOptions,
  createDefaultAuthoredHexTree,
  type AuthoredHexTreeEdit,
} from '../../src/authored-project/traits/hex-tree';

const SPELL = 'SpellMoonBeamTrait';
const GROWTH = 'ChargeRegenTalent';
const VULNERABILITY = 'MoonBeamVulnerabilityTalent';
const DAMAGE = 'MoonBeamDamageTalent';
const COUNT = 'MoonBeamCountTalent';
const lung = createDefaultAuthoredHexTree(catalog, SPELL);
const edit = (value: AuthoredHexTreeEdit, tree = lung) =>
  applyAuthoredHexTreeEdit(catalog, SPELL, tree, value);
const options = (nodeKey: string, tree = lung) =>
  authoredHexNodeEditOptions(catalog, SPELL, tree, nodeKey).map((group) => ({
    kind: group.kind,
    options: group.options.map(({ talentKey, selected, relatedNodeKeys, depth }) => ({
      talentKey,
      selected,
      ...(relatedNodeKeys.length === 0 ? {} : { related: relatedNodeKeys }),
      ...(depth === undefined ? {} : { depth }),
    })),
  }));

describe('Rare and Epic node edits', () => {
  it('offers the pool with each talent held elsewhere naming that node', () => {
    expect(options('4:1')).toEqual([
      {
        kind: 'pool',
        options: [
          { talentKey: 'MoonBeamConsecutiveDamageTalent', selected: true },
          {
            talentKey: 'MoonBeamDefenseTalent',

            selected: false,
            related: ['4:5'],
          },
          { talentKey: 'MoonBeamPrimaryTalent', selected: false },
        ],
      },
    ]);
  });

  it('keeps a repeat as set and reports exactly its two holders', () => {
    const repeated = edit({ kind: 'setNode', nodeKey: '4:1', talentKey: 'MoonBeamDefenseTalent' });
    expect(repeated.nodes).toEqual({ ...lung.nodes, '4:1': 'MoonBeamDefenseTalent' });
    expect(assessAuthoredHexTree(catalog, SPELL, repeated)).toEqual([
      { kind: 'repeatedTalent', talentKey: 'MoonBeamDefenseTalent', nodeKeys: ['4:1', '4:5'] },
    ]);
  });

  it('gives the God Sent nodes no edits', () => {
    expect(options('5:3')).toEqual([]);
    expect(options('6:1')).toEqual([]);
  });
});

describe('Common node edits', () => {
  it('swaps with the first node at its depth holding the talent, keeping the tree legal', () => {
    // Depth 3 holds two whole decks: no trade with another column.
    expect(options('3:4')).toEqual([
      {
        kind: 'atDepth',
        options: [
          { talentKey: VULNERABILITY, selected: true },
          {
            talentKey: DAMAGE,

            selected: false,
            related: ['3:2'],
          },
          {
            talentKey: COUNT,

            selected: false,
            related: ['3:3'],
          },
        ],
      },
    ]);
    const swapped = edit({ kind: 'swapNodes', nodeKey: '3:4', otherNodeKey: '3:2' });
    expect(swapped.nodes).toEqual({ ...lung.nodes, '3:4': DAMAGE, '3:2': VULNERABILITY });
    expect(assessAuthoredHexTree(catalog, SPELL, swapped)).toEqual([]);
    expect(() => edit({ kind: 'swapNodes', nodeKey: '3:4', otherNodeKey: '4:1' })).toThrow(
      'not two Common nodes',
    );
    // A swap across depths keeps each node within its depth's domain.
    expect(() => edit({ kind: 'swapNodes', nodeKey: '1:2', otherNodeKey: '3:1' })).toThrow(
      'cannot hold',
    );
  });

  it('offers swaps in its column, then trades with its deck in other columns', () => {
    expect(options('1:4')).toEqual([
      {
        kind: 'atDepth',
        options: [
          { talentKey: GROWTH, selected: false, related: ['1:2'] },
          { talentKey: VULNERABILITY, selected: true },
        ],
      },
      {
        kind: 'otherColumn',
        options: [
          { talentKey: DAMAGE, selected: false, related: ['2:2'], depth: 2 },
          { talentKey: COUNT, selected: false, related: ['2:4'], depth: 2 },
        ],
      },
    ]);
  });

  it('keeps a set that breaks the draw sequence and names only the nodes it involves', () => {
    const conflicted = edit({ kind: 'setNode', nodeKey: '1:4', talentKey: DAMAGE });
    expect(conflicted.nodes['1:4']).toBe(DAMAGE);
    expect(assessAuthoredHexTree(catalog, SPELL, conflicted)).toEqual([
      { kind: 'repeatableSequence', nodeKeys: ['1:4', '2:2'] },
    ]);
    expect(authoredHexCommonDecks(catalog, SPELL, conflicted).decks).toBeUndefined();
    // An unreadable tree keeps its column swaps and offers no trades.
    expect(options('1:4', conflicted).map((group) => group.kind)).toEqual(['atDepth']);
  });
});

describe('Common deck trades', () => {
  const trades = (nodeKey: string, tree = lung) =>
    authoredHexNodeEditOptions(catalog, SPELL, tree, nodeKey)
      .filter((group) => group.kind === 'otherColumn' || group.kind === 'unused')
      .map((group) => [group.kind, group.options.map((option) => option.edit)]);

  it('offers a node its deck mates in other columns, and the undealt talents of a partial deck', () => {
    expect(trades('1:4')).toEqual([
      [
        'otherColumn',
        [
          { kind: 'swapNodes', nodeKey: '1:4', otherNodeKey: '2:2' },
          { kind: 'swapNodes', nodeKey: '1:4', otherNodeKey: '2:4' },
        ],
      ],
    ]);
    expect(trades('3:1')).toEqual([]);
    expect(trades('5:3', createDefaultAuthoredHexTree(catalog, SPELL, 'Pyramid'))).toEqual([
      [
        'unused',
        [
          { kind: 'setNode', nodeKey: '5:3', talentKey: DAMAGE },
          { kind: 'setNode', nodeKey: '5:3', talentKey: COUNT },
        ],
      ],
    ]);
  });

  it('keeps every legal tree legal under each trade', () => {
    for (const declaration of catalog.hexes.values)
      for (const layoutKey of ['Lung', 'Pyramid', 'Maze', 'Nacelle'] as const) {
        const spell = declaration.spellTraitKey;
        const tree = createDefaultAuthoredHexTree(catalog, spell, layoutKey);
        for (const nodeKey of Object.keys(tree.nodes))
          for (const group of authoredHexNodeEditOptions(catalog, spell, tree, nodeKey))
            if (group.kind === 'otherColumn' || group.kind === 'unused')
              for (const option of group.options) {
                const next = applyAuthoredHexTreeEdit(catalog, spell, tree, option.edit);
                expect(next).not.toEqual(tree);
                expect(assessAuthoredHexTree(catalog, spell, next)).toEqual([]);
                expect(authoredHexCommonDecks(catalog, spell, next).decks).toBeDefined();
              }
      }
  });
});

describe('Hex tree layout edits', () => {
  it('keeps the tree when the same layout is chosen and regenerates another', () => {
    const edited = edit({ kind: 'setNode', nodeKey: '4:1', talentKey: 'MoonBeamPrimaryTalent' });
    expect(edit({ kind: 'changeLayout', layoutKey: 'Lung' }, edited)).toBe(edited);
    expect(edit({ kind: 'changeLayout', layoutKey: 'Maze' }, edited)).toEqual(
      createDefaultAuthoredHexTree(catalog, SPELL, 'Maze'),
    );
    expect(edit({ kind: 'reset' }, edited)).toEqual(lung);
  });
});
