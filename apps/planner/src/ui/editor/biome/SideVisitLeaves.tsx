import type {
  HubDecisionAddress,
  LocalVisitOrderAddress,
  OccurrenceAddress,
} from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  sideVisitControl,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspaceLocalVisitLeave,
  type WorkspaceRoomPlanEnd,
} from '@planner/projections/structured-workspace';
import { formatFindingSentence, presentFinding } from '@planner/projections/evaluationProjection';
import { semanticOwnerOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { IconActionButton } from '@planner/ui/controls/IconActionButton';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateWaitingHint,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { doorRewardIcons, hubReturnChip } from './doorSummary';
import { DoorChipFace } from './DecisionWorkbench';
import { LeavePicker, type LeaveOption } from './LeavePicker';
import { LeaveRow } from './TimelineDoors';
import { TimelineRow } from './TimelineRow';

type LocalSlot = WorkspaceLocalVisitDecision['slots'][number];

/** Opens the Hub Timeline at the stay a visit returns to. */
export function OpenHubTimeline({
  hub,
  visitIndex,
}: {
  readonly hub: HubDecisionAddress;
  readonly visitIndex: number;
}) {
  const dispatch = useAppDispatch();
  return (
    <IconActionButton
      hint="Open Hub Timeline"
      icon="openInEditor"
      label="Open Hub Timeline"
      onClick={() =>
        dispatch(
          semanticOwnerOpened({
            owner: hub,
            presentation: { kind: 'hubSegment', segment: visitIndex + 1 },
          }),
        )
      }
    />
  );
}

/** Opens a room on its Timeline. */
export function OpenRoomTimeline({
  label,
  room,
}: {
  readonly label: string;
  readonly room: OccurrenceAddress;
}) {
  const dispatch = useAppDispatch();
  return (
    <IconActionButton
      hint={`Open ${label}`}
      icon="openInEditor"
      label={`Open ${label}`}
      onClick={() =>
        dispatch(semanticOwnerOpened({ owner: room, presentation: { kind: 'roomTimeline' } }))
      }
    />
  );
}

function hubOption(hub: HubDecisionAddress): LeaveOption {
  return { key: 'hub', label: 'Hub', name: 'Hub', chip: hubReturnChip(hub) };
}

/** A side room by its number alone, as SR 10. */
function sideRoomName(label: string): string {
  return label.replace(/^Side Room /, 'SR ');
}

/** One exit of the main room: the Hub or an open side room, picked at this place in its visits. */
function SideVisitLeaveRow({
  anchored,
  hub,
  id,
  interactions,
  leave,
  order,
  pastEnd,
  planEnd,
  slots,
  visitIndex,
}: {
  /** Navigation to the visits lands on this row. */
  readonly anchored: boolean;
  readonly hub: HubDecisionAddress;
  readonly id: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly leave: WorkspaceLocalVisitLeave;
  readonly order: LocalVisitOrderAddress;
  /** The plan ends in an earlier side visit. */
  readonly pastEnd: boolean;
  /** The last exit ends the main room's visit; one after a side visit ends that side room's. */
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
  readonly slots: readonly LocalSlot[];
  readonly visitIndex: number;
}) {
  const findingMark = useFindingMark();
  const interaction = requireWorkspaceInteraction(
    interactions.localVisitOrders,
    leave.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const options = leave.options.flatMap((option, index): LeaveOption[] => {
    const candidate = candidates.result?.[index];
    const intent = interaction.intentFor(option.proposedOccurrenceIds);
    const findings =
      candidate?.evaluation.kind === 'sideRoomEntryOrder'
        ? candidate.evaluation.result.findings
        : [];
    const refused =
      candidate !== undefined && !candidateWaits(candidate) && !candidateMayBeAuthored(candidate);
    // A room visited before this exit is no choice here; the picked one stays shown.
    if (refused && findings.length === 0 && option.key !== leave.selectedKey) return [];
    const disabledHint = candidateWaits(candidate)
      ? candidateWaitingHint
      : refused
        ? findings.map((finding) => formatFindingSentence(presentFinding(finding))).join(' ')
        : undefined;
    const base = { ...(disabledHint === undefined ? {} : { disabledHint }), intent };
    if (option.occurrenceId === undefined) return [{ ...hubOption(hub), ...base }];
    const slot = slots.find((candidateSlot) => candidateSlot.key === option.key);
    if (slot?.generation !== 'generated') return [];
    return [
      {
        key: option.key,
        label: slot.label,
        name: sideRoomName(slot.label),
        mapLink: { kind: 'sideDoor', slotKey: slot.key },
        chip: {
          key: option.key,
          label: slot.label,
          roomIcon: slot.roomIcon,
          rewards: doorRewardIcons(slot, 'final'),
        },
        ...base,
      },
    ];
  });
  const picked = slots.find((slot) => slot.key === leave.selectedKey);
  const mark = findingMark(order, sideVisitControl(leave.position));
  return (
    <LeaveRow
      actions={
        picked === undefined ? (
          <OpenHubTimeline hub={hub} visitIndex={visitIndex} />
        ) : picked.generation === 'generated' ? (
          <OpenRoomTimeline label={picked.label} room={picked.room.address} />
        ) : undefined
      }
      {...(anchored ? { anchorOwner: order } : {})}
      // The way back to the Hub is taken at the entry door.
      {...(picked === undefined ? { heroDoor: '' } : {})}
      label="Leave room"
      pastEnd={pastEnd}
    >
      {/* The picker's choices are assessed as it is reached for, before it opens. */}
      <span
        className="timeline-leave-assessed"
        onFocusCapture={candidates.activate}
        onPointerDownCapture={candidates.activate}
      >
        <LeavePicker
          chosenKey={leave.selectedKey}
          findingMark={mark}
          id={id}
          options={options}
          pastEnd={pastEnd}
          planEnd={planEnd}
          readinessOwner={order}
        />
      </span>
    </LeaveRow>
  );
}

/**
 * The main room's exits on its Timeline: one Leave room picker per side
 * visit, the room's return from that side room after it, and a last one
 * back to the Hub. The last ends the plan in the main room; one after a
 * side visit ends it as the hero leaves that side room.
 */
export function SideVisitLeaves({
  hub,
  idPrefix,
  interactions,
  localVisit,
  planEnd,
  visitIndex,
}: {
  readonly hub: HubDecisionAddress;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
  /** The Hub visit the main room is entered by. */
  readonly visitIndex: number;
}) {
  const findingMark = useFindingMark();
  const marked = localVisit.leaves.find(
    (leave) => findingMark(localVisit.order, sideVisitControl(leave.position))['data-has-findings'],
  );
  const anchored = marked?.position ?? 1;
  const visitedBefore = (index: number) => {
    const slot = localVisit.slots.find(
      (candidate) => candidate.key === localVisit.leaves[index - 1]?.selectedKey,
    );
    return slot?.generation === 'generated' ? slot : undefined;
  };
  const endedAt = localVisit.leaves.findIndex(
    (_, index) => visitedBefore(index)?.planEnd?.relation === 'end',
  );
  return localVisit.leaves.flatMap((leave, index) => {
    const last = leave.position === localVisit.leaves.length;
    const row = (
      <SideVisitLeaveRow
        anchored={leave.position === anchored}
        hub={hub}
        id={`${idPrefix}-leave-${leave.position}`}
        interactions={interactions}
        key={`leave-${leave.position}`}
        leave={leave}
        order={localVisit.order}
        pastEnd={endedAt >= 0 && index > endedAt}
        planEnd={last ? planEnd : visitedBefore(index)?.planEnd}
        slots={localVisit.slots}
        visitIndex={visitIndex}
      />
    );
    if (last) return [row];
    const visited = localVisit.slots.find((slot) => slot.key === leave.selectedKey);
    const name = visited === undefined ? undefined : sideRoomName(visited.label);
    return [
      row,
      <TimelineRow
        aria-label={visited === undefined ? 'Returned' : `Returned from ${visited.label}`}
        className="timeline-return-row"
        // Melinoë re-enters the main room at the side room's door.
        {...(visited === undefined ? {} : { 'data-hero-door': visited.key })}
        // The plan ending in a side room ends before the hero returns from it.
        {...(endedAt >= 0 && index >= endedAt - 1 ? { 'data-plan-end': 'pastEnd' } : {})}
        key={`return-${leave.position}`}
        kind="boundary"
        label={
          <>
            <span className="timeline-banner-title">
              <strong>Returned</strong>
            </span>
            {visited?.generation !== 'generated' ? null : (
              <span className="timeline-banner-modifiers timeline-return-room">
                <span className="timeline-door-chip">
                  <DoorChipFace
                    chip={{
                      key: visited.key,
                      label: visited.label,
                      roomIcon: visited.roomIcon,
                      rewards: doorRewardIcons(visited, 'final'),
                    }}
                  />
                </span>
                <span className="timeline-leave-text">{name}</span>
              </span>
            )}
          </>
        }
      />,
    ];
  });
}

/** A side room's only exit: back to its main room, or ending the plan there. */
export function SideRoomLeave({
  id,
  mainRoom,
  planEnd,
}: {
  readonly id: string;
  readonly mainRoom: { readonly room: OccurrenceAddress; readonly label: string };
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
}) {
  const way: LeaveOption = {
    key: 'back',
    label: `Back to ${mainRoom.label}`,
    mapLink: { kind: 'door', doorIndex: 1 },
  };
  return (
    <LeaveRow
      actions={<OpenRoomTimeline label={mainRoom.label} room={mainRoom.room} />}
      label="Leave room"
    >
      <LeavePicker chosenKey={way.key} id={id} options={[way]} planEnd={planEnd} />
    </LeaveRow>
  );
}

/**
 * A Hub room's only exit with no side doors, or the Pre-Hub's: into the Hub, or
 * ending the plan there.
 */
export function HubRoomLeave({
  hub,
  id,
  planEnd,
  visitIndex,
}: {
  readonly hub: HubDecisionAddress;
  readonly id: string;
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
  /** The Hub visit the room ends; 0 for the Pre-Hub, which enters the Hub. */
  readonly visitIndex: number;
}) {
  return (
    <LeaveRow actions={<OpenHubTimeline hub={hub} visitIndex={visitIndex} />} label="Leave room">
      <LeavePicker chosenKey="hub" id={id} options={[hubOption(hub)]} planEnd={planEnd} />
    </LeaveRow>
  );
}
