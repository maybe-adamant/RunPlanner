import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';

import type { HubAction } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceDoorContract,
  type WorkspaceHubActionOrderInteraction,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubRowMove,
  type WorkspaceHubStay,
  type WorkspaceHubStayDoor,
  type WorkspaceHubStayRow,
  type WorkspaceHubStayRowReference,
  type WorkspaceHubVisit,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { rerollDieArtwork } from '@planner/ui/artwork/rerolls/rerollArtwork';
import { hubFountainIcon } from '@planner/ui/artwork/roomArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { IconActionButton } from '@planner/ui/controls/IconActionButton';
import { semanticOwnerFocused, semanticOwnerOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateWaitingHint,
} from '@planner/ui/feedback/candidatePresentation';
import {
  useAuthoringLocked,
  useFindingAnchor,
  useFindingMark,
  useFindingTarget,
  type FindingMarkProps,
} from '@planner/ui/feedback/useFindingTarget';
import { hubMapPosition, type HubMapAnnotation } from '@planner/ui/room-maps/HubMapAnnotations';
import { RerolledRewardRepairIcon } from './DoorRewardEditor';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';
import { HubBoardMap, HubDoorFace } from './hub-map/HubBoardMap';
import { RoomActionPlacementPicker } from './RoomActionPlacementPicker';
import { RoomRerolls } from './RoomRerolls';
import { roomKindIcon } from './roomIcon';
import { TimelineReorderHandle, TimelineReorderStatus } from './TimelineReorderHandle';
import {
  useTimelineReorder,
  type TimelineReorderPosition,
  type TimelineReorderSession,
} from './useTimelineReorder';

/** The stay a segment heads: Entry, then the return after each visit. */
function segmentLabel(precedingVisitCount: number): string {
  return precedingVisitCount === 0 ? 'Entry' : `Visit ${precedingVisitCount}`;
}

function stayRowLabel(row: WorkspaceHubStayRowReference): string {
  return row.kind === 'fountain' ? 'Fountain' : `Reroll ${row.position}`;
}

function moveLabel(move: WorkspaceHubRowMove): string {
  switch (move.destination.kind) {
    case 'before':
      return `Before ${stayRowLabel(move.destination.row)}`;
    case 'after':
      return `After ${stayRowLabel(move.destination.row)}`;
    case 'stay':
      return segmentLabel(move.destination.precedingVisitCount);
  }
}

/**
 * The visited door's reward as icons, first draw → final where rerolled, with
 * the repair of a kept pick its rerolls no longer match.
 */
function VisitReward({ door }: { readonly door: WorkspaceDoorContract | undefined }) {
  const findingAnchor = useFindingAnchor();
  if (door?.offerRewardSurface.visibility !== 'visible') return null;
  const rewards = door.offerRewardSurface.rewards;
  if (rewards.length === 0) return null;
  const name = rewards
    .map((reward) =>
      reward.rerolledSummary === undefined
        ? reward.summary
        : `${reward.summary} → ${reward.rerolledSummary}`,
    )
    .join(', ');
  const repaired = rewards.find((reward) => reward.rerolledRewardRepair !== undefined);
  return (
    <span
      className="hub-segment-reward"
      {...(repaired === undefined ? {} : findingAnchor(repaired.marker.address))}
    >
      <span aria-label={name} className="hub-segment-reward" role="img">
        {rewards.map((reward) => (
          <span className="hub-segment-reward-draw" key={reward.key}>
            <ArtworkIcon
              className="artwork-label-icon"
              source={reward.offer === null ? undefined : offerIcon(reward.offer)}
            />
            {reward.rerolledOffer === undefined ? null : (
              <>
                <span aria-hidden="true" className="row-reward-arrow">
                  →
                </span>
                <ArtworkIcon
                  className="artwork-label-icon"
                  source={offerIcon(reward.rerolledOffer)}
                />
              </>
            )}
          </span>
        ))}
      </span>
      {rewards.flatMap((reward) =>
        reward.rerolledRewardRepair === undefined
          ? []
          : [
              <RerolledRewardRepairIcon
                key={reward.key}
                repair={reward.rerolledRewardRepair}
                target={door.room.label}
              />,
            ],
      )}
    </span>
  );
}

/** The visit's room, picked in its row as one complete Hub action order. */
function VisitRoomPicker({
  disabledHint,
  interaction,
  node,
  onApply,
  onHover,
  visit,
}: {
  readonly disabledHint: string | undefined;
  readonly interaction: WorkspaceHubActionOrderInteraction;
  readonly node: WorkspaceHubDecisionNode;
  readonly onApply: (actions: readonly HubAction[]) => void;
  /** The room under the list's highlight, or none once the list closes. */
  readonly onHover: (hubSlotKey: string | undefined) => void;
  readonly visit: WorkspaceHubVisit;
}) {
  const findingTarget = useFindingTarget();
  const visitOrdinal = visit.visitIndex - 1;
  const actionsWith = (hubSlotKey: string): readonly HubAction[] => {
    const room = Object.freeze({ kind: 'roomVisit' as const, hubSlotKey });
    if (visit.hubSlotKey === undefined)
      return Object.freeze([...interaction.selectedActions, room]);
    let seen = -1;
    return Object.freeze(
      interaction.selectedActions.map((action) =>
        action.kind === 'roomVisit' && ++seen === visitOrdinal ? room : action,
      ),
    );
  };
  const choices = node.slots
    .filter((slot) => slot.open)
    .sort(
      (left, right) =>
        (left.drawPosition ?? Number.POSITIVE_INFINITY) -
        (right.drawPosition ?? Number.POSITIVE_INFINITY),
    )
    .map((slot) => {
      const elsewhere =
        slot.hubSlotKey !== visit.hubSlotKey &&
        interaction.selectedHubSlotKeys.includes(slot.hubSlotKey);
      const refusal = elsewhere
        ? undefined
        : interaction.proposalFor(actionsWith(slot.hubSlotKey)).refusal;
      return {
        key: slot.hubSlotKey,
        value: slot.hubSlotKey,
        label: slot.label,
        icon: slotRoomIcon(slot),
        disabled: elsewhere || refusal !== undefined,
        ...(elsewhere
          ? { explanation: 'Visited' }
          : refusal === 'rerollsChanged'
            ? { explanation: 'Remove Hub rerolls first.' }
            : {}),
      };
    });
  const picked = node.slots.find((slot) => slot.hubSlotKey === visit.hubSlotKey);
  return (
    <ContextualPicker<string>
      ariaLabel={`${segmentLabel(visit.visitIndex)} room`}
      disabled={disabledHint !== undefined}
      {...(disabledHint === undefined ? {} : { disabledHint })}
      findingTarget={findingTarget(visit.marker.address, undefined, node.owner)}
      id={`hub-visit-${visit.visitIndex}`}
      label=""
      model={declaredChoicesPicker(choices, visit.hubSlotKey)}
      onActiveChange={(item) => onHover(item?.value)}
      onOpenChange={(open) => {
        if (!open) onHover(undefined);
      }}
      onSelect={(hubSlotKey) => {
        if (hubSlotKey !== visit.hubSlotKey) onApply(actionsWith(hubSlotKey));
      }}
      itemIcon={(item) => choices.find((choice) => choice.value === item.value)?.icon}
      placeholder="Choose room"
      searchable={false}
      triggerIcon={picked === undefined ? undefined : slotRoomIcon(picked)}
      triggerSize="icon"
    />
  );
}

/** A Hub door's room as its icon. */
function slotRoomIcon(slot: WorkspaceHubDecisionNode['slots'][number]): string | undefined {
  const room = slot.room ?? slot.door?.room;
  return room === undefined ? undefined : roomKindIcon(room.roomIcon);
}

/** Opens a picked visit's room on its Timeline. */
function OpenVisitRoom({ room }: { readonly room: NonNullable<WorkspaceHubVisit['room']> }) {
  const dispatch = useAppDispatch();
  return (
    <IconActionButton
      hint={`Open ${room.label}`}
      icon="openInEditor"
      label={`Open ${room.label}`}
      onClick={() =>
        dispatch(
          semanticOwnerOpened({ owner: room.address, presentation: { kind: 'roomTimeline' } }),
        )
      }
    />
  );
}

/** Places the unused fountain as a complete Hub action order. */
function HubRowPlacement({
  findingMark,
  label,
  locked,
  moves,
  onApply,
  trigger,
  waiting,
}: {
  readonly findingMark?: FindingMarkProps;
  readonly label: string;
  readonly locked: boolean;
  readonly moves: readonly WorkspaceHubRowMove[];
  readonly onApply: (actions: readonly HubAction[]) => void;
  readonly trigger: string;
  readonly waiting: boolean;
}) {
  if (moves.length === 0) return null;
  return (
    <RoomActionPlacementPicker
      {...(findingMark === undefined ? {} : { findingMark })}
      label={label}
      trigger={trigger}
      choices={moves.map((move) => ({
        key: move.key,
        label: moveLabel(move),
        structurallyAuthorable: !locked && !waiting,
        explanations: [],
      }))}
      {...(waiting ? { disabledHint: candidateWaitingHint } : {})}
      onApply={(key) => {
        const move = moves.find((candidate) => candidate.key === key);
        if (move !== undefined) onApply(move.actions);
      }}
    />
  );
}

const stayEndAnchor = (precedingVisitCount: number): string => `stay-end:${precedingVisitCount}`;
const stayRowAnchor = (row: WorkspaceHubStayRow): string =>
  row.kind === 'fountain' ? 'fountain' : row.key;

/** A stay row's own place and its projected moves, in list order. */
function hubRowPositions(
  stay: WorkspaceHubStay,
  rowIndex: number,
): readonly TimelineReorderPosition[] {
  const row = stay.rows[rowIndex]!;
  const rerollIndexes = stay.rows.flatMap((other, index) =>
    other.kind === 'reroll' ? [index] : [],
  );
  const indexOf = (reference: WorkspaceHubStayRowReference): number =>
    reference.kind === 'fountain'
      ? stay.rows.findIndex((other) => other.kind === 'fountain')
      : (rerollIndexes[reference.position - 1] ?? -1);
  const own = { stay: stay.precedingVisitCount, slot: rowIndex };
  type Placed = TimelineReorderPosition & { readonly stay: number; readonly slot: number };
  const placed = row.moves.flatMap((move): readonly Placed[] => {
    const label = moveLabel(move);
    switch (move.destination.kind) {
      case 'before': {
        const slot = indexOf(move.destination.row);
        const other = stay.rows[slot];
        return other === undefined
          ? []
          : [
              {
                ...own,
                slot,
                move: move.key,
                label,
                anchor: stayRowAnchor(other),
                edge: 'before' as const,
              },
            ];
      }
      case 'after': {
        const other = stay.rows[indexOf(move.destination.row)];
        return other === undefined
          ? []
          : [
              {
                ...own,
                slot: stay.rows.length,
                move: move.key,
                label,
                anchor: stayRowAnchor(other),
                edge: 'after' as const,
              },
            ];
      }
      case 'stay':
        return [
          {
            stay: move.destination.precedingVisitCount,
            slot: Number.POSITIVE_INFINITY,
            move: move.key,
            label,
            anchor: stayEndAnchor(move.destination.precedingVisitCount),
            edge: 'before' as const,
          },
        ];
    }
  });
  const current: Placed = {
    ...own,
    move: undefined,
    // The handle names its own place.
    label: '',
    anchor: stayRowAnchor(row),
    edge: 'self',
  };
  return [current, ...placed]
    .sort((left, right) => left.stay - right.stay || left.slot - right.slot)
    .map(({ move, label, anchor, edge }) => ({ move, label, anchor, edge }));
}

/** The drag handle of one stay row. */
function HubRowHandle({
  findingMark,
  label,
  locked,
  onApply,
  reorder,
  rowIndex,
  stay,
  waiting,
}: {
  readonly findingMark?: FindingMarkProps;
  readonly label: string;
  readonly locked: boolean;
  readonly onApply: (actions: readonly HubAction[]) => void;
  readonly reorder: TimelineReorderSession;
  readonly rowIndex: number;
  readonly stay: WorkspaceHubStay;
  readonly waiting: boolean;
}) {
  const row = stay.rows[rowIndex]!;
  return (
    <TimelineReorderHandle
      disabled={locked}
      {...(waiting ? { disabledHint: candidateWaitingHint } : {})}
      {...(findingMark === undefined ? {} : { findingMark })}
      item={{
        key: stayRowAnchor(row),
        label,
        positions: hubRowPositions(stay, rowIndex),
        onMove: (key) => {
          const move = row.moves.find((candidate) => candidate.key === key);
          if (move !== undefined) onApply(move.actions);
        },
      }}
      session={reorder}
    />
  );
}

/** The used fountain in its stay's list, read like a press. */
function FountainRow({
  handle,
  interactions,
  node,
}: {
  readonly handle: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}) {
  const findingAnchor = useFindingAnchor();
  const control = node.fountain.rarity;
  // The Phial target follows only where a Phial reaches the use, or a kept target needs repair.
  const rarity =
    control !== undefined &&
    (control.targetTraitKey !== undefined ||
      control.pending === undefined ||
      control.pending === 'noTargetRequired')
      ? control
      : undefined;
  return (
    <li
      className="room-reroll-row hub-timeline-fountain"
      {...(rarity === undefined ? findingAnchor(node.fountain.outcomeMarker.address) : {})}
      data-reorder-anchor="fountain"
      tabIndex={-1}
    >
      {handle}
      <span className="room-reroll-verb">
        <ArtworkIcon
          className="artwork-label-icon"
          source={hubFountainIcon(node.fountain.address.biomeKey)}
        />
      </span>
      <FixedValueChip label="Fountain" />
      {rarity === undefined ? null : (
        <>
          <span aria-hidden="true" className="row-reward-arrow">
            →
          </span>
          <FountainRarityEffectRow control={rarity} interactions={interactions} />
        </>
      )}
    </li>
  );
}

/** One board door as the selected stay leaves it: cleared, or its draw and rerolls. */
function TimelineDoor({
  annotation,
  door,
  emphasis,
}: {
  readonly annotation: HubMapAnnotation;
  readonly door: WorkspaceHubStayDoor;
  /**
   * `visited`: the shown visit's door; `pending`: the door a visit will enter
   * from this board; `linked`: the picker option under its highlight.
   */
  readonly emphasis: readonly ('linked' | 'pending' | 'visited')[];
}) {
  const chain = [door.firstSummary, ...door.presses.map((press) => press.summary)].join(' → ');
  const name = door.cleared
    ? `${door.label}: Cleared`
    : `${door.label}: ${door.currentSummary}${door.presses.length === 0 ? '' : ', rerolled'}`;
  return (
    <span
      aria-label={name}
      className="hub-map-marker hub-timeline-map-marker"
      data-category={annotation.category}
      data-cleared={door.cleared || undefined}
      data-hub-slot-key={door.hubSlotKey}
      data-open="true"
      data-room-map-overlay-control
      data-linked={emphasis.includes('linked') || undefined}
      data-pending={emphasis.includes('pending') || undefined}
      data-selected-visit={emphasis.includes('visited') || undefined}
      role="img"
      style={hubMapPosition(annotation)}
      tabIndex={0}
      {...hintProps(door.presses.length === 0 ? undefined : chain, undefined, name)}
    >
      <HubDoorFace
        icon={offerIcon(door.current)}
        label={annotation.mapLabel}
        {...(door.cleared ? { status: 'Cleared' } : {})}
      />
      {door.presses.length === 0 ? null : (
        <span aria-hidden="true" className="hub-map-reroll-badge">
          <img alt="" draggable={false} src={rerollDieArtwork} />
        </span>
      )}
    </span>
  );
}

/** Which choice of a segment is being worked on: its label, its visit's room, or its rerolls. */
type SegmentPart = 'label' | 'picker' | 'rerolls';

function segmentPart(target: Element): SegmentPart {
  if (target.closest('.hub-segment-head .contextual-picker') !== null) return 'picker';
  if (target.closest('.room-reroll-append, .room-rerolls-list') !== null) return 'rerolls';
  return 'label';
}

/**
 * The board the map shows for the choice being worked on. A visit's room is
 * picked from the board before it; rerolls happen on the board after it; the
 * label shows the board after a picked, settled visit, else the one before it.
 */
function mapView(
  node: WorkspaceHubDecisionNode,
  segment: number,
  part: SegmentPart,
): {
  readonly stay: number;
  readonly picking?: true;
  readonly visited?: string;
  readonly pending?: string;
} {
  if (segment === 0) return { stay: 0 };
  const visit = node.visits[segment - 1]?.hubSlotKey;
  if (part === 'picker') return { stay: segment - 1, picking: true };
  if (part === 'rerolls')
    return { stay: segment, ...(visit === undefined ? {} : { visited: visit }) };
  if (visit !== undefined && node.stays[segment]?.doors !== undefined)
    return { stay: segment, visited: visit };
  return { stay: segment - 1, ...(visit === undefined ? {} : { pending: visit }) };
}

/**
 * The Hub's stays in order, Entry then the return after each visit, each with
 * its visit's room and its rerolls; the selected stay's board is on the map.
 */
export function HubTimeline({
  hubIdentity,
  interactions,
  locked,
  node,
  requestedSegment,
  resetControl,
}: {
  readonly hubIdentity: string;
  /**
   * An explicit open of the segment after a visit, such as a room's return to
   * its Hub: its picker is made ready, or past the last visit, its rerolls.
   */
  readonly requestedSegment?: { readonly segment: number; readonly revision: number };
  /** The tab's reset, at the end of its column title. */
  readonly resetControl: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly locked: boolean;
  readonly node: WorkspaceHubDecisionNode;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.hubActionOrders,
    workspaceInteractionKey(node.owner),
  );
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const findingAnchor = useFindingAnchor();
  const candidates =
    useWorkspaceInteractionController<
      ReturnType<ReturnType<WorkspaceHubActionOrderInteraction['proposalFor']>['load']>
    >();
  const waiting = !interaction.contextReached;
  const reorder = useTimelineReorder();
  const { attachRoot } = reorder;
  // Which stay drives the map: presentation only, never authored.
  const frontier = Math.min(interaction.selectedHubSlotKeys.length, node.requiredVisitCount);
  // The segment and which of its choices is being worked on: presentation only.
  const [selection, setSelection] = useState<{
    readonly hubIdentity: string;
    readonly segment: number;
    readonly part: SegmentPart;
  }>({ hubIdentity, segment: frontier, part: 'label' });
  const [handledRequest, setHandledRequest] = useState<number>();
  if (requestedSegment !== undefined && handledRequest !== requestedSegment.revision) {
    setHandledRequest(requestedSegment.revision);
    const past = requestedSegment.segment > node.requiredVisitCount;
    setSelection({
      hubIdentity,
      segment: past ? node.requiredVisitCount : requestedSegment.segment,
      part: past ? 'rerolls' : 'picker',
    });
  }
  // The requested visit's picker takes focus, ready to choose its room.
  const requestRevision = requestedSegment?.revision;
  const requestedPicker =
    requestedSegment !== undefined && requestedSegment.segment <= node.requiredVisitCount
      ? requestedSegment.segment
      : undefined;
  useEffect(() => {
    if (requestedPicker === undefined) return;
    document.getElementById(`hub-visit-${requestedPicker}`)?.focus();
    // Once per explicit open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestRevision]);
  const selected = selection.hubIdentity === hubIdentity ? selection.segment : frontier;
  const part = selection.hubIdentity === hubIdentity ? selection.part : 'label';
  const select = (segment: number, nextPart: SegmentPart): void => {
    if (segment !== selected || nextPart !== part)
      setSelection({ hubIdentity, segment, part: nextPart });
  };
  const [hovered, setHovered] = useState<string>();
  // An open picker's list is portaled: its events reach the segment, its DOM does not.
  const workOn = (segment: number, event: SyntheticEvent<HTMLElement>): void => {
    const target = event.target as Element;
    if (!event.currentTarget.contains(target)) return;
    select(segment, segmentPart(target));
  };
  // A Hub the plan ends in takes no visit after its end visit.
  const endsHere = node.planEnd === 'end';
  const replaceActions = (actions: readonly HubAction[]): void => {
    const proposal = interaction.proposalFor(actions);
    const options = candidates.activate(proposal);
    if (!candidateMayBeAuthored(options?.[0])) return;
    executeIntent(proposal.intent());
  };
  const rowHandle = (stay: WorkspaceHubStay, rowIndex: number, label: string) => (
    <HubRowHandle
      {...(stay.rows[rowIndex]?.kind === 'fountain'
        ? { findingMark: findingMark(node.fountain.address) }
        : {})}
      label={label}
      locked={locked}
      onApply={replaceActions}
      reorder={reorder}
      rowIndex={rowIndex}
      stay={stay}
      waiting={waiting}
    />
  );
  const fountainRow = (stay: WorkspaceHubStay, rowIndex: number) => (
    <FountainRow
      handle={rowHandle(stay, rowIndex, 'Fountain')}
      interactions={interactions}
      key="fountain"
      node={node}
    />
  );
  const visitHint = (visit: WorkspaceHubVisit): string | undefined => {
    const before = node.stays[visit.visitIndex - 1];
    if (visit.authoring === 'locked' || waiting || before?.doors === undefined)
      return candidateWaitingHint;
    if (endsHere && visit.hubSlotKey === undefined) return 'The plan ends before this visit.';
    return undefined;
  };
  const segment = (stay: WorkspaceHubStay) => {
    const visit =
      stay.precedingVisitCount === 0 ? undefined : node.visits[stay.precedingVisitCount - 1];
    const label = segmentLabel(stay.precedingVisitCount);
    const heading = (
      <div className="hub-segment-head">
        <button
          aria-pressed={selected === stay.precedingVisitCount}
          className="hub-segment-select"
          onClick={() => select(stay.precedingVisitCount, 'label')}
          type="button"
        >
          {label}
        </button>
        {visit === undefined ? null : (
          <>
            <VisitRoomPicker
              disabledHint={locked ? undefined : visitHint(visit)}
              interaction={interaction}
              node={node}
              onApply={replaceActions}
              onHover={setHovered}
              visit={visit}
            />
            <VisitReward door={visit.door} />
            {visit.room === undefined || visit.hubSlotKey === undefined ? null : (
              <OpenVisitRoom room={visit.room} />
            )}
          </>
        )}
      </div>
    );
    const fountain = stay.rows.findIndex((row) => row.kind === 'fountain');
    return (
      <li
        className="hub-segment"
        data-plan-end={visit?.planEnd}
        data-reached={stay.doors !== undefined}
        data-selected={selected === stay.precedingVisitCount || undefined}
        key={stay.precedingVisitCount}
        onFocusCapture={(event) => workOn(stay.precedingVisitCount, event)}
        onPointerDownCapture={(event) => workOn(stay.precedingVisitCount, event)}
      >
        {stay.rerolls === undefined ? (
          <>
            <header className="room-rerolls-heading">{heading}</header>
            {fountain < 0 ? null : (
              <ol className="room-rerolls-list">{fountainRow(stay, fountain)}</ol>
            )}
          </>
        ) : (
          <RoomRerolls
            heading={heading}
            interactions={interactions}
            label={`${label} rerolls`}
            order={stay.rows.map((row, index) =>
              row.kind === 'fountain'
                ? { kind: 'row' as const, key: 'fountain', row: fountainRow(stay, index) }
                : {
                    kind: 'press' as const,
                    key: row.key,
                    move: rowHandle(
                      stay,
                      index,
                      `Reroll ${
                        stay.rows.slice(0, index + 1).filter((other) => other.kind === 'reroll')
                          .length
                      }`,
                    ),
                  },
            )}
            rerolls={stay.rerolls}
            showCount={false}
          />
        )}
        <div
          aria-hidden="true"
          className="hub-timeline-stay-end"
          data-reorder-anchor={stayEndAnchor(stay.precedingVisitCount)}
        />
      </li>
    );
  };
  const view = mapView(node, selected, part);
  const shownDoors = new Map(
    (node.stays[view.stay]?.doors ?? []).map((door) => [door.hubSlotKey, door] as const),
  );
  const emphasisOf = (door: WorkspaceHubStayDoor) =>
    [
      ...(door.hubSlotKey === view.visited ? (['visited'] as const) : []),
      ...(door.hubSlotKey === view.pending ? (['pending'] as const) : []),
      ...(view.picking && door.hubSlotKey === hovered ? (['linked'] as const) : []),
    ] as const;
  return (
    <div className="hub-overview-layout hub-timeline-layout">
      <section aria-label="Ephyra Hub timeline" className="hub-timeline-column" ref={attachRoot}>
        <TimelineReorderStatus session={reorder} />
        <header className="room-feature-category-heading hub-column-title">
          <h5>Visits</h5>
          {resetControl}
        </header>
        <ol className="hub-segments">{node.stays.map(segment)}</ol>
        {node.fountain.useIn === undefined ? null : (
          <div
            {...findingAnchor(node.fountain.address)}
            className="hub-timeline-row hub-timeline-fountain"
            data-used="false"
            tabIndex={-1}
          >
            <span className="hub-timeline-step">
              <ArtworkIcon
                className="artwork-label-icon"
                source={hubFountainIcon(node.fountain.address.biomeKey)}
              />
            </span>
            <strong className="hub-timeline-room">Fountain</strong>
            <HubRowPlacement
              findingMark={findingMark(node.fountain.address)}
              label="Use Fountain"
              locked={locked}
              moves={node.fountain.useIn}
              onApply={replaceActions}
              trigger="Use…"
              waiting={waiting}
            />
          </div>
        )}
        {node.requirements.visits.planned < node.requiredVisitCount ? null : (
          <HubLeaveSegment node={node} />
        )}
      </section>
      <HubBoardMap
        door={(annotation) => {
          const door = shownDoors.get(annotation.hubSlotKey);
          return door === undefined ? null : (
            <TimelineDoor
              annotation={annotation}
              door={door}
              emphasis={emphasisOf(door)}
              key={annotation.hubSlotKey}
            />
          );
        }}
        gameName={node.gameName}
        hubIdentity={hubIdentity}
        label={`Ephyra Hub at ${segmentLabel(view.stay)}`}
      />
    </div>
  );
}

/**
 * The Hub always leaves to its Preboss: once every visit is set, a last
 * segment that opens it and holds the completed-Hub exit's findings.
 */
function HubLeaveSegment({ node }: { readonly node: WorkspaceHubDecisionNode }) {
  const findingAnchor = useFindingAnchor();
  const dispatch = useAppDispatch();
  const ready = !useAuthoringLocked(node.completedExit.target.marker.address);
  const target = node.completedExit.target;
  return (
    <div
      {...findingAnchor(node.completedExit.marker.address)}
      aria-label="Leave"
      className="hub-segment hub-leave-segment"
      data-ready={ready}
      role="group"
      tabIndex={-1}
    >
      <div className="room-rerolls-heading">
        <div className="hub-segment-head">
          <span className="hub-segment-select hub-leave-label">Leave</span>
          <span className="hub-leave-target">{target.label}</span>
          <IconActionButton
            hint={`Open ${target.label}`}
            icon="openInEditor"
            label={`Open ${target.label}`}
            onClick={() => dispatch(semanticOwnerFocused(target.marker.address))}
          />
        </div>
      </div>
    </div>
  );
}
