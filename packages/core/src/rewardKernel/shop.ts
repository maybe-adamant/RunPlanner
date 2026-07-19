import { evaluateRequirement } from '../requirementEvaluator';
import { applyConcreteAcquisition, factsWithHistory, resolveAcquisitionRole } from './history';
import type {
  AuthoredShopOffer,
  RewardHistoryState,
  RewardKernelCatalog,
  RewardKernelFacts,
  ShopGenerationWitness,
  ShopOptionEntry,
  ShopProfileDeclaration,
  ShopPurchaseResult,
} from './model';
import { isOfferSupportedAtResolutionPoint } from './support';

function optionSupportsOffer(
  catalog: RewardKernelCatalog,
  option: ShopOptionEntry,
  authored: AuthoredShopOffer,
  facts: RewardKernelFacts,
): boolean {
  return (
    option.defaultOffer.rewardType === authored.offer.rewardType &&
    (option.requirement === undefined ||
      evaluateRequirement(option.requirement, facts.requirements)) &&
    isOfferSupportedAtResolutionPoint(catalog, authored.offer, facts, 'offer')
  );
}

function assignments(
  catalog: RewardKernelCatalog,
  options: readonly ShopOptionEntry[],
  authored: readonly AuthoredShopOffer[],
  facts: RewardKernelFacts,
  used: ReadonlySet<string> = new Set(),
): readonly (readonly string[])[] {
  const current = authored[0];
  if (current === undefined) {
    return [[]];
  }
  return options.flatMap((option) => {
    if (used.has(option.key) || !optionSupportsOffer(catalog, option, current, facts)) {
      return [];
    }
    const nextUsed = new Set(used);
    nextUsed.add(option.key);
    return assignments(catalog, options, authored.slice(1), facts, nextUsed).map((tail) => [
      option.key,
      ...tail,
    ]);
  });
}

export function findShopGenerationWitnesses(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  authored: readonly AuthoredShopOffer[],
  facts: RewardKernelFacts,
): readonly ShopGenerationWitness[] {
  if (authored.length !== profile.slotCount) {
    return [];
  }
  let offset = 0;
  let witnesses: readonly (readonly string[])[] = [[]];
  for (const group of profile.groups.values) {
    const groupAuthored = authored.slice(offset, offset + group.offerCount);
    offset += group.offerCount;
    const groupAssignments = assignments(catalog, group.options.values, groupAuthored, facts);
    witnesses = witnesses.flatMap((prefix) =>
      groupAssignments.map((assignment) => [...prefix, ...assignment]),
    );
  }
  return witnesses.map((optionKeys) => Object.freeze({ optionKeys: Object.freeze(optionKeys) }));
}

function permutations(values: readonly number[]): readonly (readonly number[])[] {
  if (values.length <= 1) {
    return [values];
  }
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [
      value,
      ...tail,
    ]),
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

function historyKey(history: RewardHistoryState): string {
  const canonicalRecord = (record: Readonly<Record<string, number>>) =>
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    offerHistory: history.offerHistory,
    useRecord: canonicalRecord(history.useRecord),
    biomeUseRecord: canonicalRecord(history.biomeUseRecord),
    currentRoomUseRecord: canonicalRecord(history.currentRoomUseRecord),
    lootTypeHistory: canonicalRecord(history.lootTypeHistory),
    lootBiomeRecord: canonicalRecord(history.lootBiomeRecord),
    consumableRecord: canonicalRecord(history.consumableRecord),
    upgradableTraitCount: history.upgradableTraitCount,
    lastDevotionDepth: history.lastDevotionDepth,
  });
}

export function simulateShopPurchases(
  catalog: RewardKernelCatalog,
  profile: ShopProfileDeclaration,
  authored: readonly AuthoredShopOffer[],
  witness: ShopGenerationWitness,
  initialHistory: RewardHistoryState,
  baseFacts: RewardKernelFacts,
): readonly ShopPurchaseResult[] {
  const generationFacts = factsWithHistory(baseFacts, initialHistory, new Set());
  const witnessIsValid = findShopGenerationWitnesses(
    catalog,
    profile,
    authored,
    generationFacts,
  ).some(
    (candidate) =>
      candidate.optionKeys.length === witness.optionKeys.length &&
      candidate.optionKeys.every((optionKey, index) => optionKey === witness.optionKeys[index]),
  );
  if (!witnessIsValid) {
    return [];
  }
  const purchasedIndexes = authored.flatMap((offer, index) => (offer.purchased ? [index] : []));
  const results = new Map<string, ShopPurchaseResult>();
  for (const order of permutations(purchasedIndexes)) {
    let history = initialHistory;
    let possible = true;
    const remaining = new Set(authored.map((_, index) => index));
    for (const index of order) {
      const authoredOffer = authored[index];
      const optionKey = witness.optionKeys[index];
      const option =
        optionKey === undefined ? undefined : optionByWitness(profile, index, optionKey);
      if (authoredOffer === undefined || option === undefined) {
        possible = false;
        break;
      }
      const activeNames = new Set(
        [...remaining].flatMap((remainingIndex) => {
          const activeKey = witness.optionKeys[remainingIndex];
          const active =
            activeKey === undefined
              ? undefined
              : optionByWitness(profile, remainingIndex, activeKey);
          return active === undefined ? [] : [active.defaultOffer.rewardType];
        }),
      );
      const facts = factsWithHistory(baseFacts, history, activeNames);
      if (
        option.purchaseRequirement !== undefined &&
        !evaluateRequirement(option.purchaseRequirement, facts.requirements)
      ) {
        possible = false;
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
          break;
        }
        const event = resolveAcquisitionRole(
          catalog,
          authoredOffer.offer,
          binding.role,
          binding.lifecyclePoint,
        );
        history = applyConcreteAcquisition(catalog, history, event.acquisition);
      }
      if (!possible) {
        break;
      }
      remaining.delete(index);
    }
    if (possible) {
      const result = Object.freeze({ history, purchaseOrder: Object.freeze(order) });
      const key = historyKey(history);
      if (!results.has(key)) {
        results.set(key, result);
      }
    }
  }
  return [...results.values()];
}
