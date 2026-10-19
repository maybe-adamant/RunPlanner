import iconEphyraRunHistory from './assets/EphyraRunHistory.webp';
import iconErebusRunHistory from './assets/ErebusRunHistory.webp';
import iconFieldsRunHistory from './assets/FieldsRunHistory.webp';
import iconOceanusRunHistory from './assets/OceanusRunHistory.webp';
import iconOlympusRunHistory from './assets/OlympusRunHistory.webp';
import iconSummitRunHistory from './assets/SummitRunHistory.webp';
import iconTartarusRunHistory from './assets/TartarusRunHistory.webp';
import iconThessalyRunHistory from './assets/ThessalyRunHistory.webp';

/** Biome boss icons by catalog biome key; `null` marks a key with no icon yet. */
export const bossArtwork: Readonly<Record<string, string | null>> = {
  F: iconErebusRunHistory,
  G: iconOceanusRunHistory,
  H: iconFieldsRunHistory,
  I: iconTartarusRunHistory,
  N: iconEphyraRunHistory,
  O: iconThessalyRunHistory,
  P: iconOlympusRunHistory,
  Q: iconSummitRunHistory,
};
