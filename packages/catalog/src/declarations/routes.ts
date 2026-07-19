import type { RouteDeclaration } from '@run-planner/core';

export const routes = [
  {
    key: 'Underworld',
    label: 'Underworld',
    biomeKeys: ['F', 'G', 'H', 'I'],
  },
  {
    key: 'Surface',
    label: 'Surface',
    biomeKeys: ['N', 'O', 'P', 'Q'],
  },
] as const satisfies readonly RouteDeclaration[];
