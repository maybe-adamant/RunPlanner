import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubSlot,
  type WorkspaceHubActionOrderInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
} from '@planner/projections/structured-workspace';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import {
  HubMapQualityLegend,
  hubMapAnnotations,
  type HubMapAnnotation,
} from '@planner/ui/room-maps/HubMapAnnotations';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { HubMapMarkerContent } from './HubMapMarkerContent';
import { hubMapReward } from './hubMapReward';

interface HubMapTimelineProps {
  readonly hubIdentity: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly locked: boolean;
  readonly node: WorkspaceHubDecisionNode;
  readonly resetVisitsControl: ReactNode;
}

function TimelineMapMarker({
  annotation,
  atCapacity,
  locked,
  onAppend,
  readinessOwner,
  slot,
  visitMarker,
  visitPosition,
}: {
  readonly annotation: HubMapAnnotation;
  readonly atCapacity: boolean;
  readonly locked: boolean;
  readonly onAppend: (slot: WorkspaceHubSlot) => void;
  readonly readinessOwner: WorkspaceHubDecisionNode['owner'];
  readonly slot: WorkspaceHubSlot;
  readonly visitMarker: WorkspaceMarker | undefined;
  readonly visitPosition: number;
}) {
  const findingTarget = useFindingTarget();
  const markerTarget =
    visitMarker === undefined
      ? undefined
      : findingTarget(visitMarker.address, undefined, readinessOwner);
  const pointerStart = useRef<{ readonly x: number; readonly y: number } | undefined>(undefined);
  const dragged = useRef(false);
  const isVisited = visitPosition !== -1;
  const reward = hubMapReward(slot);
  const canAppend = !isVisited && !atCapacity;
  const markerDisabled = canAppend && locked;
  const position = {
    left: `${(annotation.x / 2560) * 100}%`,
    top: `${(annotation.y / 1440) * 100}%`,
  };
  const activate = (event: MouseEvent<HTMLButtonElement>): void => {
    if (event.detail !== 0 && dragged.current) {
      dragged.current = false;
      return;
    }
    dragged.current = false;
    if (canAppend && !locked) onAppend(slot);
  };
  const trackPointer = (event: PointerEvent<HTMLButtonElement>): void => {
    const start = pointerStart.current;
    if (start !== undefined && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) {
      dragged.current = true;
    }
  };
  const markerLabel = isVisited
    ? `${slot.label}: Visit ${visitPosition + 1}.`
    : atCapacity
      ? `${slot.label}: Unvisited.`
      : `${slot.label}: Unvisited. Add visit.`;

  return (
    <>
      <button
        aria-label={markerLabel}
        className="hub-map-marker hub-timeline-map-marker"
        data-category={annotation.category}
        data-hub-slot-key={slot.hubSlotKey}
        data-open="true"
        data-room-map-overlay-control
        data-visited={isVisited}
        {...(markerTarget ?? {})}
        aria-description={[`Reward: ${reward.summary}`, markerTarget?.['aria-description']]
          .filter(Boolean)
          .join(' ')}
        aria-disabled={!canAppend || locked || undefined}
        data-authoring-locked={markerDisabled || undefined}
        disabled={markerDisabled}
        inert={markerDisabled}
        onClick={activate}
        onPointerCancel={() => {
          pointerStart.current = undefined;
          dragged.current = true;
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          dragged.current = false;
          pointerStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={trackPointer}
        onPointerUp={(event) => {
          trackPointer(event);
          pointerStart.current = undefined;
        }}
        style={position}
        title={`${slot.label}: ${reward.summary}`}
        type="button"
      >
        <HubMapMarkerContent label={annotation.mapLabel} open reward={reward} />
      </button>
      {!isVisited ? null : (
        <span aria-hidden="true" className="hub-map-visit-badge-anchor" style={position}>
          <span className="hub-map-visit-badge">Visit {visitPosition + 1}</span>
        </span>
      )}
    </>
  );
}

/** The Timeline map appends unvisited open rooms to the visit order. */
export function HubMapTimeline({
  hubIdentity,
  interactions,
  locked,
  node,
  resetVisitsControl,
}: HubMapTimelineProps) {
  const openSlots = node.slots.filter((slot) => slot.open);
  const slotsByKey = new Map(openSlots.map((slot) => [slot.hubSlotKey, slot] as const));
  const interaction = requireWorkspaceInteraction(
    interactions.hubActionOrders,
    workspaceInteractionKey(node.owner),
  );
  const executeIntent = useCommandIntent();
  const candidates =
    useWorkspaceInteractionController<
      ReturnType<ReturnType<WorkspaceHubActionOrderInteraction['proposalFor']>['load']>
    >();
  const visitOrder = interaction.selectedHubSlotKeys;
  const atCapacity = visitOrder.length === node.requiredVisitCount;
  const appendVisit = (slot: WorkspaceHubSlot): void => {
    const proposal = interaction.proposalFor(
      Object.freeze([
        ...interaction.selectedActions,
        { kind: 'roomVisit' as const, hubSlotKey: slot.hubSlotKey },
      ]),
    );
    const options = candidates.activate(proposal);
    if (!candidateMayBeAuthored(options?.[0])) return;
    executeIntent(proposal.intent());
  };

  return (
    <section
      aria-label="Ephyra Hub timeline map"
      className="hub-board hub-map-overview hub-map-timeline"
    >
      <RoomMapViewport
        asset={roomMapAssetFor(node.gameName)}
        controlsPlacement="overlay"
        key={hubIdentity}
        overlay={
          <div aria-label="Ephyra Hub timeline map controls" className="hub-map-marker-layer">
            {hubMapAnnotations.map((annotation) => {
              const slot = slotsByKey.get(annotation.hubSlotKey);
              if (slot === undefined) return null;
              if (slot.gameName !== annotation.gameName) {
                throw new Error(
                  `Hub map annotation ${annotation.hubSlotKey} has no matching Hub slot.`,
                );
              }
              const visitPosition = visitOrder.indexOf(slot.hubSlotKey);
              const visitMarker =
                visitPosition === -1 ? undefined : node.visits[visitPosition]?.marker;
              if (visitPosition !== -1 && visitMarker === undefined) {
                throw new Error('An authored Hub visit must expose its exact visit marker.');
              }
              return (
                <TimelineMapMarker
                  annotation={annotation}
                  atCapacity={atCapacity}
                  key={annotation.hubSlotKey}
                  locked={locked}
                  onAppend={appendVisit}
                  readinessOwner={node.owner}
                  slot={slot}
                  visitMarker={visitMarker}
                  visitPosition={visitPosition}
                />
              );
            })}
          </div>
        }
        title="Ephyra Hub visit order"
        viewportOverlay={
          <div className="hub-map-corner-actions">
            {resetVisitsControl}
            <HubMapQualityLegend />
          </div>
        }
      />
    </section>
  );
}
