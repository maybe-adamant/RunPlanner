import iconChaosGate from './assets/ChaosGate.webp';
import iconEphyraExitDoor from './assets/EphyraExitDoor.webp';
import iconErebusExitDoor from './assets/ErebusExitDoor.webp';
import iconFieldsExitDoor from './assets/FieldsExitDoor.webp';
import iconFortressMainDoor from './assets/FortressMainDoor.webp';
import iconNSubRoomDoor from './assets/NSubRoomDoor.webp';
import iconOceanusExitDoor from './assets/OceanusExitDoor.webp';
import iconOlympusIndoorExitDoor from './assets/OlympusIndoorExitDoor.webp';
import iconOlympusOutdoorExitDoor from './assets/OlympusOutdoorExitDoor.webp';
import iconShipsExitDoor from './assets/ShipsExitDoor.webp';
import iconTartarusExitDoor from './assets/TartarusExitDoor.webp';
import iconTyphonExitDoor from './assets/TyphonExitDoor.webp';
import iconZagContract from './assets/ZagContract.webp';

/** Exit door icons by catalog exit type key; `null` marks a key with no icon yet. */
export const doorArtwork: Readonly<Record<string, string | null>> = {
  ErebusExitDoor: iconErebusExitDoor,
  OceanusExitDoor: iconOceanusExitDoor,
  OlympusOutdoorExitDoor: iconOlympusOutdoorExitDoor,
  OlympusIndoorExitDoor: iconOlympusIndoorExitDoor,
  TyphonExitDoor: iconTyphonExitDoor,
  FortressMainDoor: iconFortressMainDoor,
  FieldsExitDoor: iconFieldsExitDoor,
  ShipsExitDoor: iconShipsExitDoor,
  TartarusExitDoor: iconTartarusExitDoor,
  N_OpeningDoor: null,
  EphyraExitDoor: iconEphyraExitDoor,
  EphyraExitDoorReturn: null,
  EphyraExitBossDoor: null,
  N_SubRoomDoor: iconNSubRoomDoor,
  AnomalyAutoExitDoor: null,
  ZagContract: iconZagContract,
  ChaosExitDoor: iconChaosGate,
  ChaosReturnExitDoor: null,
};
