import type { CSSProperties } from 'react';

import { artworkVisualCentres } from './artworkVisualCentres';

// The same URLs the artwork modules import, keyed by their path under the UI folder. Globs
// take literal paths, and their keys are relative to this folder.
const artworkUrls: ReadonlyMap<string, string> = new Map([
  ...Object.entries(
    import.meta.glob<string>('./*/assets/*.{avif,png,webp}', { eager: true, import: 'default' }),
  ).map(([path, url]) => [`artwork/${path.slice('./'.length)}`, url] as const),
  ...Object.entries(
    import.meta.glob<string>('../controls/*/assets/*.{avif,png,webp}', {
      eager: true,
      import: 'default',
    }),
  ).map(([path, url]) => [path.slice('../'.length), url] as const),
]);

/** Each measured artwork's visible centre by its imported URL. */
const centresByUrl: ReadonlyMap<string, readonly [number, number]> = new Map(
  [...artworkUrls].flatMap(([path, url]) => {
    const centre = artworkVisualCentres[path];
    return centre === undefined ? [] : [[url, centre] as const];
  }),
);

/** An artwork's visible centre, as fractions of its contained square; undefined for one not measured. */
export function artworkVisualCentre(url: string): readonly [number, number] | undefined {
  return centresByUrl.get(url);
}

const shift = (value: number) => `${Math.round((0.5 - value) * 1000) / 10}%`;

/** The shift that lands an artwork's visible centre on the centre of its square slot. */
export function artworkVisualCentreStyle(url: string): CSSProperties | undefined {
  const centre = centresByUrl.get(url);
  if (centre === undefined || (centre[0] === 0.5 && centre[1] === 0.5)) return undefined;
  return { translate: `${shift(centre[0])} ${shift(centre[1])}` };
}
