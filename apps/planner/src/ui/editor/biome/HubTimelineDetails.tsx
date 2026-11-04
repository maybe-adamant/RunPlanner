import { hubVisitOrderWaitingHint, planEndLabel } from './planEndCopy';
import { Fragment, useId, useState, type ReactNode } from 'react';

import type { HubAction } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceDoorContract,
  type WorkspaceHubActionOrderInteraction,
  type WorkspaceHubBoardDoor,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubRowMove,
  type WorkspaceHubStay,
  type WorkspaceHubStayRow,
  type WorkspaceHubStayRowReference,
  type WorkspaceHubVisit,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { hubFountainIcon } from '@planner/ui/artwork/roomArtwork';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import {
  useFindingAnchor,
  useFindingMark,
  useFindingTarget,
  type FindingMarkProps,
} from '@planner/ui/feedback/useFindingTarget';
import { rerollDieArtwork } from '@planner/ui/artwork/rerolls/rerollArtwork';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';
import { RoomActionPlacementPicker } from './RoomActionPlacementPicker';
import { RerollCount, RoomRerolls } from './RoomRerolls';
import { RowRewardName } from './RowRewardName';
import { TimelineReorderHandle, TimelineReorderStatus } from './TimelineReorderHandle';
import {
  useTimelineReorder,
  type TimelineReorderPosition,
  type TimelineReorderSession,
} from './useTimelineReorder';

function stayLabel(precedingVisitCount: number): string {
  return precedingVisitCount === 0 ? 'Before Visit 1' : `After Visit ${precedingVisitCount}`;
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

function VisitRow({
  node,
  visit,
}: {
  readonly node: WorkspaceHubDecisionNode;
  readonly visit: WorkspaceHubVisit;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const slot =
    visit.hubSlotKey === undefined
      ? undefined
      : node.slots.find((candidate) => candidate.hubSlotKey === visit.hubSlotKey);
  const room = visit.room;
  const row = (
    <li
      className="hub-timeline-row hub-timeline-visit"
      data-authoring={visit.authoring}
      data-plan-end={visit.planEnd}
      {...(slot === undefined ? {} : findingTarget(visit.marker.address, undefined, node.owner))}
      tabIndex={-1}
    >
      <span className="hub-timeline-step">{`Visit ${visit.visitIndex}`}</span>
      {slot === undefined ? (
        <span className="hub-timeline-muted">
          {visit.authoring === 'next' ? 'Choose a door on the map' : null}
        </span>
      ) : (
        <>
          <strong className="hub-timeline-room">{slot.label}</strong>
          {visit.planEnd === 'pastEnd' ? (
            <span className="hub-timeline-visit-detail">
              <VisitReward door={visit.door} />
              <span className="hub-timeline-muted">{planEndLabel('pastEnd')}</span>
            </span>
          ) : (
            <VisitReward door={visit.door} />
          )}
          {room === undefined ? null : (
            <button
              className="quiet-action action-compact"
              onClick={() => dispatch(semanticOwnerFocused(room.address))}
              type="button"
            >
              Open Room →
            </button>
          )}
        </>
      )}
    </li>
  );
  // The plan ends with this visit: everything after it on the timeline is past the end.
  return visit.planEnd !== 'end' ? (
    row
  ) : (
    <>
      {row}
      <li className="hub-timeline-plan-end" role="note">
        {planEndLabel('end')}
      </li>
    </>
  );
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
      return stayLabel(move.destination.precedingVisitCount);
  }
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
  waitingHint,
}: {
  readonly findingMark?: FindingMarkProps;
  readonly label: string;
  readonly locked: boolean;
  readonly moves: readonly WorkspaceHubRowMove[];
  readonly onApply: (actions: readonly HubAction[]) => void;
  readonly trigger: string;
  readonly waiting: boolean;
  readonly waitingHint: string;
}) {
  if (moves.length === 0) return null;
  const choices = moves.map((move) => ({
    key: move.key,
    label: moveLabel(move),
    structurallyAuthorable: !locked && !waiting,
    explanations: [],
  }));
  return (
    <RoomActionPlacementPicker
      {...(findingMark === undefined ? {} : { findingMark })}
      label={label}
      trigger={trigger}
      choices={choices}
      {...(waiting ? { disabledHint: waitingHint } : {})}
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
  waitingHint,
}: {
  readonly findingMark?: FindingMarkProps;
  readonly label: string;
  readonly locked: boolean;
  readonly onApply: (actions: readonly HubAction[]) => void;
  readonly reorder: TimelineReorderSession;
  readonly rowIndex: number;
  readonly stay: WorkspaceHubStay;
  readonly waiting: boolean;
  readonly waitingHint: string;
}) {
  const row = stay.rows[rowIndex]!;
  return (
    <TimelineReorderHandle
      disabled={locked}
      {...(waiting ? { disabledHint: waitingHint } : {})}
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

/** The used fountain, among its stay's rerolls (`inList`) or on its own. */
function FountainRow({
  handle,
  inList,
  interactions,
  node,
}: {
  readonly handle: ReactNode;
  readonly inList: boolean;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}) {
  const findingAnchor = useFindingAnchor();
  const rarity = node.fountain.rarity;
  const icon = (
    <ArtworkIcon
      className="artwork-label-icon"
      source={hubFountainIcon(node.fountain.address.biomeKey)}
    />
  );
  const phial =
    rarity === undefined ? null : (
      <FountainRarityEffectRow control={rarity} interactions={interactions} />
    );
  const anchor = {
    ...(rarity === undefined ? findingAnchor(node.fountain.outcomeMarker.address) : {}),
    'data-reorder-anchor': 'fountain',
    tabIndex: -1,
  };
  // In a list it reads like a press: icon, target, arrow and its Phial target.
  if (inList)
    return (
      <li className="room-reroll-row hub-timeline-fountain" {...anchor}>
        {handle}
        <span className="room-reroll-verb">{icon}</span>
        <FixedValueChip label="Fountain" />
        {phial === null ? null : (
          <>
            <span aria-hidden="true" className="row-reward-arrow">
              →
            </span>
            {phial}
          </>
        )}
      </li>
    );
  return (
    <li className="hub-timeline-row hub-timeline-fountain" {...anchor}>
      <span className="hub-timeline-step">
        {handle}
        {icon}
      </span>
      <strong className="hub-timeline-room">Fountain</strong>
      <span className="hub-timeline-fountain-phial">{phial}</span>
    </li>
  );
}

function boardRewardIcon(offer: WorkspaceHubBoardDoor['offer']): string | undefined {
  const identity =
    offer.rewardType === 'Boon' && offer.payload?.kind === 'BoonSource'
      ? offer.payload.source
      : offer.rewardType;
  return rewardIcon(identity);
}

function BoardRecap({
  expanded,
  onToggle,
  stay,
}: {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly stay: WorkspaceHubStay;
}) {
  const listId = useId();
  if (stay.board === undefined) return null;
  const label = `Board ${stayLabel(stay.precedingVisitCount)}`;
  return (
    <li className="hub-timeline-board" data-expanded={expanded}>
      <button
        aria-controls={expanded ? listId : undefined}
        aria-expanded={expanded}
        className="hub-timeline-board-toggle"
        onClick={onToggle}
        type="button"
      >
        <span aria-hidden="true" className="hub-timeline-board-caret">
          {expanded ? '▾' : '▸'}
        </span>
        <span>{`Board · ${stay.board.length} open`}</span>
        {stay.boardRerolled ? (
          <img alt="Rerolled" className="hub-timeline-board-die" src={rerollDieArtwork} />
        ) : null}
      </button>
      {expanded ? (
        <ul aria-label={label} id={listId}>
          {stay.board.map((door) => (
            <li key={door.hubSlotKey}>
              <span className="hub-timeline-board-room">{door.label}</span>
              <span
                className="hub-timeline-board-reward"
                data-rerolled={door.rerolledSummary !== undefined}
              >
                <ArtworkIcon className="artwork-label-icon" source={boardRewardIcon(door.offer)} />
                {door.rerolledSummary === undefined
                  ? door.summary
                  : `${door.summary} → ${door.rerolledSummary}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The Hub's visits in order with what happens between them: the fountain,
 * each stay's board-door rerolls, and the board each stay leaves.
 */
export function HubTimelineDetails({
  interactions,
  locked,
  mapControl,
  node,
  requirement,
  resetVisitsControl,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly locked: boolean;
  readonly mapControl: ReactNode;
  readonly node: WorkspaceHubDecisionNode;
  readonly requirement: ReactNode;
  readonly resetVisitsControl: ReactNode;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.hubActionOrders,
    workspaceInteractionKey(node.owner),
  );
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const candidates =
    useWorkspaceInteractionController<
      ReturnType<ReturnType<WorkspaceHubActionOrderInteraction['proposalFor']>['load']>
    >();
  const waiting = !interaction.contextReached;
  const waitingHint = hubVisitOrderWaitingHint(node);
  // Which stays show their board: presentation only, never authored.
  const [shownBoards, setShownBoards] = useState<ReadonlySet<number>>(() => new Set());
  const boardStays = node.stays.flatMap((stay) =>
    stay.board === undefined ? [] : [stay.precedingVisitCount],
  );
  const allBoardsShown = boardStays.length > 0 && boardStays.every((stay) => shownBoards.has(stay));
  const toggleBoard = (precedingVisitCount: number): void =>
    setShownBoards((shown) => {
      const next = new Set(shown);
      if (!next.delete(precedingVisitCount)) next.add(precedingVisitCount);
      return next;
    });
  const reorder = useTimelineReorder();
  const { attachRoot } = reorder;
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
      waitingHint={waitingHint}
    />
  );
  const fountainRow = (stay: WorkspaceHubStay, rowIndex: number, inList: boolean) => (
    <FountainRow
      handle={rowHandle(stay, rowIndex, 'Fountain')}
      inList={inList}
      interactions={interactions}
      key="fountain"
      node={node}
    />
  );
  // The stay's presses and fountain are one ordered list; each row moves within it.
  const stayEntries = (stay: WorkspaceHubStay) => {
    const fountain = stay.rows.findIndex((row) => row.kind === 'fountain');
    return (
      <>
        {stay.rerolls === undefined ? (
          fountain < 0 ? null : (
            fountainRow(stay, fountain, false)
          )
        ) : (
          <li className="hub-timeline-rerolls">
            <RoomRerolls
              interactions={interactions}
              order={stay.rows.map((row, index) =>
                row.kind === 'fountain'
                  ? { kind: 'row' as const, key: 'fountain', row: fountainRow(stay, index, true) }
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
          </li>
        )}
        <li
          aria-hidden="true"
          className="hub-timeline-stay-end"
          data-reorder-anchor={stayEndAnchor(stay.precedingVisitCount)}
        />
        <BoardRecap
          expanded={shownBoards.has(stay.precedingVisitCount)}
          onToggle={() => toggleBoard(stay.precedingVisitCount)}
          stay={stay}
        />
      </>
    );
  };
  return (
    <section
      aria-label="Ephyra Hub timeline"
      className="hub-board hub-timeline-details"
      ref={attachRoot}
    >
      <TimelineReorderStatus session={reorder} />
      <header className="hub-board-heading">
        <div className="hub-board-heading-row">
          <div className="owner-markers">
            {requirement}
            {node.rerollsRemaining === undefined ? null : (
              <RerollCount remaining={node.rerollsRemaining} />
            )}
          </div>
          <div className="hub-board-heading-actions">
            {boardStays.length === 0 ? null : (
              <button
                className="quiet-action action-compact"
                onClick={() => setShownBoards(new Set(allBoardsShown ? [] : boardStays))}
                type="button"
              >
                {allBoardsShown ? 'Hide boards' : 'Show boards'}
              </button>
            )}
            {mapControl}
            {resetVisitsControl}
          </div>
        </div>
      </header>
      <ol className="hub-timeline-list">
        {node.stays.map((stay) => {
          const visit = node.visits[stay.precedingVisitCount];
          return (
            <Fragment key={stay.precedingVisitCount}>
              {stayEntries(stay)}
              {visit === undefined ? null : <VisitRow node={node} visit={visit} />}
            </Fragment>
          );
        })}
      </ol>
      {node.fountain.useIn === undefined ? null : (
        <div className="hub-timeline-row hub-timeline-fountain" data-used="false">
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
            waitingHint={waitingHint}
          />
        </div>
      )}
    </section>
  );
}
