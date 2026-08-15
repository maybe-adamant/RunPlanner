import { evaluateRequirement } from '../requirements/evaluator';
import type { RequirementExpression } from '../requirements/model';
import { applyConcreteAcquisition, factsWithHistory, resolveAcquisitionRole } from './history';
import type {
  AuthoredShopOffer,
  RewardHistoryState,
  RewardKernelCatalog,
  RewardKernelFacts,
  ShopGenerationWitness,
  ShopGenerationSupport,
  ShopGenerationConstraints,
  ShopOptionEntry,
  ShopProfileDeclaration,
  ShopPurchaseAcquisition,
  ShopPurchaseFailure,
  ShopPurchaseResult,
  ShopPurchaseSimulation,
} from './model';
import { isOfferSupportedAtResolutionPoint, locallyValidRewardOffers } from './support';

function optionSupportsOffer(
  catalog: RewardKernelCatalog,
  option: ShopOptionEntry,
  authored: AuthoredShopOffer,
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>>,
  constraints: ShopGenerationConstraints,
): boolean {
  const additionalRequirement = additionalOptionRequirements[option.key];
  const excluded = constraints.excludedPurchaseInteractionNames;
  const resolvedSource =
    option.purchaseInteraction.kind === 'resolvedOfferSource' &&
    authored.offer.payload?.kind === 'BoonSource'
      ? authored.offer.payload.source
      : undefined;
  return (
    !excluded?.has(option.defaultOffer.rewardType) &&
    (resolvedSource === undefined || !excluded?.has(resolvedSource)) &&
    option.defaultOffer.rewardType === authored.offer.rewardType &&
    (option.requirement === undefined ||
      evaluateRequirement(option.requirement, facts.requirements)) &&
    (additionalRequirement === undefined ||
      evaluateRequirement(additionalRequirement, facts.requirements)) &&
    isOfferSupportedAtResolutionPoint(catalog, authored.offer, facts, 'offer')
  );
}

function optionSupportsOfferWithPeers(
  catalog: RewardKernelCatalog,
  option: ShopOptionEntry,
  authored: AuthoredShopOffer,
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>>,
  constraints: ShopGenerationConstraints,
  priorOffers: readonly import('./model').ResolvedRewardOffer[],
): boolean {
  const additionalRequirement = additionalOptionRequirements[option.key];
  const excluded = constraints.excludedPurchaseInteractionNames;
  const resolvedSource =
    option.purchaseInteraction.kind === 'resolvedOfferSource' &&
    authored.offer.payload?.kind === 'BoonSource'
      ? authored.offer.payload.source
      : undefined;
  return (
    !excluded?.has(option.defaultOffer.rewardType) &&
    (resolvedSource === undefined || !excluded?.has(resolvedSource)) &&
    option.defaultOffer.rewardType === authored.offer.rewardType &&
    (option.requirement === undefined ||
      evaluateRequirement(option.requirement, facts.requirements)) &&
    (additionalRequirement === undefined ||
      evaluateRequirement(additionalRequirement, facts.requirements)) &&
    isOfferSupportedAtResolutionPoint(catalog, authored.offer, facts, 'offer', { priorOffers })
  );
}

export function purchaseInteractionName(
  option: ShopOptionEntry,
  offer: import('./model').ResolvedRewardOffer,
): string | undefined {
  if (option.purchaseInteraction.kind === 'fixed') return option.purchaseInteraction.gameName;
  return offer.payload?.kind === 'BoonSource' ? offer.payload.source : undefined;
}

function assignments(
  catalog: RewardKernelCatalog,
  options: readonly ShopOptionEntry[],
  authored: readonly AuthoredShopOffer[],
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>>,
  constraints: ShopGenerationConstraints,
  used: ReadonlySet<string> = new Set(),
): readonly (readonly string[])[] {
  const current = authored[0];
  if (current === undefined) {
    return [[]];
  }
  return options.flatMap((option) => {
    if (
      used.has(option.key) ||
      !optionSupportsOffer(
        catalog,
        option,
        current,
        facts,
        additionalOptionRequirements,
        constraints,
      )
    ) {
      return [];
    }
    const nextUsed = new Set(used);
    nextUsed.add(option.key);
    return assignments(
      catalog,
      options,
      authored.slice(1),
      facts,
      additionalOptionRequirements,
      constraints,
      nextUsed,
    ).map((tail) => [option.key, ...tail]);
  });
}

export function evaluateShopGenerationSupport(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  authored: readonly AuthoredShopOffer[],
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>> = {},
  constraints: ShopGenerationConstraints = {},
): ShopGenerationSupport {
  if (authored.length !== profile.slotCount) {
    return Object.freeze({
      witnesses: Object.freeze([]),
      unsupportedSlotIndexes: Object.freeze([]),
      jointlyUnavailable: true,
    });
  }
  let offset = 0;
  let witnesses: readonly (readonly string[])[] = [[]];
  const unsupportedSlotIndexes: number[] = [];
  for (const group of profile.groups.values) {
    const groupAuthored = authored.slice(offset, offset + group.offerCount);
    groupAuthored.forEach((offer, groupIndex) => {
      if (
        !group.options.values.some((option) =>
          optionSupportsOffer(
            catalog,
            option,
            offer,
            facts,
            additionalOptionRequirements,
            constraints,
          ),
        )
      ) {
        unsupportedSlotIndexes.push(offset + groupIndex);
      }
    });
    offset += group.offerCount;
    const groupAssignments = assignments(
      catalog,
      group.options.values,
      groupAuthored,
      facts,
      additionalOptionRequirements,
      constraints,
    );
    witnesses = witnesses.flatMap((prefix) =>
      groupAssignments.map((assignment) => [...prefix, ...assignment]),
    );
  }
  const normalizedWitnesses = Object.freeze(
    witnesses.map((optionKeys) => Object.freeze({ optionKeys: Object.freeze(optionKeys) })),
  );
  return Object.freeze({
    witnesses: normalizedWitnesses,
    unsupportedSlotIndexes: Object.freeze(unsupportedSlotIndexes),
    jointlyUnavailable: normalizedWitnesses.length === 0 && unsupportedSlotIndexes.length === 0,
  });
}

export function findShopGenerationWitnesses(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  authored: readonly AuthoredShopOffer[],
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>> = {},
  constraints: ShopGenerationConstraints = {},
): readonly ShopGenerationWitness[] {
  return evaluateShopGenerationSupport(
    catalog,
    profile,
    authored,
    facts,
    additionalOptionRequirements,
    constraints,
  ).witnesses;
}

function existentialGroupAssignments(
  catalog: RewardKernelCatalog,
  options: readonly ShopOptionEntry[],
  offerCount: number,
  targetLocalIndex: number | undefined,
  targetOffer: AuthoredShopOffer,
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>>,
  constraints: ShopGenerationConstraints,
  position = 0,
  used: ReadonlySet<string> = new Set(),
  priorOffers: readonly import('./model').ResolvedRewardOffer[] = Object.freeze([]),
): readonly (readonly string[])[] {
  if (position === offerCount) return Object.freeze([Object.freeze([])]);
  return options.flatMap((option) => {
    if (used.has(option.key)) return [];
    const offers =
      position === targetLocalIndex
        ? Object.freeze([targetOffer.offer])
        : locallyValidRewardOffers(catalog, option.defaultOffer.rewardType);
    return offers.flatMap((offer) => {
      if (
        !optionSupportsOfferWithPeers(
          catalog,
          option,
          Object.freeze({ offer }),
          facts,
          additionalOptionRequirements,
          constraints,
          priorOffers,
        )
      )
        return [];
      const nextUsed = new Set(used);
      nextUsed.add(option.key);
      return existentialGroupAssignments(
        catalog,
        options,
        offerCount,
        targetLocalIndex,
        targetOffer,
        facts,
        additionalOptionRequirements,
        constraints,
        position + 1,
        nextUsed,
        Object.freeze([...priorOffers, offer]),
      ).map((tail) => Object.freeze([option.key, ...tail]));
    });
  });
}

/**
 * Regenerates a complete Shop profile existentially while fixing only one
 * indexed offer. Every peer slot is freshly chosen from its own declaration,
 * and repeated slots in one group retain option-level without-replacement.
 */
export function findShopIndexedGenerationWitnesses(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  slotIndex: number,
  offer: import('./model').ResolvedRewardOffer,
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>> = {},
  constraints: ShopGenerationConstraints = {},
): readonly ShopGenerationWitness[] {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= profile.slotCount)
    return Object.freeze([]);
  let offset = 0;
  let witnesses: readonly (readonly string[])[] = Object.freeze([Object.freeze([])]);
  for (const group of profile.groups.values) {
    const targetLocalIndex =
      slotIndex >= offset && slotIndex < offset + group.offerCount ? slotIndex - offset : undefined;
    const groupAssignments = existentialGroupAssignments(
      catalog,
      group.options.values,
      group.offerCount,
      targetLocalIndex,
      Object.freeze({ offer }),
      facts,
      additionalOptionRequirements,
      constraints,
    );
    witnesses = witnesses.flatMap((prefix) =>
      groupAssignments.map((assignment) => Object.freeze([...prefix, ...assignment])),
    );
    offset += group.offerCount;
  }
  const seen = new Set<string>();
  return Object.freeze(
    witnesses.flatMap((optionKeys) => {
      const key = JSON.stringify(optionKeys);
      if (seen.has(key)) return [];
      seen.add(key);
      return [Object.freeze({ optionKeys: Object.freeze([...optionKeys]) })];
    }),
  );
}

function optionByWitness(
  profile: ShopProfileDeclaration,
  slotIndex: number,
  optionKey: string,
): ShopOptionEntry | undefined {
  let offset = 0;
  for (const group of profile.groups.values) {
    if (slotIndex < offset + group.offerCount) {
      return group.options.byKey[optionKey];
    }
    offset += group.offerCount;
  }
  return undefined;
}

export function evaluateShopPurchases(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  authored: readonly AuthoredShopOffer[],
  witness: ShopGenerationWitness,
  entryOrder: readonly number[],
  initialHistory: RewardHistoryState,
  baseFacts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>> = {},
): ShopPurchaseSimulation {
  const generationFacts = factsWithHistory(baseFacts, initialHistory, new Set());
  const witnessIsValid = findShopGenerationWitnesses(
    catalog,
    profile,
    authored,
    generationFacts,
    additionalOptionRequirements,
  ).some(
    (candidate) =>
      candidate.optionKeys.length === witness.optionKeys.length &&
      candidate.optionKeys.every((optionKey, index) => optionKey === witness.optionKeys[index]),
  );
  if (!witnessIsValid) {
    return Object.freeze({
      results: Object.freeze([]),
      failures: Object.freeze([
        Object.freeze({ entryOrder: Object.freeze([]) }) satisfies ShopPurchaseFailure,
      ]),
    });
  }
  let history = initialHistory;
  let possible = true;
  let failedSlotIndex: number | undefined;
  const acquisitions: ShopPurchaseAcquisition[] = [];
  const remaining = new Set(authored.map((_, index) => index));
  for (const index of entryOrder) {
    const authoredOffer = authored[index];
    const optionKey = witness.optionKeys[index];
    const option = optionKey === undefined ? undefined : optionByWitness(profile, index, optionKey);
    if (authoredOffer === undefined || option === undefined || !remaining.has(index)) {
      possible = false;
      failedSlotIndex = index;
      break;
    }
    const activeNames = new Set(
      [...remaining].flatMap((remainingIndex) => {
        const activeKey = witness.optionKeys[remainingIndex];
        const active =
          activeKey === undefined ? undefined : optionByWitness(profile, remainingIndex, activeKey);
        return active === undefined ? [] : [active.defaultOffer.rewardType];
      }),
    );
    const facts = factsWithHistory(baseFacts, history, activeNames);
    if (
      option.purchaseRequirement !== undefined &&
      !evaluateRequirement(option.purchaseRequirement, facts.requirements)
    ) {
      possible = false;
      failedSlotIndex = index;
      break;
    }
    for (const binding of option.acquisitionLifecycle) {
      const roleFacts = factsWithHistory(baseFacts, history, activeNames);
      if (
        !isOfferSupportedAtResolutionPoint(catalog, authoredOffer.offer, roleFacts, {
          acquisitionRole: binding.role,
        })
      ) {
        possible = false;
        failedSlotIndex = index;
        break;
      }
      const event = resolveAcquisitionRole(
        catalog,
        authoredOffer.offer,
        binding.role,
        binding.lifecyclePoint,
      );
      history = applyConcreteAcquisition(catalog, history, event.acquisition);
      acquisitions.push(Object.freeze({ slotIndex: index, optionKey: option.key, event }));
    }
    if (!possible) break;
    remaining.delete(index);
  }
  if (!possible) {
    return Object.freeze({
      results: Object.freeze([]),
      failures: Object.freeze([
        Object.freeze({
          entryOrder: Object.freeze([...entryOrder]),
          ...(failedSlotIndex === undefined ? {} : { failedSlotIndex }),
        }),
      ]),
    });
  }
  const result = Object.freeze({
    history,
    entryOrder: Object.freeze([...entryOrder]),
    acquisitions: Object.freeze(acquisitions),
  }) satisfies ShopPurchaseResult;
  return Object.freeze({ results: Object.freeze([result]), failures: Object.freeze([]) });
}

/** Settles one exact paid physical Shop slot against an explicit remaining-slot frontier. */
export function evaluateShopPurchaseAtSlot(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  authored: readonly AuthoredShopOffer[],
  witness: ShopGenerationWitness,
  slotIndex: number,
  remainingSlotIndexes: readonly number[],
  initialHistory: RewardHistoryState,
  baseFacts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>> = {},
): import('./model').ShopSinglePurchaseResult | undefined {
  const remaining = new Set(remainingSlotIndexes);
  const authoredOffer = authored[slotIndex];
  const optionKey = witness.optionKeys[slotIndex];
  const option =
    optionKey === undefined ? undefined : optionByWitness(profile, slotIndex, optionKey);
  if (authoredOffer === undefined || option === undefined || !remaining.has(slotIndex))
    return undefined;
  const activeNames = new Set(
    [...remaining].flatMap((index) => {
      const key = witness.optionKeys[index];
      const active = key === undefined ? undefined : optionByWitness(profile, index, key);
      return active === undefined ? [] : [active.defaultOffer.rewardType];
    }),
  );
  const facts = factsWithHistory(baseFacts, initialHistory, activeNames);
  const additionalRequirement = additionalOptionRequirements[option.key];
  if (
    (option.purchaseRequirement !== undefined &&
      !evaluateRequirement(option.purchaseRequirement, facts.requirements)) ||
    (additionalRequirement !== undefined &&
      !evaluateRequirement(additionalRequirement, facts.requirements))
  )
    return undefined;
  let history = initialHistory;
  const acquisitions: ShopPurchaseAcquisition[] = [];
  for (const binding of option.acquisitionLifecycle) {
    const roleFacts = factsWithHistory(baseFacts, history, activeNames);
    if (
      !isOfferSupportedAtResolutionPoint(catalog, authoredOffer.offer, roleFacts, {
        acquisitionRole: binding.role,
      })
    )
      return undefined;
    const event = resolveAcquisitionRole(
      catalog,
      authoredOffer.offer,
      binding.role,
      binding.lifecyclePoint,
    );
    history = applyConcreteAcquisition(catalog, history, event.acquisition);
    acquisitions.push(Object.freeze({ slotIndex, optionKey: option.key, event }));
  }
  remaining.delete(slotIndex);
  return Object.freeze({
    history,
    acquisitions: Object.freeze(acquisitions),
    remainingSlotIndexes: Object.freeze([...remaining]),
  });
}

export function simulateShopPurchases(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  authored: readonly AuthoredShopOffer[],
  witness: ShopGenerationWitness,
  entryOrder: readonly number[],
  initialHistory: RewardHistoryState,
  baseFacts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>> = {},
): readonly ShopPurchaseResult[] {
  return evaluateShopPurchases(
    catalog,
    profile,
    authored,
    witness,
    entryOrder,
    initialHistory,
    baseFacts,
    additionalOptionRequirements,
  ).results;
}
