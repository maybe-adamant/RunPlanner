import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';

/** Explicit low-level branch seed for tests that intentionally bypass a route. */
export function createTestArcanaFearState() {
  return createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
}
