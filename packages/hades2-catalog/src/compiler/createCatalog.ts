import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { RawCatalogInput } from '../declarations';
import { normalizeArcanaCards, normalizeFearVows } from './arcana-fear';
import { normalizeBiomes } from './biomes';
import { requireNonEmpty } from './common';
import {
  normalizeEncounterDefinitions,
  normalizeEncounterEnvelopes,
  normalizeEncounterSets,
  validateNemesisRandomEventContract,
} from './encounters';
import { normalizeExitCompatibilityPolicies, normalizeExitTypes } from './exits';
import { validateHexBindings } from './hexes';
import { normalizeKeepsakes, validateEchoGiftBindings } from './keepsakes';
import { normalizeBiomeLayouts } from './layouts';
import { normalizeRoomLifecycleProfiles, validateLifecycleBindings } from './lifecycles';
import { validateRoomLayoutClosure } from './room-layout-closure';
import { normalizeRooms } from './rooms';
import { validateFixedAcquisitionTraitGrants } from './rewards/declarations';
import { createRewardKernelCatalog } from './rewards/normalize';
import { normalizeRoutes } from './routes';
import {
  createTraitGiverByAcquisitionGameName,
  validateRewardAcquisitionRoleTraitGivers,
} from './trait-givers';
import { createTraitCatalog } from './traits';

export { CatalogContractError } from './errors';

export function createCatalog(input: RawCatalogInput): Catalog {
  requireNonEmpty(input.version, 'version');

  const biomes = normalizeBiomes(input.biomes);
  const rewards = createRewardKernelCatalog(input.rewardKernel);
  const traitCatalog = createTraitCatalog(input.traitCatalog);
  validateFixedAcquisitionTraitGrants(rewards.acquisitions, traitCatalog.traits);
  const arcanaCards = normalizeArcanaCards(input.arcanaCards, traitCatalog.traits);
  const fearVows = normalizeFearVows(input.fearVows);
  const keepsakes = normalizeKeepsakes(input.keepsakes);
  validateHexBindings({
    hexes: traitCatalog.hexes,
    traits: traitCatalog.traits,
    givers: traitCatalog.givers,
    keepsakes,
  });
  validateEchoGiftBindings(keepsakes, traitCatalog.traits);
  const encounterEnvelopes = normalizeEncounterEnvelopes(input.encounterEnvelopes, rewards);
  const encounterDefinitions = normalizeEncounterDefinitions(
    input.encounterDefinitions,
    rewards,
    traitCatalog,
    keepsakes,
  );
  const encounterSets = normalizeEncounterSets(input.encounterSets, encounterDefinitions);
  validateNemesisRandomEventContract(encounterDefinitions, encounterSets, rewards);
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
  const routes = normalizeRoutes(input.routes, biomes, rooms);
  validateLifecycleBindings({
    rooms,
    profiles: roomLifecycleProfiles,
    traits: traitCatalog.traits,
    rewards,
  });
  const biomeLayouts = normalizeBiomeLayouts(
    input.biomeLayouts,
    biomes,
    rooms,
    rewards.stores,
    exitTypes,
  );
  validateRoomLayoutClosure(rooms, biomeLayouts, exitCompatibilityPolicies);
  validateRewardAcquisitionRoleTraitGivers(rewards, traitCatalog.givers);
  const traitGiverByAcquisitionGameName = createTraitGiverByAcquisitionGameName(
    input.traitCatalog.traitAcquisitionProviders,
    traitCatalog.givers,
  );

  return Object.freeze({
    version: input.version,
    biomes,
    routes,
    arcanaCards,
    fearVows,
    keepsakes,
    defaultStartingKeepsakeKey: 'ManaOverTimeRefundKeepsake',
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
    chaos: traitCatalog.chaos,
    traitGivers: traitCatalog.givers,
    traitGiverByAcquisitionGameName,
    boonRarityBases: traitCatalog.boonRarityBases,
    boonRarityRollOrder: traitCatalog.boonRarityRollOrder,
    boonReplacementChance: traitCatalog.boonReplacementChance,
    echoLastRunBoon: traitCatalog.echoLastRunBoon,
    hexes: traitCatalog.hexes,
    traitOfferContexts: traitCatalog.offerContexts,
    traitRarityOrder: traitCatalog.rarityOrder,
    traitElements: traitCatalog.elements,
    traitBaseElements: traitCatalog.baseElements,
  });
}
