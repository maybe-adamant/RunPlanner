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

/** Entries of one reward type a counted draw could take now. */
export interface CountedStoreTypeStanding {
  /**
   * Eligible entries left in the bag the draw sees, after any refill it would
   * make; a refill appends a base set, so this can exceed one set's count.
   */
  readonly remaining: number;
}

/** Undefined when the route's store holds no entry of the type. */
export function countedStoreTypeStanding(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  rewardType: string,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions = {},
): CountedStoreTypeStanding | undefined {
  const routeKey = facts.requirements.routeKey;
  const declared = store.entries.some(
    (entry) => entry.rewardType === rewardType && storeEntryOnRoute(entry, routeKey),
  );
  if (!declared) return undefined;
  const { bag, eligible } = refilledFrontier(store, state, facts, options);
  const remaining = eligible.reduce(
    (sum, index) =>
      store.entries[index]!.rewardType === rewardType
        ? sum + (bag.remainingEntryCounts[index] ?? 0)
        : sum,
    0,
  );
  return Object.freeze({ remaining });
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

/** The bag after drawing `offer`, or undefined when no eligible entry supports it. */
export function consumeCountedOffer(
  catalog: RewardKernelCatalog,
  store: RewardStoreDeclaration,
  state: RewardBagState,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions = {},
): RewardBagState | undefined {
  const { bag: current, eligible } = refilledFrontier(store, state, facts, options);
  if (eligible.length === 0) {
    // The final fallback offers its reward without drawing from the refilled bag.
    return offer.rewardType === catalog.countedStoreFallbackRewardType &&
      isOfferSupportedAtResolutionPoint(catalog, offer, facts, 'offer')
      ? current
      : undefined;
  }

  const forced =
    offer.payload?.kind === 'BoonSource' && offer.payload.source === options.forcedBoonSource;
  if (
    !forced &&
    !isOfferSupportedAtResolutionPoint(catalog, offer, facts, 'offer', options.peers)
  ) {
    return undefined;
  }

  return drawCanonicalEntry(store, current, eligible, offer.rewardType);
}

/** Removes the canonical eligible entry of one reward type, or undefined when none is eligible. */
function drawCanonicalEntry(
  store: RewardStoreDeclaration,
  current: RewardBagState,
  eligible: readonly number[],
  rewardType: string,
): RewardBagState | undefined {
  // Same-item entries eligible together never diverge (a catalog-compiler guard), so the last is canonical.
  const entryIndex = eligible.findLast((index) => store.entries[index]?.rewardType === rewardType);
  if (entryIndex === undefined) return undefined;
  const counts = [...current.remainingEntryCounts];
  counts[entryIndex] = (counts[entryIndex] ?? 0) - 1;
  return Object.freeze({ remainingEntryCounts: Object.freeze(counts) });
}

/**
 * A bag-only draw for a roll that is never offered or acquired: when every
 * eligible entry (after the usual refills) shares one reward type, the bag
 * after removing that type's canonical entry; undefined when the type is not
 * determined.
 */
export function drawSoleEligibleRewardType(
  store: RewardStoreDeclaration,
  state: RewardBagState,
  facts: RewardKernelFacts,
  options: CountedOfferTransitionOptions = {},
): { readonly rewardType: string; readonly bag: RewardBagState } | undefined {
  const { bag, eligible } = refilledFrontier(store, state, facts, options);
  const rewardTypes = [...new Set(eligible.map((index) => store.entries[index]!.rewardType))];
  const rewardType = rewardTypes[0];
  if (rewardType === undefined || rewardTypes.length !== 1) return undefined;
  const drawn = drawCanonicalEntry(store, bag, eligible, rewardType);
  return drawn === undefined ? undefined : Object.freeze({ rewardType, bag: drawn });
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
