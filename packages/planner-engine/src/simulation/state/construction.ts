import type { Catalog } from '../../catalog-schema';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { createRewardHistoryState } from '../../reward-kernel';
import type { ArcanaFearState } from '../arcana-fear';
import type { HistoryStateView } from '../history';
import { createKeepsakeState } from '../keepsakes/state';
import { createTraitHistoryState } from '../traits';
import { createEmptyRewardLookups, type SimulationState } from './model';

/**
 * The exact run-start snapshot: declared loadout identity, the configured
 * Arcana/Fear and keepsake frontier, and empty run history. Loadout equip
 * results and the Aspect starting trait are applied by their own transitions
 * over this state.
 */
export function createInitialSimulationState(
  catalog: Catalog,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
  startingKeepsakeKey: string,
  arcanaFear: ArcanaFearState,
  reached: {
    readonly routePosition: ResolvedRoutePosition;
    readonly historyView: HistoryStateView;
  },
): SimulationState {
  return Object.freeze({
    equipment: Object.freeze({
      weaponKey: loadout.weaponKey,
      aspectKey: loadout.aspectKey,
    }),
    reached: Object.freeze(reached),
    bags: Object.freeze({}),
    rewardPriorities: Object.freeze([]),
    hexProgress: Object.freeze({ bankedPathPoints: 0, investedPathPoints: 0 }),
    rewardHistory: createRewardHistoryState(),
    traitHistory: createTraitHistoryState(),
    arcanaFear,
    keepsakes: createKeepsakeState(catalog, startingKeepsakeKey, arcanaFear),
    pendingShops: Object.freeze({}),
    pendingHermesShrineDeliveries: Object.freeze({}),
    stygianWell: Object.freeze({
      sparkUses: 0,
      yarnUses: 0,
      hymnUses: 0,
      discountUses: Object.freeze([]),
      emptySlotUses: Object.freeze([]),
      extendedUses: 0,
    }),
    rewardLookups: createEmptyRewardLookups(catalog),
    offeredRewardTypes: Object.freeze([]),
    pendingTraitOffers: Object.freeze({}),
  });
}
