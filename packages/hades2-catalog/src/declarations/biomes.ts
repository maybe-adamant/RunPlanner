import type { BiomeDeclaration } from '@run-planner/engine/catalog-schema';

export const biomes = [
  { key: 'F', label: 'Erebus' },
  { key: 'G', label: 'Oceanus' },
  { key: 'H', label: 'Fields' },
  { key: 'I', label: 'Tartarus' },
  { key: 'N', label: 'Ephyra' },
  { key: 'O', label: 'Thessaly' },
  { key: 'P', label: 'Olympus' },
  { key: 'Q', label: 'Summit' },
] as const satisfies readonly BiomeDeclaration[];
