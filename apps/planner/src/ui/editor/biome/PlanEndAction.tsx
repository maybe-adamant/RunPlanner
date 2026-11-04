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
 * Ends the plan after this room, or on the end room says so and removes the
 * end. It stays usable past the end, so the end can move to a later room.
 */
export function PlanEndAction({ planEnd }: { readonly planEnd: WorkspaceRoomPlanEnd | undefined }) {
  const executeIntent = useCommandIntent();
  if (planEnd === undefined) return null;
  if (planEnd.relation === 'end')
    return (
      <span className="plan-end-action" data-plan-end="end">
        <span className="plan-end-state" role="status">
          Plan ends here
        </span>
        <button
          className="secondary-action"
          onClick={() => executeIntent(planEnd.removeIntent)}
          type="button"
        >
          Remove plan end
        </button>
      </span>
    );
  const availability = planEnd.availability();
  return (
    <span className="plan-end-action">
      <button
        className="secondary-action"
        disabled={!availability.available}
        onClick={() => executeIntent(planEnd.endIntent)}
        type="button"
        {...hintProps(unavailableHint(availability))}
      >
        End plan here
      </button>
    </span>
  );
}
