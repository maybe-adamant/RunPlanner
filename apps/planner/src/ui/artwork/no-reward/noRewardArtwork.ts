import iconPostBossAhead from './assets/PostBossAhead.webp';
import iconPostBossUp from './assets/PostBossUp.webp';

/** Door icons for rooms without a reward, by catalog biome key; `null` marks a key with no icon yet. */
export const noRewardArtwork: Readonly<Record<string, string | null>> = {
  F: null,
  G: null,
  H: null,
  I: null,
  N: null,
  O: iconPostBossAhead,
  P: null,
  Q: iconPostBossUp,
};
