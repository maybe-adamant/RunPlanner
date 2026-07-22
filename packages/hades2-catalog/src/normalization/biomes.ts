import type { BiomeDeclaration, CatalogCollection } from '@run-planner/engine';

import { createCollection, requireNonEmpty } from './common';

export function normalizeBiomes(
  rawBiomes: readonly BiomeDeclaration[],
): CatalogCollection<BiomeDeclaration> {
  const biomes = rawBiomes.map((biome, biomeIndex) => {
    const path = `biomes[${biomeIndex}]`;
    return Object.freeze({
      key: requireNonEmpty(biome.key, `${path}.key`),
      label: requireNonEmpty(biome.label, `${path}.label`),
    });
  });
  return createCollection(biomes, 'biomes', (biome) => biome.key);
}
