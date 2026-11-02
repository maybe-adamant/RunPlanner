import { catalog } from '@run-planner/hades2-catalog';
import {
  createDefaultAuthoredHexTree,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { findingTitleLimit } from '@planner/projections/evaluationProjection';
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
