import type { SemanticAddress } from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import {
  requirementEvidence,
  type RequirementEvaluationEvidence,
} from '../../requirements/evidence';
import {
  ORDINARY_SOURCE_CAP,
  ordinarySourceGameNames,
  storeEntryOnRoute,
  type CountedOfferTransitionOptions,
  type ResolvedRewardOffer,
  type RewardBagState,
  type RewardKernelCatalog,
  type RewardKernelFacts,
  type RewardStoreDeclaration,
} from '../../reward-kernel';
import { countedOfferExclusion } from '../../reward-kernel/bag';
import {
  DEVOTION_REQUIRED_SOURCES,
  devotionPairShortfall,
  sourceSupportExclusion,
} from '../../reward-kernel/support';

/** Why a producer cannot offer a reward; params only, copy is the application's. */
export type RewardOfferExclusionReason =
  | { readonly kind: 'notInStore'; readonly rewardType: string; readonly storeKey: string | null }
  | {
      readonly kind: 'offRoute';
      readonly rewardType: string;
      readonly storeKey: string;
      readonly routeKey: string;
    }
  /** The producer always offers `rewardType`. */
  | { readonly kind: 'rewardTypeFixed'; readonly rewardType: string }
  | { readonly kind: 'excludedByProducer'; readonly rewardType: string }
  /** Echo repeats its agreed offer exactly. */
  | { readonly kind: 'replayFixed'; readonly offer: ResolvedRewardOffer }
  | { readonly kind: 'forcedReward'; readonly offer: ResolvedRewardOffer }
  | { readonly kind: 'olympianProviderForced'; readonly providerKey: string }
  /** A queued reward priority must be offered first. */
  | { readonly kind: 'priorityRequired'; readonly rewardType: string; readonly storeKey: string }
  | {
      readonly kind: 'peerConflict';
      readonly peers: readonly {
        readonly origin: SemanticAddress;
        readonly offer: ResolvedRewardOffer;
      }[];
    }
  | {
      readonly kind: 'godCap';
      readonly source: string;
      readonly acquiredSources: readonly string[];
      readonly cap: number;
    }
  | {
      readonly kind: 'godRequirement';
      readonly source: string;
      readonly evaluation: RequirementEvaluationEvidence;
    }
  | { readonly kind: 'godNotInteracted'; readonly source: string }
  /** `sources`: the pair's unacquired gods; `acquiredSources`: the pair domain's acquired gods. */
  | {
      readonly kind: 'devotionSourceNotAcquired';
      readonly sources: readonly string[];
      readonly acquiredSources: readonly string[];
      readonly required: number;
    }
  | {
      readonly kind: 'entryRequirement';
      readonly rewardType: string;
      readonly storeKey: string;
      readonly evaluation: RequirementEvaluationEvidence;
    }
  | { readonly kind: 'entriesSpent'; readonly rewardType: string; readonly storeKey: string }
  /** No option of the Shop slot's group stocks the offer. */
  | { readonly kind: 'notInShop'; readonly profileKey: string; readonly slotIndex: number }
  | {
      readonly kind: 'shopOptionRequirement';
      readonly optionKey: string;
      readonly rewardType: string;
      readonly evaluation: RequirementEvaluationEvidence;
    }
  /** Travel Deal or Echo removes this purchase from the restock. */
  | { readonly kind: 'shopExcluded'; readonly name: string }
  /** The Infernal Contract item needs its boon equipped. */
  | { readonly kind: 'contractNotEquipped' }
  /** Both refills found nothing eligible, so only the fallback reward is offered. */
  | {
      readonly kind: 'storeExhausted';
      readonly storeKey: string;
      readonly fallbackRewardType: string;
    };

/** A cause that is the whole answer, such as one the producer fixes. */
export function staticRewardOfferExclusion(
  reason: RewardOfferExclusionReason,
): readonly RewardOfferExclusionReason[] {
  return Object.freeze([Object.freeze({ ...reason })]);
}

/** The reached state's first failing gate; none when it explains nothing or no state is reached. */
export function reachedRewardOfferExclusion(
  reason: RewardOfferExclusionReason | undefined,
): readonly RewardOfferExclusionReason[] | undefined {
  return reason === undefined ? undefined : staticRewardOfferExclusion(reason);
}

/** God-source reasons for a locally valid offer unsupported without peers. */
export function sourceSupportReason(
  catalog: RewardKernelCatalog,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
  resolution: 'offer' | { readonly acquisitionRole: string },
): RewardOfferExclusionReason | undefined {
  const code = sourceSupportExclusion(catalog, offer, facts, resolution);
  const payload = offer.payload;
  if (code === undefined || payload === undefined) return undefined;
  const acquired = facts.requirements.records.lootTypeHistory;
  if (code === 'devotionSourceNotAcquired') {
    const shortfall = devotionPairShortfall(catalog, offer, facts);
    return shortfall === undefined
      ? undefined
      : { kind: code, ...shortfall, required: DEVOTION_REQUIRED_SOURCES };
  }
  if (payload.kind !== 'BoonSource') return undefined;
  const source = payload.source;
  switch (code) {
    case 'godCap':
      return {
        kind: code,
        source,
        acquiredSources: ordinarySourceGameNames(catalog).filter(
          (name) => (acquired[name] ?? 0) > 0,
        ),
        cap: ORDINARY_SOURCE_CAP,
      };
    case 'godRequirement': {
      const requirement = catalog.acquisitions.byKey[source]?.lootRequirement;
      return requirement === undefined
        ? undefined
        : { kind: code, source, evaluation: requirementEvidence(requirement, facts.requirements) };
    }
    case 'godNotInteracted':
      return { kind: code, source };
  }
}

/** Counted-bag reasons for an offer with no draw from its store. */
export function countedBagReason(
  catalog: RewardKernelCatalog,
  store: RewardStoreDeclaration,
  bag: RewardBagState,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions,
  peers: readonly { readonly origin: SemanticAddress; readonly offer: ResolvedRewardOffer }[],
): RewardOfferExclusionReason | undefined {
  const storeKey = store.key;
  const exclusion = countedOfferExclusion(store, bag, offer, facts, options);
  switch (exclusion?.kind) {
    case undefined:
      return undefined;
    case 'storeExhausted':
      return {
        kind: 'storeExhausted',
        storeKey,
        fallbackRewardType: catalog.countedStoreFallbackRewardType,
      };
    case 'entriesSpent':
      return { kind: 'entriesSpent', rewardType: offer.rewardType, storeKey };
    case 'excludedByProducer':
      return { kind: 'excludedByProducer', rewardType: offer.rewardType };
    case 'peerConflict':
      return {
        kind: 'peerConflict',
        peers: peers
          .filter((peer) => peer.offer.rewardType === offer.rewardType)
          .map(({ origin, offer: peer }) => ({ origin, offer: peer })),
      };
    case 'entryRequirement':
      return exclusion.entry.requirement === undefined
        ? undefined
        : {
            kind: 'entryRequirement',
            rewardType: offer.rewardType,
            storeKey,
            evaluation: requirementEvidence(exclusion.entry.requirement, facts.requirements),
          };
  }
}

/**
 * Store membership, route scope and binding filters of a counted offer; they
 * hold for every branch.
 */
export function staticCountedOfferExclusion(
  catalog: Catalog,
  binding: CountedRewardBinding | undefined,
  storeKey: string | undefined,
  offer: ResolvedRewardOffer,
  routeKey: string,
): RewardOfferExclusionReason | undefined {
  const { rewardType } = offer;
  if (
    binding === undefined ||
    rewardType === catalog.rewards.countedStoreFallbackRewardType ||
    binding.forcedRewards?.some((forced) => forced.offer.rewardType === rewardType) === true
  )
    return undefined;
  if (
    (binding.eligibleRewardTypes.length > 0 && !binding.eligibleRewardTypes.includes(rewardType)) ||
    binding.ineligibleRewardTypes.includes(rewardType)
  )
    return { kind: 'excludedByProducer', rewardType };
  const store =
    storeKey === undefined || !binding.storeKeys.includes(storeKey)
      ? undefined
      : catalog.rewards.stores.byKey[storeKey];
  const entries = store?.entries.filter((entry) => entry.rewardType === rewardType) ?? [];
  if (store === undefined || entries.length === 0)
    return { kind: 'notInStore', rewardType, storeKey: storeKey ?? null };
  return entries.some((entry) => storeEntryOnRoute(entry, routeKey))
    ? undefined
    : { kind: 'offRoute', rewardType, storeKey: store.key, routeKey };
}

/**
 * One branch's first failing `consumeCountedOffer` gate for a producer without
 * peers: store exhaustion, then source support, then the offer's entries.
 */
export function peerlessCountedOfferReason(
  catalog: RewardKernelCatalog,
  store: RewardStoreDeclaration,
  bag: RewardBagState,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions,
): RewardOfferExclusionReason | undefined {
  const bagReason = countedBagReason(catalog, store, bag, offer, facts, options, []);
  if (bagReason?.kind === 'storeExhausted')
    return offer.rewardType === catalog.countedStoreFallbackRewardType
      ? sourceSupportReason(catalog, offer, facts, 'offer')
      : bagReason;
  const source = sourceSupportReason(catalog, offer, facts, 'offer');
  if (source !== undefined) return source;
  if (bagReason !== undefined) return bagReason;
  // Only the final fallback offers a reward the store does not stock.
  return store.entries.some((entry) => entry.rewardType === offer.rewardType)
    ? undefined
    : { kind: 'notInStore', rewardType: offer.rewardType, storeKey: store.key };
}
