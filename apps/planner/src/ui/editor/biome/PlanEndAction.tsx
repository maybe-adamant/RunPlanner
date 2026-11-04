import type {
  WorkspacePlanEndAvailability,
  WorkspaceRoomPlanEnd,
} from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

/** Only an unsettled plan needs explaining; a room off the path already says so. */
function unavailableHint(availability: WorkspacePlanEndAvailability): string | undefined {
  return !availability.available && availability.reason === 'notSettled'
    ? 'Complete the plan up to this room first.'
    : undefined;
}

/**
 * Ends the plan after this room, or on the end room removes the end. It stays
 * usable past the end, so the end can move to a later room.
 */
export function PlanEndAction({ planEnd }: { readonly planEnd: WorkspaceRoomPlanEnd | undefined }) {
  const executeIntent = useCommandIntent();
  if (planEnd === undefined) return null;
  if (planEnd.relation === 'end')
    return (
      <button
        className="plan-end-action"
        onClick={() => executeIntent(planEnd.removeIntent)}
        type="button"
      >
        Continue planning
      </button>
    );
  const availability = planEnd.availability();
  return (
    <button
      className="plan-end-action"
      disabled={!availability.available}
      onClick={() => executeIntent(planEnd.endIntent)}
      type="button"
      {...hintProps(unavailableHint(availability))}
    >
      End plan here
    </button>
  );
}
