import type { HistoryEvent } from '../../history';
import { beginRewardRoom } from '../processing';
import type { RewardBranchState } from '../branch-primitives';

/** The room-preparation lifecycle transition has no emitted artifacts. */
export function applyRoomPreparedTransition(
  event: Extract<HistoryEvent, { readonly kind: 'roomPrepared' }>,
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  return beginRewardRoom(branches, event.sequence);
}
