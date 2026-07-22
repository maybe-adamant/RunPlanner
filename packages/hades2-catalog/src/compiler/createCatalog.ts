import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { RawCatalogInput } from '../declarations';
import { normalizeBiomes } from './biomes';
import { requireNonEmpty } from './common';
import { normalizeEncounterProfiles } from './encounters';
import { normalizeExitCompatibilityPolicies, normalizeExitTypes } from './exits';
import {
  normalizeBiomeLayouts,
  validateDerivedRoomOwnership,
  validateRewardLookupOwnership,
} from './layouts';
import { normalizeRooms } from './rooms';
import { normalizeRoomLifecycleProfiles } from './lifecycles';
import { normalizeRoutes } from './routes';
import { createRewardKernelCatalog } from './rewards/normalize';

export { CatalogContractError } from './errors';

export function createCatalog(input: RawCatalogInput): Catalog {
  requireNonEmpty(input.version, 'version');

  const biomes = normalizeBiomes(input.biomes);
  const routes = normalizeRoutes(input.routes, biomes);
  const rewards = createRewardKernelCatalog(input.rewardKernel);
  const encounterProfiles = normalizeEncounterProfiles(input.encounterProfiles, rewards);
  const roomLifecycleProfiles = normalizeRoomLifecycleProfiles(
    input.roomLifecycleProfiles,
    encounterProfiles,
    rewards.producerLifecycles,
  );
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
  validateRewardLookupOwnership(rooms, biomeLayouts);

  return Object.freeze({
    version: input.version,
    biomes,
    routes,
    rewards,
    encounterProfiles,
    roomLifecycleProfiles,
    exitCompatibilityPolicies,
    exitTypes,
    rooms,
    biomeLayouts,
  });
}
