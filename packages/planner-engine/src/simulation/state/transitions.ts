import { attachTraitHistory } from '../traits';
import type { TraitHistoryState } from '../traits';
import type { HistoryStateView } from '../history';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import type { SimulationState } from './model';
import { reconcileBarrenArcana } from '../arcana-fear';

/** Publishes trait history, the reward kernel's derived facts and Barren's Arcana effect as one transition. */
export function replaceSimulationTraitHistory(
  state: SimulationState,
  traitHistory: TraitHistoryState,
): SimulationState {
  if (traitHistory === state.traitHistory) return state;
  const barren = (history: TraitHistoryState) =>
    history.activeChaosCurses.some((curse) => curse.semanticTag === 'Barren');
  return Object.freeze({
    ...state,
    traitHistory,
    rewardHistory: attachTraitHistory(state.rewardHistory, traitHistory),
    arcanaFear: reconcileBarrenArcana(
      state.arcanaFear,
      barren(state.traitHistory),
      barren(traitHistory),
    ),
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
