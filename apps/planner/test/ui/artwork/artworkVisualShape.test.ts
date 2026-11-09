import { describe, expect, it } from 'vitest';

import { rewardArtwork } from '@planner/ui/artwork/rewards/rewardArtwork';
import {
  artworkVisualScale,
  artworkVisualShape,
  artworkVisualShapeStyle,
} from '@planner/ui/artwork/artworkVisualShape';
import { artworkVisualShapes } from '@planner/ui/artwork/artworkVisualShapes';

// Every image the planner UI imports, apart from the room map backdrops.
const uiImages = import.meta.glob<string>(
  ['../../../src/ui/**/*.{avif,png,webp}', '!../../../src/ui/room-maps/**'],
  { eager: true, import: 'default' },
);

describe('artwork visual shapes', () => {
  it('measures the centre and extent of every artwork the planner can draw', () => {
    const urls = Object.values(uiImages);
    expect(urls.length).toBe(Object.keys(artworkVisualShapes).length);
    expect(urls.filter((url) => artworkVisualShape(url) === undefined)).toEqual([]);
    for (const [, , extent] of Object.values(artworkVisualShapes)) {
      expect(extent).toBeGreaterThan(0);
      expect(extent).toBeLessThanOrEqual(1);
    }
  });

  it('enlarges a small visible shape without letting it outgrow its slot', () => {
    for (const [, , extent] of Object.values(artworkVisualShapes)) {
      const scale = artworkVisualScale(extent);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(extent * scale).toBeLessThanOrEqual(1);
    }
    expect(artworkVisualScale(1)).toBe(1);
  });

  it('shifts a single icon onto its visible centre at its enlarged size', () => {
    const [x, y, extent] = artworkVisualShape(rewardArtwork.MaxManaDrop!)!;
    const scale = artworkVisualScale(extent);
    expect(scale).toBeGreaterThan(1);
    expect(artworkVisualShapeStyle(rewardArtwork.MaxManaDrop!)).toEqual({
      translate: `${Math.round((0.5 - x) * scale * 1000) / 10}% ${Math.round((0.5 - y) * scale * 1000) / 10}%`,
      scale: String(scale),
    });
    const settled = Object.values(uiImages).find((url) => {
      const shape = artworkVisualShape(url);
      return shape?.[0] === 0.5 && shape[1] === 0.5 && artworkVisualScale(shape[2]) === 1;
    })!;
    expect(artworkVisualShapeStyle(settled)).toBeUndefined();
  });
});
