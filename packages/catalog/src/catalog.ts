import type { Catalog } from '@run-planner/core';

import type { RawCatalogInput } from './declarations';
import { normalizeBiomes } from './normalization/biomes';
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

  const biomes = normalizeBiomes(input.biomes);
  const routes = normalizeRoutes(input.routes, biomes);
  const rewards = createRewardKernelCatalog(input.rewardKernel);
  const encounterProfiles = normalizeEncounterProfiles(input.encounterProfiles, rewards);
  const exitCompatibilityPolicies = normalizeExitCompatibilityPolicies(
    input.exitCompatibilityPolicies,
  );
  const exitTypes = normalizeExitTypes(input.exitTypes, exitCompatibilityPolicies);
  const rooms = normalizeRooms(
    input.rooms,
    new Set(biomes.values.map((biome) => biome.key)),
    rewards,
    encounterProfiles,
    exitTypes,
  );
  const biomeLayouts = normalizeBiomeLayouts(input.biomeLayouts, biomes, rooms, rewards.stores);
  validateDerivedRoomOwnership(rooms, biomeLayouts);

  return Object.freeze({
    version: input.version,
    biomes,
    routes,
    rewards,
    encounterProfiles,
    exitCompatibilityPolicies,
    exitTypes,
    rooms,
    biomeLayouts,
  });
}
