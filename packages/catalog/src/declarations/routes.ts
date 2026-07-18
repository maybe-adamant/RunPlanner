import type { RouteDeclaration } from '@run-planner/core';

export const routes = [
  {
    key: 'Underworld',
    label: 'Underworld',
    biomeSteps: [
      { key: 'Underworld_F', biome: 'F' },
      { key: 'Underworld_G', biome: 'G' },
      { key: 'Underworld_H', biome: 'H' },
      { key: 'Underworld_I', biome: 'I' },
    ],
  },
  {
    key: 'Surface',
    label: 'Surface',
    biomeSteps: [
      { key: 'Surface_N', biome: 'N' },
      { key: 'Surface_O', biome: 'O' },
      { key: 'Surface_P', biome: 'P' },
      { key: 'Surface_Q', biome: 'Q' },
    ],
  },
] as const satisfies readonly RouteDeclaration[];
