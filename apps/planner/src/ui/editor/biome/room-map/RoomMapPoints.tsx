import type { WorkspaceRoomMap } from '@planner/projections/structured-workspace';
import { roomMapMarkers, type RoomMapMarkers } from '@planner/projections/roomMapMarkers';
import { melinoeIcon } from '@planner/ui/artwork/player/playerArtwork';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { position } from './roomMapPosition';

/** Anchors and entries: Melinoë's head at each entry, a filled spot at each anchor. */
export function RoomMapSpots({ markers }: { readonly markers: RoomMapMarkers }) {
  return (
    <>
      {markers.anchors.map((anchor) => (
        <span
          aria-label="Anchor"
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
        />
      ))}
    </div>
  );
}
