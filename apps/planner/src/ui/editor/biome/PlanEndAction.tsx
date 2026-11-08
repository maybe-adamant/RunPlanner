import type {
  WorkspacePlanEndAvailability,
  WorkspaceRoomPlanEnd,
} from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

/** Only an unsettled plan needs explaining; a room off the path already says so. */
// eslint-disable-next-line react-refresh/only-export-components -- The Leave room picker explains the same refusal.
export function planEndUnavailableHint(
  availability: WorkspacePlanEndAvailability,
): string | undefined {
  return !availability.available && availability.reason === 'notSettled'
    ? 'Complete the plan up to this room first.'
    : undefined;
}

/**
 * Ends the plan after a room with no Leave room picker of its own. It stays
 * usable past the end, so the end can move to a later room.
 */
export function PlanEndAction({ planEnd }: { readonly planEnd: WorkspaceRoomPlanEnd | undefined }) {
  const executeIntent = useCommandIntent();
  if (planEnd === undefined || planEnd.relation === 'end') return null;
  const availability = planEnd.availability();
  return (
    <button
      className="plan-end-action"
      disabled={!availability.available}
      onClick={() => executeIntent(planEnd.endIntent)}
      type="button"
      {...hintProps(planEndUnavailableHint(availability))}
    >
      End plan here
    </button>
  );
}
