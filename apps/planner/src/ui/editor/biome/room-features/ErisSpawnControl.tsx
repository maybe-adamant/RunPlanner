import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

/** Eris spawns on room entry; her talk stays on the Room Timeline. */
export function ErisSpawnControl({
  interactions,
  observation,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly observation: NonNullable<WorkspaceRoomSummary['erisObservation']>;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.erisObservations,
    observation.interactionKey,
  );
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  return (
    <label className="room-feature-presence-row">
      <input
        {...findingTarget(observation.address)}
        checked={interaction.spawned}
        onChange={(event) => executeIntent(interaction.intentFor(event.target.checked))}
        type="checkbox"
      />
      <span>Eris has spawned</span>
    </label>
  );
}
