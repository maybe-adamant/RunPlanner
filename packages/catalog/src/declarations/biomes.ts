import type { BiomeDeclaration } from '@run-planner/core';

export const biomes = [
  { key: 'F', label: 'Erebus' },
  { key: 'G', label: 'Oceanus' },
  { key: 'H', label: 'Fields of Mourning' },
  { key: 'I', label: 'Tartarus' },
  { key: 'N', label: 'City of Ephyra' },
  { key: 'O', label: 'Rift of Thessaly' },
  { key: 'P', label: 'Mount Olympus' },
  { key: 'Q', label: 'Summit' },
] as const satisfies readonly BiomeDeclaration[];
