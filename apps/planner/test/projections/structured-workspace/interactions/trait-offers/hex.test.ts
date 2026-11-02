import { catalog } from '@run-planner/hades2-catalog';
import {
  authoredHexColumns,
  createDefaultAuthoredHexTree,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { findingTitleLimit } from '@planner/projections/evaluationProjection';
import type { WorkspaceHexColumnDeal } from '@planner/projections/structured-workspace';
import { projectHexTreeDomain } from '@planner/projections/structured-workspace/interactions/trait-offers/hex';

describe('Hex tree conflict titles', () => {
  it('fit a finding title with the longest Rare and Epic talent on every layout', () => {
    for (const hex of catalog.hexes.values)
      for (const layout of hex.layouts.values)
        for (const [kind, candidates] of [
          ['keystone', hex.rareCandidates.values],
          ['legendary', hex.epicCandidates.values],
        ] as const) {
          const nodes = layout.nodes.values.filter((node) => node.kind === kind);
          const longest = [...candidates].sort((a, b) => b.label.length - a.label.length)[0];
          if (nodes.length < 2 || longest === undefined) continue;
          const tree = createDefaultAuthoredHexTree(catalog, hex.spellTraitKey, layout.key);
          const repeated = {
            ...tree,
            nodes: Object.fromEntries(
              Object.entries(tree.nodes).map(([nodeKey, talentKey]) => [
                nodeKey,
                nodes.some((node) => node.key === nodeKey) ? longest.key : talentKey,
              ]),
            ),
          };
          const issues = projectHexTreeDomain(
            catalog,
            hex.spellTraitKey,
            repeated,
            createRouteAddress('Underworld'),
          )!.treeIssues;
          expect(issues.map(([key]) => key)).toContain(`repeatedTalent:${longest.key}`);
          for (const [, title] of issues)
            expect(title.length, title).toBeLessThanOrEqual(findingTitleLimit);
        }
  });
});

describe('Hex tree Common column rows', () => {
  const owner = createRouteAddress('Underworld');
  const project = (spell: string, tree = createDefaultAuthoredHexTree(catalog, spell)) =>
    projectHexTreeDomain(catalog, spell, tree, owner)!;
  const label = (spell: string, key: string) =>
    catalog.hexes.byKey[spell]!.repeatableCandidates.byKey[key]!.label;
  const picks = (deal: WorkspaceHexColumnDeal) =>
    deal.deck.flatMap((segment) => segment.cards.filter((card) => card.pick));

  it('presents the engine columns in draw order and the deck legend from the declarations', () => {
    const tree = createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait');
    const columns = authoredHexColumns(catalog, 'SpellMoonBeamTrait', tree);
    const domain = project('SpellMoonBeamTrait', tree);
    expect(domain.columns.map((row) => [row.depth, row.label, row.draw?.undrawable])).toEqual(
      columns.map((column, index) => [column.depth, `Column ${index + 1}`, false]),
    );
    domain.columns.forEach((row, index) =>
      expect(row.slots).toEqual(
        columns[index]!.slots.map((slot) => ({
          nodeKey: slot.nodeKey,
          talent: { talentKey: slot.talentKey, label: label('SpellMoonBeamTrait', slot.talentKey) },
        })),
      ),
    );
    // Only capped talents carry their cap.
    const summon = catalog.hexes.byKey['SpellSummonTrait']!;
    expect(project('SpellSummonTrait').deckLegend).toEqual(
      summon.repeatableCandidates.values.map((talent) =>
        talent.maxCount === undefined ? talent.label : `${talent.label} ×${talent.maxCount}`,
      ),
    );
    expect(project('SpellSummonTrait').deckLegend).toContain('Growth ×1');
    expect(project('SpellSummonTrait').deckLegend).toContain('Preparation ×2');
  });

  it('deals a column card by card from the cards left, ending with its column edit', () => {
    const tree = createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait');
    const row = project('SpellMoonBeamTrait', tree).columns[0]!;
    const start = row.draw!.deal([]);
    expect(start.slots.every((slot) => slot.talent === undefined)).toBe(true);
    expect(start.deck.some((segment) => segment.refill)).toBe(false);
    const first = picks(start)[0]!.talentKey;
    const one = row.draw!.deal([first]);
    expect(one.slots[0]!.talent?.talentKey).toBe(first);
    // A dealt card leaves the deck.
    expect(
      one.deck.flatMap((segment) => segment.cards).map((card) => card.talentKey),
    ).not.toContain(first);
    expect(one.edit).toBeUndefined();
    const second = picks(one)[0]!.talentKey;
    expect(row.draw!.deal([first, second]).edit).toEqual({
      kind: 'setColumn',
      depth: row.depth,
      talentKeys: [first, second],
    });
  });

  it('shows a refill where the deal reaches it, each talent a pick once', () => {
    const rows = project('SpellSummonTrait').columns;
    const crossing = rows.find((row) => row.draw!.deal([]).deck.length > 1)!;
    const deal = crossing.draw!.deal([]);
    expect(deal.deck.slice(1).every((segment) => segment.refill)).toBe(true);
    const picked = picks(deal).map((card) => card.talentKey);
    expect(new Set(picked).size).toBe(picked.length);
    // A column starting a fresh deck opens on a refill.
    for (const [index, row] of rows.entries()) {
      const before = rows[index - 1];
      if (before === undefined) continue;
      const lastBefore = before.draw!.deal([]).deck.at(-1)!.key;
      const firstHere = row.draw!.deal([]).deck[0]!;
      expect(firstHere.refill).toBe(firstHere.key !== lastBefore);
    }
  });

  it('names the first undrawable column, which can be dealt; later columns wait', () => {
    const tree = createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait');
    const [first, second] = authoredHexColumns(catalog, 'SpellMoonBeamTrait', tree);
    const broken = {
      ...tree,
      nodes: {
        ...tree.nodes,
        ...Object.fromEntries(
          first!.slots.map((slot, index) => [slot.nodeKey, second!.slots[index]!.talentKey]),
        ),
      },
    };
    const domain = project('SpellMoonBeamTrait', broken);
    expect(domain.treeIssues).toEqual([['repeatableSequence', "Column 2 can't be dealt"]]);
    expect(domain.columns.map((row) => row.draw?.undrawable)).toEqual([
      false,
      true,
      undefined,
      undefined,
      undefined,
    ]);
    expect(picks(domain.columns[1]!.draw!.deal([])).length).toBeGreaterThan(0);
  });
});
