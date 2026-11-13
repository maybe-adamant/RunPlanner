import iconChaosGate from './assets/ChaosGate.webp';
import iconEphyraDoor from './assets/EphyraDoor.webp';
import iconEphyraSubRoomDoor from './assets/EphyraSubRoomDoor.webp';
import iconErebusDoor from './assets/ErebusDoor.webp';
import iconFieldsDoor from './assets/FieldsDoor.webp';
import iconOceanusDoor from './assets/OceanusDoor.webp';
import iconOlympusIndoorDoor from './assets/OlympusIndoorDoor.webp';
import iconShipsDoor from './assets/ShipsDoor.webp';
import iconTartarusDoor from './assets/TartarusDoor.webp';
import iconTyphonDoor from './assets/TyphonDoor.webp';
import iconZagContract from './assets/ZagContract.webp';

/** Exit door icons by catalog exit type key; `null` marks a key with no icon yet. */
export const doorArtwork: Readonly<Record<string, string | null>> = {
  ErebusExitDoor: iconErebusDoor,
  OceanusExitDoor: iconOceanusDoor,
  OlympusOutdoorExitDoor: null,
  OlympusIndoorExitDoor: iconOlympusIndoorDoor,
  TyphonExitDoor: iconTyphonDoor,
  FortressMainDoor: null,
  FieldsExitDoor: iconFieldsDoor,
  ShipsExitDoor: iconShipsDoor,
  TartarusExitDoor: iconTartarusDoor,
  N_OpeningDoor: null,
  EphyraExitDoor: iconEphyraDoor,
  EphyraExitDoorReturn: null,
  EphyraExitBossDoor: null,
  N_SubRoomDoor: iconEphyraSubRoomDoor,
  AnomalyAutoExitDoor: null,
  ZagContract: iconZagContract,
  ChaosExitDoor: iconChaosGate,
  ChaosReturnExitDoor: null,
};
