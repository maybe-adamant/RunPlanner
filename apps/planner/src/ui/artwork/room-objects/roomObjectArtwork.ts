import iconHermesShrine from './assets/HermesShrine.webp';
import iconKeepsakeRack from './assets/KeepsakeRack.webp';
import iconPoolOfPurging from './assets/PoolOfPurging.webp';
import iconStygianWell from './assets/StygianWell.webp';

/** In-world room object icons by planner room object key; `null` marks a key with no icon yet. */
export const roomObjectArtwork: Readonly<Record<string, string | null>> = {
  stygianWell: iconStygianWell,
  purgingPool: iconPoolOfPurging,
  hermesShrine: iconHermesShrine,
  keepsakeRack: iconKeepsakeRack,
};
