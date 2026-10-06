import type { ReactNode } from 'react';
import type {
  WorkspaceFieldsCageLabel,
  WorkspaceRoomLifecycleBoundary,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { TimelineRow } from './TimelineRow';

/** Render-only boundary row; timeline placement remains the projection's authority. */
export function LifecycleBoundaryRow({
  boundary,
  label,
  dropIndex,
  dropState,
  editors,
  fieldsCage,
}: {
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  readonly label: string;
  readonly dropIndex: number;
  readonly dropState?: 'available' | 'unavailable';
  readonly editors?: ReactNode;
  readonly fieldsCage?: WorkspaceFieldsCageLabel;
}) {
  const findingTarget = useFindingTarget();
  return (
    <TimelineRow
      aria-label={label}
      data-drop-position={dropState}
      data-lifecycle-boundary={boundary.key}
      data-room-action-drop-index={dropIndex}
      editors={editors}
      kind="boundary"
      label={
        <>
          <strong>{label}</strong>
          {fieldsCage === undefined ? null : (
            <span className="fields-cage-label" {...findingTarget(fieldsCage.owner)} tabIndex={-1}>
              {fieldsCage.label}
            </span>
          )}
        </>
      }
      ordinal="·"
    />
  );
}
