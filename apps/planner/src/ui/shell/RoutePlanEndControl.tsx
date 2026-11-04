import type {
  WorkspaceRoute,
  WorkspaceRoutePlanEnd,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

/** Where the plan ends, with the way to its room and to remove it; the route's end repair. */
export function RoutePlanEndControl({
  planEnd,
  route,
}: {
  readonly planEnd: WorkspaceRoutePlanEnd;
  readonly route: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  return (
    <div className="route-plan-end field-control field-control-inline">
      <span>Plan ends</span>
      <div
        aria-label="Plan end"
        className="route-plan-end-value"
        data-unreached={planEnd.unreached}
        role="group"
        {...findingTarget(route.marker.address)}
      >
        <span className="route-plan-end-room">
          After {planEnd.roomLabel} · {planEnd.biomeLabel}
        </span>
        <button
          className="quiet-action action-compact"
          onClick={() => dispatch(semanticOwnerFocused(planEnd.room))}
          type="button"
        >
          Open room →
        </button>
        <button
          className="quiet-action action-compact"
          onClick={() => executeIntent(planEnd.removeIntent)}
          type="button"
        >
          Remove plan end
        </button>
      </div>
    </div>
  );
}
