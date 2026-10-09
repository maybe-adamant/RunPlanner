import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultAuthoredHexTree } from '@run-planner/engine/authored-project';
import type { HexLayoutKey } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import { CATALOG_VERSION, migrateProjectDocument } from '@planner/persistence/project-93-to-94.js';

describe.runIf(catalog.version === CATALOG_VERSION)('schema 93 to 94 Hex tree migration', () => {
  it('fills every Hex and layout exactly as the catalog default around the Rare and Epic picks', () => {
    for (const hex of catalog.hexes.values)
      for (const layout of hex.layouts.values) {
        const tree = createDefaultAuthoredHexTree(
          catalog,
          hex.spellTraitKey,
          layout.key as HexLayoutKey,
        );
        const picks = (kind: string) =>
          layout.nodes.values.flatMap((node) => (node.kind === kind ? [tree.nodes[node.key]] : []));
        const migrated = migrateProjectDocument({
          schemaVersion: 93,
          catalogVersion: CATALOG_VERSION,
          offer: {
            options: [{ traitKey: hex.spellTraitKey }],
            selectedOptionKey: 'option1',
            hexTree: {
              layoutKey: layout.key,
              rareTalentKeys: picks('keystone'),
              epicTalentKeys: picks('legendary'),
            },
          },
        }) as { offer: { hexTree: unknown } };
        expect(migrated.offer.hexTree, `${hex.spellTraitKey} ${layout.key}`).toEqual(tree);
      }
  });
});
