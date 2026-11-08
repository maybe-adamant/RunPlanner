import type { CSSProperties } from 'react';

import type { RoomMapMarkerPosition } from '@planner/projections/roomMapMarkers';

/** A marker's place over the map image. */
export const position = (marker: RoomMapMarkerPosition): CSSProperties => ({
  left: `${marker.left}%`,
  top: `${marker.top}%`,
});

/** How close to an edge, in percent of the image, a chip turns away from it. */
const edgeMargin = { x: 8, y: 7 } as const;

/**
 * The side a chip extends to from its point: centred on it, or away from an
 * edge it would cross (below a point near the top, inward from a side).
 */
export interface RoomMapChipSide {
  readonly x?: 'right' | 'left';
  readonly y?: 'below' | 'above';
}

export function roomMapChipSide(marker: RoomMapMarkerPosition): RoomMapChipSide {
  const x =
    marker.left < edgeMargin.x ? 'right' : marker.left > 100 - edgeMargin.x ? 'left' : undefined;
  const y =
    marker.top < edgeMargin.y ? 'below' : marker.top > 100 - edgeMargin.y ? 'above' : undefined;
  return { ...(x === undefined ? {} : { x }), ...(y === undefined ? {} : { y }) };
}

/**
 * A marker's place and, shown as a chip, the side it extends to, as element
 * attributes; a ring stays centred on its point.
 */
export function markerPlacement(
  marker: RoomMapMarkerPosition,
  chip: boolean,
): {
  readonly style: CSSProperties;
  readonly 'data-chip-x'?: 'right' | 'left';
  readonly 'data-chip-y'?: 'below' | 'above';
} {
  const side = chip ? roomMapChipSide(marker) : {};
  return {
    style: position(marker),
    ...(side.x === undefined ? {} : { 'data-chip-x': side.x }),
    ...(side.y === undefined ? {} : { 'data-chip-y': side.y }),
  };
}
