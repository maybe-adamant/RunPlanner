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
import { fail } from './errors';
import { normalizeArcanaCards, normalizeFearVows } from './arcana-fear';
import { normalizeKeepsakes } from './keepsakes';

function validateLifecycleBindings(
  rooms: Catalog['rooms'],
  profiles: Catalog['roomLifecycleProfiles'],
  traits: Catalog['traits'],
  rewards: Catalog['rewards'],
): void {
  for (const room of rooms.values) {
    if (room.lifecycleProfileKey === undefined) continue;
    const profile = profiles.byKey[room.lifecycleProfileKey];
    if (profile === undefined)
      fail(`rooms.${room.gameName}.lifecycleProfileKey`, 'unknown room lifecycle profile');
    if (!profile.encounterEnvelopeKeys.includes(room.encounterEnvelopeKey))
      fail(
        `rooms.${room.gameName}.lifecycleProfileKey`,
        'does not support the room encounter envelope',
      );
    if (profile.producer.kind === 'none') {
      if (room.incomingReward.kind !== 'none')
        fail(`rooms.${room.gameName}.lifecycleProfileKey`, 'requires no incoming reward producer');
    } else {
      if (room.incomingReward.kind === 'none')
        fail(`rooms.${room.gameName}.lifecycleProfileKey`, 'requires an incoming reward producer');
      if (!profile.producer.lifecycleProfileKeys.includes(room.incomingReward.producerLifecycleKey))
        fail(
          `rooms.${room.gameName}.lifecycleProfileKey`,
          'does not admit the incoming producer lifecycle',
        );
    }
  }
  for (const trait of traits.values) {
    const disposition = trait.selectedDisposition;
    if (disposition.kind !== 'producePickups') continue;
    const lifecycle = rewards.producerLifecycles.byKey[disposition.producerLifecycleKey];
    if (lifecycle === undefined)
      fail(
        `traits.${trait.key}.selectedDisposition.producerLifecycleKey`,
        'unknown producer lifecycle',
      );
    for (const pickup of disposition.pickups) {
      if (rewards.rewardTypes.byKey[pickup.rewardType] === undefined)
        fail(
          `traits.${trait.key}.selectedDisposition.pickups.${pickup.key}`,
          'unknown reward type',
        );
      if (lifecycle.rewardTypes.byKey[pickup.rewardType] === undefined)
        fail(
          `traits.${trait.key}.selectedDisposition.pickups.${pickup.key}`,
          'is not supported by producer lifecycle',
        );
    }
  }
}

export { CatalogContractError } from './errors';

export function createCatalog(input: RawCatalogInput): Catalog {
  requireNonEmpty(input.version, 'version');

  const biomes = normalizeBiomes(input.biomes);
  const routes = normalizeRoutes(input.routes, biomes);
  const rewards = createRewardKernelCatalog(input.rewardKernel);
  const traitCatalog = createTraitCatalog(input.traitCatalog);
  const arcanaCards = normalizeArcanaCards(input.arcanaCards, traitCatalog.traits);
  const fearVows = normalizeFearVows(input.fearVows);
  const keepsakes = normalizeKeepsakes(input.keepsakes);
  const encounterEnvelopes = normalizeEncounterEnvelopes(input.encounterEnvelopes, rewards);
  const encounterDefinitions = normalizeEncounterDefinitions(
    input.encounterDefinitions,
    rewards,
    traitCatalog,
    keepsakes,
  );
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
  validateLifecycleBindings(rooms, roomLifecycleProfiles, traitCatalog.traits, rewards);
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
    traitGivers: traitCatalog.givers,
    echoLastRunBoon: traitCatalog.echoLastRunBoon,
    traitOfferContexts: traitCatalog.offerContexts,
    traitRarityOrder: traitCatalog.rarityOrder,
    traitElements: traitCatalog.elements,
    traitBaseElements: traitCatalog.baseElements,
  });
}
