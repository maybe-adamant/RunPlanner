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
import { normalizeBiomeLayouts } from './layouts';
import { validateRoomLayoutClosure } from './room-layout-closure';
import { normalizeRooms } from './rooms';
import { normalizeRoomLifecycleProfiles } from './lifecycles';
import { normalizeRoutes } from './routes';
import { createRewardKernelCatalog } from './rewards/normalize';
import { createTraitCatalog } from './traits';
import { CatalogContractError, fail } from './errors';
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
    if (disposition.kind === 'echo' && disposition.effect === 'doubleShop') {
      for (const rewardType of disposition.excludedRewardTypes)
        if (rewards.rewardTypes.byKey[rewardType] === undefined)
          fail(
            `traits.${trait.key}.selectedDisposition.excludedRewardTypes`,
            `unknown reward type ${rewardType}`,
          );
      continue;
    }
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

function validateEchoGiftBindings(
  keepsakes: Catalog['keepsakes'],
  traits: Catalog['traits'],
): void {
  const gift = traits.byKey.EchoRepeatKeepsakeBoon?.selectedDisposition;
  if (gift?.kind !== 'echo' || gift.effect !== 'repeatKeepsake')
    fail('traits.EchoRepeatKeepsakeBoon', 'must declare Echo keepsake replay');
  const excluded = keepsakes.values
    .filter((keepsake) => keepsake.echoGift.availability === 'excluded')
    .map((keepsake) => keepsake.key);
  if (
    excluded.length !== gift.excludedKeepsakeKeys.length ||
    excluded.some((key) => !gift.excludedKeepsakeKeys.includes(key))
  )
    fail('traits.EchoRepeatKeepsakeBoon.selectedDisposition', 'must match keepsake exclusions');
}

function validateFixedAcquisitionTraitGrants(
  rewards: Catalog['rewards'],
  traits: Catalog['traits'],
): void {
  for (const acquisition of rewards.acquisitions.values) {
    if (acquisition.gameName === 'InfernalContractBoon') {
      if (
        acquisition.grantedTraitKey !== 'InfernalContractBoon' ||
        traits.byKey.InfernalContractBoon?.rarityDomain.kind !== 'none'
      )
        fail(
          'rewards.acquisitions.InfernalContractBoon',
          'must grant the rarityless contract trait',
        );
    } else if (acquisition.grantedTraitKey !== undefined) {
      fail(
        `rewards.acquisitions.${acquisition.gameName}.grantedTraitKey`,
        'fixed acquisition trait grants are reserved for Infernal Contract',
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
  validateFixedAcquisitionTraitGrants(rewards, traitCatalog.traits);
  const arcanaCards = normalizeArcanaCards(input.arcanaCards, traitCatalog.traits);
  const fearVows = normalizeFearVows(input.fearVows);
  const keepsakes = normalizeKeepsakes(input.keepsakes);
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
  validateLifecycleBindings(rooms, roomLifecycleProfiles, traitCatalog.traits, rewards);
  const biomeLayouts = normalizeBiomeLayouts(
    input.biomeLayouts,
    biomes,
    rooms,
    rewards.stores,
    exitTypes,
  );
  validateRoomLayoutClosure(rooms, biomeLayouts, exitCompatibilityPolicies);
  for (const reward of rewards.rewardTypes.values) {
    for (const role of reward.acquisitionRoles.values) {
      if (
        role.traitGiverKey !== undefined &&
        traitCatalog.givers.byKey[role.traitGiverKey] === undefined
      )
        fail(
          `rewards.rewardTypes.${reward.gameName}.${role.key}.traitGiverKey`,
          'references an unknown trait giver',
        );
    }
  }
  const trialRole = rewards.rewardTypes.byKey.TrialUpgrade?.acquisitionRoles.byKey.self;
  if (trialRole?.traitGiverKey !== 'Chaos')
    fail('rewards.rewardTypes.TrialUpgrade.self.traitGiverKey', 'must bind explicitly to Chaos');
  const bindings = input.traitCatalog.traitAcquisitionProviders;
  if (new Set(bindings.map((binding) => binding.gameName)).size !== bindings.length)
    fail('traitCatalog.traitAcquisitionProviders', 'contains duplicate game-name bindings');
  const traitGiverByAcquisitionGameName = Object.freeze(
    Object.fromEntries(
      bindings.map(({ gameName, giverKey }) => {
        if (traitCatalog.givers.byKey[giverKey] === undefined)
          fail(`traitCatalog.traitAcquisitionProviders.${gameName}`, 'references an unknown giver');
        return [gameName, giverKey];
      }),
    ),
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
    echoLastRunBoon: traitCatalog.echoLastRunBoon,
    traitOfferContexts: traitCatalog.offerContexts,
    traitRarityOrder: traitCatalog.rarityOrder,
    traitElements: traitCatalog.elements,
    traitBaseElements: traitCatalog.baseElements,
  });
}

function validateNemesisRandomEventContract(
  definitions: ReturnType<typeof normalizeEncounterDefinitions>,
  sets: ReturnType<typeof normalizeEncounterSets>,
  rewards: Catalog['rewards'],
): void {
  const event = definitions.byKey.NemesisRandomEvent;
  if (event === undefined || event.nemesisRandomEvent === undefined) {
    throw new CatalogContractError(
      'encounterDefinitions',
      'must declare the one NemesisRandomEvent descriptor',
    );
  }
  if (
    definitions.values.filter((definition) => definition.nemesisRandomEvent !== undefined)
      .length !== 1
  )
    throw new CatalogContractError(
      'encounterDefinitions',
      'must assign the Nemesis event policy to its sole identity',
    );
  if (definitions.values.filter((definition) => definition.suppressesIncomingReward).length !== 1)
    throw new CatalogContractError(
      'encounterDefinitions',
      'must assign incoming-reward suppression to its sole Nemesis identity',
    );
  const descriptor = event.nemesisRandomEvent;
  const eventResultTypes = [
    ...new Set([
      ...descriptor.freeItem.resultRewardTypes,
      ...descriptor.goldTrade.variants.map((variant) => variant.rewardType),
      ...descriptor.damageTrade.variants.map((variant) => variant.rewardType),
      descriptor.traitTrade.fixedResultRewardType,
      ...descriptor.damageContest.successResultRewardTypes,
      descriptor.damageContest.failureResultRewardType,
    ]),
  ].sort();
  if (
    event.kind !== 'nonCombat' ||
    event.countsEncounterDepth !== false ||
    event.npcPresentationKey !== 'Nemesis' ||
    event.requiresInteraction !== true ||
    event.canEncounterSkip !== false ||
    event.hostsGorgon !== false ||
    event.skipEndEncounterEffects !== false ||
    event.traitOfferProducer !== undefined ||
    event.sequenceEffect !== undefined ||
    event.suppressesIncomingReward !== true ||
    event.blocksGorgon !== true
  ) {
    throw new CatalogContractError(
      'encounterDefinitions.NemesisRandomEvent',
      'must retain its exact noncombat Nemesis interaction and suppression facts',
    );
  }
  const expectedSets = new Set([
    'FEncountersDefault',
    'GEncountersDefault',
    'HEncountersPassive',
    'HEncountersPassiveSmall',
  ]);
  for (const set of sets.values) {
    const contains = set.encounterDefinitionKeys.includes('NemesisRandomEvent');
    if (contains !== expectedSets.has(set.key)) {
      throw new CatalogContractError(
        `encounterSets.${set.key}`,
        'has invalid NemesisRandomEvent placement',
      );
    }
  }
  for (const [gameName, expected] of [
    ['EmptyMaxHealthDrop', { canDuplicate: true, goldConversionEligible: true }],
    ['HealDrop', { canDuplicate: true, goldConversionEligible: false }],
    ['RoomRewardConsolationPrize', { canDuplicate: true, goldConversionEligible: true }],
  ] as const) {
    const acquisition = rewards.acquisitions.byKey[gameName];
    if (
      acquisition === undefined ||
      acquisition.canDuplicate !== expected.canDuplicate ||
      (acquisition.goldConversionEligible === true) !== expected.goldConversionEligible ||
      acquisition.artificerConversionEligible === true ||
      acquisition.lastRewardRecreation !== undefined
    )
      throw new CatalogContractError(
        `rewards.acquisitions.${gameName}`,
        'must retain its audited Nemesis Sea Star, Time Piece, Artificer, and Echo capabilities',
      );
  }
  const lifecycle = rewards.producerLifecycles.byKey.NemesisEventPickup;
  if (
    lifecycle === undefined ||
    lifecycle.rewardTypes.values
      .map((reward) => reward.rewardType)
      .sort()
      .join('\u0000') !== eventResultTypes.join('\u0000') ||
    eventResultTypes.some(
      (rewardType) =>
        lifecycle.rewardTypes.byKey[rewardType]?.acquisitionLifecycle.some(
          (binding) => binding.blocksArtificerConversion !== true,
        ) !== false,
    )
  )
    throw new CatalogContractError(
      'rewards.producerLifecycles.NemesisEventPickup',
      'must block Artificer for every Nemesis result',
    );
}
