import type { Catalog } from '../../catalog-schema';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { createRewardHistoryState } from '../../reward-kernel';
import type { RouteLoadout, RouteWeaponAspectLoadout } from '../../authored-project/model';
import {
  resolveRouteEquipment,
  routeSaveFileGodHistory,
} from '../../authored-project/route-profile';
import type { ArcanaFearState } from '../arcana-fear';
import type { HistoryStateView } from '../history';
import { createKeepsakeState } from '../keepsakes/state';
import { createTraitHistoryState } from '../traits';
import { createEmptyRewardLookups, type SimulationState } from './model';

/**
 * The exact run-start snapshot: declared loadout identity, the configured
 * Arcana/Fear and keepsake frontier, the save file's god history and empty
 * run history. Loadout equip
 * results and the Aspect starting trait are applied by their own transitions
 * over this state.
 */
export function createInitialSimulationState(
  catalog: Catalog,
  loadout: RouteWeaponAspectLoadout & Pick<RouteLoadout, 'familiarKey'>,
  startingKeepsakeKey: string | null,
  arcanaFear: ArcanaFearState,
  reached: {
    readonly routePosition: ResolvedRoutePosition;
    readonly historyView: HistoryStateView;
  },
): SimulationState {
  const routeKey = reached.routePosition.routeKey;
  return Object.freeze({
    equipment: Object.freeze({
      ...resolveRouteEquipment(catalog, routeKey, loadout),
      familiarKey: loadout.familiarKey,
    }),
    reached: Object.freeze(reached),
    bags: Object.freeze({}),
    rewardPriorities: Object.freeze([]),
    hexProgress: Object.freeze({ bankedPathPoints: 0, investedNodeKeys: Object.freeze([]) }),
    rewardHistory: createRewardHistoryState(
      catalog.rewards,
      routeSaveFileGodHistory(catalog, routeKey),
    ),
    traitHistory: createTraitHistoryState(),
    arcanaFear,
    keepsakes: createKeepsakeState(catalog, startingKeepsakeKey, arcanaFear),
    pendingShops: Object.freeze({}),
    pendingHermesShrineDeliveries: Object.freeze({}),
    stygianWell: Object.freeze({
      sparkUses: 0,
      yarnUses: 0,
      hymnUses: 0,
      extendedUses: 0,
      timedInstances: Object.freeze([]),
      directPurchases: Object.freeze({}),
    }),
    rewardLookups: createEmptyRewardLookups(catalog),
    offeredRewardTypes: Object.freeze([]),
    pendingTraitOffers: Object.freeze({}),
    pendingResourcePickups: Object.freeze({}),
  });
}
