import type { ReactNode } from 'react';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type { WorkspaceRoomRerolls } from '@planner/projections/structured-workspace';
import type { DoorChip } from './doorSummary';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { TimelineRow } from './TimelineRow';

/**
 * A room's doors on its Timeline: the Doors open row (a compact state that
 * expands into the doors' editor), the room's last row saying how it is
 * left, the batch facts beside the Timeline and the Doors object.
 */
export interface TimelineDoorsContent {
  /** The doors' compact state on the Doors open row. */
  readonly summary?: ReactNode;
  /** The owners the editor repairs; a new finding on any opens the doors. */
  readonly findingOwners?: readonly SemanticAddress[];
  /** The doors' editor, shown while the row is expanded. */
  readonly detail?: ReactNode;
  /** The room's last row: how the room is left, or where the plan ends. */
  readonly leave?: ReactNode;
  /** Batch facts, beside the Timeline. */
  readonly notes?: ReactNode;
  /** The Doors object in the Add area, where presses on the doors are added. */
  readonly object?: ReactNode;
  /** The presses on the doors, each edited on its own Timeline row. */
  readonly rerolls?: WorkspaceRoomRerolls;
  /** The doors as first drawn, which each press row shows as it leaves them. */
  readonly chips?: readonly DoorChip[];
}

export interface TimelineDoors extends TimelineDoorsContent {
  /** What the editor holds: a room's doors, or a Ship wheel's offers. */
  readonly noun: 'door' | 'offer';
  /** The editor line's id, which the disclosure controls. */
  readonly detailId: string;
  readonly expanded: boolean;
  /** Absent where the editor cannot be hidden. */
  readonly onExpandedChange?: (expanded: boolean) => void;
}

/** The Doors open row's own controls: the door chips, then the disclosure that hides the doors. */
export function DoorsOpenControls({ doors }: { readonly doors: TimelineDoors }) {
  const toggle = doors.onExpandedChange;
  return (
    <span className="timeline-doors-open-controls">
      {doors.summary}
      {doors.detail === undefined || toggle === undefined ? null : (
        <button
          aria-controls={doors.detailId}
          aria-expanded={doors.expanded}
          aria-label={doors.noun === 'door' ? 'Door details' : 'Offer details'}
          className="text-action timeline-doors-toggle"
          onClick={() => toggle(!doors.expanded)}
          type="button"
        >
          <span aria-hidden="true">{doors.expanded ? '▾' : '▸'}</span>
        </button>
      )}
    </span>
  );
}

/** The expanded doors, as one full-width Timeline line under the Doors open row. */
export function DoorsOpenDetailRow({
  children,
  id,
}: {
  readonly children: ReactNode;
  readonly id: string;
}) {
  return (
    <li className="timeline-doors-detail-row" id={id}>
      {children}
    </li>
  );
}

/** A Doors open row where the room's timeline has none of its own yet. */
export function DoorsOpenBanner({
  doors,
  label = 'Doors open',
}: {
  readonly doors: TimelineDoors;
  /** A Ship phase's wheel opens as Next phase ready. */
  readonly label?: string;
}) {
  return (
    <>
      <TimelineRow
        aria-label={label}
        kind="boundary"
        label={
          <>
            <span className="timeline-banner-title">
              <strong>{label}</strong>
            </span>
            <span className="timeline-banner-modifiers">
              <DoorsOpenControls doors={doors} />
            </span>
          </>
        }
      />
      {doors.expanded && doors.detail !== undefined ? (
        <DoorsOpenDetailRow id={doors.detailId}>{doors.detail}</DoorsOpenDetailRow>
      ) : null}
    </>
  );
}

/** The room's last Timeline row: its title, then what it shows or picks, then its actions. */
export function LeaveRow({
  actions,
  anchorOwner,
  children,
  label,
  status,
}: {
  readonly actions?: ReactNode;
  /** The owner the row repairs, such as the exit selection; navigation lands on its picker. */
  readonly anchorOwner?: SemanticAddress;
  readonly children?: ReactNode;
  readonly label: string;
  /** A quiet note on the doors' state. */
  readonly status?: string | undefined;
}) {
  const findingAnchor = useFindingAnchor();
  const anchor =
    anchorOwner === undefined
      ? {}
      : {
          ...findingAnchor(anchorOwner, {
            // Navigation lands on the exit picker, never on End plan here; else on the row.
            focusTarget: (row) =>
              row.querySelector<HTMLElement>('.timeline-leave-door button:not(:disabled)') ?? row,
          }),
          tabIndex: -1,
        };
  return (
    <TimelineRow
      {...anchor}
      aria-label={label}
      className="timeline-leave-row"
      kind="boundary"
      label={
        <>
          <span className="timeline-banner-title">
            <strong>{label}</strong>
          </span>
          <span className="timeline-banner-modifiers timeline-leave-controls">
            {children}
            {status === undefined ? null : <span className="neutral-status">{status}</span>}
            {actions === undefined ? null : (
              <span className="timeline-leave-actions">{actions}</span>
            )}
          </span>
        </>
      }
    />
  );
}
