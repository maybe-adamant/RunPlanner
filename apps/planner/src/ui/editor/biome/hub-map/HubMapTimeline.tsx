import {
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import * as Popover from '@radix-ui/react-popover';

import type { HubAction } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubFountain,
  type WorkspaceHubSlot,
  type WorkspaceHubActionOrderInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
} from '@planner/projections/structured-workspace';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import {
  HubMapQualityLegend,
  hubMapAnnotations,
  hubMapFountainAnnotation,
  hubMapPosition,
  type HubMapAnnotation,
} from '@planner/ui/room-maps/HubMapAnnotations';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { HubMapFountainContent, HubMapMarkerContent } from './HubMapMarkerContent';
import { hubMapReward } from './hubMapReward';

interface HubMapTimelineProps {
  readonly hubIdentity: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly locked: boolean;
  readonly node: WorkspaceHubDecisionNode;
  readonly resetVisitsControl: ReactNode;
}

function TimelineMarkerPopover({
  open,
  onOpenChange,
  marker,
  title,
  summary,
  actionLabel,
  onNavigate,
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly marker: RefObject<HTMLButtonElement | null>;
  readonly title: string;
  readonly summary: string;
  readonly actionLabel: string;
  readonly onNavigate: () => void;
  readonly children: ReactNode;
}) {
  const navigating = useRef(false);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor asChild>{children}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="hub-map-popover hub-timeline-popover"
          aria-label={title}
          sideOffset={8}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!navigating.current) marker.current?.focus();
            navigating.current = false;
          }}
        >
          <header>
            <h4>{title}</h4>
            <Popover.Close className="quiet-action action-compact">Close</Popover.Close>
          </header>
          <p>{summary}</p>
          <button
            className="quiet-action action-compact"
            type="button"
            onClick={() => {
              navigating.current = true;
              onOpenChange(false);
              onNavigate();
            }}
          >
            {actionLabel}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Map markers pan with the image; a pointer drag past a few pixels is never a click. */
function useDragSuppressedActivation(onActivate: () => void) {
  const pointerStart = useRef<{ readonly x: number; readonly y: number } | undefined>(undefined);
  const dragged = useRef(false);
  const trackPointer = (event: PointerEvent<HTMLButtonElement>): void => {
    const start = pointerStart.current;
    if (start !== undefined && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) {
      dragged.current = true;
    }
  };
  return {
    onClick: (event: MouseEvent<HTMLButtonElement>): void => {
      if (event.detail !== 0 && dragged.current) {
        dragged.current = false;
        return;
      }
      dragged.current = false;
      onActivate();
    },
    onPointerCancel: () => {
      pointerStart.current = undefined;
      dragged.current = true;
    },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      dragged.current = false;
      pointerStart.current = { x: event.clientX, y: event.clientY };
    },
    onPointerMove: trackPointer,
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      trackPointer(event);
      pointerStart.current = undefined;
    },
  };
}

function TimelineMapMarker({
  actionPosition,
  annotation,
  atCapacity,
  complete,
  locked,
  onAppend,
  readinessOwner,
  slot,
  visitMarker,
  visitPosition,
}: {
  readonly actionPosition: number | undefined;
  readonly annotation: HubMapAnnotation;
  readonly atCapacity: boolean;
  readonly complete: boolean;
  readonly locked: boolean;
  readonly onAppend: (slot: WorkspaceHubSlot) => void;
  readonly readinessOwner: WorkspaceHubDecisionNode['owner'];
  readonly slot: WorkspaceHubSlot;
  readonly visitMarker: WorkspaceMarker | undefined;
  readonly visitPosition: number;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const marker = useRef<HTMLButtonElement>(null);
  const markerTarget =
    visitMarker === undefined
      ? undefined
      : findingTarget(visitMarker.address, undefined, readinessOwner);
  const isVisited = visitPosition !== -1;
  const reward = hubMapReward(slot);
  const canAppend = !isVisited && !atCapacity;
  const canOpen = isVisited && complete && slot.room !== undefined;
  const markerDisabled = canAppend && locked;
  const position = hubMapPosition(annotation);
  const pointer = useDragSuppressedActivation(() => {
    if (canAppend && !locked) onAppend(slot);
    else if (canOpen) setOpen(true);
  });
  const markerLabel = isVisited
    ? `${slot.label}: Visit ${visitPosition + 1}, step ${actionPosition}.`
    : atCapacity
      ? `${slot.label}: Unvisited.`
      : `${slot.label}: Unvisited. Add visit.`;

  return (
    <>
      <TimelineMarkerPopover
        open={open && canOpen}
        onOpenChange={setOpen}
        marker={marker}
        title={slot.label}
        summary={`Reward: ${reward.summary}`}
        actionLabel="Open Room →"
        onNavigate={() => {
          if (slot.room !== undefined) dispatch(semanticOwnerFocused(slot.room.address));
        }}
      >
        <button
          aria-label={markerLabel}
          className="hub-map-marker hub-timeline-map-marker"
          data-category={annotation.category}
          data-hub-slot-key={slot.hubSlotKey}
          data-open="true"
          data-room-map-overlay-control
          data-visited={isVisited}
          {...(markerTarget ?? {})}
          ref={(element) => {
            marker.current = element;
            markerTarget?.ref(element);
          }}
          aria-description={[`Reward: ${reward.summary}`, markerTarget?.['aria-description']]
            .filter(Boolean)
            .join(' ')}
          aria-disabled={(!canAppend && !canOpen) || (canAppend && locked) || undefined}
          data-authoring-locked={markerDisabled || undefined}
          disabled={markerDisabled}
          inert={markerDisabled}
          {...pointer}
          style={position}
          title={`${slot.label}: ${reward.summary}`}
          type="button"
        >
          <HubMapMarkerContent label={annotation.mapLabel} open reward={reward} />
        </button>
      </TimelineMarkerPopover>
      {!isVisited ? null : (
        <span aria-hidden="true" className="hub-map-visit-badge-anchor" style={position}>
          <span className="hub-map-visit-badge">{actionPosition}</span>
        </span>
      )}
    </>
  );
}

/** Append once; after completing the board, open the hosted fountain interaction. */
function TimelineFountainMarker({
  fountain,
  locked,
  complete,
  onAppend,
  readinessOwner,
}: {
  readonly fountain: WorkspaceHubFountain;
  readonly locked: boolean;
  readonly complete: boolean;
  readonly onAppend: (actions: readonly HubAction[]) => void;
  readonly readinessOwner: WorkspaceHubDecisionNode['owner'];
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const marker = useRef<HTMLButtonElement>(null);
  const target = findingTarget(fountain.address, undefined, readinessOwner);
  const appendActions = fountain.appendActions;
  const canAppend = appendActions !== undefined;
  const canOpen = !canAppend && complete;
  const markerDisabled = canAppend && locked;
  const position = hubMapPosition(hubMapFountainAnnotation);
  const pointer = useDragSuppressedActivation(() => {
    if (appendActions !== undefined && !locked) onAppend(appendActions);
    else if (canOpen) setOpen(true);
  });
  return (
    <>
      <TimelineMarkerPopover
        open={open && canOpen}
        onOpenChange={setOpen}
        marker={marker}
        title="Hub fountain"
        summary={
          fountain.controlsHost?.kind === 'room'
            ? `Used after ${fountain.controlsHost.label}.`
            : 'Used after the planned visits.'
        }
        actionLabel="Open Interaction →"
        onNavigate={() => dispatch(semanticOwnerFocused(fountain.outcomeMarker.address))}
      >
        <button
          {...target}
          ref={(element) => {
            marker.current = element;
            target.ref(element);
          }}
          aria-disabled={(!canAppend && !canOpen) || (canAppend && locked) || undefined}
          aria-label={
            fountain.actionPosition === undefined
              ? 'Hub fountain: Unused. Use fountain.'
              : `Hub fountain: Step ${fountain.actionPosition}.`
          }
          className="hub-map-fountain-marker hub-timeline-fountain-marker"
          data-authoring-locked={markerDisabled || undefined}
          data-hub-fountain
          data-room-map-overlay-control
          data-used={fountain.actionPosition !== undefined}
          disabled={markerDisabled}
          inert={markerDisabled}
          {...pointer}
          style={position}
          title="Hub fountain"
          type="button"
        >
          <HubMapFountainContent />
        </button>
      </TimelineMarkerPopover>
      {fountain.actionPosition === undefined ? null : (
        <span aria-hidden="true" className="hub-map-visit-badge-anchor" style={position}>
          <span className="hub-map-visit-badge">{fountain.actionPosition}</span>
        </span>
      )}
    </>
  );
}

/** The Timeline map appends unvisited open rooms and the fountain use to the Hub action order. */
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
  // Capacity counts room visits only; the fountain use never occupies a visit.
  const atCapacity = visitOrder.length === node.requiredVisitCount;
  const complete = atCapacity && node.fountain.actionPosition !== undefined;
  const replaceActions = (actions: readonly HubAction[]): void => {
    const proposal = interaction.proposalFor(actions);
    const options = candidates.activate(proposal);
    if (!candidateMayBeAuthored(options?.[0])) return;
    executeIntent(proposal.intent());
  };
  const appendVisit = (slot: WorkspaceHubSlot): void =>
    replaceActions(
      Object.freeze([
        ...interaction.selectedActions,
        { kind: 'roomVisit' as const, hubSlotKey: slot.hubSlotKey },
      ]),
    );

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
                  actionPosition={
                    visitPosition === -1 ? undefined : node.visits[visitPosition]?.actionPosition
                  }
                  annotation={annotation}
                  atCapacity={atCapacity}
                  complete={complete}
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
            <TimelineFountainMarker
              fountain={node.fountain}
              complete={complete}
              locked={locked}
              onAppend={replaceActions}
              readinessOwner={node.owner}
            />
          </div>
        }
        title="Ephyra Hub timeline"
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
