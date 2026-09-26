import * as Popover from '@radix-ui/react-popover';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import type {
  WorkspaceHubDecisionNode,
  WorkspaceHubSlot,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import {
  HubMapQualityLegend,
  hubMapAnnotations,
  hubMapFountainAnnotation,
  hubMapPosition,
  type HubMapAnnotation,
} from '@planner/ui/room-maps/HubMapAnnotations';
import { RoomMapViewport } from '@planner/ui/room-maps/RoomMapViewport';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import { DoorRewardEditor } from '../DoorRewardEditor';
import { useHubSlotMembership } from '../HubMembershipBoard';
import { HubMapFountainContent, HubMapMarkerContent } from './HubMapMarkerContent';
import { hubMapReward } from './hubMapReward';

interface HubMapOverviewProps {
  readonly hubIdentity: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
  readonly resetBoardControl: ReactNode;
  readonly detailsControl: ReactNode;
}

interface HubMapMarkerProps {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onClose: () => void;
  readonly onOpen: (slotKey: string) => void;
  readonly selected: boolean;
  readonly slot: WorkspaceHubSlot;
  readonly annotation: HubMapAnnotation;
  readonly x: number;
  readonly y: number;
}

function HubMapMarker({
  annotation,
  interactions,
  onClose,
  onOpen,
  selected,
  slot,
  x,
  y,
}: HubMapMarkerProps) {
  const dragged = useRef(false);
  const marker = useRef<HTMLButtonElement>(null);
  const pointerStart = useRef<{ readonly x: number; readonly y: number } | undefined>(undefined);
  const membership = useHubSlotMembership({
    interactions,
    onMembershipTransition: (transition) => {
      if (transition.source === 'closed') onOpen(transition.slotKey);
    },
    slot,
  });
  const open = slot.open;
  const reward = hubMapReward(slot);
  // An open marker launches the existing reward surface. Its separate Close
  // action may be unavailable without making that surface unreachable.
  const disabled = open ? false : membership.disabled;
  const suppressDragClick = (event: PointerEvent<HTMLButtonElement>): void => {
    const start = pointerStart.current;
    if (start !== undefined && Math.hypot(start.x - event.clientX, start.y - event.clientY) > 6) {
      dragged.current = true;
    }
  };
  const activate = (event: MouseEvent<HTMLButtonElement>): void => {
    const pointerClick = event.detail !== 0;
    if (pointerClick && dragged.current) {
      dragged.current = false;
      return;
    }
    // A canceled pointer sequence must not lock out the next keyboard action.
    dragged.current = false;
    if (open) {
      onOpen(slot.hubSlotKey);
    } else {
      membership.activate(pointerClick ? 'pointer' : 'keyboard');
    }
  };
  const closePopover = (): void => {
    onClose();
  };

  return (
    <Popover.Root
      open={selected}
      onOpenChange={(next) => (next ? onOpen(slot.hubSlotKey) : closePopover())}
    >
      <Popover.Anchor asChild>
        <button
          aria-busy={membership.pending || undefined}
          aria-description={open ? `Reward: ${reward.summary}` : undefined}
          aria-label={
            open
              ? `${slot.label}: Opened. Edit reward or close room.`
              : `${slot.label}: Closed. Open room.`
          }
          className="hub-map-marker"
          data-category={annotation.category}
          data-hub-slot-key={slot.hubSlotKey}
          data-open={open}
          data-room-map-overlay-control
          data-selected={selected || undefined}
          disabled={disabled}
          onClick={activate}
          onPointerCancel={() => {
            pointerStart.current = undefined;
            dragged.current = true;
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            dragged.current = false;
            pointerStart.current = { x: event.clientX, y: event.clientY };
            if (!open) membership.prepare();
          }}
          onPointerMove={suppressDragClick}
          onPointerUp={(event) => {
            suppressDragClick(event);
            pointerStart.current = undefined;
          }}
          ref={marker}
          style={hubMapPosition({ x, y })}
          title={open ? `${slot.label}: ${reward.summary}` : `${slot.label}: Closed`}
          type="button"
        >
          <HubMapMarkerContent label={annotation.mapLabel} open={open} reward={reward} />
        </button>
      </Popover.Anchor>
      {open ? (
        <Popover.Portal>
          <Popover.Content
            align="center"
            className="hub-map-popover"
            collisionPadding={12}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              marker.current?.focus();
            }}
            sideOffset={8}
          >
            <header>
              <div>
                <p className="eyebrow">Opened room</p>
                <h4>{slot.label}</h4>
              </div>
              <button className="quiet-action action-compact" onClick={closePopover} type="button">
                Close
              </button>
            </header>
            {slot.door === undefined ? (
              <p className="fixed-room-state">Reward details are not available yet.</p>
            ) : (
              <DoorRewardEditor
                door={slot.door}
                idPrefix={`hub-map-${slot.hubSlotKey}`}
                interactions={interactions}
              />
            )}
            {slot.canClose ? (
              <button
                className="danger-action action-compact"
                disabled={membership.disabled}
                onClick={() => {
                  closePopover();
                  membership.activate('pointer');
                }}
                type="button"
              >
                Close room
              </button>
            ) : (
              <p className="fixed-room-state">This room cannot be closed now.</p>
            )}
          </Popover.Content>
        </Popover.Portal>
      ) : null}
    </Popover.Root>
  );
}

function HubMapMarkerLayer({
  interactions,
  node,
}: Pick<HubMapOverviewProps, 'interactions' | 'node'>) {
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | undefined>();
  const selectedSlot = node.slots.find((slot) => slot.hubSlotKey === selectedSlotKey);
  useEffect(() => {
    if (selectedSlotKey === undefined || selectedSlot?.open) return;
    const reset = window.setTimeout(() => setSelectedSlotKey(undefined));
    return () => window.clearTimeout(reset);
  }, [selectedSlot?.open, selectedSlotKey]);
  return (
    <div aria-label="Ephyra Hub room map controls" className="hub-map-marker-layer">
      {hubMapAnnotations.map((annotation) => {
        const slot = node.slots.find((candidate) => candidate.hubSlotKey === annotation.hubSlotKey);
        if (slot === undefined || slot.gameName !== annotation.gameName) {
          throw new Error(`Hub map annotation ${annotation.hubSlotKey} has no matching Hub slot.`);
        }
        return (
          <HubMapMarker
            annotation={annotation}
            interactions={interactions}
            key={annotation.hubSlotKey}
            onClose={() => setSelectedSlotKey(undefined)}
            onOpen={setSelectedSlotKey}
            selected={selectedSlotKey === annotation.hubSlotKey && slot.open}
            slot={slot}
            x={annotation.x}
            y={annotation.y}
          />
        );
      })}
      {/* Fountain use is authored on Timeline; Overview only locates it. */}
      <span
        aria-label="Hub fountain"
        className="hub-map-fountain-marker"
        data-hub-fountain
        role="img"
        style={hubMapPosition(hubMapFountainAnnotation)}
        title="Hub fountain"
      >
        <HubMapFountainContent />
      </span>
    </div>
  );
}

/** The Overview-only Hub map consumes the same bound membership/reward contacts as List. */
export function HubMapOverview({
  hubIdentity,
  interactions,
  node,
  resetBoardControl,
  detailsControl,
}: HubMapOverviewProps) {
  return (
    <section aria-label="Ephyra Hub map" className="hub-map-overview">
      <RoomMapViewport
        asset={roomMapAssetFor(node.gameName)}
        controlsPlacement="overlay"
        key={hubIdentity}
        overlay={<HubMapMarkerLayer interactions={interactions} node={node} />}
        title="Ephyra Hub"
        viewportOverlay={
          <div className="hub-map-corner-actions">
            <div className="hub-map-board-actions">
              {resetBoardControl}
              {detailsControl}
            </div>
            <HubMapQualityLegend />
          </div>
        }
      />
    </section>
  );
}
