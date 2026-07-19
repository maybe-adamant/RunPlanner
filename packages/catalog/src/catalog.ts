import type { Catalog } from '@run-planner/core';

import type { RawCatalogInput } from './declarations';
import { requireNonEmpty } from './normalization/common';
import { normalizeEncounterProfiles } from './normalization/encounters';
import { normalizeBiomeLayouts } from './normalization/layouts';
import { normalizeRooms } from './normalization/rooms';
import { normalizeRoutes } from './normalization/routes';
import { createRewardKernelCatalog } from './rewardKernel/normalize';

export { CatalogContractError } from './normalization/errors';

export function createCatalog(input: RawCatalogInput): Catalog {
  requireNonEmpty(input.version, 'version');

  const routes = normalizeRoutes(input.routes);
  const rewards = createRewardKernelCatalog(input.rewardKernel);
  const encounterProfiles = normalizeEncounterProfiles(input.encounterProfiles);
  const routeSteps = new Set(
    routes.values.flatMap((route) => route.biomeSteps.map((step) => step.key)),
  );
  const rooms = normalizeRooms(input.rooms, routeSteps, rewards, encounterProfiles);
  const biomeLayouts = normalizeBiomeLayouts(input.biomeLayouts, routeSteps, rooms, rewards.stores);

  return Object.freeze({
    version: input.version,
    routes,
    rewards,
    encounterProfiles,
    rooms,
    biomeLayouts,
  });
}
