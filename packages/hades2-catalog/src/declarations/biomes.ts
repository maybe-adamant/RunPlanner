import type { BiomeDeclaration } from '@run-planner/engine/catalog-schema';

export const biomes = [
  { key: 'F', label: 'Erebus', hasPostbossKeepsakeRack: true },
  { key: 'G', label: 'Oceanus', hasPostbossKeepsakeRack: true },
  { key: 'H', label: 'Fields', hasPostbossKeepsakeRack: true },
  { key: 'I', label: 'Tartarus', hasPostbossKeepsakeRack: false },
  { key: 'N', label: 'Ephyra', hasPostbossKeepsakeRack: true },
  { key: 'O', label: 'Thessaly', hasPostbossKeepsakeRack: true },
  { key: 'P', label: 'Olympus', hasPostbossKeepsakeRack: true },
  { key: 'Q', label: 'Summit', hasPostbossKeepsakeRack: false },
] as const satisfies readonly BiomeDeclaration[];
