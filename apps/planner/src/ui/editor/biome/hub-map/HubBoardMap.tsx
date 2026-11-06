import { useRef, type ReactNode } from 'react';

import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import {
  HubMapQualityLegend,
  hubMapAnnotations,
  type HubMapAnnotation,
} from '@planner/ui/room-maps/HubMapAnnotations';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { useMapHeightCap } from './useMapHeightCap';

/**
 * The Ephyra Hub map with one marker per declared board door. Each consumer
 * supplies its doors.
 */
export function HubBoardMap({
  door,
  gameName,
  hubIdentity,
  label,
}: {
  /** The marker of one declared door, or nothing where the map shows none. */
  readonly door: (annotation: HubMapAnnotation) => ReactNode;
  readonly gameName: string;
  /** A different Hub never inherits this map's pan and zoom. */
  readonly hubIdentity: string;
  readonly label: string;
}) {
  const section = useRef<HTMLElement>(null);
  useMapHeightCap(section);
  return (
    <section aria-label={label} className="hub-map-overview hub-board-map" ref={section}>
      <RoomMapViewport
        asset={roomMapAssetFor(gameName)}
        controlsPlacement="collapsible-overlay"
        key={hubIdentity}
        overlay={
          <div aria-label={`${label} doors`} className="hub-map-marker-layer" role="group">
            {hubMapAnnotations.map((annotation) => door(annotation))}
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
