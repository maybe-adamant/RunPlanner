import iconChallengeSwitch from './assets/ChallengeSwitch.webp';
import iconDoorLock from './assets/DoorLock.webp';
import iconHermesShrine from './assets/HermesShrine.webp';
import iconInfernalTrove from './assets/InfernalTrove.webp';
import iconKeepsakeRack from './assets/KeepsakeRack.webp';
import iconLockedDoors from './assets/LockedDoors.webp';
import iconMoonMonument from './assets/MoonMonument.webp';
import iconPoolOfPurging from './assets/PoolOfPurging.webp';
import iconStygianWell from './assets/StygianWell.webp';
import iconUnseenSigil from './assets/UnseenSigil.webp';

/** In-world room object icons by planner room object key; `null` marks a key with no icon yet. */
export const roomObjectArtwork: Readonly<Record<string, string | null>> = {
  stygianWell: iconStygianWell,
  purgingPool: iconPoolOfPurging,
  hermesShrine: iconHermesShrine,
  keepsakeRack: iconKeepsakeRack,
  challengeSwitch: iconChallengeSwitch,
  infernalTrove: iconInfernalTrove,
  moonMonument: iconMoonMonument,
  unseenSigil: iconUnseenSigil,
  lockedDoors: iconLockedDoors,
  doorLock: iconDoorLock,
};
