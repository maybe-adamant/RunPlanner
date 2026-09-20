import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '../../src/catalog-schema';
import type { AuthoredKeepsakeEquipResults } from '../../src/authored-project/model';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { resolveRoutePosition } from '../../src/authored-project/route-context';
import { createArcanaFearState, type ArcanaFearState } from '../../src/simulation/arcana-fear';
import { createRouteStartHistoryView } from '../../src/simulation/history/fold';
import { initializeRewardBranches } from '../../src/simulation/rewards/branch-lifecycle';
import type { RewardBranch } from '../../src/simulation/rewards/model';

/** Explicit low-level branch seed for tests that intentionally bypass a route. */
export function createTestArcanaFearState(
  fearRanks: Readonly<Record<string, number>> = Object.freeze({}),
) {
  const loadout = createDefaultRouteLoadout(catalog);
  return createArcanaFearState(catalog, {
    ...loadout,
    fearRanks: Object.freeze({ ...loadout.fearRanks, ...fearRanks }),
  });
}

/**
 * Explicit low-level branch seed using the production catalog's declared
 * starting keepsake. Tests that bypass route evaluation retain a complete
 * branch state without inventing a parallel keepsake default.
 */
export function initializeTestRewardBranches(arcanaFear = createTestArcanaFearState()) {
  return initializeTestRewardBranchesForRoute(undefined, arcanaFear);
}

/**
 * Test-only construction adapter for direct reward-kernel fixtures. It supplies
 * the same concrete route-start contact used by production evaluation while
 * retaining every explicit route/loadout input from a fixture.
 */
export function initializeTestRewardBranchesForRoute(
  initialBranches: readonly RewardBranch[] | undefined = undefined,
  initialArcanaFear: ArcanaFearState | undefined = undefined,
  testCatalog: Catalog = catalog,
  startingKeepsakeKey: string | undefined = undefined,
  startingKeepsakeEquipResults: AuthoredKeepsakeEquipResults | undefined = undefined,
  routeKey: string | undefined = undefined,
  loadout: ReturnType<typeof createDefaultRouteLoadout> | undefined = undefined,
  reached?: Parameters<typeof initializeRewardBranches>[7],
) {
  const predecessor = initialBranches?.[0];
  const resolvedRouteKey =
    routeKey ?? predecessor?.state.reached.routePosition.routeKey ?? 'Underworld';
  const resolvedLoadout =
    loadout ??
    (predecessor === undefined
      ? createDefaultRouteLoadout(testCatalog)
      : {
          weaponKey: predecessor.state.equipment.weaponKey,
          aspectKey: predecessor.state.equipment.aspectKey,
        });
  const resolvedArcanaFear =
    initialArcanaFear ??
    predecessor?.state.arcanaFear ??
    createArcanaFearState(testCatalog, loadout ?? createDefaultRouteLoadout(testCatalog));
  const route = testCatalog.routes.byKey[resolvedRouteKey];
  const firstBiomeKey = route?.biomeKeys[0];
  if (
    reached === undefined &&
    predecessor === undefined &&
    (route === undefined || firstBiomeKey === undefined)
  ) {
    throw new Error(`test route ${resolvedRouteKey} has no first biome`);
  }
  return initializeRewardBranches(
    initialBranches,
    resolvedArcanaFear,
    testCatalog,
    startingKeepsakeKey ?? testCatalog.defaultStartingKeepsakeKey,
    startingKeepsakeEquipResults,
    resolvedRouteKey,
    resolvedLoadout,
    reached ?? {
      routePosition:
        predecessor?.state.reached.routePosition ??
        resolveRoutePosition(
          testCatalog,
          { routeKey: resolvedRouteKey, itineraryBiomeKeys: route!.biomeKeys },
          firstBiomeKey!,
        ),
      historyView: predecessor?.state.reached.historyView ?? createRouteStartHistoryView(),
    },
  );
}
