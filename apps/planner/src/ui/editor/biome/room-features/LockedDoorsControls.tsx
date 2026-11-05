import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceLockedDoors,
} from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

const lockHint = (lock: NonNullable<WorkspaceLockedDoors['doors'][number]['lock']>) =>
  lock === 'unreached' ? candidateWaitingHint : 'A room with a challenge switch never locks.';

/** A lock host's doors that can lock: ticking one marks it locked when the doors open. */
export function LockedDoorsControls({
  interactions,
  lockedDoors,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly lockedDoors: WorkspaceLockedDoors;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.roomObjectEntries,
    lockedDoors.interactionKey,
  );
  const executeIntent = useCommandIntent();
  const idKey = semanticOwnerControlElementId(lockedDoors.address);
  return (
    <fieldset className="room-purging-pool locked-doors" id={idKey}>
      <legend className="visually-hidden">Locked doors</legend>
      <div className="room-feature-presence-row">
        <span>Locked doors</span>
        {lockedDoors.doors.map((door) => (
          <label
            className="room-resource-selection"
            key={door.exitKey}
            {...hintProps(door.lock === undefined ? undefined : lockHint(door.lock))}
          >
            <input
              aria-label={`${door.label} locked`}
              checked={door.locked}
              disabled={door.lock !== undefined}
              onChange={() => executeIntent(interaction.intentFor(door.exitKey))}
              type="checkbox"
            />
            <span>{door.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
