import iconFBoss from './assets/FBoss.webp';
import iconGBoss from './assets/GBoss.webp';
import iconHBoss from './assets/HBoss.webp';
import iconIBoss from './assets/IBoss.webp';
import iconNBoss from './assets/NBoss.webp';
import iconOBoss from './assets/OBoss.webp';
import iconPBoss from './assets/PBoss.webp';
import iconQBoss from './assets/QBoss.webp';

/** Biome boss icons by catalog biome key; `null` marks a key with no icon yet. */
export const bossArtwork: Readonly<Record<string, string | null>> = {
  F: iconFBoss,
  G: iconGBoss,
  H: iconHBoss,
  I: iconIBoss,
  N: iconNBoss,
  O: iconOBoss,
  P: iconPBoss,
  Q: iconQBoss,
};
