import { useLayoutEffect, useRef } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  type WorkspaceHubSlot,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';
import { DoorRewardEditor } from './DoorRewardEditor';
import { HubSlotMembershipControl, type HubMembershipTransition } from './HubMembershipBoard';

/** The Overview card owns Hub membership and reward editing, never visit order. */
export function OpenHubRoomCard({
  focusedRewardOwnerKey,
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly focusedRewardOwnerKey: string | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition?: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  const card = useRef<HTMLElement>(null);
  const rewards =
    slot.door?.offerRewardSurface.visibility === 'visible'
      ? slot.door.offerRewardSurface.rewards
      : undefined;
  const reward = rewards?.length === 1 ? rewards[0] : undefined;
  const rewardOwnerKey =
    reward === undefined ? undefined : semanticAddressKey(reward.marker.address);
  const focusedMainReward = rewardOwnerKey === focusedRewardOwnerKey;

  useLayoutEffect(() => {
    if (!focusedMainReward) return;
    card.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    card.current
      ?.querySelector<HTMLButtonElement>('.hub-main-reward .contextual-picker-trigger')
      ?.focus({ preventScroll: true });
  }, [focusedMainReward]);

  return (
    <article
      aria-label={`${slot.label} Hub room`}
      className="hub-slot-card hub-open-room-card"
      data-focused-main-reward={focusedMainReward || undefined}
      data-hub-card-presentation="overview"
      data-hub-slot-key={slot.hubSlotKey}
      data-open="true"
      ref={card}
    >
      <div className="hub-roster-primary">
        <div className="hub-roster-identity">
          <div className="hub-slot-heading">
            <h3>{slot.label}</h3>
            <RoomMapLauncher
              gameName={slot.gameName}
              hostId={slot.marker.focusKey}
              label="Map"
              title={slot.label}
            />
          </div>
        </div>
        {onMembershipTransition === undefined ? null : (
          <HubSlotMembershipControl
            interactions={interactions}
            onMembershipTransition={onMembershipTransition}
            slot={slot}
          />
        )}
      </div>
      {rewards === undefined || rewards.length === 0 || slot.door === undefined ? null : (
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
