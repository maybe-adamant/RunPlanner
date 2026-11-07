import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { elementIcon, gatheringToolIcon } from '@planner/ui/artwork/roomArtwork';

/** The room's resources as one row of icon toggles; a resource placed elsewhere says where. */
export function RoomResourceControls({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const resources = room.resources ?? [];
  const name = (resource: (typeof resources)[number]) =>
    resource.element === undefined ? resource.label : `Collect ${resource.element}`;
  return (
    <div aria-label="Resources" className="room-feature-action-list" role="region">
      <div className="icon-toggle-row">
        {resources.map((resource) => (
          <IconToggle
            disabled={!resource.legal && resource.action !== 'remove'}
            icon={
              resource.element === undefined
                ? gatheringToolIcon(resource.family)
                : elementIcon(resource.element)
            }
            key={resource.family}
            name={name(resource)}
            onToggle={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.resourcePlacements,
                  resource.interactionKey,
                ).intent,
              )
            }
            pressed={resource.action === 'remove'}
            target={findingTarget(resource.address)}
          />
        ))}
      </div>
      {resources.map((resource) =>
        resource.action === 'move' && resource.currentPlacement !== undefined ? (
          <span className="resource-placement-disclosure" key={resource.family}>
            {resource.element ?? resource.label} placed at{' '}
            <button
              className="semantic-focus-link"
              onClick={() => dispatch(semanticOwnerNavigated(resource.currentPlacement!.address))}
              type="button"
            >
              {resource.currentPlacement.biomeKey} · {resource.currentPlacement.locationLabel}
            </button>
            .
          </span>
        ) : null,
      )}
    </div>
  );
}
