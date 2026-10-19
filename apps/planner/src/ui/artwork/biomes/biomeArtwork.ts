import iconEphyraBountyBoard from './assets/EphyraBountyBoard.webp';
import iconErebusBountyBoard from './assets/ErebusBountyBoard.webp';
import iconFieldsBountyBoard from './assets/FieldsBountyBoard.webp';
import iconOceanusBountyBoard from './assets/OceanusBountyBoard.webp';
import iconOlympusBountyBoard from './assets/OlympusBountyBoard.webp';
import iconSummitCauldronIncantation from './assets/SummitCauldronIncantation.webp';
import iconTartarusCauldronIncantationNoBadge from './assets/TartarusCauldronIncantationNoBadge.webp';
import iconThessalyBountyBoard from './assets/ThessalyBountyBoard.webp';

/** Biome icons by catalog biome key; `null` marks a key with no icon yet. */
export const biomeArtwork: Readonly<Record<string, string | null>> = {
  F: iconErebusBountyBoard,
  G: iconOceanusBountyBoard,
  H: iconFieldsBountyBoard,
  I: iconTartarusCauldronIncantationNoBadge,
  N: iconEphyraBountyBoard,
  O: iconThessalyBountyBoard,
  P: iconOlympusBountyBoard,
  Q: iconSummitCauldronIncantation,
};
