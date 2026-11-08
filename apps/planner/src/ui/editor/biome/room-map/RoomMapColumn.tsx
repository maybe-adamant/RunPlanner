import type { WorkspaceRoomMap } from '@planner/projections/structured-workspace';
import { roomMapMarkers } from '@planner/projections/roomMapMarkers';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { DoorChipFace } from '../DecisionWorkbench';
import type { DoorChip } from '../doorSummary';
import {
  RoomMapNumber,
  RoomMapLegend,
  RoomMapSpots,
  type RoomMapPlacements,
} from './RoomMapPoints';
import { useRoomMapHighlight } from './roomMapHighlight';
import { position } from './roomMapPosition';

/**
 * The room at one point of its Timeline: `closed` before its doors open,
 * `open` once they do, `left` once it is left by the taken door. `summary`
 * is the room as planned, every door open and the taken one lit.
 */
export type RoomMapStage = 'closed' | 'open' | 'left' | 'summary';

const chipName = (chip: DoorChip): string =>
  chip.locked === true ? `${chip.label} · Locked` : chip.label;

/**
 * The room's map beside its controls: its doors, Chaos gate, entries, anchors
 * and Fields points, mirrored when the room is flipped.
 */
export function RoomMapColumn({
  chips = [],
  flipped = false,
  gameName,
  map,
  placements,
  roomIdentity,
  stage,
  title,
}: {
  /** The room's settled flip; a previewed flip or entry shows its own. */
  readonly flipped?: boolean | undefined;
  /** What stands on the room's points as planned. */
  readonly placements?: Omit<RoomMapPlacements, 'preview'> | undefined;
  /** The room's doors as its Timeline shows them. */
  readonly chips?: readonly DoorChip[] | undefined;
  readonly gameName: string;
  readonly map: WorkspaceRoomMap;
  /** A different room never inherits this map's pan and zoom. */
  readonly roomIdentity: string;
  readonly stage: RoomMapStage;
  readonly title: string;
}) {
  const highlight = useRoomMapHighlight();
  const calibration = roomMapCalibrations[gameName];
  if (calibration === undefined) return null;
  // A previewed flip, or the flip a previewed entry sets, shows the room that way.
  const shownFlip =
    highlight?.kind === 'flip' && highlight.flipped !== undefined
      ? highlight.flipped
      : highlight?.kind === 'entry' && highlight.flipped !== undefined
        ? highlight.flipped
        : flipped;
  const markers = roomMapMarkers(map, calibration, shownFlip);
  const preview =
    highlight?.kind === 'entry' && highlight.pointId !== undefined
      ? { kind: 'entry' as const, id: highlight.pointId }
      : highlight?.kind === 'anchor'
        ? { kind: 'anchor' as const, id: highlight.anchorId }
        : highlight?.kind === 'fieldsPoint'
          ? { kind: 'fieldsPoint' as const, id: highlight.pointId }
          : undefined;
  // While the gate's position is being picked, every Chaos point shows with its position.
  const chaosPoints = highlight?.kind === 'chaosPoints' ? markers.chaosPoints : [];
  const previewedChaosPoint =
    highlight?.kind === 'chaosPoints' && highlight.position !== undefined
      ? markers.chaosPoints[highlight.position - 1]
      : undefined;
  const gateRank = chaosPoints.findIndex((point) => point.id === markers.chaosGate?.id);
  const gatePosition = gateRank < 0 ? undefined : gateRank + 1;
  const open = stage !== 'closed';
  const taken = stage === 'left' || stage === 'summary';
  const chipFor = (doorIndex: number | undefined) =>
    doorIndex === undefined
      ? undefined
      : chips.find((chip) => chip.additionalExit === undefined && chip.doorIndex === doorIndex);
  const chaosChip = chips.find((chip) => chip.additionalExit === 'chaos');
  return (
    <section aria-label={`${title} map`} className="room-map-column">
      <RoomMapViewport
        asset={roomMapAssetFor(gameName)}
        controlsPlacement="collapsible-overlay"
        key={roomIdentity}
        mirrored={shownFlip}
        overlay={
          <div aria-label={`${title} map points`} className="room-map-marker-layer" role="group">
            <RoomMapSpots
              markers={markers}
              {...(placements === undefined
                ? {}
                : { placements: { ...placements, ...(preview === undefined ? {} : { preview }) } })}
            />
            {chaosPoints.map((point, index) =>
              point.id === markers.chaosGate?.id ? null : (
                <span
                  aria-label={`Chaos gate position ${index + 1}`}
                  className="room-map-door"
                  data-chaos
                  data-closed
                  data-preview={point === previewedChaosPoint || undefined}
                  key={`chaos:${point.id}`}
                  role="img"
                  style={position(point)}
                >
                  <RoomMapNumber value={index + 1} />
                </span>
              ),
            )}
            {markers.chaosGate === undefined ? null : (
              <span
                aria-label={chaosChip === undefined ? 'Chaos gate' : chipName(chaosChip)}
                className="room-map-door"
                data-chaos
                data-closed={!open || undefined}
                data-preview={
                  highlight?.kind === 'chaosGate' ||
                  (previewedChaosPoint !== undefined &&
                    previewedChaosPoint.id === markers.chaosGate.id) ||
                  undefined
                }
                data-ring={(open && chaosChip === undefined) || undefined}
                data-taken={(taken && chaosChip?.picked) || undefined}
                role="img"
                style={position(markers.chaosGate)}
              >
                {!open || chaosChip === undefined ? null : (
                  <span aria-hidden="true" className="room-map-door-face">
                    <DoorChipFace chip={chaosChip} />
                  </span>
                )}
                <RoomMapNumber value={gatePosition} />
              </span>
            )}
            {markers.doors.map((door) => {
              const chip = chipFor(door.doorIndex);
              const name =
                chip === undefined
                  ? door.doorIndex === undefined
                    ? 'Door'
                    : `Door ${door.doorIndex}`
                  : chipName(chip);
              return (
                <span
                  aria-label={open ? name : `${name} · Closed`}
                  className="room-map-door"
                  data-closed={!open || undefined}
                  data-locked={(open && chip?.locked) || undefined}
                  data-preview={
                    (highlight?.kind === 'door' && highlight.doorIndex === door.doorIndex) ||
                    undefined
                  }
                  data-ring={(open && chip === undefined) || undefined}
                  data-taken={(taken && chip?.picked) || undefined}
                  key={`door:${door.id}`}
                  role="img"
                  style={position(door)}
                >
                  {open && chip !== undefined ? (
                    <span aria-hidden="true" className="room-map-door-face">
                      <DoorChipFace chip={chip} />
                    </span>
                  ) : null}
                  <RoomMapNumber value={door.doorIndex} />
                </span>
              );
            })}
          </div>
        }
        title={title}
      />
      <RoomMapLegend
        chaos={markers.chaosGate !== undefined || chaosPoints.length > 0}
        markers={markers}
      />
    </section>
  );
}
