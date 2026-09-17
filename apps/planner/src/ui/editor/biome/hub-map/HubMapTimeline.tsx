import * as Popover from '@radix-ui/react-popover';
import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import type { SemanticAddress } from '@run-planner/engine/authored-project';

import {
  reconcileHubBoardRanking,
  dropHubBoardRoom,
  moveHubBoardRoom,
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type HubBoardMove,
  type HubBoardMoveResult,
  type HubBoardRanking,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubSlot,
  type WorkspaceHubVisitOrderInteraction,
  type WorkspaceInteractionCatalog,
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
import { HubReplacementChoices } from '../HubVisitRanking';

interface HubMapTimelineProps {
  readonly hubIdentity: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
  readonly toolbarActions: ReactNode;
}

function TimelineMapMarker({
  annotation,
  interaction,
  onApplied,
  onClose,
  onMarkerActivate,
  onStaleAnchorClose,
  onVisitMove,
  activePopoverSlotKey,
  popoverOpen,
  ranking,
  requiredVisitCount,
  readinessOwner,
  slot,
  slotsByKey,
}: {
  readonly annotation: HubMapAnnotation;
  readonly interaction: WorkspaceHubVisitOrderInteraction;
  readonly onApplied: (
    result: HubBoardMoveResult,
    announcement: string,
    action: HubBoardMove,
  ) => void;
  readonly onClose: (slotKey: string) => void;
  readonly onMarkerActivate: (slot: WorkspaceHubSlot, visitPosition: number) => void;
  readonly onStaleAnchorClose: () => void;
  readonly onVisitMove: (slotKey: string, destination: number | undefined) => void;
  readonly activePopoverSlotKey: string | undefined;
  readonly popoverOpen: boolean;
  readonly ranking: HubBoardRanking;
  readonly requiredVisitCount: number;
  readonly readinessOwner: SemanticAddress;
  readonly slot: WorkspaceHubSlot;
  readonly slotsByKey: ReadonlyMap<string, WorkspaceHubSlot>;
}) {
  const marker = useRef<HTMLButtonElement>(null);
  const closeControl = useRef<HTMLButtonElement>(null);
  const previousPopoverState = useRef<
    { readonly open: boolean; readonly visitPosition: number } | undefined
  >(undefined);
  const findingTarget = useFindingTarget();
  const markerTarget = findingTarget(slot.marker.address, undefined, readinessOwner);
  const pointerStart = useRef<{ readonly x: number; readonly y: number } | undefined>(undefined);
  const dragged = useRef(false);
  const closedByOutsideInteraction = useRef(false);
  const visitPosition = ranking.authoredVisitOrder.indexOf(slot.hubSlotKey);
  const position = {
    left: `${(annotation.x / 2560) * 100}%`,
    top: `${(annotation.y / 1440) * 100}%`,
  };
  useLayoutEffect(() => {
    const previous = previousPopoverState.current;
    if (previous?.open === true && popoverOpen && previous.visitPosition !== visitPosition) {
      closeControl.current?.focus({ preventScroll: true });
    }
    previousPopoverState.current = { open: popoverOpen, visitPosition };
  }, [popoverOpen, visitPosition]);
  const activate = (event: MouseEvent<HTMLButtonElement>): void => {
    if (event.detail !== 0 && dragged.current) {
      dragged.current = false;
      return;
    }
    dragged.current = false;
    closedByOutsideInteraction.current = false;
    onMarkerActivate(slot, visitPosition);
  };
  const trackPointer = (event: PointerEvent<HTMLButtonElement>): void => {
    const start = pointerStart.current;
    if (start !== undefined && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) {
      dragged.current = true;
    }
  };

  return (
    <Popover.Root
      open={popoverOpen}
      onOpenChange={(open) => {
        if (open) {
          closedByOutsideInteraction.current = false;
          onMarkerActivate(slot, visitPosition);
          return;
        }
        onClose(slot.hubSlotKey);
      }}
    >
      <Popover.Anchor asChild>
        <button
          aria-label={
            visitPosition === -1
              ? `${slot.label}: not visited. Edit visit order.`
              : `${slot.label}: Visit ${visitPosition + 1}. Edit visit order.`
          }
          className="hub-map-marker hub-timeline-map-marker"
          data-category={annotation.category}
          data-hub-slot-key={slot.hubSlotKey}
          data-open="true"
          data-visited={visitPosition !== -1}
          data-room-map-overlay-control
          {...markerTarget}
          disabled={markerTarget.inert}
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
          ref={marker}
          style={position}
          type="button"
        >
          <span aria-hidden="true">{annotation.mapLabel}</span>
        </button>
      </Popover.Anchor>
      {visitPosition === -1 ? null : (
        <span aria-hidden="true" className="hub-map-visit-badge-anchor" style={position}>
          <span className="hub-map-visit-badge">Visit {visitPosition + 1}</span>
        </span>
      )}
      <Popover.Portal>
        <Popover.Content
          align="center"
          aria-label={
            visitPosition === -1
              ? `Choose visit to replace with ${slot.label}`
              : `Edit ${slot.label} visit order`
          }
          className="hub-map-popover hub-map-timeline-popover"
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (closedByOutsideInteraction.current) return;
            if (activePopoverSlotKey !== undefined && activePopoverSlotKey !== slot.hubSlotKey) {
              return;
            }
            if (marker.current?.isConnected) {
              marker.current.focus();
            } else {
              onStaleAnchorClose();
            }
          }}
          onInteractOutside={() => {
            closedByOutsideInteraction.current = true;
          }}
          sideOffset={8}
        >
          <header>
            <div>
              <p className="eyebrow">
                {visitPosition === -1 ? 'Open room' : `Visit ${visitPosition + 1}`}
              </p>
              <h4>{slot.label}</h4>
            </div>
            <button
              className="quiet-action action-compact"
              onClick={() => onClose(slot.hubSlotKey)}
              ref={closeControl}
              type="button"
            >
              Close
            </button>
          </header>
          {visitPosition === -1 ? (
            <HubReplacementChoices
              interaction={interaction}
              onApplied={onApplied}
              onComplete={() => onClose(slot.hubSlotKey)}
              ranking={ranking}
              requiredVisitCount={requiredVisitCount}
              slot={slot}
              slotsByKey={slotsByKey}
              locked={markerTarget.inert}
            />
          ) : (
            <div
              aria-label={`Visit order controls for ${slot.label}; planned visit ${visitPosition + 1}`}
              className="hub-replacement-options hub-map-visit-actions"
              role="group"
            >
              <button
                disabled={markerTarget.inert}
                onClick={() => onVisitMove(slot.hubSlotKey, undefined)}
                type="button"
              >
                Remove visit
              </button>
              {ranking.authoredVisitOrder.map((_, destination) =>
                destination === visitPosition ? null : (
                  <button
                    disabled={markerTarget.inert}
                    key={destination}
                    onClick={() => onVisitMove(slot.hubSlotKey, destination)}
                    type="button"
                  >
                    Move to {destination + 1}
                  </button>
                ),
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The Timeline map renders only authored-open rooms and shares List proposals. */
export function HubMapTimeline({
  hubIdentity,
  interactions,
  node,
  toolbarActions,
}: HubMapTimelineProps) {
  const mapRegion = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<{
    readonly hubIdentity: string;
    readonly popoverSlotKey: string | undefined;
  }>({ hubIdentity, popoverSlotKey: undefined });
  const stalePopoverNeedsFallback = useRef(false);
  const openSlots = node.slots.filter((slot) => slot.open);
  const slotsByKey = new Map(openSlots.map((slot) => [slot.hubSlotKey, slot] as const));
  const interaction = requireWorkspaceInteraction(
    interactions.hubVisitOrders,
    workspaceInteractionKey(node.owner),
  );
  const ranking = reconcileHubBoardRanking({
    authoredVisitOrder: interaction.selectedHubSlotKeys,
    declarationOpenSlotKeys: openSlots.map((slot) => slot.hubSlotKey),
  });
  const executeIntent = useCommandIntent();
  const candidates =
    useWorkspaceInteractionController<
      ReturnType<ReturnType<WorkspaceHubVisitOrderInteraction['proposalFor']>['load']>
    >();
  const popoverSlotKey =
    selection.hubIdentity === hubIdentity && slotsByKey.has(selection.popoverSlotKey ?? '')
      ? selection.popoverSlotKey
      : undefined;
  const closePopover = (slotKey: string): void =>
    setSelection((current) =>
      current.hubIdentity === hubIdentity && current.popoverSlotKey === slotKey
        ? { hubIdentity, popoverSlotKey: undefined }
        : current,
    );
  const focusStaleAnchorFallback = (): void => {
    mapRegion.current
      ?.querySelector<HTMLButtonElement>('[aria-label="Hub Timeline view"] [aria-pressed="true"]')
      ?.focus({ preventScroll: true });
  };
  const hasStalePopoverAnchor =
    selection.hubIdentity === hubIdentity &&
    selection.popoverSlotKey !== undefined &&
    !slotsByKey.has(selection.popoverSlotKey);
  const hasStaleSelection = selection.hubIdentity !== hubIdentity || hasStalePopoverAnchor;
  if (hasStaleSelection) {
    stalePopoverNeedsFallback.current ||= hasStalePopoverAnchor;
    setSelection({ hubIdentity, popoverSlotKey: undefined });
  }
  useLayoutEffect(() => {
    if (!stalePopoverNeedsFallback.current) return;
    stalePopoverNeedsFallback.current = false;
    focusStaleAnchorFallback();
  });
  const apply = (): void => {
    // Publication owns the updated order. Keeping the popover anchored to its
    // stable slot key preserves the author’s map context across an edit.
  };
  const publishVisitOrder = (result: HubBoardMoveResult | undefined): boolean => {
    if (result?.proposedVisitOrder === undefined) return false;
    const proposal = interaction.proposalFor(result.proposedVisitOrder);
    const options = candidates.activate(proposal);
    if (!candidateMayBeAuthored(options?.[0])) return false;
    executeIntent(proposal.intent());
    return true;
  };
  const moveVisit = (slotKey: string, destination: number | undefined): void => {
    const source = ranking.authoredVisitOrder.indexOf(slotKey);
    if (source === -1) return;
    if (destination === undefined) {
      const removed = publishVisitOrder(
        moveHubBoardRoom(ranking, node.requiredVisitCount, {
          kind: 'removeFromVisits',
          slotKey,
        }),
      );
      if (removed) closePopover(slotKey);
      return;
    }
    const target = ranking.authoredVisitOrder[destination];
    if (target === undefined || target === slotKey) return;
    publishVisitOrder(
      dropHubBoardRoom(ranking, node.requiredVisitCount, slotKey, {
        kind: source < destination ? 'afterSlot' : 'beforeSlot',
        slotKey: target,
      }),
    );
  };
  const activateMarker = (slot: WorkspaceHubSlot, visitPosition: number): void => {
    if (visitPosition !== -1) {
      setSelection({
        hubIdentity,
        popoverSlotKey: slot.hubSlotKey,
      });
      return;
    }
    if (ranking.authoredVisitOrder.length === node.requiredVisitCount) {
      setSelection({
        hubIdentity,
        popoverSlotKey: slot.hubSlotKey,
      });
      return;
    }
    const result = moveHubBoardRoom(ranking, node.requiredVisitCount, {
      kind: 'addToVisits',
      slotKey: slot.hubSlotKey,
    });
    if (result?.proposedVisitOrder === undefined) return;
    publishVisitOrder(result);
  };

  return (
    <section
      aria-label="Ephyra Hub timeline map"
      className="hub-map-overview hub-map-timeline"
      ref={mapRegion}
    >
      <RoomMapViewport
        asset={roomMapAssetFor(node.gameName)}
        key={hubIdentity}
        overlay={
          <div aria-label="Ephyra Hub timeline map controls" className="hub-map-marker-layer">
            <HubMapQualityLegend />
            {hubMapAnnotations.map((annotation) => {
              const slot = slotsByKey.get(annotation.hubSlotKey);
              if (slot === undefined) return null;
              if (slot.gameName !== annotation.gameName) {
                throw new Error(
                  `Hub map annotation ${annotation.hubSlotKey} has no matching Hub slot.`,
                );
              }
              return (
                <TimelineMapMarker
                  annotation={annotation}
                  interaction={interaction}
                  key={annotation.hubSlotKey}
                  onApplied={apply}
                  activePopoverSlotKey={popoverSlotKey}
                  onClose={closePopover}
                  onMarkerActivate={activateMarker}
                  onStaleAnchorClose={focusStaleAnchorFallback}
                  onVisitMove={moveVisit}
                  popoverOpen={popoverSlotKey === annotation.hubSlotKey}
                  ranking={ranking}
                  requiredVisitCount={node.requiredVisitCount}
                  readinessOwner={node.owner}
                  slot={slot}
                  slotsByKey={slotsByKey}
                />
              );
            })}
          </div>
        }
        title="Ephyra Hub visit order"
        toolbarEnd={toolbarActions}
      />
    </section>
  );
}
