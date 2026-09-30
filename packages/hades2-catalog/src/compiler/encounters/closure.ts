import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterSet,
  KeepsakeDeclaration,
  RouteDeclaration,
  TraitCatalog,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import { CatalogContractError, fail } from '../errors';
import {
  validateEncounterRequirementReferences,
  validateRequirementReferences,
} from '../requirements';

/** Customization route exclusions and route-keyed first-biome identities name declared routes. */
export function validateEncounterRouteReferences(
  definitions: CatalogCollection<EncounterDefinition>,
  sets: CatalogCollection<EncounterSet>,
  routes: CatalogCollection<RouteDeclaration>,
): void {
  sets.values.forEach((set, setIndex) =>
    set.authoringProfiles.forEach((profile, profileIndex) => {
      profile.routeKeys?.forEach((routeKey) => {
        if (routes.byKey[routeKey] === undefined)
          fail(
            `encounterSets[${setIndex}].authoringProfiles[${profileIndex}].routeKeys`,
            `unknown route ${routeKey}`,
          );
      });
      if (profile.resolution.kind !== 'rewardContext') return;
      for (const routeKey of Object.keys(
        profile.resolution.firstBiomeEncounterDefinitionKeyByRoute ?? {},
      ))
        if (routes.byKey[routeKey] === undefined)
          fail(
            `encounterSets[${setIndex}].authoringProfiles[${profileIndex}].resolution.firstBiomeEncounterDefinitionKeyByRoute`,
            `unknown route ${routeKey}`,
          );
    }),
  );
  definitions.values.forEach((definition, index) =>
    definition.customization?.forEach((decision, decisionIndex) => {
      if (decision.selection.kind !== 'single' && decision.selection.kind !== 'orderedPrefix')
        return;
      decision.selection.choices.forEach((choice, choiceIndex) =>
        choice.excludedRouteKeys?.forEach((routeKey, routeIndex) => {
          if (routes.byKey[routeKey] === undefined)
            fail(
              `encounterDefinitions[${index}].customization[${decisionIndex}].selection.choices[${choiceIndex}].excludedRouteKeys[${routeIndex}]`,
              `unknown route ${routeKey}`,
            );
        }),
      );
    }),
  );
}

export function validateEncounterDefinitionClosure(input: {
  readonly definitions: CatalogCollection<EncounterDefinition>;
  readonly rewards: RewardKernelCatalog;
  readonly traits: TraitCatalog;
  readonly keepsakes: CatalogCollection<KeepsakeDeclaration>;
}): void {
  const linkedIntroductions = new Set(
    input.definitions.values.flatMap((definition) =>
      (definition.customization ?? []).flatMap((decision) =>
        decision.selection.kind === 'generated'
          ? decision.selection.choices.flatMap((enemy) =>
              enemy.introductionEncounterKey === undefined ? [] : [enemy.introductionEncounterKey],
            )
          : [],
      ),
    ),
  );
  input.definitions.values.forEach((definition, index) => {
    if (definition.enemyTriggeredIntroduction === true && !linkedIntroductions.has(definition.key))
      fail(`encounterDefinitions[${index}].enemyTriggeredIntroduction`, 'names no trigger enemy');
    const path = `encounterDefinitions[${index}]`;
    definition.customization?.forEach((decision, decisionIndex) => {
      if (decision.selection.kind !== 'generated') return;
      const selection = decision.selection;
      [...selection.choices, ...(selection.generatedSeeds ?? [])].forEach((enemy) => {
        if (enemy.admission !== undefined)
          validateEncounterRequirementReferences(
            enemy.admission,
            input.definitions,
            `${path}.customization[${decisionIndex}].selection.${enemy.key}.admission`,
          );
        const key = enemy.introductionEncounterKey;
        if (key !== undefined && input.definitions.byKey[key] === undefined)
          fail(
            `${path}.customization[${decisionIndex}].selection`,
            `${enemy.key} names unknown introduction ${key}`,
          );
      });
    });
    for (const keepsakeKey of definition.blocksKeepsakeSelectionKeys ?? []) {
      if (input.keepsakes.byKey[keepsakeKey] === undefined)
        fail(`${path}.blocksKeepsakeSelectionKeys`, `unknown keepsake ${keepsakeKey}`);
    }
    if (definition.requirements !== undefined) {
      validateRequirementReferences(
        definition.requirements,
        input.rewards.rewardTypes,
        `${path}.requirements`,
      );
      validateEncounterRequirementReferences(
        definition.requirements,
        input.definitions,
        `${path}.requirements`,
      );
    }
    if (
      definition.traitOfferProducer !== undefined &&
      input.traits.givers.byKey[definition.traitOfferProducer.giverKey] === undefined
    )
      fail(
        `${path}.traitOfferProducer.giverKey`,
        `unknown trait giver ${definition.traitOfferProducer.giverKey}`,
      );
    const event = definition.nemesisRandomEvent;
    if (event === undefined) return;
    const assertRewardType = (rewardType: string, rewardPath: string) => {
      if (input.rewards.rewardTypes.byKey[rewardType] === undefined)
        fail(rewardPath, `unknown reward type ${rewardType}`);
    };
    event.goldTrade.variants.forEach((variant, variantIndex) =>
      assertRewardType(
        variant.rewardType,
        `${path}.nemesisRandomEvent.goldTrade[${variantIndex}].rewardType`,
      ),
    );
    event.damageTrade.variants.forEach((variant, variantIndex) =>
      assertRewardType(
        variant.rewardType,
        `${path}.nemesisRandomEvent.damageTrade[${variantIndex}].rewardType`,
      ),
    );
    event.freeItem.resultRewardTypes.forEach((rewardType) =>
      assertRewardType(rewardType, `${path}.nemesisRandomEvent.freeItem.resultRewardTypes`),
    );
    assertRewardType(
      event.traitTrade.fixedResultRewardType,
      `${path}.nemesisRandomEvent.traitTrade.fixedResultRewardType`,
    );
    [
      ...event.damageContest.successResultRewardTypes,
      event.damageContest.failureResultRewardType,
    ].forEach((rewardType) =>
      assertRewardType(rewardType, `${path}.nemesisRandomEvent.damageContest`),
    );
  });
}

export function validateEncounterSetClosure(
  sets: CatalogCollection<EncounterSet>,
  definitions: CatalogCollection<EncounterDefinition>,
  rewards: RewardKernelCatalog,
): void {
  sets.values.forEach((set, setIndex) => {
    set.encounterDefinitionKeys.forEach((definitionKey, definitionIndex) => {
      if (definitions.byKey[definitionKey] === undefined)
        fail(
          `encounterSets[${setIndex}].encounterDefinitionKeys[${definitionIndex}]`,
          `unknown encounter definition ${definitionKey}`,
        );
    });
    set.authoringProfiles.forEach((profile, profileIndex) => {
      if (profile.resolution.kind !== 'rewardContext') return;
      Object.keys(profile.resolution.encounterDefinitionKeyByRewardType).forEach((rewardType) => {
        if (rewards.rewardTypes.byKey[rewardType] === undefined)
          fail(
            `encounterSets[${setIndex}].authoringProfiles[${profileIndex}].resolution.encounterDefinitionKeyByRewardType.${rewardType}`,
            `unknown reward type ${rewardType}`,
          );
      });
    });
  });
}

/** Closes encounter relationships after envelopes, definitions, and sets exist. */
export function validateNemesisRandomEventContract(
  definitions: CatalogCollection<EncounterDefinition>,
  sets: CatalogCollection<EncounterSet>,
  rewards: RewardKernelCatalog,
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
