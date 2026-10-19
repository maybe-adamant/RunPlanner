import iconDreamDiveAlt2 from './assets/DreamDiveAlt2.webp';
import iconSurfaceAlt2 from './assets/SurfaceAlt2.webp';
import iconUnderworldAlt1 from './assets/UnderworldAlt1.webp';

/** Header banners by catalog route key; `null` marks a key with no icon yet. */
export const routeBannerArtwork: Readonly<Record<string, string | null>> = {
  Underworld: iconUnderworldAlt1,
  Surface: iconSurfaceAlt2,
  Dream: iconDreamDiveAlt2,
  FreshFile: iconUnderworldAlt1,
};
