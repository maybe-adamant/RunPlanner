import type { CSSProperties } from 'react';

import type { WorkspaceRoomMap } from '@planner/projections/structured-workspace';
import { roomMapMarkers, type RoomMapMarkerPosition } from '@planner/projections/roomMapMarkers';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { DoorChipFace } from '../DecisionWorkbench';
import type { DoorChip } from '../doorSummary';

/**
 * The room at one point of its Timeline: `closed` before its doors open,
 * `open` once they do, `left` once it is left by the taken door. `summary`
 * is the room as planned, every door open and the taken one lit.
 */
export type RoomMapStage = 'closed' | 'open' | 'left' | 'summary';

const position = (marker: RoomMapMarkerPosition): CSSProperties => ({
  left: `${marker.left}%`,
  top: `${marker.top}%`,
});

const chipName = (chip: DoorChip): string =>
  chip.locked === true ? `${chip.label} · Locked` : chip.label;

/** The room's map beside its controls: its doors, Chaos gate, entries and anchors. */
export function RoomMapColumn({
  chips = [],
  gameName,
  map,
  roomIdentity,
  stage,
  title,
}: {
  /** The room's doors as its Timeline shows them. */
  readonly chips?: readonly DoorChip[] | undefined;
  readonly gameName: string;
  readonly map: WorkspaceRoomMap;
  /** A different room never inherits this map's pan and zoom. */
  readonly roomIdentity: string;
  readonly stage: RoomMapStage;
  readonly title: string;
}) {
  const calibration = roomMapCalibrations[gameName];
  if (calibration === undefined) return null;
  const markers = roomMapMarkers(map, calibration);
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
        overlay={
          <div aria-label={`${title} map points`} className="room-map-marker-layer" role="group">
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
              <span
                aria-label="Entry"
                className="room-map-point"
                data-point="entry"
                key={`entry:${entry.id}`}
                role="img"
                style={position(entry)}
              />
            ))}
            {markers.chaosGate === undefined ? null : (
              <span
                aria-label={chaosChip === undefined ? 'Chaos gate' : chipName(chaosChip)}
                className="room-map-door"
                data-chaos
                data-closed={!open || undefined}
                data-taken={(taken && chaosChip?.picked) || undefined}
                role="img"
                style={position(markers.chaosGate)}
              >
                {!open || chaosChip === undefined ? null : (
                  <span aria-hidden="true" className="room-map-door-face">
                    <DoorChipFace chip={chaosChip} />
                  </span>
                )}
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
                </span>
              );
            })}
          </div>
        }
        title={title}
      />
    </section>
  );
}
