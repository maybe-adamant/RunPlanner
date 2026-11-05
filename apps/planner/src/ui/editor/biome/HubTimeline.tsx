import { useState, type ReactNode } from 'react';

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
import { hubFountainIcon } from '@planner/ui/artwork/roomArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
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
import { FountainRarityEffectRow } from './FountainRarityEffectRow';
import { HubBoardMap, HubDoorFace } from './hub-map/HubBoardMap';
import { RoomActionPlacementPicker } from './RoomActionPlacementPicker';
import { RerollCount, RoomRerolls } from './RoomRerolls';
import { RowRewardName } from './RowRewardName';
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

/** The door's visible rewards as icons, first draw → final where rerolled. */
function VisitReward({ door }: { readonly door: WorkspaceDoorContract | undefined }) {
  if (door?.offerRewardSurface.visibility !== 'visible') return null;
  return (
    <span className="hub-timeline-reward">
      {door.offerRewardSurface.rewards.map((reward) => (
        <span className="hub-timeline-reward-draw" key={reward.key}>
          {reward.offer === null ? (
            reward.summary
          ) : (
            <RowRewardName name={reward.summary} offer={reward.offer} />
          )}
          {reward.rerolledOffer === undefined ? null : (
            <>
              <span aria-hidden="true" className="row-reward-arrow">
                →
              </span>
              <RowRewardName
                name={reward.rerolledSummary ?? reward.summary}
                offer={reward.rerolledOffer}
              />
            </>
          )}
        </span>
      ))}
    </span>
  );
}

/** The visit's room, picked in its row as one complete Hub action order. */
function VisitRoomPicker({
  disabledHint,
  interaction,
  node,
  onApply,
  visit,
}: {
  readonly disabledHint: string | undefined;
  readonly interaction: WorkspaceHubActionOrderInteraction;
  readonly node: WorkspaceHubDecisionNode;
  readonly onApply: (actions: readonly HubAction[]) => void;
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
        disabled: elsewhere || refusal !== undefined,
        ...(elsewhere
          ? { explanation: 'Visited' }
          : refusal === 'rerollsChanged'
            ? { explanation: 'Remove Hub rerolls first.' }
            : {}),
      };
    });
  return (
    <ContextualPicker<string>
      ariaLabel={`${segmentLabel(visit.visitIndex)} room`}
      disabled={disabledHint !== undefined}
      {...(disabledHint === undefined ? {} : { disabledHint })}
      findingTarget={findingTarget(visit.marker.address, undefined, node.owner)}
      id={`hub-visit-${visit.visitIndex}`}
      label=""
      model={declaredChoicesPicker(choices, visit.hubSlotKey)}
      onSelect={(hubSlotKey) => {
        if (hubSlotKey !== visit.hubSlotKey) onApply(actionsWith(hubSlotKey));
      }}
      placeholder="Choose room"
      searchable={false}
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
  const rarity = node.fountain.rarity;
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
  visited,
}: {
  readonly annotation: HubMapAnnotation;
  readonly door: WorkspaceHubStayDoor;
  readonly visited: boolean;
}) {
  const chain = [door.firstSummary, ...door.presses.map((press) => press.summary)].join(' → ');
  const name = door.cleared
    ? `${door.label}: Cleared`
    : `${door.label}: ${door.changed ? `${door.firstSummary} → ${door.currentSummary}` : door.currentSummary}`;
  return (
    <span
      aria-label={name}
      className="hub-map-marker hub-timeline-map-marker"
      data-category={annotation.category}
      data-cleared={door.cleared || undefined}
      data-hub-slot-key={door.hubSlotKey}
      data-open="true"
      data-room-map-overlay-control
      data-selected-visit={visited || undefined}
      role="img"
      style={hubMapPosition(annotation)}
      tabIndex={0}
      {...hintProps(door.presses.length === 0 ? undefined : chain, undefined, name)}
    >
      <HubDoorFace
        icons={
          door.changed
            ? [offerIcon(door.firstDraw), offerIcon(door.current)]
            : [offerIcon(door.current)]
        }
        label={annotation.mapLabel}
        {...(door.cleared ? { status: 'Cleared' } : {})}
      />
    </span>
  );
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
  resetVisitsControl,
}: {
  readonly hubIdentity: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly locked: boolean;
  readonly node: WorkspaceHubDecisionNode;
  readonly resetVisitsControl: ReactNode;
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
  const [selection, setSelection] = useState({ hubIdentity, stay: frontier });
  const selected = selection.hubIdentity === hubIdentity ? selection.stay : frontier;
  const select = (stay: number): void => {
    if (stay !== selected) setSelection({ hubIdentity, stay });
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
          onClick={() => select(stay.precedingVisitCount)}
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
              visit={visit}
            />
            <VisitReward door={visit.door} />
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
        onFocusCapture={() => select(stay.precedingVisitCount)}
        onPointerDownCapture={() => select(stay.precedingVisitCount)}
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
  const shown = node.stays[selected];
  const shownDoors = new Map((shown?.doors ?? []).map((door) => [door.hubSlotKey, door] as const));
  const shownVisit = selected === 0 ? undefined : node.visits[selected - 1]?.hubSlotKey;
  return (
    <div className="hub-overview-layout hub-timeline-layout">
      <section aria-label="Ephyra Hub timeline" className="hub-timeline-column" ref={attachRoot}>
        <TimelineReorderStatus session={reorder} />
        <header className="hub-overview-rewards-heading">
          {node.rerollsRemaining === undefined ? (
            <span />
          ) : (
            <RerollCount remaining={node.rerollsRemaining} />
          )}
          {resetVisitsControl}
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
        <HubExitRow node={node} />
      </section>
      <HubBoardMap
        door={(annotation) => {
          const door = shownDoors.get(annotation.hubSlotKey);
          return door === undefined ? null : (
            <TimelineDoor
              annotation={annotation}
              door={door}
              key={annotation.hubSlotKey}
              visited={door.hubSlotKey === shownVisit}
            />
          );
        }}
        gameName={node.gameName}
        hubIdentity={hubIdentity}
        label={`Ephyra Hub at ${segmentLabel(selected)}`}
      />
    </div>
  );
}

/**
 * The Hub always leaves to its Preboss: a fixed last row, quiet until the
 * Hub is complete, that holds the completed-Hub exit's findings.
 */
function HubExitRow({ node }: { readonly node: WorkspaceHubDecisionNode }) {
  const findingAnchor = useFindingAnchor();
  const ready = !useAuthoringLocked(node.completedExit.target.marker.address);
  return (
    <div
      {...findingAnchor(node.completedExit.marker.address)}
      aria-label={`Go to ${node.completedExit.target.label}`}
      className="hub-timeline-row hub-timeline-exit"
      role="group"
      data-ready={ready}
      tabIndex={-1}
    >
      <span className="hub-timeline-step" />
      <strong className="hub-timeline-room">Go to {node.completedExit.target.label}</strong>
    </div>
  );
}
