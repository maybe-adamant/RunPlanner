import type { WorkspaceRoomMap } from '@planner/projections/structured-workspace';
import { roomMapMarkers, type RoomMapMarkers } from '@planner/projections/roomMapMarkers';
import { melinoeIcon } from '@planner/ui/artwork/player/playerArtwork';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { position } from './roomMapPosition';

/** Anchors and entries: Melinoë's head at each entry, a ring at each anchor. */
export function RoomMapSpots({ markers }: { readonly markers: RoomMapMarkers }) {
  return (
    <>
      {markers.anchors.map((anchor) => (
        <span
          aria-label="Object spot"
          className="room-map-point"
          data-point="anchor"
          key={`anchor:${anchor.id}`}
          role="img"
          style={position(anchor)}
        />
      ))}
      {markers.entries.map((entry) => (
        <img
          alt="Entry"
          className="room-map-entry"
          draggable={false}
          key={`entry:${entry.id}`}
          src={melinoeIcon}
          style={position(entry)}
        />
      ))}
    </>
  );
}

/**
 * A number on a marker's corner: a door's, as its Door row and Timeline name
 * it, or a Chaos point's position.
 */
export function RoomMapNumber({ value }: { readonly value: number | undefined }) {
  return value === undefined ? null : (
    <span aria-hidden="true" className="room-map-number">
      {value}
    </span>
  );
}

/** The kinds of point a map shows, one swatch each, under the map. */
export function RoomMapLegend({
  chaos,
  markers,
}: {
  /** Whether the map shows a Chaos gate or Chaos points. */
  readonly chaos: boolean;
  readonly markers: RoomMapMarkers;
}) {
  const kinds = [
    ...(markers.doors.length > 0 ? (['exit'] as const) : []),
    ...(chaos ? (['chaos'] as const) : []),
    ...(markers.entries.length > 0 ? (['entry'] as const) : []),
    ...(markers.anchors.length > 0 ? (['anchor'] as const) : []),
  ];
  if (kinds.length === 0) return null;
  const names = { exit: 'Exit', chaos: 'Chaos', entry: 'Entry', anchor: 'Object spot' } as const;
  return (
    <ul aria-label="Map key" className="room-map-legend">
      {kinds.map((kind) => (
        <li data-kind={kind} key={kind}>
          {kind === 'entry' ? (
            <img alt="" className="room-map-legend-entry" draggable={false} src={melinoeIcon} />
          ) : (
            <span aria-hidden="true" className="room-map-legend-swatch" />
          )}
          {names[kind]}
        </li>
      ))}
    </ul>
  );
}

/** A feature map's key: the kinds of point the room has. */
export function RoomFeatureMapLegend({
  gameName,
  map,
}: {
  readonly gameName: string;
  readonly map: WorkspaceRoomMap;
}) {
  const calibration = roomMapCalibrations[gameName];
  if (calibration === undefined) return null;
  const markers = roomMapMarkers(map, calibration);
  return <RoomMapLegend chaos={markers.chaosPoints.length > 0} markers={markers} />;
}

/**
 * The room's map points alone, with no plan: its doors, every Chaos point,
 * entries and anchors, on a calibrated image.
 */
export function RoomFeatureMapPoints({
  gameName,
  map,
  title,
}: {
  readonly gameName: string;
  readonly map: WorkspaceRoomMap;
  readonly title: string;
}) {
  const calibration = roomMapCalibrations[gameName];
  if (calibration === undefined) return null;
  const markers = roomMapMarkers(map, calibration);
  return (
    <div aria-label={`${title} map points`} className="room-map-marker-layer" role="group">
      <RoomMapSpots markers={markers} />
      {markers.chaosPoints.map((point) => (
        <span
          aria-label="Chaos gate point"
          className="room-map-door"
          data-chaos
          data-closed
          key={`chaos:${point.id}`}
          role="img"
          style={position(point)}
        />
      ))}
      {markers.doors.map((door) => (
        <span
          aria-label={door.doorIndex === undefined ? 'Door' : `Door ${door.doorIndex}`}
          className="room-map-door"
          data-closed
          key={`door:${door.id}`}
          role="img"
          style={position(door)}
        >
          <RoomMapNumber value={door.doorIndex} />
        </span>
      ))}
    </div>
  );
}
