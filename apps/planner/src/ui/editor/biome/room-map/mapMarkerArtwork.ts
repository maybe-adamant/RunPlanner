import type { CSSProperties } from 'react';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { mapMarkerArtworkCentres } from './mapMarkerArtworkCentres';

const artworkFolder = '../../../artwork/';

// The same URLs the artwork modules import, keyed by their path under the artwork folder.
const markerArtworkUrls = import.meta.glob<string>(
  [
    // Globs take literal paths: these are the artwork folder's map-marker folders.
    '../../../artwork/rewards/assets/*.{avif,png,webp}',
    '../../../artwork/room-objects/assets/*.{avif,png,webp}',
    '../../../artwork/npcs/assets/*.{avif,png,webp}',
    '../../../artwork/rerolls/assets/*.{avif,png,webp}',
  ],
  { eager: true, import: 'default' },
);

const centresByUrl: ReadonlyMap<string, readonly [number, number]> = new Map(
  Object.entries(markerArtworkUrls).flatMap(([path, url]) => {
    const centre = mapMarkerArtworkCentres[path.slice(artworkFolder.length)];
    return centre === undefined ? [] : [[url, centre] as const];
  }),
);

/** An artwork's visible centre, as fractions of its contained square; undefined for one not measured. */
export function mapMarkerArtworkCentre(url: string): readonly [number, number] | undefined {
  return centresByUrl.get(url);
}

/** The shift that lands a marker icon's visible centre on its ring's centre. */
export function mapMarkerArtworkStyle(
  source: ArtworkSource | undefined,
): CSSProperties | undefined {
  if (typeof source !== 'string') return undefined;
  const centre = centresByUrl.get(source);
  if (centre === undefined) return undefined;
  const shift = (value: number) => `${Math.round((0.5 - value) * 1000) / 10}%`;
  return { translate: `${shift(centre[0])} ${shift(centre[1])}` };
}
