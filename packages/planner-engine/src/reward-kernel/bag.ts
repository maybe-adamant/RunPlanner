import { evaluateRequirement } from '../requirements/evaluator';
import type {
  CountedOfferTransitionOptions,
  ResolvedRewardOffer,
  RewardBagState,
  RewardKernelCatalog,
  RewardKernelFacts,
  RewardStoreDeclaration,
} from './model';
import { isOfferSupportedAtResolutionPoint } from './support';

export function createRewardBagState(store: RewardStoreDeclaration): RewardBagState {
  return Object.freeze({
    remainingEntryCounts: Object.freeze(store.entries.map(() => 1)),
  });
}

function entryIsEligible(
  store: RewardStoreDeclaration,
  entryIndex: number,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions,
): boolean {
  const entry = store.entries[entryIndex];
  if (entry === undefined) {
    return false;
  }
  if (
    options.eligibleRewardTypes !== undefined &&
    !options.eligibleRewardTypes.has(entry.rewardType)
  ) {
    return false;
  }
  if (options.ineligibleRewardTypes?.has(entry.rewardType) === true) {
    return false;
  }
  if (
    !entry.allowDuplicates &&
    options.peers?.priorOffers.some((peer) => peer.rewardType === entry.rewardType) === true
  ) {
    return false;
  }
  return (
    entry.requirement === undefined || evaluateRequirement(entry.requirement, facts.requirements)
  );
}

function eligibleIndexes(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions,
): readonly number[] {
  return store.entries.flatMap((_, index) =>
    (state.remainingEntryCounts[index] ?? 0) > 0 && entryIsEligible(store, index, facts, options)
      ? [index]
      : [],
  );
}

function refill(state: RewardBagState): RewardBagState {
  return Object.freeze({
    remainingEntryCounts: Object.freeze(
      state.remainingEntryCounts.map((remaining) => remaining + 1),
    ),
  });
}

function entrySemanticKey(store: RewardStoreDeclaration, index: number): string {
  const entry = store.entries[index];
  return JSON.stringify({
    rewardType: entry?.rewardType,
    allowDuplicates: entry?.allowDuplicates,
    requirement: entry?.requirement,
  });
}

function bagSemanticKey(store: RewardStoreDeclaration, state: RewardBagState): string {
  const totals = new Map<string, number>();
  store.entries.forEach((_, index) => {
    const count = state.remainingEntryCounts[index] ?? 0;
    if (count > 0) {
      const key = entrySemanticKey(store, index);
      totals.set(key, (totals.get(key) ?? 0) + count);
    }
  });
  return JSON.stringify({
    entries: [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)),
  });
}

export function consumeCountedOffer(
  catalog: RewardKernelCatalog,
  store: RewardStoreDeclaration,
  state: RewardBagState,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions = {},
): readonly RewardBagState[] {
  let current = state;
  let eligible = eligibleIndexes(store, current, facts, options);
  if (eligible.length === 0) {
    current = refill(current);
    eligible = eligibleIndexes(store, current, facts, options);
    if (eligible.length === 0) {
      throw new Error(`${store.key} violated the supported one-refill eligibility invariant`);
    }
  }

  if (!isOfferSupportedAtResolutionPoint(catalog, offer, facts, 'offer', options.peers)) {
    return [];
  }

  const states = eligible.flatMap((entryIndex) => {
    if (store.entries[entryIndex]?.rewardType !== offer.rewardType) {
      return [];
    }
    const counts = [...current.remainingEntryCounts];
    counts[entryIndex] = (counts[entryIndex] ?? 0) - 1;
    return [
      Object.freeze({
        remainingEntryCounts: Object.freeze(counts),
      }),
    ];
  });

  const unique = new Map<string, RewardBagState>();
  for (const next of states) {
    unique.set(bagSemanticKey(store, next), next);
  }
  return [...unique.values()];
}
