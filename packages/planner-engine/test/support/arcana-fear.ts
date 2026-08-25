import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { initializeRewardBranches } from '../../src/simulation/rewards/processing';

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
  return initializeRewardBranches(
    undefined,
    arcanaFear,
    catalog,
    catalog.defaultStartingKeepsakeKey,
  );
}
