import type { RouteDeclaration } from '@run-planner/engine/catalog-schema';

export const routes = [
  {
    key: 'Underworld',
    label: 'Underworld',
    biomeKeys: ['F', 'G', 'H', 'I'],
    prebossRoomGameNames: ['F_PreBoss01', 'G_PreBoss01', 'H_PreBoss01', 'I_PreBoss02'],
    postbossRoomGameNames: ['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01', null],
  },
  {
    key: 'Surface',
    label: 'Surface',
    biomeKeys: ['N', 'O', 'P', 'Q'],
    prebossRoomGameNames: ['N_PreBoss01', 'O_PreBoss01', 'P_PreBoss01', 'Q_PreBoss01'],
    postbossRoomGameNames: ['N_PostBoss01', 'O_PostBoss01', 'P_PostBoss01', null],
  },
] as const satisfies readonly RouteDeclaration[];
