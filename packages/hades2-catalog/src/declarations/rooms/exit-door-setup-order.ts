/**
 * Each room's map exit doors in its door-setup order, the order open doors enter
 * `MapState.OfferedExitDoors`, as [ObjectId, obstacle name]. Native
 * `DoUnlockRoomExits` sorts that table by obstacle name, and same-name doors
 * keep the table's walk order, which no save keeps. Door-order probe.
 */
export const exitDoorSetupOrders: Readonly<
  Record<string, readonly (readonly [doorId: number, obstacleName: string])[]>
> = {
  F_Combat02: [
    [560571, 'ErebusExitDoor'],
    [560574, 'ErebusExitDoor'],
  ],
  F_Combat03: [
    [560571, 'ErebusExitDoor'],
    [560572, 'ErebusExitDoor'],
  ],
  F_Combat04: [
    [560572, 'ErebusExitDoor'],
    [560573, 'ErebusExitDoor'],
  ],
  F_Combat05: [
    [560576, 'ErebusExitDoor'],
    [560577, 'ErebusExitDoor'],
  ],
  F_Combat06: [
    [560571, 'ErebusExitDoor'],
    [560573, 'ErebusExitDoor'],
  ],
  F_Combat07: [
    [560574, 'ErebusExitDoor'],
    [560575, 'ErebusExitDoor'],
  ],
  F_Combat08: [
    [560573, 'ErebusExitDoor'],
    [560572, 'ErebusExitDoor'],
  ],
  F_Combat11: [
    [560914, 'ErebusExitDoor'],
    [560915, 'ErebusExitDoor'],
  ],
  F_Combat12: [
    [561217, 'ErebusExitDoor'],
    [560915, 'ErebusExitDoor'],
  ],
  F_Combat13: [
    [566353, 'ErebusExitDoor'],
    [561217, 'ErebusExitDoor'],
  ],
  F_Combat14: [
    [566362, 'ErebusExitDoor'],
    [560915, 'ErebusExitDoor'],
  ],
  F_Combat15: [
    [566345, 'ErebusExitDoor'],
    [560915, 'ErebusExitDoor'],
  ],
  F_Combat16: [
    [566626, 'ErebusExitDoor'],
    [566958, 'ErebusExitDoor'],
  ],
  F_Combat17: [
    [593700, 'ErebusExitDoor'],
    [593702, 'ErebusExitDoor'],
  ],
  F_Combat18: [
    [590434, 'ErebusExitDoor'],
    [590436, 'ErebusExitDoor'],
  ],
  F_Combat19: [
    [561392, 'ErebusExitDoor'],
    [590549, 'ErebusExitDoor'],
  ],
  F_Combat20: [
    [593380, 'ErebusExitDoor'],
    [593382, 'ErebusExitDoor'],
  ],
  F_Combat21: [
    [699394, 'ErebusExitDoor'],
    [561392, 'ErebusExitDoor'],
  ],
  F_Combat22: [
    [786704, 'ErebusExitDoor'],
    [786707, 'ErebusExitDoor'],
  ],
  F_Reprieve01: [
    [560573, 'ErebusExitDoor'],
    [560575, 'ErebusExitDoor'],
  ],
  F_Shop01: [
    [561481, 'ErebusExitDoor'],
    [561482, 'ErebusExitDoor'],
  ],
  F_Story01: [
    [560572, 'ErebusExitDoor'],
    [560571, 'ErebusExitDoor'],
  ],
  G_Combat01: [
    [558233, 'OceanusExitDoor'],
    [568429, 'OceanusExitDoor'],
  ],
  G_Combat02: [
    [568576, 'OceanusExitDoor'],
    [558528, 'OceanusExitDoor'],
    [558526, 'OceanusExitDoor'],
  ],
  G_Combat03: [
    [560617, 'OceanusExitDoor'],
    [568708, 'OceanusExitDoor'],
    [558528, 'OceanusExitDoor'],
  ],
  G_Combat04: [
    [558528, 'OceanusExitDoor'],
    [568712, 'OceanusExitDoor'],
  ],
  G_Combat05: [
    [558528, 'OceanusExitDoor'],
    [568653, 'OceanusExitDoor'],
    [568792, 'OceanusExitDoor'],
  ],
  G_Combat06: [
    [569065, 'OceanusExitDoor'],
    [558528, 'OceanusExitDoor'],
  ],
  G_Combat07: [
    [569053, 'OceanusExitDoor'],
    [569070, 'OceanusExitDoor'],
  ],
  G_Combat08: [
    [569119, 'OceanusExitDoor'],
    [558528, 'OceanusExitDoor'],
  ],
  G_Combat09: [
    [569281, 'OceanusExitDoor'],
    [558528, 'OceanusExitDoor'],
    [563251, 'OceanusExitDoor'],
  ],
  G_Combat10: [
    [563168, 'OceanusExitDoor'],
    [558528, 'OceanusExitDoor'],
  ],
  G_Combat11: [
    [563168, 'OceanusExitDoor'],
    [566324, 'OceanusExitDoor'],
  ],
  G_Combat12: [
    [608958, 'OceanusExitDoor'],
    [569232, 'OceanusExitDoor'],
  ],
  G_Combat13: [
    [608958, 'OceanusExitDoor'],
    [569232, 'OceanusExitDoor'],
  ],
  G_Combat14: [
    [569053, 'OceanusExitDoor'],
    [609523, 'OceanusExitDoor'],
    [609522, 'OceanusExitDoor'],
  ],
  G_Combat15: [
    [609579, 'OceanusExitDoor'],
    [609581, 'OceanusExitDoor'],
    [609583, 'OceanusExitDoor'],
  ],
  G_Combat16: [
    [569053, 'OceanusExitDoor'],
    [737079, 'OceanusExitDoor'],
  ],
  G_Combat17: [
    [569053, 'OceanusExitDoor'],
    [737225, 'OceanusExitDoor'],
    [737226, 'OceanusExitDoor'],
  ],
  G_Combat18: [
    [776558, 'OceanusExitDoor'],
    [776559, 'OceanusExitDoor'],
    [569053, 'OceanusExitDoor'],
  ],
  G_Combat19: [
    [777358, 'OceanusExitDoor'],
    [777356, 'OceanusExitDoor'],
  ],
  G_Combat20: [
    [569053, 'OceanusExitDoor'],
    [776584, 'OceanusExitDoor'],
    [776586, 'OceanusExitDoor'],
  ],
  G_MiniBoss01: [
    [568792, 'OceanusExitDoor'],
    [558528, 'OceanusExitDoor'],
  ],
  G_MiniBoss03: [
    [569053, 'OceanusExitDoor'],
    [609760, 'OceanusExitDoor'],
  ],
  G_Reprieve01: [
    [558528, 'OceanusExitDoor'],
    [563183, 'OceanusExitDoor'],
  ],
  G_Shop01: [
    [561365, 'OceanusExitDoor'],
    [561374, 'OceanusExitDoor'],
  ],
  H_Bridge01: [
    [565616, 'FieldsExitDoor'],
    [564300, 'FieldsExitDoor'],
  ],
  H_Combat02: [
    [621470, 'FieldsExitDoor'],
    [621199, 'FieldsExitDoor'],
  ],
  H_Combat03: [
    [564448, 'FieldsExitDoor'],
    [617734, 'FieldsExitDoor'],
  ],
  H_Combat04: [
    [621199, 'FieldsExitDoor'],
    [564448, 'FieldsExitDoor'],
  ],
  H_Combat05: [
    [621199, 'FieldsExitDoor'],
    [564448, 'FieldsExitDoor'],
  ],
  H_Combat06: [
    [621470, 'FieldsExitDoor'],
    [621199, 'FieldsExitDoor'],
  ],
  H_Combat07: [
    [621199, 'FieldsExitDoor'],
    [564448, 'FieldsExitDoor'],
  ],
  H_Combat08: [
    [564448, 'FieldsExitDoor'],
    [621199, 'FieldsExitDoor'],
  ],
  H_Combat09: [
    [621470, 'FieldsExitDoor'],
    [621199, 'FieldsExitDoor'],
  ],
  H_Combat10: [
    [625258, 'FieldsExitDoor'],
    [625259, 'FieldsExitDoor'],
  ],
  H_Combat11: [
    [626254, 'FieldsExitDoor'],
    [621470, 'FieldsExitDoor'],
  ],
  H_Combat12: [
    [627867, 'FieldsExitDoor'],
    [627866, 'FieldsExitDoor'],
  ],
  H_Combat13: [
    [621470, 'FieldsExitDoor'],
    [715318, 'FieldsExitDoor'],
  ],
  H_Combat14: [
    [621470, 'FieldsExitDoor'],
    [621199, 'FieldsExitDoor'],
  ],
  H_Combat15: [
    [621199, 'FieldsExitDoor'],
    [621470, 'FieldsExitDoor'],
  ],
  H_MiniBoss01: [
    [621199, 'FieldsExitDoor'],
    [621470, 'FieldsExitDoor'],
  ],
  I_Combat01: [
    [625872, 'CWTartarusExitDoor'],
    [625883, 'CWTartarusExitDoor'],
  ],
  I_Combat03: [
    [490803, 'CWTartarusExitDoor'],
    [625815, 'CWTartarusExitDoor'],
  ],
  I_Combat04: [
    [490803, 'CWTartarusExitDoor'],
    [625685, 'CWTartarusExitDoor'],
  ],
  I_Combat09: [
    [710744, 'CWTartarusExitDoor'],
    [710745, 'CWTartarusExitDoor'],
  ],
  I_Combat10: [
    [565223, 'CWTartarusExitDoor'],
    [565224, 'CWTartarusExitDoor'],
  ],
  I_Combat11: [
    [565223, 'CWTartarusExitDoor'],
    [699962, 'CWTartarusExitDoor'],
  ],
  I_Combat12: [
    [565223, 'CWTartarusExitDoor'],
    [625309, 'CWTartarusExitDoor'],
  ],
  I_Combat15: [
    [626022, 'CWTartarusExitDoor'],
    [626024, 'CWTartarusExitDoor'],
  ],
  I_Combat18: [
    [626017, 'CWTartarusExitDoor'],
    [626020, 'CWTartarusExitDoor'],
  ],
  I_Combat21: [
    [626004, 'CWTartarusExitDoor'],
    [626013, 'CWTartarusExitDoor'],
  ],
  I_Combat22: [
    [626009, 'CWTartarusExitDoor'],
    [626012, 'CWTartarusExitDoor'],
  ],
  I_MiniBoss01: [
    [625673, 'CWTartarusExitDoor'],
    [625691, 'CWTartarusExitDoor'],
  ],
  I_MiniBoss02: [
    [625673, 'CWTartarusExitDoor'],
    [625741, 'CWTartarusExitDoor'],
  ],
  I_Reprieve01: [
    [625934, 'CWTartarusExitDoor'],
    [625937, 'CWTartarusExitDoor'],
  ],
  N_Hub: [
    [560705, 'EphyraExitDoor'],
    [560707, 'EphyraExitDoor'],
    [560708, 'EphyraExitDoor'],
    [560713, 'EphyraExitDoor'],
    [560848, 'EphyraExitDoor'],
    [560725, 'EphyraExitDoor'],
    [561368, 'EphyraExitDoor'],
    [561374, 'EphyraExitDoor'],
    [561380, 'EphyraExitDoor'],
    [560620, 'EphyraExitDoor'],
    [561389, 'EphyraExitDoor'],
    [617113, 'EphyraExitDoor'],
    [560889, 'EphyraExitDoor'],
    [560776, 'EphyraExitDoor'],
    [561418, 'EphyraExitDoor'],
    [617138, 'EphyraExitDoor'],
    [617012, 'EphyraExitDoor'],
    [561424, 'EphyraExitDoor'],
    [561337, 'EphyraExitDoor'],
    [617144, 'EphyraExitDoor'],
    [662586, 'EphyraExitBossDoor'],
    [617151, 'EphyraExitDoor'],
    [617024, 'EphyraExitDoor'],
    [616992, 'EphyraExitDoor'],
    [617162, 'EphyraExitDoor'],
    [561449, 'EphyraExitDoor'],
    [561354, 'EphyraExitDoor'],
    [617043, 'EphyraExitDoor'],
    [561395, 'EphyraExitDoor'],
    [561403, 'EphyraExitDoor'],
    [560699, 'EphyraExitDoor'],
    [560702, 'EphyraExitDoor'],
  ],
  P_Combat02: [
    [723046, 'OlympusIndoorExitDoor'],
    [560830, 'OlympusIndoorExitDoor'],
  ],
  P_Combat03: [
    [723044, 'OlympusOutdoorExitDoor'],
    [560836, 'OlympusIndoorExitDoor'],
  ],
  P_Combat04: [
    [560830, 'OlympusIndoorExitDoor'],
    [560834, 'OlympusIndoorExitDoor'],
  ],
  P_Combat07: [
    [560830, 'OlympusIndoorExitDoor'],
    [561194, 'OlympusIndoorExitDoor'],
  ],
  P_Combat08: [
    [723068, 'OlympusIndoorExitDoor'],
    [723087, 'OlympusIndoorExitDoor'],
  ],
  P_Combat09: [
    [560830, 'OlympusIndoorExitDoor'],
    [738462, 'OlympusIndoorExitDoor'],
  ],
  P_Combat10: [
    [722956, 'OlympusIndoorExitDoor'],
    [560830, 'OlympusIndoorExitDoor'],
  ],
  P_Combat11: [
    [560834, 'OlympusOutdoorExitDoor'],
    [722942, 'OlympusIndoorExitDoor'],
  ],
  P_Combat12: [
    [738509, 'OlympusIndoorExitDoor'],
    [560830, 'OlympusIndoorExitDoor'],
  ],
  P_Combat13: [
    [560834, 'OlympusOutdoorExitDoor'],
    [722942, 'OlympusIndoorExitDoor'],
  ],
  P_Combat14: [
    [723130, 'OlympusOutdoorExitDoor'],
    [723131, 'OlympusIndoorExitDoor'],
  ],
  P_Combat15: [
    [770558, 'OlympusIndoorExitDoor'],
    [738613, 'OlympusIndoorExitDoor'],
  ],
  P_Combat18: [
    [780124, 'OlympusIndoorExitDoor'],
    [777109, 'OlympusIndoorExitDoor'],
  ],
  P_Combat19: [
    [783190, 'OlympusOutdoorExitDoor'],
    [782698, 'OlympusIndoorExitDoor'],
  ],
  P_Intro: [
    [561088, 'OlympusOutdoorExitDoor'],
    [744481, 'OlympusOutdoorExitDoor'],
  ],
  P_MiniBoss01: [
    [723525, 'OlympusIndoorExitDoor'],
    [560830, 'OlympusIndoorExitDoor'],
  ],
  P_Reprieve01: [
    [744826, 'OlympusIndoorExitDoor'],
    [747468, 'OlympusIndoorExitDoor'],
  ],
  P_Story01: [
    [744818, 'OlympusIndoorExitDoor'],
    [744822, 'OlympusOutdoorExitDoor'],
  ],
  Q_Combat03: [
    [789293, 'TyphonExitDoor'],
    [768119, 'TyphonExitDoor'],
  ],
  Q_Combat05: [
    [787827, 'TyphonExitDoor'],
    [768119, 'TyphonExitDoor'],
  ],
  Q_Combat12: [
    [774745, 'TyphonExitDoor'],
    [768716, 'TyphonExitDoor'],
  ],
  Q_Combat13: [
    [774745, 'TyphonExitDoor'],
    [768716, 'TyphonExitDoor'],
  ],
  Q_Combat14: [
    [774745, 'TyphonExitDoor'],
    [768716, 'TyphonExitDoor'],
  ],
  Q_Combat15: [
    [768716, 'TyphonExitDoor'],
    [774744, 'TyphonExitDoor'],
  ],
};
