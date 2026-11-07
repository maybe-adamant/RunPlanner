import type { ReactNode } from 'react';
import type { EncounterPhaseAddress } from '@run-planner/engine/authored-project';
import type {
  WorkspaceFieldsCageLabel,
  WorkspaceRoomLifecycleBoundary,
} from '@planner/projections/structured-workspace';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from '@planner/ui/controls/hint';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';
import { TimelineRow } from './TimelineRow';
import { BannerTitle } from './TimelineDoors';
import type { BannerToggle } from './doorSummary';

/** Render-only boundary row; timeline placement remains the projection's authority. */
export function LifecycleBoundaryRow({
  boundary,
  label,
  controls,
  money,
  fieldsCage,
  identity,
  phase,
  toggle,
}: {
  /** The encounter phase this banner belongs to, for the phase's light grouping. */
  readonly phase?: number;
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  readonly label: string;
  /** The banner's own controls, flowing on its sentence after its identity. */
  readonly controls?: ReactNode;
  /** Gold the banner settles, in the Timeline's money column. */
  readonly money?: ReactNode;
  readonly fieldsCage?: WorkspaceFieldsCageLabel;
  /** The phase's settled identity; it navigates to its Overview picker and never edits. */
  readonly identity?: { readonly label: string; readonly owner: EncounterPhaseAddress };
  /** The title shows or hides the editor under the banner, such as the doors'. */
  readonly toggle?: BannerToggle | undefined;
}) {
  const findingAnchor = useFindingAnchor();
  const dispatch = useAppDispatch();
  // A Fields cage is known by its slot, subscripted on its encounter's name.
  const cageSlot =
    fieldsCage === undefined ? null : (
      <span
        {...hintProps(fieldsCage.cage)}
        aria-label={fieldsCage.label}
        className="fields-cage-slot"
        {...(fieldsCage.owner === undefined
          ? {}
          : { ...findingAnchor(fieldsCage.owner), tabIndex: -1 })}
        role="img"
      >
        {fieldsCage.slot}
      </span>
    );
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
      kind="boundary"
      money={money}
      label={
        <>
          <span className="timeline-banner-title">
            <BannerTitle label={label} toggle={toggle} />
            {identity === undefined ? cageSlot : null}
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
                  {cageSlot}
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
