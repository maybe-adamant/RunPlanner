import iconCodexFoesSurface from './assets/CodexFoesSurface.webp';
import iconCodexFoesUnderworld from './assets/CodexFoesUnderworld.webp';

/** Combat room icons by catalog biome key; `null` marks a key with no icon yet. */
export const combatRoomArtwork: Readonly<Record<string, string | null>> = {
  F: iconCodexFoesUnderworld,
  G: iconCodexFoesUnderworld,
  H: iconCodexFoesUnderworld,
  I: iconCodexFoesUnderworld,
  N: iconCodexFoesSurface,
  O: iconCodexFoesSurface,
  P: iconCodexFoesSurface,
  Q: iconCodexFoesSurface,
};
