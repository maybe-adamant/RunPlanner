import iconChaosGate from './assets/ChaosGate.webp';
import iconZagContract from './assets/ZagContract.webp';

/** Exit door icons by catalog exit type key; `null` marks a key with no icon yet. */
export const doorArtwork: Readonly<Record<string, string | null>> = {
  ErebusExitDoor: null,
  OceanusExitDoor: null,
  OlympusOutdoorExitDoor: null,
  OlympusIndoorExitDoor: null,
  TyphonExitDoor: null,
  FortressMainDoor: null,
  FieldsExitDoor: null,
  ShipsExitDoor: null,
  TartarusExitDoor: null,
  N_OpeningDoor: null,
  EphyraExitDoor: null,
  EphyraExitDoorReturn: null,
  EphyraExitBossDoor: null,
  N_SubRoomDoor: null,
  AnomalyAutoExitDoor: null,
  ZagContract: iconZagContract,
  ChaosExitDoor: iconChaosGate,
  ChaosReturnExitDoor: null,
};
