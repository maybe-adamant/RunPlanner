import type { Catalog } from '@run-planner/core';

import type { RawCatalogInput } from './declarations';
import { requireNonEmpty } from './normalization/common';
import { normalizeEncounterProfiles } from './normalization/encounters';
import { normalizeExitCompatibilityPolicies, normalizeExitTypes } from './normalization/exits';
import { normalizeBiomeLayouts, validateDerivedRoomOwnership } from './normalization/layouts';
import { normalizeRooms } from './normalization/rooms';
import { normalizeRoutes } from './normalization/routes';
import { createRewardKernelCatalog } from './rewardKernel/normalize';

export { CatalogContractError } from './normalization/errors';

export function createCatalog(input: RawCatalogInput): Catalog {
  requireNonEmpty(input.version, 'version');

  const routes = normalizeRoutes(input.routes);
  const rewards = createRewardKernelCatalog(input.rewardKernel);
  const encounterProfiles = normalizeEncounterProfiles(input.encounterProfiles);
  const exitCompatibilityPolicies = normalizeExitCompatibilityPolicies(
    input.exitCompatibilityPolicies,
  );
  const exitTypes = normalizeExitTypes(input.exitTypes, exitCompatibilityPolicies);
  const routeSteps = new Set(
    routes.values.flatMap((route) => route.biomeSteps.map((step) => step.key)),
  );
  const routeTransitions = new Map(
    routes.values.flatMap((route) =>
      route.biomeSteps.map(
        (step, index) =>
          [
            step.key,
            index === route.biomeSteps.length - 1 ? 'routeComplete' : 'nextBiome',
          ] as const,
      ),
    ),
  );
  const rooms = normalizeRooms(input.rooms, routeSteps, rewards, encounterProfiles, exitTypes);
  const biomeLayouts = normalizeBiomeLayouts(
    input.biomeLayouts,
    routeTransitions,
    rooms,
    rewards.stores,
  );
  validateDerivedRoomOwnership(rooms, biomeLayouts);

  return Object.freeze({
    version: input.version,
    routes,
    rewards,
    encounterProfiles,
    exitCompatibilityPolicies,
    exitTypes,
    rooms,
    biomeLayouts,
  });
}
