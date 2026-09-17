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
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { DoorRewardEditor } from './DoorRewardEditor';
import {
  HubSlotMembershipControl,
  MarkerAssessment,
  type HubMembershipTransition,
} from './HubMembershipBoard';
import { HubRoomOrderControls, type HubRosterDropState } from './HubVisitRanking';

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
  sequenceLocked = false,
  slotsByKey,
  visitOrderInteraction,
  visitMarker,
  slot,
  showMembership = true,
  showOrder = true,
  activeReplacementSlotKey,
  replacementOpen = false,
  onReplacementOpenChange,
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
  readonly sequenceLocked?: boolean;
  readonly slotsByKey: ReadonlyMap<string, WorkspaceHubSlot>;
  readonly slot: WorkspaceHubSlot;
  readonly visitMarker?: WorkspaceMarker;
  readonly visitOrderInteraction: WorkspaceHubVisitOrderInteraction;
  readonly showMembership?: boolean;
  readonly showOrder?: boolean;
  readonly activeReplacementSlotKey?: string | undefined;
  readonly replacementOpen?: boolean;
  readonly onReplacementOpenChange?: (open: boolean) => void;
}) {
  const findingTarget = useFindingTarget();
  const visitTarget =
    showOrder && visitMarker !== undefined ? findingTarget(visitMarker.address) : undefined;
  const card = useRef<HTMLElement>(null);
  const rewards =
    slot.door?.offerRewardSurface.visibility === 'visible'
      ? slot.door.offerRewardSurface.rewards
      : undefined;
  const reward = rewards?.length === 1 ? rewards[0] : undefined;
  const rewardOwnerKey =
    reward === undefined ? undefined : semanticAddressKey(reward.marker.address);
  const focusedMainReward = rewardOwnerKey === focusedRewardOwnerKey;
  const visitPosition = ranking.authoredVisitOrder.indexOf(slot.hubSlotKey);
  const showSlotAssessment =
    visitMarker === undefined || visitMarker.assessment !== slot.marker.assessment;
  const roomHeading = (
    <div className="hub-slot-heading">
      <h3>{slot.label}</h3>
      <RoomMapLauncher
        gameName={slot.gameName}
        hostId={slot.marker.focusKey}
        label="Map"
        title={slot.label}
      />
      {visitMarker === undefined ? null : <MarkerAssessment marker={visitMarker} />}
      {showSlotAssessment ? <MarkerAssessment marker={slot.marker} /> : null}
    </div>
  );

  // A reward owner deliberately resolves to the Hub board. Keep the picker
  // closed, but bring the existing card into view so the returned destination
  // is evident when the board is longer than the inspector viewport. Focusing
  // the existing trigger also gives keyboard users a precise return point
  // without opening the picker.
  useLayoutEffect(() => {
    if (!focusedMainReward) return;
    card.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    if (!showOrder) {
      card.current
        ?.querySelector<HTMLButtonElement>('.hub-main-reward .contextual-picker-trigger')
        ?.focus({ preventScroll: true });
    }
  }, [focusedMainReward, showOrder]);

  return (
    <article
      {...visitTarget}
      tabIndex={visitTarget === undefined ? undefined : -1}
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
      ref={(element) => {
        card.current = element;
        visitTarget?.ref(element);
      }}
    >
      <div className="hub-roster-primary">
        {!showOrder || onPointerDragStarted === undefined ? null : (
          <span
            aria-hidden="true"
            className="hub-roster-drag-handle"
            data-hub-roster-drag-handle
            data-hub-roster-region="drag-handle"
            data-dragging={pointerDragging || undefined}
            onPointerDown={(event) => {
              if (!sequenceLocked) onPointerDragStarted(event, slot.hubSlotKey);
            }}
          >
            ⠿
          </span>
        )}
        {!showOrder || onRankMove === undefined ? null : (
          <span aria-hidden="true" className="hub-roster-rank" data-hub-roster-region="rank">
            {visitPosition === -1 ? '—' : visitPosition + 1}
          </span>
        )}
        <div
          className="hub-roster-identity"
          data-hub-roster-region={showOrder ? 'identity' : undefined}
        >
          {roomHeading}
        </div>
        {!showOrder ? null : (
          <div
            aria-label={`${slot.label} reward preview`}
            className="hub-timeline-reward-preview"
            data-hub-roster-region="reward"
            data-hub-main-reward-owner={rewardOwnerKey}
          >
            {rewards === undefined || rewards.length === 0 ? null : (
              <>
                <span>Reward</span>
                <strong>{rewards.map((candidate) => candidate.summary).join(', ')}</strong>
              </>
            )}
          </div>
        )}
        {!showMembership || onMembershipTransition === undefined ? null : (
          <HubSlotMembershipControl
            interactions={interactions}
            onMembershipTransition={onMembershipTransition}
            slot={slot}
          />
        )}
        {!showOrder || onRankMove === undefined ? null : (
          <HubRoomOrderControls
            activeReplacementSlotKey={activeReplacementSlotKey}
            interaction={visitOrderInteraction}
            onApplied={onRankMove}
            ranking={ranking}
            requiredVisitCount={requiredVisitCount}
            slot={slot}
            slotsByKey={slotsByKey}
            locked={sequenceLocked}
            {...(onReplacementOpenChange === undefined ? {} : { onReplacementOpenChange })}
            replacementOpen={replacementOpen}
          />
        )}
      </div>
      {showOrder ||
      rewards === undefined ||
      rewards.length === 0 ||
      slot.door === undefined ? null : (
        <div
          aria-label={`${slot.label} reward editor`}
          className="hub-main-reward hub-overview-reward-slot"
          data-focused-main-reward={focusedMainReward || undefined}
          data-hub-main-reward-owner={rewardOwnerKey}
        >
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`hub-${slot.hubSlotKey}`}
            interactions={interactions}
          />
        </div>
      )}
    </article>
  );
}
