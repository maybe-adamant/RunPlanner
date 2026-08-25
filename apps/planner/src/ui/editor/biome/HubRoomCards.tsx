import { type PointerEvent as ReactPointerEvent, useLayoutEffect, useRef } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  type HubBoardMove,
  type HubBoardMoveResult,
  type HubBoardRanking,
  type WorkspaceHubSlot,
  type WorkspaceHubVisitOrderInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { DoorRewardEditor } from './DoorRewardEditor';
import {
  HubSlotMembershipControl,
  MarkerAssessment,
  type HubMembershipTransition,
} from './HubMembershipBoard';
import { HubRoomOrderControls, type HubRosterDropState } from './HubVisitRanking';

type HubRewardPresentation = 'editor' | 'preview';
export function OpenHubRoomCard({
  dropAfter,
  dropBefore,
  focusedRewardOwnerKey,
  interactions,
  onMembershipTransition,
  onPointerDragStarted,
  onRankMove,
  pointerDragging,
  ranking,
  requiredVisitCount,
  visitOrderInteraction,
  visitMarker,
  slot,
  showMembership = true,
  showOrder = true,
  rewardPresentation = 'editor',
}: {
  readonly dropAfter: HubRosterDropState | undefined;
  readonly dropBefore: HubRosterDropState | undefined;
  readonly focusedRewardOwnerKey: string | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition?: (transition: HubMembershipTransition) => void;
  readonly onPointerDragStarted?: (
    event: ReactPointerEvent<HTMLSpanElement>,
    slotKey: string,
  ) => void;
  readonly onRankMove?: (
    result: HubBoardMoveResult,
    announcement: string,
    action: HubBoardMove,
  ) => void;
  readonly pointerDragging: boolean;
  readonly ranking: HubBoardRanking;
  readonly requiredVisitCount: number;
  readonly slot: WorkspaceHubSlot;
  readonly visitMarker?: WorkspaceMarker;
  readonly visitOrderInteraction: WorkspaceHubVisitOrderInteraction;
  readonly showMembership?: boolean;
  readonly showOrder?: boolean;
  readonly rewardPresentation?: HubRewardPresentation;
}) {
  const dispatch = useAppDispatch();
  const card = useRef<HTMLElement>(null);
  const rewards =
    slot.door?.rewardPreview.kind === 'visible' ? slot.door.rewardPreview.rewards : undefined;
  const reward = rewards?.length === 1 ? rewards[0] : undefined;
  const rewardOwnerKey =
    reward === undefined ? undefined : semanticAddressKey(reward.marker.address);
  const focusedMainReward = rewardOwnerKey === focusedRewardOwnerKey;
  const canInspectLocalDetail = slot.visited && slot.room !== undefined;
  const visitPosition = ranking.authoredVisitOrder.indexOf(slot.hubSlotKey);
  const showSlotAssessment =
    visitMarker === undefined || visitMarker.assessment !== slot.marker.assessment;

  // A reward owner deliberately resolves to the Hub board. Keep the picker
  // closed, but bring the existing card into view so the returned destination
  // is evident when the board is longer than the inspector viewport. Focusing
  // the existing trigger also gives keyboard users a precise return point
  // without opening the picker.
  useLayoutEffect(() => {
    if (!focusedMainReward) return;
    card.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    if (rewardPresentation === 'editor') {
      card.current
        ?.querySelector<HTMLButtonElement>('.hub-main-reward .contextual-picker-trigger')
        ?.focus({ preventScroll: true });
    }
  }, [focusedMainReward, rewardPresentation]);

  return (
    <article
      aria-label={`${slot.label} Hub room`}
      className="hub-slot-card hub-open-room-card"
      data-dragging={pointerDragging || undefined}
      data-drop-after={dropAfter}
      data-drop-before={dropBefore}
      data-focused-main-reward={focusedMainReward || undefined}
      data-hub-slot-key={slot.hubSlotKey}
      data-hub-card-presentation={showOrder ? 'timeline' : 'overview'}
      data-open="true"
      data-visit-position={visitPosition === -1 ? undefined : visitPosition + 1}
      data-visited={slot.room?.entered}
      ref={card}
    >
      <div className="hub-roster-primary">
        {!showOrder || onPointerDragStarted === undefined ? null : (
          <span
            aria-hidden="true"
            className="hub-roster-drag-handle"
            data-hub-roster-drag-handle
            data-dragging={pointerDragging || undefined}
            onPointerDown={(event) => onPointerDragStarted(event, slot.hubSlotKey)}
          >
            ⠿
          </span>
        )}
        {!showOrder || onRankMove === undefined ? null : (
          <span aria-hidden="true" className="hub-roster-rank">
            {visitPosition === -1 ? '—' : visitPosition + 1}
          </span>
        )}
        <div className="hub-roster-identity">
          <div className="hub-slot-heading">
            <div className="owner-markers">
              <h3>{slot.label}</h3>
              <SemanticOwnerMarker address={slot.marker.address} />
              {visitMarker === undefined ? null : (
                <SemanticOwnerMarker address={visitMarker.address} />
              )}
            </div>
          </div>
          <div className="hub-slot-meta">
            <div className="hub-slot-state">
              <span className="room-kind">{slot.roomKind}</span>
              {slot.room?.entered ? <span className="neutral-status">Entered</span> : null}
              {visitMarker === undefined ? null : <MarkerAssessment marker={visitMarker} />}
              {showSlotAssessment ? <MarkerAssessment marker={slot.marker} /> : null}
            </div>
            {!canInspectLocalDetail || slot.room === undefined ? null : (
              <button
                aria-label={`Open details for ${slot.label}`}
                className="semantic-focus-link"
                onClick={() => dispatch(semanticOwnerFocused(slot.room!.marker.address))}
                type="button"
              >
                Room details
              </button>
            )}
          </div>
        </div>
        {!showMembership || onMembershipTransition === undefined ? null : (
          <HubSlotMembershipControl
            interactions={interactions}
            onMembershipTransition={onMembershipTransition}
            slot={slot}
          />
        )}
        {!showOrder || onRankMove === undefined ? null : (
          <HubRoomOrderControls
            interaction={visitOrderInteraction}
            onApplied={onRankMove}
            ranking={ranking}
            requiredVisitCount={requiredVisitCount}
            slot={slot}
          />
        )}
      </div>
      {rewards === undefined || rewards.length === 0 || slot.door === undefined ? null : (
        <div
          aria-label={`${slot.label} reward ${rewardPresentation}`}
          className={`hub-main-reward room-state-with-marker${!showOrder ? ' hub-overview-reward-slot' : ''}`}
          data-focused-main-reward={focusedMainReward || undefined}
          data-hub-main-reward-owner={rewardOwnerKey}
        >
          {rewardPresentation === 'editor' ? (
            <DoorRewardEditor
              door={slot.door}
              idPrefix={`hub-${slot.hubSlotKey}`}
              interactions={interactions}
            />
          ) : (
            <div className="hub-timeline-reward-preview">
              <span>Reward</span>
              <strong>{rewards.map((candidate) => candidate.summary).join(', ')}</strong>
              {rewards.map((candidate) => (
                <SemanticOwnerMarker address={candidate.marker.address} key={candidate.key} />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
