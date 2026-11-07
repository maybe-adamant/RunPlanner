import * as Popover from '@radix-ui/react-popover';
import { useRef, useState } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { elementIcon, gatheringToolIcon } from '@planner/ui/artwork/roomArtwork';

type RoomResource = NonNullable<WorkspaceRoomSummary['resources']>[number];

/**
 * The room's resources as one row of icon toggles: dim when not placed, lit
 * when placed here, dim with its room's number when placed in another room.
 */
export function RoomResourceControls({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}) {
  return (
    <div aria-label="Resources" className="room-feature-action-list" role="region">
      <div className="icon-toggle-row">
        {(room.resources ?? []).map((resource) => (
          <ResourceToggle interactions={interactions} key={resource.family} resource={resource} />
        ))}
      </div>
    </div>
  );
}

function ResourceToggle({
  interactions,
  resource,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly resource: RoomResource;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const [confirming, setConfirming] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const disabled = !resource.legal && resource.action !== 'remove';
  const place = () =>
    executeIntent(
      requireWorkspaceInteraction(interactions.resourcePlacements, resource.interactionKey).intent,
    );
  const elsewhere = resource.action === 'move' && !disabled ? resource.currentPlacement : undefined;
  const toggle = (
    <IconToggle
      disabled={disabled}
      icon={
        resource.element === undefined
          ? gatheringToolIcon(resource.family)
          : elementIcon(resource.element)
      }
      name={resource.element === undefined ? resource.label : `Collect ${resource.element}`}
      onToggle={() => (elsewhere === undefined ? place() : setConfirming((open) => !open))}
      pressed={resource.action === 'remove'}
      target={findingTarget(resource.address)}
      {...(elsewhere === undefined
        ? {}
        : {
            badge: elsewhere.runDepth?.toString(),
            detail: placementRoom(elsewhere),
            opensDialog: { open: confirming },
          })}
    />
  );
  const shortName = resource.element ?? resource.label;
  // One stable tree, so the toggle keeps focus when its placement moves here.
  return (
    <Popover.Root open={confirming && elsewhere !== undefined} onOpenChange={setConfirming}>
      <Popover.Anchor asChild>
        <span className="resource-toggle-anchor" ref={anchor}>
          {toggle}
        </span>
      </Popover.Anchor>
      {elsewhere === undefined ? null : (
        <Popover.Portal>
          <Popover.Content
            aria-label={`Move ${shortName}`}
            className="contextual-picker-popover resource-move-popover"
            collisionPadding={12}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              anchor.current?.querySelector('button')?.focus();
            }}
            onInteractOutside={(event) => {
              // The toggle itself closes the popover through its own press.
              if (anchor.current?.contains(event.target as Node)) event.preventDefault();
            }}
            side="bottom"
            align="start"
            sideOffset={6}
          >
            <p className="resource-move-message">
              {shortName} is placed in {placementRoom(elsewhere)}.
            </p>
            <div className="resource-move-actions">
              <button
                className="secondary-action"
                onClick={() => {
                  setConfirming(false);
                  place();
                }}
                type="button"
              >
                Move here
              </button>
              <Popover.Close asChild>
                <button className="quiet-action" type="button">
                  Cancel
                </button>
              </Popover.Close>
            </div>
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

function placementRoom(placement: NonNullable<RoomResource['currentPlacement']>): string {
  return placement.runDepth === undefined
    ? placement.locationLabel
    : `Room ${placement.runDepth} · ${placement.locationLabel}`;
}
