import { catalog } from '@run-planner/hades2-catalog';
import { createRewardHistoryState } from '../../src/reward-kernel';

/** Mature save-file god ledgers for hand-built requirement contexts. */
export function matureGodHistoryRecords() {
  const history = createRewardHistoryState(catalog.rewards, 'mature');
  return {
    lifetimeGodUseRecord: history.lifetimeGodUseRecord,
    lifetimeGodPickupRecord: history.lifetimeGodPickupRecord,
  };
}
