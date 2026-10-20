import iconDreamDiveScene from './assets/DreamDiveScene.webp';
import iconSurfaceScene from './assets/SurfaceScene.webp';
import iconUnderworldScene from './assets/UnderworldScene.webp';

/** Route backdrops by catalog route key; `null` marks a key with no art yet. */
export const routeBannerArtwork: Readonly<Record<string, string | null>> = {
  Underworld: iconUnderworldScene,
  Surface: iconSurfaceScene,
  Dream: iconDreamDiveScene,
  FreshFile: iconUnderworldScene,
};
