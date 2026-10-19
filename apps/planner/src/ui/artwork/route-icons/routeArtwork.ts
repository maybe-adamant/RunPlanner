import iconDreamDiveRunHistory from './assets/DreamDiveRunHistory.webp';
import iconSurface from './assets/Surface.webp';
import iconUnderworld from './assets/Underworld.webp';
import iconUnderworldNewStar from './assets/UnderworldNewStar.webp';

/** Route icons by catalog route key; `null` marks a key with no icon yet. */
export const routeArtwork: Readonly<Record<string, string | null>> = {
  Underworld: iconUnderworld,
  Surface: iconSurface,
  Dream: iconDreamDiveRunHistory,
  FreshFile: iconUnderworldNewStar,
};
