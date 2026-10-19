import iconFountainErebus from './assets/FountainErebus.webp';
import iconFountainOceanus from './assets/FountainOceanus.webp';
import iconFountainOlympus from './assets/FountainOlympus.webp';
import iconFountainTartarus from './assets/FountainTartarus.webp';
import iconFountainThessaly from './assets/FountainThessaly.webp';

/** Fountain room icons by catalog biome key; `null` marks a key with no icon yet. */
export const fountainArtwork: Readonly<Record<string, string | null>> = {
  F: iconFountainErebus,
  G: iconFountainOceanus,
  H: null,
  I: iconFountainTartarus,
  N: null,
  O: iconFountainThessaly,
  P: iconFountainOlympus,
  Q: null,
};
