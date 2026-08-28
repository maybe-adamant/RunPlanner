import type { RouteDeclaration } from '@run-planner/engine/catalog-schema';

export const routes = [
  {
    key: 'Underworld',
    label: 'Underworld',
    biomeKeys: ['F', 'G', 'H', 'I'],
    postbossRoomGameNames: ['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01', null],
  },
  {
    key: 'Surface',
    label: 'Surface',
    biomeKeys: ['N', 'O', 'P', 'Q'],
    postbossRoomGameNames: ['N_PostBoss01', 'O_PostBoss01', 'P_PostBoss01', null],
  },
] as const satisfies readonly RouteDeclaration[];
