import { evaluateRequirement } from '../requirements/evaluator';
import type {
  CountedOfferTransitionOptions,
  ResolvedRewardOffer,
  RewardBagState,
  RewardKernelCatalog,
  RewardKernelFacts,
  RewardStoreDeclaration,
  RewardStoreEntry,
} from './model';
import { isOfferSupportedAtResolutionPoint } from './support';

/** Whether the route's bag holds this entry; fill and refill skip the others. */
export function storeEntryOnRoute(entry: RewardStoreEntry, routeKey: string | undefined): boolean {
  if (entry.routeKeys === undefined) return true;
  if (routeKey === undefined)
    throw new Error(`route-scoped ${entry.rewardType} store entry reached without route identity`);
  return entry.routeKeys.includes(routeKey);
}

export function createRewardBagState(
  store: RewardStoreDeclaration,
  routeKey: string,
): RewardBagState {
  return Object.freeze({
    remainingEntryCounts: Object.freeze(
      store.entries.map((entry) => (storeEntryOnRoute(entry, routeKey) ? 1 : 0)),
    ),
  });
}

/** Appends one complete base set only when no exact-name entry remains. */
export function insertExactPriorityIntoBag(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  rewardType: string,
  routeKey: string,
): RewardBagState {
  if (
    store.entries.some(
      (entry, index) =>
        entry.rewardType === rewardType && (state.remainingEntryCounts[index] ?? 0) > 0,
    )
  )
    return state;
  return refill(store, state, routeKey);
}

/** The first entry-level gate that keeps a counted store entry from being drawn. */
export type CountedEntryExclusion = 'excludedByProducer' | 'peerConflict' | 'entryRequirement';

function countedEntryExclusion(
  entry: RewardStoreEntry,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions,
): CountedEntryExclusion | undefined {
  if (
    (options.eligibleRewardTypes !== undefined &&
      !options.eligibleRewardTypes.has(entry.rewardType)) ||
    options.ineligibleRewardTypes?.has(entry.rewardType) === true
  ) {
    return 'excludedByProducer';
  }
  if (
    !entry.allowDuplicates &&
    options.peers?.priorOffers.some((peer) => peer.rewardType === entry.rewardType) === true
  ) {
    return 'peerConflict';
  }
  return entry.requirement === undefined ||
    evaluateRequirement(entry.requirement, facts.requirements)
    ? undefined
    : 'entryRequirement';
}

function entryIsEligible(
  store: RewardStoreDeclaration,
  entryIndex: number,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions,
): boolean {
  const entry = store.entries[entryIndex];
  return entry !== undefined && countedEntryExclusion(entry, facts, options) === undefined;
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

/** The deterministic planner disposition: first queued name with eligible exact support. */
export function oldestSupportedRewardPriority(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  priorities: readonly string[],
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions = {},
): string | undefined {
  if (priorities.length === 0) return undefined;
  // The final fallback returns before priorities are consulted.
  const { eligible } = refilledFrontier(store, state, facts, options);
  const supported = new Set(eligible.map((index) => store.entries[index]!.rewardType));
  return priorities.find((priority) => supported.has(priority));
}

/** Native ChooseRoomReward appends a full store copy per empty pass, at most twice. */
const MAXIMUM_STORE_REFILLS = 2;

function refilledFrontier(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions,
): { readonly bag: RewardBagState; readonly eligible: readonly number[] } {
  let bag = state;
  let eligible = eligibleIndexes(store, bag, facts, options);
  for (let refills = 0; eligible.length === 0 && refills < MAXIMUM_STORE_REFILLS; refills += 1) {
    bag = refill(store, bag, facts.requirements.routeKey);
    eligible = eligibleIndexes(store, bag, facts, options);
  }
  return { bag, eligible };
}

/** Whether both appended copies stay ineligible, so the offer is the final fallback. */
export function countedStoreExhausted(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions = {},
): boolean {
  return refilledFrontier(store, state, facts, options).eligible.length === 0;
}

function refill(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  routeKey: string | undefined,
): RewardBagState {
  return Object.freeze({
    remainingEntryCounts: Object.freeze(
      state.remainingEntryCounts.map(
        (remaining, index) =>
          remaining + (storeEntryOnRoute(store.entries[index]!, routeKey) ? 1 : 0),
      ),
    ),
  });
}

function entrySemanticKey(store: RewardStoreDeclaration, index: number): string {
  const entry = store.entries[index];
  const interchangeable =
    entry !== undefined && store.interchangeableRewardTypes?.includes(entry.rewardType) === true;
  return JSON.stringify({
    rewardType: entry?.rewardType,
    allowDuplicates: entry?.allowDuplicates,
    requirement: interchangeable ? undefined : entry?.requirement,
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
  const { bag: current, eligible } = refilledFrontier(store, state, facts, options);
  if (eligible.length === 0) {
    // The final fallback offers its reward without drawing from the refilled bag.
    return offer.rewardType === catalog.countedStoreFallbackRewardType &&
      isOfferSupportedAtResolutionPoint(catalog, offer, facts, 'offer')
      ? [current]
      : [];
  }

  const forced =
    offer.payload?.kind === 'BoonSource' && offer.payload.source === options.forcedBoonSource;
  if (
    !forced &&
    !isOfferSupportedAtResolutionPoint(catalog, offer, facts, 'offer', options.peers)
  ) {
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

/** Why a counted offer has no draw while its store still has eligible entries. */
export type CountedOfferExclusion =
  | { readonly kind: 'entriesSpent' }
  | { readonly kind: 'storeExhausted' }
  | { readonly kind: CountedEntryExclusion; readonly entry: RewardStoreEntry };

/**
 * Explains an empty `consumeCountedOffer` by the first gate of the offer's own
 * entries; an unspent entry's gate outranks a spent one.
 */
export function countedOfferExclusion(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions = {},
): CountedOfferExclusion | undefined {
  const { bag, eligible } = refilledFrontier(store, state, facts, options);
  if (eligible.length === 0) return Object.freeze({ kind: 'storeExhausted' });
  let first: CountedOfferExclusion | undefined;
  for (const [index, entry] of store.entries.entries()) {
    if (entry.rewardType !== offer.rewardType) continue;
    if ((bag.remainingEntryCounts[index] ?? 0) <= 0) {
      first ??= Object.freeze({ kind: 'entriesSpent' });
      continue;
    }
    const kind = countedEntryExclusion(entry, facts, options);
    if (kind === undefined) return undefined;
    if (first === undefined || first.kind === 'entriesSpent')
      first = Object.freeze({ kind, entry });
  }
  return first;
}
