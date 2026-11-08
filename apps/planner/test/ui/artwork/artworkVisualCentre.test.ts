import { describe, expect, it } from 'vitest';

import { rewardArtwork } from '@planner/ui/artwork/rewards/rewardArtwork';
import {
  artworkVisualCentre,
  artworkVisualCentreStyle,
} from '@planner/ui/artwork/artworkVisualCentre';
import { artworkVisualCentres } from '@planner/ui/artwork/artworkVisualCentres';

// Every image the planner UI imports, apart from the room map backdrops.
const uiImages = import.meta.glob<string>(
  ['../../../src/ui/**/*.{avif,png,webp}', '!../../../src/ui/room-maps/**'],
  { eager: true, import: 'default' },
);

describe('artwork visual centres', () => {
  it('measures every artwork the planner can draw', () => {
    const urls = Object.values(uiImages);
    expect(urls.length).toBe(Object.keys(artworkVisualCentres).length);
    expect(urls.filter((url) => artworkVisualCentre(url) === undefined)).toEqual([]);
  });

  it('shifts a single icon onto its visible centre and leaves a centred one in place', () => {
    const [x, y] = artworkVisualCentre(rewardArtwork.MaxManaDrop!)!;
    expect(artworkVisualCentreStyle(rewardArtwork.MaxManaDrop!)).toEqual({
      translate: `${Math.round((0.5 - x) * 1000) / 10}% ${Math.round((0.5 - y) * 1000) / 10}%`,
    });
    const centred = Object.values(uiImages).find(
      (url) => artworkVisualCentre(url)?.join() === '0.5,0.5',
    )!;
    expect(artworkVisualCentreStyle(centred)).toBeUndefined();
  });
});
