import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  applyAuthoredHexTreeEdit,
  assessAuthoredHexTree,
  authoredHexColumnDeal,
  authoredHexColumns,
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

describe('Common columns', () => {
  const LAYOUTS = ['Lung', 'Pyramid', 'Maze', 'Nacelle'] as const;
  const columns = (tree = lung, spell = SPELL) => authoredHexColumns(catalog, spell, tree);
  const shape = (tree = lung, spell = SPELL) =>
    columns(tree, spell).map((column) => ({
      depth: column.depth,
      drawable: column.drawable,
      deck: column.deck?.map(({ deckIndex, draws }) => [deckIndex, draws]),
    }));
  const slotOptions = (depth: number, nodeKey: string, tree = lung, spell = SPELL) =>
    columns(tree, spell)
      .find((column) => column.depth === depth)!
      .slots.find((slot) => slot.nodeKey === nodeKey)!
      .options.map((option) => [option.talentKey, option.edit.talentKeys]);
  const setColumn = (depth: number, talentKeys: readonly string[], tree = lung, spell = SPELL) =>
    applyAuthoredHexTreeEdit(catalog, spell, tree, { kind: 'setColumn', depth, talentKeys });

  it('reads each default column on the same deck boundaries as the deck table', () => {
    for (const declaration of catalog.hexes.values)
      for (const layoutKey of LAYOUTS) {
        const spell = declaration.spellTraitKey;
        const tree = createDefaultAuthoredHexTree(catalog, spell, layoutKey);
        const { depths, decks } = authoredHexCommonDecks(catalog, spell, tree);
        const projected = columns(tree, spell);
        expect(projected.map((column) => column.depth)).toEqual(depths);
        for (const column of projected) {
          expect(column.drawable).toBe(true);
          const dealt = decks!.flatMap((deck) =>
            deck.segments
              .filter((segment) => segment.depth === column.depth)
              .map((segment) => ({ deckIndex: deck.index, ...segment })),
          );
          expect(column.deck!.map(({ deckIndex, draws }) => [deckIndex, draws])).toEqual(
            dealt.map((segment) => [segment.deckIndex, segment.nodeKeys.length]),
          );
          // What a deck holds when the column reaches it is what this column was dealt and what later ones take.
          column.deck!.forEach((segment, index) => {
            const later = decks![segment.deckIndex]!.segments.filter(
              (other) => other.depth === undefined || other.depth > column.depth,
            );
            expect([...segment.talentKeys].sort()).toEqual(
              [...dealt[index]!.talentKeys, ...later.flatMap((other) => other.talentKeys)].sort(),
            );
          });
          expect(new Set(column.slots.map((slot) => slot.nodeKey))).toEqual(
            new Set(dealt.flatMap((segment) => segment.nodeKeys)),
          );
        }
      }
  });

  it('lists slots top to bottom on the map, then left to right', () => {
    const slots = (tree: typeof lung, depth: number) =>
      columns(tree)
        .find((column) => column.depth === depth)!
        .slots.map((slot) => slot.nodeKey);
    expect(slots(lung, 3)).toEqual(['3:3', '3:1', '3:2', '3:4', '3:6', '3:5']);
    const maze = createDefaultAuthoredHexTree(catalog, SPELL, 'Maze');
    expect(slots(maze, 5)).toEqual(['5:1', '5:3', '5:2', '5:4', '5:5', '5:6']);
  });

  it('keeps a drawable column drawable under every slot choice, as the tree policy agrees', () => {
    for (const declaration of catalog.hexes.values)
      for (const layoutKey of LAYOUTS) {
        const spell = declaration.spellTraitKey;
        const tree = createDefaultAuthoredHexTree(catalog, spell, layoutKey);
        for (const column of columns(tree, spell))
          for (const slot of column.slots)
            for (const option of slot.options) {
              const next = applyAuthoredHexTreeEdit(catalog, spell, tree, option.edit);
              const after = columns(next, spell);
              expect(after.find((other) => other.depth === column.depth)!.drawable).toBe(true);
              expect(assessAuthoredHexTree(catalog, spell, next).length === 0).toBe(
                after.every((other) => other.drawable),
              );
            }
      }
  });

  it('offers a column the rest of its deck, swapping a talent it already holds', () => {
    expect(slotOptions(1, '1:2')).toEqual([
      [GROWTH, [GROWTH, VULNERABILITY]],
      [VULNERABILITY, [VULNERABILITY, GROWTH]],
      [DAMAGE, [DAMAGE, VULNERABILITY]],
      [COUNT, [COUNT, VULNERABILITY]],
    ]);
    // A column that takes its whole deck can only rearrange it.
    expect(slotOptions(2, '2:2')).toEqual([
      [DAMAGE, [DAMAGE, COUNT]],
      [COUNT, [COUNT, DAMAGE]],
    ]);
  });

  it('offers the refill subset where a partial deck straddles a column', () => {
    const pyramid = createDefaultAuthoredHexTree(catalog, SPELL, 'Pyramid');
    expect(shape(pyramid)[0]).toEqual({
      depth: 1,
      drawable: true,
      deck: [
        [0, 4],
        [1, 1],
      ],
    });
    expect(columns(pyramid)[0]!.deck![1]!.talentKeys).toEqual([VULNERABILITY, DAMAGE, COUNT]);
    const first = [GROWTH, VULNERABILITY, DAMAGE, COUNT];
    expect(slotOptions(1, '1:5', pyramid)).toEqual([
      [GROWTH, [VULNERABILITY, VULNERABILITY, DAMAGE, COUNT, GROWTH]],
      [VULNERABILITY, [...first, VULNERABILITY]],
      [DAMAGE, [...first, DAMAGE]],
      [COUNT, [...first, COUNT]],
    ]);
    // The next column starts from what the refill pick left.
    const picked = setColumn(1, [...first, DAMAGE], pyramid);
    expect(columns(picked)[1]!.deck![0]!.talentKeys).toEqual([VULNERABILITY, COUNT]);
  });

  it('respects MaxCount: Growth once, Preparation twice', () => {
    const nightBloom = 'SpellSummonTrait';
    const PREPARATION = 'PreChargeTalent';
    for (const layoutKey of LAYOUTS) {
      const tree = createDefaultAuthoredHexTree(catalog, nightBloom, layoutKey);
      const projected = columns(tree, nightBloom);
      const reachable = (talentKey: string) =>
        projected.flatMap((column) =>
          column.deck!.flatMap((segment) =>
            segment.talentKeys.includes(talentKey) ? [segment.deckIndex] : [],
          ),
        );
      expect(new Set(reachable(GROWTH))).toEqual(new Set([0]));
      expect(new Set(reachable(PREPARATION))).toEqual(new Set([0, 1]));
      for (const column of projected)
        for (const slot of column.slots)
          for (const option of slot.options) {
            const count = (talentKey: string) =>
              option.edit.talentKeys.filter((key) => key === talentKey).length;
            expect(count(GROWTH)).toBeLessThanOrEqual(1);
            expect(count(PREPARATION)).toBeLessThanOrEqual(2);
          }
    }
    // Night Bloom on Pyramid: the first column's refill pick cannot be Growth again.
    const pyramid = createDefaultAuthoredHexTree(catalog, nightBloom, 'Pyramid');
    expect(columns(pyramid, nightBloom)[0]!.deck![1]!.talentKeys).not.toContain(GROWTH);
    const twice = setColumn(
      1,
      ['CooldownDamageTalent', GROWTH, PREPARATION, 'SummonDamageTalent', GROWTH],
      pyramid,
      nightBloom,
    );
    expect(columns(twice, nightBloom)[0]!.drawable).toBe(false);
    expect(assessAuthoredHexTree(catalog, nightBloom, twice)).not.toEqual([]);
  });

  it('sets a column atomically and keeps later columns as authored', () => {
    const kept = setColumn(1, [DAMAGE, GROWTH]);
    expect(kept.nodes).toEqual({ ...lung.nodes, '1:2': DAMAGE, '1:4': GROWTH });
    expect(assessAuthoredHexTree(catalog, SPELL, kept)).toEqual([
      { kind: 'repeatableSequence', nodeKeys: expect.any(Array) },
    ]);
    // Column 2 still holds Damage, which column 1 now drew.
    expect(shape(kept).map(({ drawable }) => drawable)).toEqual([true, false, false, false, false]);
    const legal = setColumn(1, [VULNERABILITY, GROWTH]);
    expect(assessAuthoredHexTree(catalog, SPELL, legal)).toEqual([]);
    expect(() => setColumn(1, [GROWTH])).toThrow('has 2 slots');
    expect(() => setColumn(6, [])).toThrow('no Common column');
  });

  it('marks the first column a column edit breaks, past which no deck is read', () => {
    const broken = setColumn(1, [DAMAGE, COUNT]);
    expect(shape(broken)).toEqual([
      { depth: 1, drawable: true, deck: [[0, 2]] },
      { depth: 2, drawable: false, deck: [[0, 2]] },
      { depth: 3, drawable: false, deck: undefined },
      { depth: 4, drawable: false, deck: undefined },
      { depth: 5, drawable: false, deck: undefined },
    ]);
    // The tree finding names the smallest changes that restore a draw sequence.
    expect(assessAuthoredHexTree(catalog, SPELL, broken)).toEqual([
      { kind: 'repeatableSequence', nodeKeys: ['1:2', '1:4', '2:2', '2:4'] },
    ]);
    // The broken column offers its whole deck; a column past it, its node's own domain.
    expect(slotOptions(2, '2:2', broken).map(([talentKey]) => talentKey)).toEqual([
      GROWTH,
      VULNERABILITY,
      DAMAGE,
    ]);
    expect(slotOptions(2, '2:2', broken)[0]).toEqual([GROWTH, [GROWTH, COUNT]]);
    expect(slotOptions(4, '4:3', broken).map(([talentKey]) => talentKey)).toEqual([
      VULNERABILITY,
      DAMAGE,
      COUNT,
    ]);
  });
});

describe('Common column deals', () => {
  const deal = (depth: number, dealt: readonly string[], tree = lung, spell = SPELL) =>
    authoredHexColumnDeal(catalog, spell, tree, depth, dealt)!;
  const pyramid = createDefaultAuthoredHexTree(catalog, SPELL, 'Pyramid');

  it('lets a refill card be dealt first and then forces the rest of the current deck', () => {
    // Pyramid column 1: the whole first deck, then one refill card.
    const first = deal(1, [], pyramid);
    expect(first.nodeKeys).toEqual(['1:1', '1:2', '1:3', '1:4', '1:5']);
    expect(first.nextTalentKeys).toEqual([GROWTH, VULNERABILITY, DAMAGE, COUNT]);
    const refillFirst = deal(1, [DAMAGE, DAMAGE], pyramid);
    expect(
      refillFirst.segments.map(({ remainingTalentKeys, drawsLeft }) => ({
        remainingTalentKeys,
        drawsLeft,
      })),
    ).toEqual([
      { remainingTalentKeys: [GROWTH, VULNERABILITY, COUNT], drawsLeft: 3 },
      { remainingTalentKeys: [VULNERABILITY, COUNT], drawsLeft: 0 },
    ]);
    expect(refillFirst.nextTalentKeys).toEqual([GROWTH, VULNERABILITY, COUNT]);
    const forced = deal(1, [DAMAGE, DAMAGE, COUNT, VULNERABILITY], pyramid);
    expect(forced.nextTalentKeys).toEqual([GROWTH]);
    const complete = deal(1, [DAMAGE, DAMAGE, COUNT, VULNERABILITY, GROWTH], pyramid);
    expect(complete.complete).toBe(true);
    expect(complete.nextTalentKeys).toEqual([]);
    const next = applyAuthoredHexTreeEdit(catalog, SPELL, pyramid, complete.edit!);
    expect(next.nodes).toMatchObject({
      '1:1': DAMAGE,
      '1:2': DAMAGE,
      '1:3': COUNT,
      '1:4': VULNERABILITY,
      '1:5': GROWTH,
    });
    expect(authoredHexColumns(catalog, SPELL, next)[0]!.drawable).toBe(true);
    expect(() => deal(1, [DAMAGE, COUNT, DAMAGE, COUNT], pyramid)).toThrow('cannot be dealt');
  });

  it('deals a subset of a deck the column does not empty', () => {
    expect(deal(1, [GROWTH]).nextTalentKeys).toEqual([VULNERABILITY, DAMAGE, COUNT]);
    expect(deal(1, [GROWTH, COUNT]).edit).toEqual({
      kind: 'setColumn',
      depth: 1,
      talentKeys: [GROWTH, COUNT],
    });
  });

  it('respects MaxCount mid-deal', () => {
    const nightBloom = 'SpellSummonTrait';
    const PREPARATION = 'PreChargeTalent';
    const tree = createDefaultAuthoredHexTree(catalog, nightBloom, 'Pyramid');
    // Growth's one copy is dealt: the refill card cannot be Growth.
    const dealt = deal(1, [GROWTH], tree, nightBloom);
    expect(dealt.nextTalentKeys).not.toContain(GROWTH);
    expect(deal(1, [PREPARATION, PREPARATION], tree, nightBloom).nextTalentKeys).not.toContain(
      PREPARATION,
    );
    // Lung column 3 reaches past Preparation's second deck: it deals at most one.
    const lungTree = createDefaultAuthoredHexTree(catalog, nightBloom, 'Lung');
    expect(deal(3, [], lungTree, nightBloom).nextTalentKeys).toContain(PREPARATION);
    expect(deal(3, [PREPARATION], lungTree, nightBloom).nextTalentKeys).not.toContain(PREPARATION);
    expect(deal(3, [], lungTree, nightBloom).nextTalentKeys).not.toContain(GROWTH);
  });

  it('completes every deal it offers, on every Hex and layout', () => {
    for (const declaration of catalog.hexes.values)
      for (const layoutKey of ['Lung', 'Pyramid', 'Maze', 'Nacelle'] as const) {
        const spell = declaration.spellTraitKey;
        const tree = createDefaultAuthoredHexTree(catalog, spell, layoutKey);
        for (const column of authoredHexColumns(catalog, spell, tree)) {
          // Always deal the last offered card: a different path from the default tree.
          let state = deal(column.depth, [], tree, spell);
          while (!state.complete) {
            expect(state.nextTalentKeys.length).toBeGreaterThan(0);
            state = deal(column.depth, [...state.dealt, state.nextTalentKeys.at(-1)!], tree, spell);
          }
          const next = applyAuthoredHexTreeEdit(catalog, spell, tree, state.edit!);
          expect(
            authoredHexColumns(catalog, spell, next).find((other) => other.depth === column.depth)!
              .drawable,
          ).toBe(true);
        }
      }
  });

  it('has no deal past an undrawable column', () => {
    const broken = applyAuthoredHexTreeEdit(catalog, SPELL, lung, {
      kind: 'setColumn',
      depth: 1,
      talentKeys: [DAMAGE, COUNT],
    });
    expect(authoredHexColumnDeal(catalog, SPELL, broken, 2, [])).toBeDefined();
    expect(authoredHexColumnDeal(catalog, SPELL, broken, 3, [])).toBeUndefined();
  });
});
