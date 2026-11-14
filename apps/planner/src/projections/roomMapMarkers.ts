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

/**
 * An entry the capture leaves out of frame: drawn at the frame's edge, with the
 * sides it lies beyond.
 */
export interface RoomMapOffFrame {
  readonly x?: 'left' | 'right';
  readonly y?: 'above' | 'below';
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
  readonly entries: readonly (RoomMapMarkerPosition & {
    readonly id: number;
    readonly offFrame?: RoomMapOffFrame;
  })[];
  readonly anchors: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly chaosPoints: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly chaosGate?: RoomMapMarkerPosition & { readonly id: number };
  readonly fieldsCagePoints: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly fieldsOptionalPoints: readonly (RoomMapMarkerPosition & { readonly id: number })[];
  readonly shopItems: readonly (RoomMapMarkerPosition & {
    readonly id: number;
    readonly offerKey: string;
  })[];
  readonly contractPedestal?: RoomMapMarkerPosition & { readonly id: number };
  readonly wheel?: RoomMapMarkerPosition & {
    readonly id: number;
    readonly leftOffer: RoomMapMarkerPosition;
    readonly rightOffer: RoomMapMarkerPosition;
  };
}

/** One world point's place on its room's calibrated, unflipped image. */
export function roomMapPosition(
  point: Pick<WorkspaceRoomMapPoint, 'x' | 'y'>,
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

/** How far inside the frame, in percent, an off-frame entry is anchored. */
const offFrameInset = { x: 0.5, y: 0.5 } as const;

/** Keeps a position on the frame, naming the sides it lay beyond. */
function inFrame(marker: RoomMapMarkerPosition): RoomMapMarkerPosition & {
  readonly offFrame?: RoomMapOffFrame;
} {
  const clamp = (value: number, inset: number) => Math.min(Math.max(value, inset), 100 - inset);
  const x = marker.left < 0 ? 'left' : marker.left > 100 ? 'right' : undefined;
  const y = marker.top < 0 ? 'above' : marker.top > 100 ? 'below' : undefined;
  if (x === undefined && y === undefined) return marker;
  return {
    left: x === undefined ? marker.left : clamp(marker.left, offFrameInset.x),
    top: y === undefined ? marker.top : clamp(marker.top, offFrameInset.y),
    offFrame: Object.freeze({
      ...(x === undefined ? {} : { x }),
      ...(y === undefined ? {} : { y }),
    }),
  };
}

/**
 * Places the room's map points on its calibrated image. A flipped room shows
 * its image mirrored, each point at the mirrored pixel (x' = width - x). An
 * entry outside the captured frame is drawn at its edge.
 */
export function roomMapMarkers(
  map: WorkspaceRoomMap,
  calibration: RoomMapCalibration,
  flipped = false,
): RoomMapMarkers {
  const place = (point: Pick<WorkspaceRoomMapPoint, 'x' | 'y'>): RoomMapMarkerPosition => {
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
      map.entries.map((entry) => Object.freeze({ id: entry.id, ...inFrame(place(entry)) })),
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
    shopItems: Object.freeze(
      map.shopItems.map((item) =>
        Object.freeze({ id: item.id, offerKey: item.offerKey, ...place(item) }),
      ),
    ),
    ...(map.contractPedestal === undefined
      ? {}
      : {
          contractPedestal: Object.freeze({
            id: map.contractPedestal.id,
            ...place(map.contractPedestal),
          }),
        }),
    ...(map.chaosGate === undefined
      ? {}
      : { chaosGate: Object.freeze({ id: map.chaosGate.id, ...place(map.chaosGate) }) }),
    ...(map.wheel === undefined
      ? {}
      : {
          wheel: Object.freeze({
            id: map.wheel.id,
            ...place(map.wheel),
            leftOffer: Object.freeze(place(map.wheel.leftOffer)),
            rightOffer: Object.freeze(place(map.wheel.rightOffer)),
          }),
        }),
  });
}
