import type { CSSProperties } from 'react';

import { artworkVisualShapes } from './artworkVisualShapes';

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

type VisualShape = readonly [x: number, y: number, extent: number];

/** Each measured artwork's visible shape by its imported URL. */
const shapesByUrl: ReadonlyMap<string, VisualShape> = new Map(
  [...artworkUrls].flatMap(([path, url]) => {
    const shape = artworkVisualShapes[path];
    return shape === undefined ? [] : [[url, shape] as const];
  }),
);

/** An artwork's visible centre and larger side, as fractions of its contained square; undefined for one not measured. */
export function artworkVisualShape(url: string): VisualShape | undefined {
  return shapesByUrl.get(url);
}

// The share of its slot a framed boon or keepsake fills; a smaller shape is enlarged towards it,
// never past the cap, and never past the slot since the share is below one.
const filledExtent = 0.92;
const maximumScale = 1.4;

/** How much an artwork is enlarged so its visible shape fills its slot like its neighbours. */
export function artworkVisualScale(extent: number): number {
  const scale = Math.min(maximumScale, filledExtent / extent);
  return scale < 1.03 ? 1 : Math.round(scale * 100) / 100;
}

const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

/** The scale and shift that land an artwork's visible shape, filled out, on the centre of its square slot. */
export function artworkVisualShapeStyle(url: string): CSSProperties | undefined {
  const shape = shapesByUrl.get(url);
  if (shape === undefined) return undefined;
  const [x, y, extent] = shape;
  const scale = artworkVisualScale(extent);
  if (x === 0.5 && y === 0.5 && scale === 1) return undefined;
  return {
    translate: `${percent((0.5 - x) * scale)} ${percent((0.5 - y) * scale)}`,
    ...(scale === 1 ? {} : { scale: String(scale) }),
  };
}
