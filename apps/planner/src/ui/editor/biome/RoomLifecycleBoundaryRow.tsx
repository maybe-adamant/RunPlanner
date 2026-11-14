import type { ReactNode } from 'react';
import type { EncounterPhaseAddress } from '@run-planner/engine/authored-project';
import type {
  WorkspaceFieldsCageLabel,
  WorkspaceRoomLifecycleBoundary,
} from '@planner/projections/structured-workspace';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { hintProps } from '@planner/ui/controls/hint';
import { TimelineRow } from './TimelineRow';
import { BannerTitle } from './TimelineDoors';
import { TimelineEventIcon } from './TimelineEventIcon';
import type { BannerToggle } from './doorSummary';
import { boundarySpokenLabel } from './lifecycleBoundaryLabel';

/** Render-only boundary row; timeline placement remains the projection's authority. */
export function LifecycleBoundaryRow({
  boundary,
  underTrigger,
  label,
  controls,
  money,
  fieldsCage,
  identity,
  phaseTitle,
  toggle,
}: {
  /** The marker and its phase shown, where the label names both. */
  readonly phaseTitle?: { readonly marker: string; readonly phase: string } | undefined;
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  /** An action row right above brought it about, so it hangs under that row. */
  readonly underTrigger?: true;
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
  const dispatch = useAppDispatch();
  const accessibleLabel = boundarySpokenLabel(label, fieldsCage);
  // One hint tells the whole title: its cage, then its encounter's identity.
  const titleHint = [fieldsCage?.cage, identity?.label]
    .filter((part) => part !== undefined)
    .join(' · ');
  return (
    <TimelineRow
      aria-label={accessibleLabel}
      data-lifecycle-boundary={boundary.key}
      data-boundary-kind={boundary.kind}
      data-reorder-anchor={boundary.key}
      // A Fields cage's markers follow its Unlock row, which already names the cage.
      data-fields-cage={fieldsCage?.slot}
      hooked={underTrigger === true}
      kind="boundary"
      marker={<TimelineEventIcon name={boundary.kind} />}
      money={money}
      label={
        <>
          <span className="timeline-banner-title">
            {identity === undefined ? (
              fieldsCage === undefined ? (
                <BannerTitle
                  label={phaseTitle?.marker ?? label}
                  phase={phaseTitle?.phase}
                  toggle={toggle}
                />
              ) : (
                <span {...hintProps(titleHint, undefined, accessibleLabel)}>
                  <BannerTitle label={label} toggle={toggle} />
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
                <strong>{phaseTitle?.marker ?? label}</strong>
                {phaseTitle === undefined ? null : (
                  <span className="timeline-phase-chip">{phaseTitle.phase}</span>
                )}
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
