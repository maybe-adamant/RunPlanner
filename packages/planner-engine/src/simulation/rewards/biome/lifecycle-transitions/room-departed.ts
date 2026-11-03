import { replaceSimulationTraitHistory } from '../../../state/transitions';
import { gainSilkenSashDoorArmor } from '../../../keepsakes/state';
import type { Catalog } from '../../../../catalog-schema';
import type { HistoryEvent } from '../../../history';
import { advanceChaosClock, advanceRoomDecay } from '../../../traits';
import { advanceStygianWellClock } from '../../../commerce/stygian-well';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranch } from '../../branch-lifecycle';

/**
 * Native LeaveRoom advances room-use curses, room-decaying traits and
 * room-clocked Well traits; into a new room, Silken Sash gains its door armor.
 */
export function applyRoomDepartedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomDeparted' }>,
  branch: RewardBranchState | undefined,
): RewardBranchState | undefined {
  if (branch === undefined) return undefined;
  // Door effects run only into a room not visited before (RoomLogic.lua:4229-4238).
  const entersNewRoom = event.destination === 'newRoom' || event.destination === 'biomeExit';
  const traitHistory = advanceRoomDecay(
    catalog,
    advanceChaosClock(catalog, branch.state.traitHistory, event.sequence, 'locations'),
    event.origin,
    event.sequence,
  );
  const stygianWell = advanceStygianWellClock(branch.state.stygianWell, 'rooms');
  const keepsakes = entersNewRoom
    ? gainSilkenSashDoorArmor(catalog, branch.state.keepsakes)
    : branch.state.keepsakes;
  const state = replaceSimulationTraitHistory(branch.state, traitHistory);
  const next =
    state === branch.state &&
    stygianWell === branch.state.stygianWell &&
    keepsakes === branch.state.keepsakes
      ? branch
      : Object.freeze({ ...branch, state: Object.freeze({ ...state, stygianWell, keepsakes }) });
  return advanceRewardBranch(next, event.sequence);
}
