import type { ReactNode } from 'react';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type {
  WorkspaceDoorStep,
  WorkspaceRoomRerolls,
} from '@planner/projections/structured-workspace';
import type { DoorChip } from './doorSummary';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { DoorChips } from './DecisionWorkbench';
import { TimelineRow } from './TimelineRow';
import { doorsOpenToggle, type BannerToggle } from './doorSummary';

/**
 * A room's doors on its Timeline: the Doors open row (a compact state that
 * expands into the doors' editor), the room's last row saying how it is
 * left, the batch facts beside the Timeline and the Doors object.
 */
export interface TimelineDoorsContent {
  /** The doors' compact state on the Doors open row: a chip per door. */
  readonly summary?: {
    readonly chips: readonly DoorChip[];
    /** The list's name, where it holds a wheel's offers. */
    readonly label?: string;
  };
  /**
   * The door note being hovered or focused: the chip it lights while the
   * editor is shut, and whether the open editor shows it on a row of its own.
   * A note lights the Doors open title where neither shows it.
   */
  readonly activeNote?: { readonly chip?: string; readonly ownRow: boolean };
  /** The owners the editor repairs; a new finding on any opens the doors. */
  readonly findingOwners?: readonly SemanticAddress[];
  /** Owners whose findings of one code also open the doors, such as a locked door picked to leave by. */
  readonly attentionFindings?: readonly {
    readonly owner: SemanticAddress;
    readonly code: string;
  }[];
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
  /** The doors after each unlock and door reroll, by its Timeline row's action key. */
  readonly steps?: readonly WorkspaceDoorStep[];
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

/** The Doors open row's own controls: the door chips. */
export function DoorsOpenControls({ doors }: { readonly doors: TimelineDoors }) {
  return (
    <span className="timeline-doors-open-controls">
      {doors.summary === undefined ? null : (
        <DoorChips
          activeKey={doors.expanded ? undefined : doors.activeNote?.chip}
          chips={doors.summary.chips}
          label={doors.summary.label}
        />
      )}
    </span>
  );
}

/** A banner's title: its name, or the disclosure button carrying it. */
export function BannerTitle({
  label,
  toggle,
}: {
  readonly label: string;
  readonly toggle?: BannerToggle | undefined;
}) {
  if (toggle === undefined) return <strong>{label}</strong>;
  return (
    <button
      aria-controls={toggle.controls}
      aria-expanded={toggle.expanded}
      aria-label={toggle.label}
      className="timeline-banner-toggle"
      data-note-active={toggle.noteActive || undefined}
      onClick={toggle.onToggle}
      type="button"
    >
      <span aria-hidden="true" className="timeline-banner-toggle-caret">
        {toggle.expanded ? '▾' : '▸'}
      </span>
      <strong>{label}</strong>
    </button>
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
        data-doors-open
        kind="boundary"
        label={
          <>
            <span className="timeline-banner-title">
              <BannerTitle label={label} toggle={doorsOpenToggle(doors)} />
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
  heroDoor,
  label,
  pastEnd = false,
  status,
}: {
  readonly actions?: ReactNode;
  /** The owner the row repairs, such as the exit selection; navigation lands on its picker. */
  readonly anchorOwner?: SemanticAddress;
  readonly children?: ReactNode;
  /** Where Melinoë stands on the room's map from this row: a side door's slot key, empty for the entry. */
  readonly heroDoor?: string | undefined;
  readonly label: string;
  /** The plan ends before this row: it stays as authored, not walked. */
  readonly pastEnd?: boolean;
  /** A quiet note on the doors' state. */
  readonly status?: string | undefined;
}) {
  const findingAnchor = useFindingAnchor();
  const anchor = () => {
    if (anchorOwner === undefined) return {};
    // The picker shows its own waiting state, so the row never locks around it.
    const {
      inert: _inert,
      'aria-disabled': _disabled,
      'data-authoring-locked': _locked,
      ...props
    } = findingAnchor(anchorOwner, {
      // Navigation lands on the Leave room picker; else on the row.
      focusTarget: (row) =>
        row.querySelector<HTMLElement>('.timeline-leave-door button:not(:disabled)') ?? row,
    });
    void _inert;
    void _disabled;
    void _locked;
    return { ...props, tabIndex: -1 };
  };
  return (
    <TimelineRow
      {...anchor()}
      aria-label={label}
      className="timeline-leave-row"
      {...(heroDoor === undefined ? {} : { 'data-hero-door': heroDoor })}
      {...(pastEnd ? { 'data-plan-end': 'pastEnd' } : {})}
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
