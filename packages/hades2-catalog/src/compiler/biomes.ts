import type { BiomeDeclaration, CatalogCollection } from '@run-planner/engine/catalog-schema';

import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

export function normalizeBiomes(
  rawBiomes: readonly BiomeDeclaration[],
): CatalogCollection<BiomeDeclaration> {
  const biomes = rawBiomes.map((biome, biomeIndex) => {
    const path = `biomes[${biomeIndex}]`;
    return Object.freeze({
      key: requireNonEmpty(biome.key, `${path}.key`),
      label: requireNonEmpty(biome.label, `${path}.label`),
      minDepthBeforeIntros:
        Number.isInteger(biome.minDepthBeforeIntros) && biome.minDepthBeforeIntros >= 0
          ? biome.minDepthBeforeIntros
          : fail(`${path}.minDepthBeforeIntros`, 'must be a nonnegative integer'),
    });
  });
  return createCollection(biomes, 'biomes', (biome) => biome.key);
}
