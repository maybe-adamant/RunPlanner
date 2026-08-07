import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { RawCatalogInput } from '../declarations';
import { normalizeBiomes } from './biomes';
import { requireNonEmpty } from './common';
import {
  normalizeEncounterDefinitions,
  normalizeEncounterEnvelopes,
  normalizeEncounterSets,
} from './encounters';
import { normalizeExitCompatibilityPolicies, normalizeExitTypes } from './exits';
import {
  normalizeBiomeLayouts,
  validatePrebossBatchPolicies,
  validateDerivedRoomOwnership,
  validateRewardLookupOwnership,
} from './layouts';
import { normalizeRooms } from './rooms';
import { normalizeRoomLifecycleProfiles } from './lifecycles';
import { normalizeRoutes } from './routes';
import { createRewardKernelCatalog } from './rewards/normalize';
import { createTraitCatalog } from './traits';

export { CatalogContractError } from './errors';

export function createCatalog(input: RawCatalogInput): Catalog {
  requireNonEmpty(input.version, 'version');

  const biomes = normalizeBiomes(input.biomes);
  const routes = normalizeRoutes(input.routes, biomes);
  const rewards = createRewardKernelCatalog(input.rewardKernel);
  const traitCatalog = createTraitCatalog(input.traitCatalog);
  const encounterEnvelopes = normalizeEncounterEnvelopes(input.encounterEnvelopes, rewards);
  const encounterDefinitions = normalizeEncounterDefinitions(input.encounterDefinitions, rewards);
  const encounterSets = normalizeEncounterSets(input.encounterSets, encounterDefinitions);
  const roomLifecycleProfiles = normalizeRoomLifecycleProfiles(
    input.roomLifecycleProfiles,
    encounterEnvelopes,
    rewards.producerLifecycles,
  );
  const exitCompatibilityPolicies = normalizeExitCompatibilityPolicies(
    input.exitCompatibilityPolicies,
  );
  const exitTypes = normalizeExitTypes(input.exitTypes, exitCompatibilityPolicies);
  const rooms = normalizeRooms(
    input.rooms,
    rewards,
    encounterEnvelopes,
    encounterDefinitions,
    encounterSets,
    exitTypes,
  );
  const biomeLayouts = normalizeBiomeLayouts(
    input.biomeLayouts,
    biomes,
    rooms,
    rewards.stores,
    exitTypes,
  );
  validatePrebossBatchPolicies(biomeLayouts, rooms, exitCompatibilityPolicies);
  validateDerivedRoomOwnership(rooms, biomeLayouts);
  validateRewardLookupOwnership(rooms, biomeLayouts);

  return Object.freeze({
    version: input.version,
    biomes,
    routes,
    rewards,
    encounterEnvelopes,
    encounterDefinitions,
    encounterSets,
    roomLifecycleProfiles,
    exitCompatibilityPolicies,
    exitTypes,
    rooms,
    biomeLayouts,
    weapons: traitCatalog.weapons,
    aspects: traitCatalog.aspects,
    traits: traitCatalog.traits,
    traitGivers: traitCatalog.givers,
    traitOfferContexts: traitCatalog.offerContexts,
    traitRarityOrder: traitCatalog.rarityOrder,
    traitElements: traitCatalog.elements,
    traitBaseElements: traitCatalog.baseElements,
    deferredTraitKeys: traitCatalog.deferredTraitKeys,
  });
}
