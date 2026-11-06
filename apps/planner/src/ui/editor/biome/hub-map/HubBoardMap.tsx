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
  action,
  door,
  gameName,
  hubIdentity,
  label,
}: {
  /** One tab action placed beside the map's own controls. */
  readonly action?: ReactNode;
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
        {...(action === undefined
          ? {}
          : { viewportOverlay: <div className="room-map-controls">{action}</div> })}
        viewportLegend={<HubMapQualityLegend />}
      />
    </section>
  );
}

/** A door marker's face: its map label, then its reward icons or its state. */
export function HubDoorFace({
  icons,
  label,
  status,
}: {
  /** First draw, then what rerolls left it, where they changed it. */
  readonly icons: readonly (ArtworkSource | undefined)[];
  readonly label: string;
  readonly status?: string;
}) {
  return (
    <span aria-hidden="true" className="hub-map-marker-content">
      <span>{label}</span>
      {status === undefined ? null : <span className="hub-map-marker-status">{status}</span>}
      {icons.length === 0 ? null : (
        <span className="hub-map-reward-icons">
          {icons.map((icon, index) => (
            <span className="hub-map-reward-step" key={index}>
              {index === 0 ? null : <span className="hub-map-reward-arrow">→</span>}
              <ArtworkIcon className="hub-map-reward-icon" source={icon} />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
