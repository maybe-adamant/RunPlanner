import type { ReactNode } from 'react';

import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import {
  HubMapQualityLegend,
  hubMapAnnotations,
  hubMapFountainAnnotation,
  hubMapPosition,
  type HubMapAnnotation,
} from '@planner/ui/room-maps/HubMapAnnotations';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';

/**
 * The Ephyra Hub map with one marker per declared board door. Each consumer
 * supplies its doors; the fountain basin is only located here.
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
  return (
    <section aria-label={label} className="hub-map-overview hub-board-map">
      <RoomMapViewport
        asset={roomMapAssetFor(gameName)}
        controlsPlacement="collapsible-overlay"
        key={hubIdentity}
        overlay={
          <div aria-label={`${label} doors`} className="hub-map-marker-layer" role="group">
            {hubMapAnnotations.map((annotation) => door(annotation))}
            <span
              aria-label="Hub fountain"
              className="hub-map-fountain-marker"
              data-hub-fountain
              role="img"
              style={hubMapPosition(hubMapFountainAnnotation)}
            >
              <span aria-hidden="true" className="hub-map-fountain-content">
                <span className="hub-map-fountain-label">Fountain</span>
              </span>
            </span>
          </div>
        }
        title="Ephyra Hub"
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
