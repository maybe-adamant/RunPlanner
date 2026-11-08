import type { WorkspaceRoomMap } from '@planner/projections/structured-workspace';
import { roomMapMarkers, type RoomMapMarkers } from '@planner/projections/roomMapMarkers';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { melinoeIcon } from '@planner/ui/artwork/player/playerArtwork';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { position } from './roomMapPosition';

/** What stands on a map point: its name, icon and corner mark. */
export interface RoomMapOccupant {
  readonly label: string;
  readonly icon?: ArtworkSource | undefined;
  readonly badge?: string | undefined;
}

/**
 * The room as planned on its points: the entry it is entered at (others dim),
 * what stands on each anchor and Fields point, and the point a control
 * previews.
 */
export interface RoomMapPlacements {
  /** The settled or chosen entry; absent while the game picks. */
  readonly entryId?: number | undefined;
  readonly entryNumbers: ReadonlyMap<number, number>;
  readonly anchors: ReadonlyMap<number, RoomMapOccupant>;
  readonly anchorNumbers: ReadonlyMap<number, number>;
  readonly fieldsPoints: ReadonlyMap<number, RoomMapOccupant>;
  readonly preview?:
    { readonly kind: 'entry' | 'anchor' | 'fieldsPoint'; readonly id: number } | undefined;
}

const unplanned: RoomMapPlacements = Object.freeze({
  entryNumbers: new Map(),
  anchors: new Map(),
  anchorNumbers: new Map(),
  fieldsPoints: new Map(),
});

/**
 * Anchors, Fields points and entries: Melinoë's head at each entry, a ring at
 * each anchor or point, with what stands there.
 */
export function RoomMapSpots({
  markers,
  placements = unplanned,
}: {
  readonly markers: RoomMapMarkers;
  readonly placements?: RoomMapPlacements;
}) {
  const previewed = (kind: 'entry' | 'anchor' | 'fieldsPoint', id: number) =>
    (placements.preview?.kind === kind && placements.preview.id === id) || undefined;
  const occupantMark = (occupant: RoomMapOccupant | undefined) =>
    occupant === undefined ? null : (
      <>
        <ArtworkIcon className="artwork-label-icon" source={occupant.icon} />
        {occupant.badge === undefined ? null : (
          <span aria-hidden="true" className="room-map-number">
            {occupant.badge}
          </span>
        )}
      </>
    );
  // An entry the game picks leaves every entry lit; a settled one dims the others.
  const entryShown =
    placements.preview?.kind === 'entry' ? placements.preview.id : placements.entryId;
  return (
    <>
      {markers.anchors.map((anchor) => {
        const occupant = placements.anchors.get(anchor.id);
        const number = placements.anchorNumbers.get(anchor.id);
        return (
          <span
            aria-label={
              occupant === undefined
                ? 'Object spot'
                : `${occupant.label}${number === undefined ? '' : ` on A${number}`}`
            }
            className="room-map-point"
            data-occupied={occupant !== undefined || undefined}
            data-point="anchor"
            data-preview={previewed('anchor', anchor.id)}
            key={`anchor:${anchor.id}`}
            role="img"
            style={position(anchor)}
          >
            {occupantMark(occupant)}
          </span>
        );
      })}
      {[
        ...markers.fieldsCagePoints.map((point) => ['cage', point] as const),
        ...markers.fieldsOptionalPoints.map((point) => ['pickup', point] as const),
      ].map(([kind, point]) => {
        const occupant = placements.fieldsPoints.get(point.id);
        return (
          <span
            aria-label={occupant === undefined ? `Fields ${kind} point` : occupant.label}
            className="room-map-point"
            data-occupied={occupant !== undefined || undefined}
            data-point={kind}
            data-preview={previewed('fieldsPoint', point.id)}
            key={`fields:${point.id}`}
            role="img"
            style={position(point)}
          >
            {occupantMark(occupant)}
          </span>
        );
      })}
      {markers.entries.map((entry) => {
        const number = placements.entryNumbers.get(entry.id);
        return (
          <span
            aria-label={number === undefined ? 'Entry' : `Entry E${number}`}
            className="room-map-entry"
            data-chosen={(entryShown !== undefined && entryShown === entry.id) || undefined}
            data-dim={(entryShown !== undefined && entryShown !== entry.id) || undefined}
            data-preview={previewed('entry', entry.id)}
            key={`entry:${entry.id}`}
            role="img"
            style={position(entry)}
          >
            <img alt="" draggable={false} src={melinoeIcon} />
            {number === undefined ? null : (
              <span aria-hidden="true" className="room-map-number">
                E{number}
              </span>
            )}
          </span>
        );
      })}
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
    ...(markers.fieldsCagePoints.length > 0 ? (['cage'] as const) : []),
    ...(markers.fieldsOptionalPoints.length > 0 ? (['pickup'] as const) : []),
  ];
  if (kinds.length === 0) return null;
  const names = {
    exit: 'Exit',
    chaos: 'Chaos',
    entry: 'Entry',
    anchor: 'Object spot',
    cage: 'Cage point',
    pickup: 'Pickup point',
  } as const;
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
