import type { CSSProperties } from 'react';

import type { RoomMapMarkerPosition } from '@planner/projections/roomMapMarkers';

/** A marker's place over the map image. */
export const position = (marker: RoomMapMarkerPosition): CSSProperties => ({
  left: `${marker.left}%`,
  top: `${marker.top}%`,
});
