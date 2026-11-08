import type {
  WorkspaceRoomMap,
  WorkspaceRoomMapPoint,
} from '@planner/projections/structured-workspace';

/**
 * A room image's capture: its pixel size, the camera target at its centre and
 * the pixels per world unit.
 */
export interface RoomMapCalibration {
  readonly width: number;
  readonly height: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly scale: number;
}

/** A map thing's place on the image, in percent of its width and height. */
export interface RoomMapMarkerPosition {
  readonly left: number;
  readonly top: number;
}

export interface RoomMapMarkers {
  readonly doors: readonly (RoomMapMarkerPosition & {
    readonly id: number;
    readonly doorIndex?: number;
  })[];
  readonly sideDoors: readonly (RoomMapMarkerPosition & {
    readonly id: number;
    readonly slotKey: string;
  })[];
  readonly entries: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly anchors: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly chaosPoints: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly chaosGate?: RoomMapMarkerPosition & { readonly id: number };
  readonly fieldsCagePoints: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly fieldsOptionalPoints: readonly (RoomMapMarkerPosition & { readonly id: number })[];
}

/** One world point's place on its room's calibrated, unflipped image. */
export function roomMapPosition(
  point: WorkspaceRoomMapPoint,
  calibration: RoomMapCalibration,
): RoomMapMarkerPosition {
  return {
    left:
      ((calibration.width / 2 + calibration.scale * (point.x - calibration.targetX)) /
        calibration.width) *
      100,
    top:
      ((calibration.height / 2 + calibration.scale * (point.y - calibration.targetY)) /
        calibration.height) *
      100,
  };
}

/**
 * Places the room's map points on its calibrated image. A flipped room shows
 * its image mirrored, each point at the mirrored pixel (x' = width - x).
 */
export function roomMapMarkers(
  map: WorkspaceRoomMap,
  calibration: RoomMapCalibration,
  flipped = false,
): RoomMapMarkers {
  const place = (point: WorkspaceRoomMapPoint): RoomMapMarkerPosition => {
    const { left, top } = roomMapPosition(point, calibration);
    return { left: flipped ? 100 - left : left, top };
  };
  return Object.freeze({
    doors: Object.freeze(
      map.doors.map((door) =>
        Object.freeze({
          id: door.id,
          ...(door.doorIndex === undefined ? {} : { doorIndex: door.doorIndex }),
          ...place(door),
        }),
      ),
    ),
    sideDoors: Object.freeze(
      map.sideDoors.map((door) =>
        Object.freeze({ id: door.id, slotKey: door.slotKey, ...place(door) }),
      ),
    ),
    entries: Object.freeze(
      map.entries.map((entry) => Object.freeze({ id: entry.id, ...place(entry) })),
    ),
    anchors: Object.freeze(
      map.anchors.map((anchor) => Object.freeze({ id: anchor.id, ...place(anchor) })),
    ),
    chaosPoints: Object.freeze(
      map.chaosPoints.map((point) => Object.freeze({ id: point.id, ...place(point) })),
    ),
    fieldsCagePoints: Object.freeze(
      map.fieldsCagePoints.map((point) => Object.freeze({ id: point.id, ...place(point) })),
    ),
    fieldsOptionalPoints: Object.freeze(
      map.fieldsOptionalPoints.map((point) => Object.freeze({ id: point.id, ...place(point) })),
    ),
    ...(map.chaosGate === undefined
      ? {}
      : { chaosGate: Object.freeze({ id: map.chaosGate.id, ...place(map.chaosGate) }) }),
  });
}
