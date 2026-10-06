import type { ReactNode } from 'react';
import type { EncounterPhaseAddress } from '@run-planner/engine/authored-project';
import type {
  WorkspaceFieldsCageLabel,
  WorkspaceRoomLifecycleBoundary,
} from '@planner/projections/structured-workspace';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
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
  identity,
}: {
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  readonly label: string;
  readonly dropIndex: number;
  readonly dropState?: 'available' | 'unavailable';
  readonly editors?: ReactNode;
  readonly fieldsCage?: WorkspaceFieldsCageLabel;
  /** The phase's settled identity; it navigates to its Overview picker and never edits. */
  readonly identity?: { readonly label: string; readonly owner: EncounterPhaseAddress };
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
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
          {identity === undefined ? null : (
            <>
              <span aria-hidden="true">·</span>
              <button
                className="timeline-banner-identity"
                onClick={() => dispatch(semanticOwnerNavigated(identity.owner))}
                title="Edit in Room Overview"
                type="button"
              >
                {identity.label}
              </button>
            </>
          )}
        </>
      }
    />
  );
}
