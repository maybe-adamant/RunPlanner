import { replaceSimulationTraitHistory } from '../../../state/transitions';
import { gainSilkenSashDoorArmor } from '../../../keepsakes/state';
import type { Catalog } from '../../../../catalog-schema';
import type { HistoryEvent } from '../../../history';
import { advanceChaosClock, advanceRoomDecay } from '../../../traits';
import { advanceStygianWellClock } from '../../../commerce/stygian-well';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';

/**
 * Native LeaveRoom advances room-use curses, room-decaying traits and
 * room-clocked Well traits; into a new room, Silken Sash gains its door armor.
 */
export function applyRoomDepartedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomDeparted' }>,
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  // Door effects run only into a room not visited before (RoomLogic.lua:4229-4238).
  const entersNewRoom = event.destination === 'newRoom' || event.destination === 'biomeExit';
  const next = branches.map((branch) => {
    const before = branch.state.traitHistory;
    const traitHistory = advanceRoomDecay(
      catalog,
      advanceChaosClock(catalog, before, event.sequence, 'locations'),
      event.origin,
      event.sequence,
    );
    const stygianWell = advanceStygianWellClock(branch.state.stygianWell, 'rooms');
    const keepsakes = entersNewRoom
      ? gainSilkenSashDoorArmor(catalog, branch.state.keepsakes)
      : branch.state.keepsakes;
    const state = replaceSimulationTraitHistory(branch.state, traitHistory);
    if (
      state === branch.state &&
      stygianWell === branch.state.stygianWell &&
      keepsakes === branch.state.keepsakes
    )
      return branch;
    return Object.freeze({ ...branch, state: Object.freeze({ ...state, stygianWell, keepsakes }) });
  });
  return advanceRewardBranches(Object.freeze(next), event.sequence);
}
