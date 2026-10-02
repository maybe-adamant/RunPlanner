import type {
  WorkspaceFieldsCageLabel,
  WorkspaceRoomLifecycleBoundary,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

/** Render-only boundary row; timeline placement remains the projection's authority. */
export function LifecycleBoundaryRow({
  boundary,
  label,
  dropIndex,
  dropState,
  fieldsCage,
}: {
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  readonly label: string;
  readonly dropIndex: number;
  readonly dropState?: 'available' | 'unavailable';
  readonly fieldsCage?: WorkspaceFieldsCageLabel;
}) {
  const findingTarget = useFindingTarget();
  return (
    <li
      aria-label={label}
      className="room-action-lifecycle-boundary"
      data-drop-position={dropState}
      data-lifecycle-boundary={boundary.key}
      data-room-action-drop-index={dropIndex}
    >
      <span aria-hidden="true" className="hub-roster-rank">
        ·
      </span>
      <strong>{label}</strong>
      {fieldsCage === undefined ? null : (
        <span className="fields-cage-label" {...findingTarget(fieldsCage.owner)} tabIndex={-1}>
          {fieldsCage.label}
        </span>
      )}
    </li>
  );
}
