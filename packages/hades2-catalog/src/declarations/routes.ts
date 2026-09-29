import type { RouteDeclaration } from '@run-planner/engine/catalog-schema';

export const routes = [
  {
    key: 'Underworld',
    label: 'Underworld',
    biomeKeys: ['F', 'G', 'H', 'I'],
    completion: {
      prebossRoomGameNameByBiomeKey: {
        F: 'F_PreBoss01',
        G: 'G_PreBoss01',
        H: 'H_PreBoss01',
        I: 'I_PreBoss02',
      },
      postbossRoomGameNamesByOrdinal: ['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01', null],
    },
    initialProfile: { kind: 'matureSave' },
  },
  {
    key: 'Surface',
    label: 'Surface',
    biomeKeys: ['N', 'O', 'P', 'Q'],
    completion: {
      prebossRoomGameNameByBiomeKey: {
        N: 'N_PreBoss01',
        O: 'O_PreBoss01',
        P: 'P_PreBoss01',
        Q: 'Q_PreBoss01',
      },
      postbossRoomGameNamesByOrdinal: ['N_PostBoss01', 'O_PostBoss01', 'P_PostBoss01', null],
    },
    initialProfile: { kind: 'matureSave' },
  },
  {
    key: 'Dream',
    label: 'Dream Dive',
    biomeKeys: [],
    dreamItinerary: {
      biomeCount: 4,
      initialBiomeKeys: ['G', 'H', 'I', 'O', 'P', 'Q'],
      laterAdditionalBiomeKeys: ['F', 'N'],
      naturalSuccessorByBiomeKey: {
        F: 'G',
        G: 'H',
        H: 'I',
        N: 'O',
        O: 'P',
        P: 'Q',
      },
    },
    completion: {
      prebossRoomGameNameByBiomeKey: {
        F: 'F_PreBoss01',
        G: 'G_PreBoss01',
        H: 'H_PreBoss01',
        I: 'I_PreBoss01',
        N: 'N_PreBoss01',
        O: 'O_PreBoss01',
        P: 'P_PreBoss01',
        Q: 'Q_PreBoss01',
      },
      postbossRoomGameNamesByOrdinal: [
        'Dream_PostBoss01',
        'Dream_PostBoss02',
        'Dream_PostBoss03',
        null,
      ],
    },
    initialProfile: { kind: 'matureSave' },
  },
  {
    // StartNewGame begins the first attempt with StartNewRun(nil, { RoomName = "F_Opening01" })
    // and the aspectless DummyWeaponStaff; I_PreBoss01 is the pre-true-ending Tartarus Preboss.
    key: 'FreshFile',
    label: 'Fresh File',
    biomeKeys: ['F', 'G', 'H', 'I'],
    completion: {
      prebossRoomGameNameByBiomeKey: {
        F: 'F_PreBoss01',
        G: 'G_PreBoss01',
        H: 'H_PreBoss01',
        I: 'I_PreBoss01',
      },
      postbossRoomGameNamesByOrdinal: ['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01', null],
    },
    initialProfile: {
      kind: 'freshFile',
      fixedWeaponKey: 'WeaponStaffSwing',
      openingRoomGameName: 'F_Opening01',
    },
  },
] as const satisfies readonly RouteDeclaration[];
