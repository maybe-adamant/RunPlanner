import { Fragment, type ReactNode } from 'react';

import type { HubAction } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceDoorContract,
  type WorkspaceHubActionOrderInteraction,
  type WorkspaceHubBoardDoor,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubStay,
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
import {
  candidateMayBeAuthored,
  candidateWaitingHint,
} from '@planner/ui/feedback/candidatePresentation';
import {
  useFindingAnchor,
  useFindingMark,
  useFindingTarget,
} from '@planner/ui/feedback/useFindingTarget';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';
import { RoomActionPlacementPicker } from './RoomActionPlacementPicker';
import { RoomRerolls } from './RoomRerolls';

function stayLabel(precedingVisitCount: number): string {
  return precedingVisitCount === 0 ? 'Before Visit 1' : `After Visit ${precedingVisitCount}`;
}

function doorRewardLine(door: WorkspaceDoorContract | undefined): string | undefined {
  if (door?.offerRewardSurface.visibility !== 'visible') return undefined;
  return door.offerRewardSurface.rewards
    .map((reward) =>
      reward.rerolledSummary === undefined
        ? reward.summary
        : `${reward.summary} → ${reward.rerolledSummary}`,
    )
    .join(', ');
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
  const reward = doorRewardLine(visit.door);
  const room = visit.room;
  return (
    <li
      className="hub-timeline-row hub-timeline-visit"
      data-authoring={visit.authoring}
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
          {reward === undefined ? null : <span className="hub-timeline-reward">{reward}</span>}
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
}

function FountainPlacement({
  label,
  locked,
  node,
  onApply,
  trigger,
  waiting,
}: {
  readonly label: string;
  readonly locked: boolean;
  readonly node: WorkspaceHubDecisionNode;
  readonly onApply: (actions: readonly HubAction[]) => void;
  readonly trigger: string;
  readonly waiting: boolean;
}) {
  const findingMark = useFindingMark();
  const choices = node.stays.flatMap((stay) =>
    stay.fountainActions === undefined
      ? []
      : [
          {
            key: String(stay.precedingVisitCount),
            label: stayLabel(stay.precedingVisitCount),
            structurallyAuthorable: !locked && !waiting,
            explanations: [],
            actions: stay.fountainActions,
          },
        ],
  );
  return (
    <RoomActionPlacementPicker
      findingMark={findingMark(node.fountain.address)}
      label={label}
      trigger={trigger}
      choices={choices}
      {...(waiting ? { disabledHint: candidateWaitingHint } : {})}
      onApply={(key) => {
        const choice = choices.find((candidate) => candidate.key === key);
        if (choice !== undefined) onApply(choice.actions);
      }}
    />
  );
}

function FountainRow({
  interactions,
  locked,
  node,
  onApply,
  waiting,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly locked: boolean;
  readonly node: WorkspaceHubDecisionNode;
  readonly onApply: (actions: readonly HubAction[]) => void;
  readonly waiting: boolean;
}) {
  const findingAnchor = useFindingAnchor();
  const rarity = node.fountain.rarity;
  return (
    <li
      className="hub-timeline-row hub-timeline-fountain"
      {...(rarity === undefined ? findingAnchor(node.fountain.outcomeMarker.address) : {})}
      tabIndex={-1}
    >
      <span className="hub-timeline-step">
        <ArtworkIcon
          className="artwork-label-icon"
          source={hubFountainIcon(node.fountain.address.biomeKey)}
        />
      </span>
      <strong className="hub-timeline-room">Fountain</strong>
      <span className="hub-timeline-fountain-phial">
        {rarity === undefined ? null : (
          <FountainRarityEffectRow control={rarity} interactions={interactions} />
        )}
      </span>
      <FountainPlacement
        label="Move Fountain"
        locked={locked}
        node={node}
        onApply={onApply}
        trigger="Move…"
        waiting={waiting}
      />
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

function BoardRecap({ stay }: { readonly stay: WorkspaceHubStay }) {
  if (stay.board === undefined) return null;
  return (
    <li className="hub-timeline-board">
      <h5>Board</h5>
      <ul aria-label={`Board ${stayLabel(stay.precedingVisitCount)}`}>
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
  const candidates =
    useWorkspaceInteractionController<
      ReturnType<ReturnType<WorkspaceHubActionOrderInteraction['proposalFor']>['load']>
    >();
  const waiting = !interaction.contextReached;
  const replaceActions = (actions: readonly HubAction[]): void => {
    const proposal = interaction.proposalFor(actions);
    const options = candidates.activate(proposal);
    if (!candidateMayBeAuthored(options?.[0])) return;
    executeIntent(proposal.intent());
  };
  const fountainRow = (
    <FountainRow
      interactions={interactions}
      locked={locked}
      node={node}
      onApply={replaceActions}
      waiting={waiting}
    />
  );
  const stayEntries = (stay: WorkspaceHubStay) => (
    <>
      {stay.fountain?.afterRerolls === false ? fountainRow : null}
      {stay.rerolls === undefined ? null : (
        <li className="hub-timeline-rerolls">
          <RoomRerolls interactions={interactions} rerolls={stay.rerolls} />
        </li>
      )}
      {stay.fountain?.afterRerolls === true ? fountainRow : null}
      <BoardRecap stay={stay} />
    </>
  );
  return (
    <section aria-label="Ephyra Hub timeline" className="hub-board hub-timeline-details">
      <header className="hub-board-heading">
        <div className="hub-board-heading-row">
          <div className="owner-markers">{requirement}</div>
          <div className="hub-board-heading-actions">
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
      {node.fountain.appendActions === undefined ? null : (
        <div className="hub-timeline-row hub-timeline-fountain" data-used="false">
          <span className="hub-timeline-step">
            <ArtworkIcon
              className="artwork-label-icon"
              source={hubFountainIcon(node.fountain.address.biomeKey)}
            />
          </span>
          <strong className="hub-timeline-room">Fountain</strong>
          <FountainPlacement
            label="Use Fountain"
            locked={locked}
            node={node}
            onApply={replaceActions}
            trigger="Use…"
            waiting={waiting}
          />
        </div>
      )}
    </section>
  );
}
