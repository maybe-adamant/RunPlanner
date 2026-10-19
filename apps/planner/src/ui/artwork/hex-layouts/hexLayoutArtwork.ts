import iconLung from './assets/Lung.webp';
import iconMaze from './assets/Maze.webp';
import iconNacelle from './assets/Nacelle.webp';
import iconPyramid from './assets/Pyramid.webp';

/** Path of Stars layout icons by catalog layout key; `null` marks a key with no icon yet. */
export const hexLayoutArtwork: Readonly<Record<string, string | null>> = {
  Lung: iconLung,
  Pyramid: iconPyramid,
  Maze: iconMaze,
  Nacelle: iconNacelle,
};
