import type { WorkspaceHubSlot } from '@planner/projections/structured-workspace';

import { rewardIcon } from '@planner/ui/artwork/rewardIcon';

/**
 * Presentation of the door reward, not its eventual pickup outcome: its first
 * draw, then what its rerolls left, whose icon the marker shows.
 */
export function hubMapReward(slot: WorkspaceHubSlot): {
  readonly summary: string;
  readonly icon?: string;
} {
  if (!slot.open || slot.door?.offerRewardSurface.visibility !== 'visible') {
    return { summary: 'Reward unavailable.' };
  }
  const rewards = slot.door.offerRewardSurface.rewards;
  if (rewards.length === 0) return { summary: 'Reward not configured.' };
  const summary = rewards
    .map((reward) =>
      reward.rerolledSummary === undefined
        ? reward.summary
        : `${reward.summary} → ${reward.rerolledSummary}`,
    )
    .join(', ');
  const only = rewards.length === 1 ? rewards[0] : undefined;
  const offer = only?.rerolledOffer ?? only?.offer;
  const identity =
    offer?.rewardType === 'Boon' && offer.payload?.kind === 'BoonSource'
      ? offer.payload.source
      : offer?.rewardType;
  const icon = identity === undefined ? undefined : rewardIcon(identity);
  return { summary, ...(icon === undefined ? {} : { icon }) };
}
