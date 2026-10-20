import type { SemanticAddress } from '../../authored-project/addresses';
import {
  requirementEvidence,
  type RequirementEvaluationEvidence,
} from '../../requirements/evidence';
import {
  countedOfferExclusion,
  ORDINARY_SOURCE_CAP,
  ordinarySourceGameNames,
  sourceSupportExclusion,
  type CountedOfferTransitionOptions,
  type ResolvedRewardOffer,
  type RewardBagState,
  type RewardKernelCatalog,
  type RewardKernelFacts,
  type RewardStoreDeclaration,
} from '../../reward-kernel';

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
  | { readonly kind: 'devotionSourceNotAcquired'; readonly sources: readonly string[] }
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

/** `allBranches`: the reason holds in every reached branch, not only some earlier rolls. */
export type RewardOfferExclusionEvidence = RewardOfferExclusionReason & {
  readonly allBranches: boolean;
};

export type RewardOfferExclusionKind = RewardOfferExclusionReason['kind'];

/** Tie-break order among equally cited reasons, following the offer gates. */
const KIND_PRECEDENCE: readonly RewardOfferExclusionKind[] = [
  'notInStore',
  'notInShop',
  'offRoute',
  'rewardTypeFixed',
  'excludedByProducer',
  'contractNotEquipped',
  'shopExcluded',
  'forcedReward',
  'olympianProviderForced',
  'peerConflict',
  'godCap',
  'godRequirement',
  'godNotInteracted',
  'devotionSourceNotAcquired',
  'priorityRequired',
  'shopOptionRequirement',
  'entryRequirement',
  'entriesSpent',
  'storeExhausted',
];

const STATIC_KINDS: ReadonlySet<RewardOfferExclusionKind> = new Set([
  'notInStore',
  'notInShop',
  'offRoute',
  'rewardTypeFixed',
  'excludedByProducer',
]);

const MAXIMUM_EXCLUSIONS = 2;

/** A cause that holds in every branch and is the whole answer. */
export function staticRewardOfferExclusion(
  reason: RewardOfferExclusionReason,
): readonly RewardOfferExclusionEvidence[] {
  return Object.freeze([Object.freeze({ ...reason, allBranches: true })]);
}

interface Tally {
  readonly reason: RewardOfferExclusionReason;
  cited: number;
  everywhere: number;
}

function ranked(
  tallies: ReadonlyMap<string, Tally>,
  groups: number,
): readonly RewardOfferExclusionEvidence[] | undefined {
  let entries = [...tallies.values()];
  if (entries.length === 0) return undefined;
  if (entries.some((entry) => STATIC_KINDS.has(entry.reason.kind)))
    entries = entries.filter((entry) => STATIC_KINDS.has(entry.reason.kind));
  entries.sort(
    (left, right) =>
      right.cited - left.cited ||
      KIND_PRECEDENCE.indexOf(left.reason.kind) - KIND_PRECEDENCE.indexOf(right.reason.kind),
  );
  return Object.freeze(
    entries
      .slice(0, MAXIMUM_EXCLUSIONS)
      .map((entry) => Object.freeze({ ...entry.reason, allBranches: entry.everywhere === groups })),
  );
}

function tally(
  tallies: Map<string, Tally>,
  reason: RewardOfferExclusionReason,
  everywhere: boolean,
): void {
  const key = JSON.stringify(reason);
  const entry = tallies.get(key) ?? { reason, cited: 0, everywhere: 0 };
  entry.cited += 1;
  if (everywhere) entry.everywhere += 1;
  tallies.set(key, entry);
}

/**
 * Aggregates each reached branch's first failing gate; an unexplained branch
 * still counts as reached.
 */
export function aggregateRewardOfferExclusions(
  branchReasons: readonly (RewardOfferExclusionReason | undefined)[],
): readonly RewardOfferExclusionEvidence[] | undefined {
  const tallies = new Map<string, Tally>();
  for (const reason of branchReasons) if (reason !== undefined) tally(tallies, reason, true);
  return ranked(tallies, branchReasons.length);
}

/**
 * Combines candidate results over branch cohorts. A supported cohort cites
 * nothing, so its reasons cannot hold in every branch.
 */
export function mergeRewardOfferExclusions(
  results: readonly { readonly exclusions?: readonly RewardOfferExclusionEvidence[] }[],
): readonly RewardOfferExclusionEvidence[] | undefined {
  const tallies = new Map<string, Tally>();
  for (const result of results)
    for (const { allBranches, ...reason } of result.exclusions ?? [])
      tally(tallies, reason as RewardOfferExclusionReason, allBranches);
  return ranked(tallies, results.length);
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
  if (code === 'devotionSourceNotAcquired')
    return payload.kind === 'DevotionPair'
      ? {
          kind: code,
          sources: [payload.chosenSource, payload.spurnedSource].filter(
            (source) => (acquired[source] ?? 0) === 0,
          ),
        }
      : undefined;
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
