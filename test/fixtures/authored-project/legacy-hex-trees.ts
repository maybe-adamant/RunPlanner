import { catalog } from '@run-planner/hades2-catalog';

/** A pre-94 document body: each Hex tree's Keystone and Legendary talents as Rare and Epic picks. */
export function legacyRareEpicHexTrees(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(legacyRareEpicHexTrees);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (key !== 'hexTree' && key !== 'aspectHexTree') return [key, legacyRareEpicHexTrees(entry)];
      const tree = entry as { layoutKey: string; nodes: Record<string, string> };
      const layout = catalog.hexes.values[0]!.layouts.byKey[tree.layoutKey]!;
      const talents = (kind: string) =>
        layout.nodes.values.flatMap((node) => (node.kind === kind ? [tree.nodes[node.key]] : []));
      return [
        key,
        {
          layoutKey: tree.layoutKey,
          rareTalentKeys: talents('keystone'),
          epicTalentKeys: talents('legendary'),
        },
      ];
    }),
  );
}
