import { useRef, type CSSProperties, type ReactNode } from 'react';

import type { WorkspaceHubSlot } from '@planner/projections/structured-workspace';
import { roomMapPosition, type RoomMapMarkerPosition } from '@planner/projections/roomMapMarkers';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { position } from '../room-map/roomMapPosition';
import { hubDoorMapLabel, hubDoorQuality, hubDoorQualityKey } from './hubDoorQuality';
import { useMapHeightCap } from './useMapHeightCap';

/** One Hub slot's door on the board map: where it stands, its rating and short name. */
export interface HubMapDoor {
  readonly hubSlotKey: string;
  readonly category: string | undefined;
  readonly mapLabel: string;
  readonly style: CSSProperties;
}

/**
 * Display-only vertical nudges, in map image pixels, for doors whose true
 * map positions overlap their neighbour's marker.
 */
const markerNudges: Readonly<Record<string, number>> = Object.freeze({
  combat22: -32,
  combat11: 32,
  combat13: -38,
  combat10: 6,
  combat23: -12,
  combat01: 12,
  combat07: -14,
  combat08: 14,
});

/** Visible, noninteractive colour key of the board's doors. */
function HubMapQualityLegend() {
  return (
    <div aria-label="Hub room quality legend" className="hub-map-legend">
      {hubDoorQualityKey.map((quality) => (
        <span data-category={quality} key={quality}>
          {quality}
        </span>
      ))}
    </div>
  );
}

function nudged(
  marker: RoomMapMarkerPosition,
  image: { readonly height: number },
  dy: number | undefined,
): RoomMapMarkerPosition {
  return dy === undefined ? marker : { ...marker, top: marker.top + (dy / image.height) * 100 };
}

/**
 * The Ephyra Hub map with one marker per declared board door, each at its
 * map door. Each consumer supplies its doors.
 */
export function HubBoardMap({
  door,
  gameName,
  hubIdentity,
  label,
  slots,
}: {
  /** The marker of one declared door, or nothing where the map shows none. */
  readonly door: (door: HubMapDoor) => ReactNode;
  readonly gameName: string;
  /** A different Hub never inherits this map's pan and zoom. */
  readonly hubIdentity: string;
  readonly label: string;
  readonly slots: readonly WorkspaceHubSlot[];
}) {
  const section = useRef<HTMLElement>(null);
  useMapHeightCap(section);
  const calibration = roomMapCalibrations[gameName];
  return (
    <section aria-label={label} className="hub-map-overview hub-board-map" ref={section}>
      <RoomMapViewport
        asset={roomMapAssetFor(gameName)}
        controlsPlacement="collapsible-overlay"
        key={hubIdentity}
        overlay={
          <div aria-label={`${label} doors`} className="hub-map-marker-layer" role="group">
            {calibration === undefined
              ? null
              : slots.map((slot) =>
                  slot.mapDoor === undefined
                    ? null
                    : door({
                        hubSlotKey: slot.hubSlotKey,
                        category: hubDoorQuality(slot.hubSlotKey),
                        mapLabel: hubDoorMapLabel(slot.hubSlotKey),
                        style: position(
                          nudged(
                            roomMapPosition(slot.mapDoor, calibration),
                            calibration,
                            markerNudges[slot.hubSlotKey],
                          ),
                        ),
                      }),
                )}
          </div>
        }
        title="Ephyra Hub"
        viewportLegend={<HubMapQualityLegend />}
      />
    </section>
  );
}

/** A door marker's face: its map label, then its reward icon or its state. */
export function HubDoorFace({
  icon,
  label,
  status,
}: {
  /** The reward the door offers at the board shown. */
  readonly icon?: ArtworkSource | undefined;
  readonly label: string;
  readonly status?: string;
}) {
  return (
    <span aria-hidden="true" className="hub-map-marker-content">
      <span>{label}</span>
      {status === undefined ? null : <span className="hub-map-marker-status">{status}</span>}
      {icon === undefined ? null : <ArtworkIcon className="hub-map-reward-icon" source={icon} />}
    </span>
  );
}
