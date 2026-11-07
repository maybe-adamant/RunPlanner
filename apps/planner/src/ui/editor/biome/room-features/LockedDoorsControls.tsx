import { useState } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceLockedDoors,
} from '@planner/projections/structured-workspace';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { authoredProjectCommandsDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';

const lockHint = (lock: NonNullable<WorkspaceLockedDoors['doors'][number]['lock']>) =>
  lock === 'unreached' ? candidateWaitingHint : 'A room with a challenge switch never locks.';

/**
 * A lock host's Lock Doors gate: ticking it shows the doors that can lock,
 * each marking its door locked when the doors open; unticking it unlocks
 * every door as one edit.
 */
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
  const dispatch = useAppDispatch();
  // Ticking the gate with no door locked only shows the doors; nothing is authored.
  const [revealed, setRevealed] = useState(false);
  const locked = lockedDoors.doors.filter((door) => door.locked);
  const open = revealed || locked.length > 0;
  const unavailable =
    locked.length === 0
      ? lockedDoors.doors.find((door) => door.lock !== undefined)?.lock
      : undefined;
  const disabled =
    locked.length === 0 && lockedDoors.doors.every((door) => door.lock !== undefined);
  const idKey = semanticOwnerControlElementId(lockedDoors.address);
  return (
    <fieldset
      className="room-purging-pool locked-doors"
      data-open={open ? '' : undefined}
      id={idKey}
    >
      <legend className="visually-hidden">Lock Doors</legend>
      <div className="room-feature-presence-row">
        <IconToggle
          disabled={disabled}
          disabledHint={disabled && unavailable !== undefined ? lockHint(unavailable) : undefined}
          icon={roomObjectIcon('lockedDoors')}
          name="Lock Doors"
          onToggle={(next) => {
            if (next) {
              setRevealed(true);
              return;
            }
            setRevealed(false);
            if (locked.length > 0)
              dispatch(
                authoredProjectCommandsDispatched(
                  locked.map((door) => interaction.intentFor(door.exitKey).command),
                ),
              );
          }}
          pressed={open}
        />
      </div>
      {open ? (
        <div className="locked-doors-list">
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
      ) : null}
    </fieldset>
  );
}
