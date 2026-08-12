import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';

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
