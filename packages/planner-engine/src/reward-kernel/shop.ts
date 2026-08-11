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
  ShopOptionEntry,
  ShopProfileDeclaration,
  ShopPurchaseAcquisition,
  ShopPurchaseFailure,
  ShopPurchaseResult,
  ShopPurchaseSimulation,
} from './model';
import { isOfferSupportedAtResolutionPoint } from './support';

function optionSupportsOffer(
  catalog: RewardKernelCatalog,
  option: ShopOptionEntry,
  authored: AuthoredShopOffer,
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>>,
): boolean {
  const additionalRequirement = additionalOptionRequirements[option.key];
  return (
    option.defaultOffer.rewardType === authored.offer.rewardType &&
    (option.requirement === undefined ||
      evaluateRequirement(option.requirement, facts.requirements)) &&
    (additionalRequirement === undefined ||
      evaluateRequirement(additionalRequirement, facts.requirements)) &&
    isOfferSupportedAtResolutionPoint(catalog, authored.offer, facts, 'offer')
  );
}

function assignments(
  catalog: RewardKernelCatalog,
  options: readonly ShopOptionEntry[],
  authored: readonly AuthoredShopOffer[],
  facts: RewardKernelFacts,
  additionalOptionRequirements: Readonly<Record<string, RequirementExpression>>,
  used: ReadonlySet<string> = new Set(),
): readonly (readonly string[])[] {
  const current = authored[0];
  if (current === undefined) {
    return [[]];
  }
  return options.flatMap((option) => {
    if (
      used.has(option.key) ||
      !optionSupportsOffer(catalog, option, current, facts, additionalOptionRequirements)
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
          optionSupportsOffer(catalog, option, offer, facts, additionalOptionRequirements),
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
): readonly ShopGenerationWitness[] {
  return evaluateShopGenerationSupport(
    catalog,
    profile,
    authored,
    facts,
    additionalOptionRequirements,
  ).witnesses;
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
