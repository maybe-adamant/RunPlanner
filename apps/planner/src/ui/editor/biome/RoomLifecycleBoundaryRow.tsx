import type { ReactNode } from 'react';
import type { EncounterPhaseAddress } from '@run-planner/engine/authored-project';
import type {
  WorkspaceFieldsCageLabel,
  WorkspaceRoomLifecycleBoundary,
} from '@planner/projections/structured-workspace';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';
import { TimelineRow } from './TimelineRow';

/** Render-only boundary row; timeline placement remains the projection's authority. */
export function LifecycleBoundaryRow({
  boundary,
  label,
  controls,
  editors,
  fieldsCage,
  identity,
  phase,
}: {
  /** The encounter phase this banner belongs to, for the phase's light grouping. */
  readonly phase?: number;
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  readonly label: string;
  /** The banner's own controls, on its line after its identity; they never shrink. */
  readonly controls?: ReactNode;
  readonly editors?: ReactNode;
  readonly fieldsCage?: WorkspaceFieldsCageLabel;
  /** The phase's settled identity; it navigates to its Overview picker and never edits. */
  readonly identity?: { readonly label: string; readonly owner: EncounterPhaseAddress };
}) {
  const findingAnchor = useFindingAnchor();
  const dispatch = useAppDispatch();
  return (
    <TimelineRow
      aria-label={label}
      data-lifecycle-boundary={boundary.key}
      data-reorder-anchor={boundary.key}
      data-phase={phase}
      data-phase-start={
        (boundary.kind === 'encounterStart' || boundary.kind === 'roomEntered') &&
        phase !== undefined
          ? ''
          : undefined
      }
      editors={editors}
      kind="boundary"
      label={
        <>
          <span className="timeline-banner-title">
            <strong>{label}</strong>
            {fieldsCage === undefined ? null : <span aria-hidden="true">·</span>}
            {fieldsCage === undefined ? null : (
              <span
                aria-label={fieldsCage.label}
                className="fields-cage-label"
                {...(fieldsCage.owner === undefined
                  ? {}
                  : { ...findingAnchor(fieldsCage.owner), tabIndex: -1 })}
                role="img"
              >
                <span className="timeline-row-tag">{fieldsCage.cage}</span>
              </span>
            )}
            {identity === undefined ? null : (
              <>
                <span aria-hidden="true">·</span>
                <button
                  className="timeline-banner-identity"
                  onMouseEnter={showTruncatedTitle}
                  onClick={() => dispatch(semanticOwnerNavigated(identity.owner))}
                  type="button"
                >
                  {identity.label}
                </button>
              </>
            )}
          </span>
          {controls === undefined ? null : (
            <span className="timeline-banner-modifiers">{controls}</span>
          )}
        </>
      }
    />
  );
}
