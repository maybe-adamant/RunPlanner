import { attachTraitHistory } from '../traits';
import type { TraitHistoryState } from '../traits';
import type { HistoryStateView } from '../history';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import type { SimulationState } from './model';

/** Publishes trait history and the reward kernel's derived facts as one state transition. */
export function replaceSimulationTraitHistory(
  state: SimulationState,
  traitHistory: TraitHistoryState,
): SimulationState {
  return traitHistory === state.traitHistory
    ? state
    : Object.freeze({
        ...state,
        traitHistory,
        rewardHistory: attachTraitHistory(state.rewardHistory, traitHistory),
      });
}

export function reachSimulationHistory(
  state: SimulationState,
  routePosition: ResolvedRoutePosition,
  historyView: HistoryStateView,
): SimulationState {
  return state.reached.routePosition === routePosition && state.reached.historyView === historyView
    ? state
    : Object.freeze({ ...state, reached: Object.freeze({ routePosition, historyView }) });
}
