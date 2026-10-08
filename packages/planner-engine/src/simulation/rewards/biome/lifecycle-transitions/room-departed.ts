import { replaceSimulationTraitHistory } from '../../../state/transitions';
import type { Catalog } from '../../../../catalog-schema';
import type { HistoryEvent } from '../../../history';
import { advanceChaosClock, advanceRoomDecay } from '../../../traits';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';

/** Native LeaveRoom advances room-use curses and room-decaying traits together. */
export function applyRoomDepartedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomDeparted' }>,
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  const next = branches.map((branch) => {
    const before = branch.state.traitHistory;
    const traitHistory = advanceRoomDecay(
      catalog,
      advanceChaosClock(catalog, before, event.sequence, 'locations'),
      event.origin,
      event.sequence,
    );
    return traitHistory === before
      ? branch
      : Object.freeze({
          ...branch,
          state: replaceSimulationTraitHistory(branch.state, traitHistory),
        });
  });
  return advanceRewardBranches(Object.freeze(next), event.sequence);
}
