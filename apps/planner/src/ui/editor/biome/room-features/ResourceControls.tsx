import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { elementIcon, gatheringToolIcon } from '@planner/ui/artwork/roomArtwork';

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
  return (
    <div aria-label="Resources" className="room-feature-action-list" role="region">
      {room.resources?.map((resource) => (
        <div className="room-feature-presence-row room-resource-row" key={resource.family}>
          <label className="room-resource-selection">
            <input
              {...findingTarget(resource.address)}
              checked={resource.action === 'remove'}
              disabled={!resource.legal && resource.action !== 'remove'}
              onChange={() =>
                executeIntent(
                  requireWorkspaceInteraction(
                    interactions.resourcePlacements,
                    resource.interactionKey,
                  ).intent,
                )
              }
              type="checkbox"
            />
            <ArtworkIcon
              className="artwork-label-icon"
              source={gatheringToolIcon(resource.family)}
            />
            <span>{resource.label}</span>
            {resource.element === undefined ? null : (
              <ArtworkIcon className="artwork-label-icon" source={elementIcon(resource.element)} />
            )}
          </label>
          {resource.action === 'move' && resource.currentPlacement !== undefined ? (
            <span className="resource-placement-disclosure">
              Currently placed at{' '}
              <button
                className="semantic-focus-link"
                onClick={() => dispatch(semanticOwnerNavigated(resource.currentPlacement!.address))}
                type="button"
              >
                {resource.currentPlacement.biomeKey} · {resource.currentPlacement.locationLabel}
              </button>
              .
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
