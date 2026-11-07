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
import { TimelineRow } from './TimelineRow';
import { BannerTitle } from './TimelineDoors';
import type { BannerToggle } from './doorSummary';
import { boundarySpokenLabel } from './lifecycleBoundaryLabel';

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
  /** The phase's settled identity: the title's hint, and a link to its Overview picker. */
  readonly identity?: { readonly label: string; readonly owner: EncounterPhaseAddress };
  /** The title shows or hides the editor under the banner, such as the doors'. */
  readonly toggle?: BannerToggle | undefined;
}) {
  const findingAnchor = useFindingAnchor();
  const dispatch = useAppDispatch();
  const accessibleLabel = boundarySpokenLabel(label, fieldsCage);
  // One hint tells the whole title: its cage, then its encounter's identity.
  const titleHint = [fieldsCage?.cage, identity?.label]
    .filter((part) => part !== undefined)
    .join(' · ');
  // A Fields cage is known by its slot, subscripted on its encounter's name as its rewards mark it.
  const cageSlot =
    fieldsCage === undefined ? null : (
      <span
        aria-label={fieldsCage.cage}
        className="fields-cage-slot"
        {...(fieldsCage.owner === undefined
          ? {}
          : { ...findingAnchor(fieldsCage.owner), tabIndex: -1 })}
        role="img"
      >
        C{fieldsCage.slot}
      </span>
    );
  return (
    <TimelineRow
      aria-label={accessibleLabel}
      data-lifecycle-boundary={boundary.key}
      data-boundary-kind={boundary.kind}
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
            {identity === undefined ? (
              cageSlot === null ? (
                <BannerTitle label={label} toggle={toggle} />
              ) : (
                // The slot hugs the title as a subscript, as it does on a start banner.
                <span {...hintProps(titleHint, undefined, accessibleLabel)}>
                  <BannerTitle label={label} toggle={toggle} />
                  {cageSlot}
                </span>
              )
            ) : (
              <button
                {...hintProps(titleHint, undefined, `${label}: ${titleHint}`)}
                aria-label={`${label}: ${titleHint}`}
                className="timeline-banner-identity"
                onClick={() => dispatch(semanticOwnerNavigated(identity.owner))}
                type="button"
              >
                <strong>{label}</strong>
                {cageSlot}
              </button>
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
