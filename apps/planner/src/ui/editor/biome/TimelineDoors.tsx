import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type {
  WorkspaceDoorStep,
  WorkspaceRoomRerolls,
} from '@planner/projections/structured-workspace';
import { useFindingAnchor } from '@planner/ui/feedback/useFindingTarget';
import { DoorChipFace, DoorChips } from './DecisionWorkbench';
import { useRoomMapPointedAmong } from './room-map/roomMapHighlight';
import { TimelineRow } from './TimelineRow';
import { TimelineMapStageContext } from './timelineMapStage';
import { doorChipMapLink, type DoorChip } from './doorSummary';
import { TimelineEventIcon } from './TimelineEventIcon';

/**
 * A room's doors on its Timeline: the Doors open row (a compact state that
 * opens the doors' editor), the room's last row saying how it is left.
 */
export interface TimelineDoorsContent {
  /** The doors' compact state on the Doors open row: a chip per door. */
  readonly summary?: {
    readonly chips: readonly DoorChip[];
    /** The list's name, where it holds a wheel's offers. */
    readonly label?: string;
  };
  /** The owners the editor repairs; a finding on any marks the Doors open row. */
  readonly findingOwners?: readonly SemanticAddress[];
  /** Owners whose findings of one code also mark it, such as a locked door picked to leave by. */
  readonly attentionFindings?: readonly {
    readonly owner: SemanticAddress;
    readonly code: string;
  }[];
  /** The doors' editor, opened from the Doors open row. */
  readonly detail?: ReactNode;
  /** The room's last row: how the room is left, or where the plan ends. */
  readonly leave?: ReactNode;
  /** The plan's saved end: its last row stays, to continue from, while the room is unsettled. */
  readonly endsPlan?: true;
  /** False where the room shows no doors, only its last row. */
  readonly doorsOpenRow?: false;
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
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  /** The editor holds findings, which mark its row while it is shut. */
  readonly holdsFindings?: boolean;
}

/**
 * The Doors open moment's title: its name and its chips as one button that
 * opens the whole moment's editor in one popover. Where the doors cannot be
 * edited, the name and chips stand plain.
 */
export function DoorsMomentTitle({
  doors,
  label,
  phase,
}: {
  readonly doors: TimelineDoors;
  readonly label: string;
  /** The phase a marker of a room of several belongs to, as a chip after its name. */
  readonly phase?: string | undefined;
}) {
  const chips = doors.summary?.chips ?? [];
  if (doors.detail === undefined)
    return (
      <>
        <BannerTitle label={label} phase={phase} />
        <DoorChips chips={chips} label={doors.summary?.label} />
      </>
    );
  return (
    <Popover.Root onOpenChange={doors.onExpandedChange} open={doors.expanded}>
      <Popover.Trigger asChild>
        <button
          aria-label={doors.noun === 'door' ? 'Edit doors' : 'Edit offers'}
          className="doors-moment-trigger"
          data-has-findings={doors.holdsFindings === true || undefined}
          type="button"
        >
          <BannerTitle label={label} phase={phase} />
          {chips.length === 0 ? null : (
            <span aria-hidden="true" className="timeline-door-chips">
              {chips.map((chip) => (
                <DoorsMomentChip chip={chip} key={chip.key} />
              ))}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          aria-label={doors.noun === 'door' ? 'Doors' : 'Offers'}
          className="doors-moment-popover"
          collisionPadding={12}
          // Focus lands on the popover itself, so no first control shows its hint unasked.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}
          sideOffset={6}
        >
          {doors.detail}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** One chip of the moment's button: its face, marked while its map point is pointed at. */
function DoorsMomentChip({ chip }: { readonly chip: DoorChip }) {
  const pointed = useRoomMapPointedAmong([doorChipMapLink(chip)]);
  return (
    <span
      className="timeline-door-chip"
      data-map-pointed={pointed || undefined}
      data-missing={chip.missing}
      data-unavailable={chip.unavailable || undefined}
    >
      <DoorChipFace chip={chip} />
    </span>
  );
}

/** A banner's title: its name, and its phase where a room has several. */
export function BannerTitle({
  label,
  phase,
}: {
  readonly label: string;
  /** The phase a marker of a room of several belongs to, as a chip after its name. */
  readonly phase?: string | undefined;
}) {
  return (
    <>
      <strong>{label}</strong>
      {phase === undefined ? null : <span className="timeline-phase-chip">{phase}</span>}
    </>
  );
}

/** A Doors open row where the room's timeline has none of its own yet. */
export function DoorsOpenBanner({
  doors,
  label = 'Doors opened',
  phaseTitle,
}: {
  readonly doors: TimelineDoors;
  /** A Ship phase's wheel opens as Wheels open. */
  readonly label?: string;
  /** The marker and its phase shown, where the label names both. */
  readonly phaseTitle?: { readonly marker: string; readonly phase: string } | undefined;
}) {
  return (
    <TimelineMapStageContext.Provider value="open">
      <TimelineRow
        aria-label={label}
        kind="boundary"
        marker={<TimelineEventIcon name={doors.noun === 'offer' ? 'wheelsOpen' : 'doorsOpened'} />}
        label={
          <>
            <span className="timeline-banner-title">
              <DoorsMomentTitle
                doors={doors}
                label={phaseTitle?.marker ?? label}
                phase={phaseTitle?.phase}
              />
            </span>
          </>
        }
      />
    </TimelineMapStageContext.Provider>
  );
}

/** The room's last Timeline row: its title, then what it shows or picks, then its actions. */
export function LeaveRow({
  actions,
  anchorOwner,
  children,
  choice = false,
  gap,
  heroDoor,
  label,
  pastEnd = false,
  status,
}: {
  readonly actions?: ReactNode;
  /** The control of the gap above this row, drawn on the spine. */
  readonly gap?: ReactNode;
  /** The owner the row repairs, such as the exit selection; navigation lands on its picker. */
  readonly anchorOwner?: SemanticAddress;
  readonly children?: ReactNode;
  /** The row is an action of the room, such as picking a wheel's offer, not its way out. */
  readonly choice?: boolean;
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
    <TimelineMapStageContext.Provider value="left">
      <TimelineRow
        {...anchor()}
        aria-label={label}
        className="timeline-leave-row"
        gap={gap}
        {...(heroDoor === undefined ? {} : { 'data-hero-door': heroDoor })}
        {...(pastEnd ? { 'data-plan-end': 'pastEnd' } : {})}
        kind={choice ? 'action' : 'boundary'}
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
    </TimelineMapStageContext.Provider>
  );
}
