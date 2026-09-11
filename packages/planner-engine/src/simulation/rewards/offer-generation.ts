import type { Catalog, RoomDeclaration } from '../../catalog-schema';

import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';

import {
  applyOfferProjection,
  consumeCountedOffer,
  oldestSupportedRewardPriority,
  isOfferSupportedAtResolutionPoint,
  isPayloadLocallyValid,
  type RewardBagState,
  type ResolvedRewardOffer,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';

import type { CanonicalResolvedIncomingReward } from '../materialization';
import { type FindingEvidence, type RewardGenerationFindingCode } from '../model';
import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';
import { olympianProviderForOffer, consumeOlympianProviderMaterialized } from '../keepsakes';
import {
  appendRewardEvent,
  freezeRecord,
  mergeEquivalentRewardBranches,
  offerEvidence,
  type RewardBranchState,
} from './branch-primitives';
import { historyChronology, type RewardFactsFactory } from './acquisition-settlement';
import { withBag } from './branch-primitives';

import { addRewardFinding, rewardFinding } from './findings';

function semanticAddressEvidence(origin: SemanticAddress): FindingEvidence {
  return Object.freeze({ ...origin }) as FindingEvidence;
}

function resolvedOfferEvidence(offer: ResolvedRewardOffer): FindingEvidence {
  return Object.freeze({
    rewardType: offer.rewardType,
    ...(offer.payload === undefined
      ? {}
      : { payload: Object.freeze({ ...offer.payload }) as FindingEvidence }),
  });
}

function sourceConflictingPeers(
  offer: ResolvedRewardOffer,
  peers: readonly OfferProcessingPeer[],
): readonly OfferProcessingPeer[] {
  const source = offer.payload?.kind === 'BoonSource' ? offer.payload.source : undefined;
  const conflicts = peers.filter(
    (peer) =>
      source !== undefined &&
      peer.offer.payload?.kind === 'BoonSource' &&
      peer.offer.payload.source === source,
  );
  return conflicts.length === 0 ? peers : conflicts;
}

export function countedBinding(
  declaration: RoomDeclaration,
  incoming: CanonicalResolvedIncomingReward,
): CountedRewardBinding | undefined {
  if (incoming.producerKind === 'freeReward') {
    const policy = declaration.prebossBatchPolicy;
    const remaining = policy?.kind === 'takeOverNormalDoors' ? policy.remainingOffers : undefined;
    return remaining?.kind === 'counted' ? remaining.reward : undefined;
  }
  return declaration.incomingReward.kind === 'countedChoice'
    ? declaration.incomingReward
    : undefined;
}

export interface OfferProcessingContext {
  readonly catalog: Catalog;
  readonly reward: {
    readonly origin: SemanticAddress;
    readonly offer: ResolvedRewardOffer;
    readonly producerLifecycleKey: string;
    readonly requiredEntryKeys?: ReadonlySet<string>;
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
    readonly resolvedStoreKey?: string;
  };
  readonly binding?: CountedRewardBinding;
  readonly historySequence: number;
  /** Exact producer checkpoint used for first-blocking ordering. */
  readonly findingChronology?: FindingChronology;
  readonly peers: readonly OfferProcessingPeer[];
  readonly facts: RewardFactsFactory;
}

export interface OfferProcessingPeer {
  readonly origin: SemanticAddress;
  readonly offer: ResolvedRewardOffer;
}

function permutations<T>(values: readonly T[]): readonly (readonly T[])[] {
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

interface SourceOrderingFailure {
  readonly blocked: OfferProcessingContext;
  readonly prior: readonly OfferProcessingContext[];
}

function isSourceOrderingFailure(
  value: readonly OfferProcessingContext[] | SourceOrderingFailure,
): value is SourceOrderingFailure {
  return 'blocked' in value;
}

function sourceOrdering(
  branch: RewardBranchState,
  contexts: readonly OfferProcessingContext[],
): readonly OfferProcessingContext[] | SourceOrderingFailure {
  const sourceContexts = contexts.filter((context) => {
    const type = context.catalog.rewards.rewardTypes.byKey[context.reward.offer.rewardType];
    return type?.sourceSupport !== undefined && type.sourceResolution?.kind === 'offer';
  });
  const completeMask = (1 << sourceContexts.length) - 1;
  const failedMasks = new Set<number>();
  let failure: SourceOrderingFailure = Object.freeze({
    blocked: sourceContexts[0]!,
    prior: Object.freeze([]),
  });
  const visit = (mask: number): readonly OfferProcessingContext[] | undefined => {
    if (mask === completeMask) return Object.freeze([]);
    if (failedMasks.has(mask)) return undefined;
    const prior = sourceContexts.filter((_, offset) => (mask & (1 << offset)) !== 0);
    for (const [offset, context] of sourceContexts.entries()) {
      if ((mask & (1 << offset)) !== 0) continue;
      if (
        !isOfferSupportedAtResolutionPoint(
          context.catalog.rewards,
          context.reward.offer,
          context.facts(branch.history, undefined, branch),
          'offer',
          { priorOffers: prior.map((entry) => entry.reward.offer) },
        )
      ) {
        if (prior.length >= failure.prior.length) {
          failure = Object.freeze({ blocked: context, prior: Object.freeze(prior) });
        }
        continue;
      }
      const tail = visit(mask | (1 << offset));
      if (tail !== undefined) return Object.freeze([context, ...tail]);
    }
    failedMasks.add(mask);
    return undefined;
  };
  const orderedSources = visit(0);
  if (orderedSources === undefined) return failure;
  let sourceOffset = 0;
  return contexts.map((context) =>
    sourceContexts.includes(context) ? orderedSources[sourceOffset++]! : context,
  );
}

export function processRewardOffer(
  branches: readonly RewardBranchState[],
  context: OfferProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
  const { catalog, reward, historySequence, findingChronology } = context;
  const rewardType = catalog.rewards.rewardTypes.byKey[reward.offer.rewardType];
  if (
    rewardType === undefined ||
    !isPayloadLocallyValid(catalog.rewards, rewardType, reward.offer.payload)
  ) {
    addRewardFinding(
      findings,
      rewardFinding('rewardPayloadInvalid', reward.origin, offerEvidence(reward.offer)),
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
    return Object.freeze([]);
  }

  const next: RewardBranchState[] = [];
  let sawSourceFailure = false;
  let sawBagInvariantFailure = false;
  let sawSiblingFailure = false;
  const siblingConflicts = new Map<string, OfferProcessingPeer>();
  const recordSiblingConflict = (peer: OfferProcessingPeer) => {
    siblingConflicts.set(semanticAddressKey(peer.origin), peer);
  };
  for (const originalBranch of branches) {
    // ForceBoonName participates only in counted room-reward setup. Fixed
    // rewards, direct pickups, and inventory offers retain their own provider.
    const requiredProvider =
      context.binding === undefined
        ? undefined
        : requiredOlympianProviderForOffer(catalog, originalBranch, reward.offer, context.peers);
    // Provider pressure constrains the retained authored offer at its existing
    // reward owner.  It is deliberately not a runtime rewrite: an author can
    // repair the same payload control and no hidden forced-provider field is
    // introduced into authored state.
    if (
      requiredProvider !== undefined &&
      !offerContainsProvider(catalog, reward.offer, requiredProvider)
    ) {
      sawSourceFailure = true;
      continue;
    }
    const effectiveOffer = reward.offer;
    const facts = context.facts(originalBranch.history, undefined, originalBranch);
    const peers = { priorOffers: context.peers.map((peer) => peer.offer) };
    if (
      !isOfferSupportedAtResolutionPoint(catalog.rewards, effectiveOffer, facts, 'offer', peers)
    ) {
      sawSourceFailure = true;
      if (
        context.peers.length > 0 &&
        isOfferSupportedAtResolutionPoint(catalog.rewards, effectiveOffer, facts, 'offer', {
          priorOffers: [],
        })
      ) {
        sawSiblingFailure = true;
        sourceConflictingPeers(effectiveOffer, context.peers).forEach(recordSiblingConflict);
      }
      continue;
    }

    if (context.binding === undefined) {
      const history = applyOfferProjection(
        catalog.rewards,
        originalBranch.history,
        effectiveOffer,
        facts,
      );
      next.push(
        appendRewardEvent(Object.freeze({ ...originalBranch, history }), historySequence, {
          kind: 'rewardOffered',
          origin: reward.origin,
          offer: effectiveOffer,
          ...(reward.resolvedStoreKey === undefined ? {} : { storeKey: reward.resolvedStoreKey }),
        }),
      );
      continue;
    }

    const storeKey = reward.resolvedStoreKey;
    if (storeKey === undefined || !context.binding.storeKeys.includes(storeKey)) {
      sawBagInvariantFailure = true;
      continue;
    }
    const prepared = withBag(catalog, originalBranch, storeKey);
    const store = catalog.rewards.stores.byKey[storeKey];
    if (prepared === undefined || store === undefined) {
      sawBagInvariantFailure = true;
      continue;
    }
    const bagOptions = {
      ...(context.binding.eligibleRewardTypes.length === 0
        ? {}
        : { eligibleRewardTypes: new Set(context.binding.eligibleRewardTypes) }),
      ...(context.binding.ineligibleRewardTypes.length === 0
        ? {}
        : { ineligibleRewardTypes: new Set(context.binding.ineligibleRewardTypes) }),
      peers,
    };
    const requiredPriority = oldestSupportedRewardPriority(
      store,
      prepared.bag,
      originalBranch.rewardPriorities,
      facts,
      bagOptions,
    );
    if (requiredPriority !== undefined && effectiveOffer.rewardType !== requiredPriority) {
      sawBagInvariantFailure = true;
      continue;
    }
    if (
      context.peers.some((peer) => peer.offer.rewardType === effectiveOffer.rewardType) &&
      store.entries.some(
        (entry) => entry.rewardType === effectiveOffer.rewardType && !entry.allowDuplicates,
      )
    ) {
      sawSiblingFailure = true;
      context.peers
        .filter((peer) => peer.offer.rewardType === effectiveOffer.rewardType)
        .forEach(recordSiblingConflict);
    }
    let transitions: readonly RewardBagState[];
    try {
      transitions = consumeCountedOffer(
        catalog.rewards,
        store,
        prepared.bag,
        effectiveOffer,
        facts,
        bagOptions,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('one-refill eligibility invariant')) {
        sawBagInvariantFailure = true;
        continue;
      }
      throw error;
    }
    for (const bag of transitions) {
      const history = applyOfferProjection(
        catalog.rewards,
        prepared.branch.history,
        effectiveOffer,
        facts,
      );
      next.push(
        appendRewardEvent(
          Object.freeze({
            ...prepared.branch,
            bags: freezeRecord({ ...prepared.branch.bags, [storeKey]: bag }),
            rewardPriorities:
              requiredPriority === undefined
                ? prepared.branch.rewardPriorities
                : Object.freeze(
                    prepared.branch.rewardPriorities.filter(
                      (priority, index) =>
                        priority !== requiredPriority ||
                        index !== prepared.branch.rewardPriorities.indexOf(requiredPriority),
                    ),
                  ),
            history,
          }),
          historySequence,
          { kind: 'rewardOffered', origin: reward.origin, offer: effectiveOffer, storeKey },
        ),
      );
    }
  }

  if (next.length === 0) {
    const code: RewardGenerationFindingCode = sawSourceFailure
      ? 'rewardSourceUnavailable'
      : sawBagInvariantFailure
        ? 'rewardBagSupportEmpty'
        : 'rewardBagEntryUnavailable';
    addRewardFinding(
      findings,
      rewardFinding(code, reward.origin, {
        ...offerEvidence(reward.offer),
        storeKey: reward.resolvedStoreKey ?? null,
        ...(sawSiblingFailure
          ? {
              priorOffers: [...siblingConflicts.values()].map((peer) => ({
                origin: semanticAddressEvidence(peer.origin),
                offer: resolvedOfferEvidence(peer.offer),
              })),
            }
          : {}),
      }),
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
  }
  return Object.freeze(next);
}

/**
 * Computes the source-required provider payload without changing the retained
 * authored offer.  The caller reports disagreement at that offer's owner.
 */
function requiredOlympianProviderForOffer(
  catalog: Catalog,
  branch: RewardBranchState,
  offer: ResolvedRewardOffer,
  peers: readonly OfferProcessingPeer[],
): string | undefined {
  if (!branch.keepsakes.olympianSources.some((source) => source.remainingForceUses === 1))
    return undefined;
  const providerForLootSource = (source: string): string | undefined =>
    catalog.traitGiverByAcquisitionGameName[source];
  if (offer.rewardType === 'Boon' && offer.payload?.kind === 'BoonSource') {
    const siblingProviders = peers.flatMap((peer): readonly string[] =>
      peer.offer.rewardType === 'Boon' && peer.offer.payload?.kind === 'BoonSource'
        ? (() => {
            const provider = providerForLootSource(peer.offer.payload.source);
            return provider === undefined ? [] : [provider];
          })()
        : [],
    );
    const provider = olympianProviderForOffer(branch.keepsakes, siblingProviders);
    return provider;
  }
  if (offer.rewardType !== 'Devotion' || offer.payload?.kind !== 'DevotionPair') return undefined;
  const interactedProviders = new Set(
    Object.entries(catalog.traitGiverByAcquisitionGameName).flatMap(([source, giverKey]) =>
      branch.history.lootTypeHistory[source] !== undefined ? [giverKey] : [],
    ),
  );
  const provider = olympianProviderForOffer(branch.keepsakes, [], true, interactedProviders);
  return provider;
}

function offerContainsProvider(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  providerKey: string,
): boolean {
  if (offer.payload?.kind === 'BoonSource')
    return catalog.traitGiverByAcquisitionGameName[offer.payload.source] === providerKey;
  if (offer.payload?.kind === 'DevotionPair')
    return (
      catalog.traitGiverByAcquisitionGameName[offer.payload.chosenSource] === providerKey ||
      catalog.traitGiverByAcquisitionGameName[offer.payload.spurnedSource] === providerKey
    );
  return false;
}

function recordCanonicalOffer(
  branch: RewardBranchState,
  context: OfferProcessingContext,
): RewardBranchState {
  const facts = context.facts(branch.history, undefined, branch);
  const history = applyOfferProjection(
    context.catalog.rewards,
    branch.history,
    context.reward.offer,
    facts,
  );
  return appendRewardEvent(Object.freeze({ ...branch, history }), context.historySequence, {
    kind: 'rewardOffered',
    origin: context.reward.origin,
    offer: context.reward.offer,
    ...(context.reward.resolvedStoreKey === undefined
      ? {}
      : { storeKey: context.reward.resolvedStoreKey }),
  });
}

export function processOfferGenerationCohort(
  branches: readonly RewardBranchState[],
  contexts: readonly OfferProcessingContext[],
  findings: Map<string, FindingRegionEntry>,
  policy: {
    readonly ordering: 'allOffers' | 'sourceOffers';
    readonly atomicRegion?: string;
  },
): readonly RewardBranchState[] {
  if (contexts.length <= 1) {
    const context = contexts[0];
    return context === undefined ? branches : processRewardOffer(branches, context, findings);
  }
  const supported: RewardBranchState[] = [];
  let representativeFailures: readonly FindingRegionEntry[] = Object.freeze([]);
  for (const branch of branches) {
    const sourceResult =
      policy.ordering === 'sourceOffers' ? sourceOrdering(branch, contexts) : undefined;
    if (sourceResult !== undefined && isSourceOrderingFailure(sourceResult)) {
      const localFindings = new Map<string, FindingRegionEntry>();
      processRewardOffer(
        Object.freeze([branch]),
        {
          ...sourceResult.blocked,
          peers: Object.freeze(
            sourceResult.prior.map((context) => ({
              origin: context.reward.origin,
              offer: context.reward.offer,
            })),
          ),
        },
        localFindings,
      );
      if (representativeFailures.length === 0) {
        representativeFailures = Object.freeze([...localFindings.values()]);
      }
      continue;
    }
    const orderings =
      policy.ordering === 'allOffers'
        ? permutations(contexts)
        : Object.freeze([sourceResult ?? contexts]);
    for (const ordering of orderings) {
      let candidates: readonly RewardBranchState[] = Object.freeze([branch]);
      const localFindings = new Map<string, FindingRegionEntry>();
      const priorOffers: OfferProcessingPeer[] = [];
      for (const context of ordering) {
        candidates = processRewardOffer(
          candidates,
          { ...context, peers: Object.freeze([...priorOffers]) },
          localFindings,
        );
        if (candidates.length === 0) {
          break;
        }
        priorOffers.push({ origin: context.reward.origin, offer: context.reward.offer });
      }
      if (candidates.length === 0) {
        if (representativeFailures.length === 0) {
          representativeFailures = Object.freeze([...localFindings.values()]);
        }
        continue;
      }
      for (const candidate of candidates) {
        let canonical: RewardBranchState = Object.freeze({
          // Offer-order permutations may only contribute the candidate bag
          // state. The rest of the branch has already progressed through the
          // same history, traits, keepsakes, and evaluations; carrying the
          // whole candidate would replay that permutation-local evolution a
          // second time when canonical offers are recorded below.
          ...branch,
          bags: candidate.bags,
          rewardPriorities: candidate.rewardPriorities,
        });
        for (const context of contexts) {
          canonical = recordCanonicalOffer(canonical, context);
        }
        supported.push(canonical);
      }
    }
  }
  if (supported.length === 0) {
    for (const value of representativeFailures) {
      addRewardFinding(
        findings,
        value.finding,
        policy.atomicRegion ?? value.atomicRegion,
        value.chronology,
      );
    }
  }
  return mergeEquivalentRewardBranches(supported);
}

/**
 * Assess one new/edited participant after the board identities that are
 * already authored. Each supported peer contributes once to the generation
 * frontier and remains in the focused offer's unordered peer context; an
 * independently invalid peer is omitted so it cannot suppress an unrelated
 * repair. This is deliberately linear. Complete unordered-cohort validation
 * remains owned by `processOfferGenerationCohort`.
 */
export function processFocusedOfferAfterAuthoredPeers(
  branches: readonly RewardBranchState[],
  peerContexts: readonly OfferProcessingContext[],
  focusedContext: OfferProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
  let reached = branches;
  const acceptedPeers: OfferProcessingPeer[] = [];
  for (const context of peerContexts) {
    const peerFindings = new Map<string, FindingRegionEntry>();
    const next = processRewardOffer(
      reached,
      { ...context, peers: Object.freeze([]) },
      peerFindings,
    );
    if (next.length === 0) continue;
    reached = mergeEquivalentRewardBranches(next);
    acceptedPeers.push(
      Object.freeze({ origin: context.reward.origin, offer: context.reward.offer }),
    );
  }

  const focusedFindings = new Map<string, FindingRegionEntry>();
  const supported = processRewardOffer(
    reached,
    { ...focusedContext, peers: Object.freeze(acceptedPeers) },
    focusedFindings,
  );
  if (supported.length > 0) return supported;
  for (const value of focusedFindings.values()) {
    addRewardFinding(findings, value.finding, value.atomicRegion, value.chronology);
  }
  return Object.freeze([]);
}

/**
 * Returns the reached generated offer from the existing chronological ledger.
 * Materialization consumers use this instead of reinterpreting a retained
 * authored payload after a branch-local provider force has bound it.
 */
export function reachedOfferForOrigin(
  branch: RewardBranchState,
  origin: SemanticAddress,
): ResolvedRewardOffer | undefined {
  const key = semanticAddressKey(origin);
  for (const event of [...branch.events].reverse()) {
    if (event.kind === 'rewardOffered' && semanticAddressKey(event.origin) === key)
      return event.offer;
  }
  return undefined;
}

/** Exact normalized provider lookup for a concrete god-loot game name. */
export function traitProviderForLootSource(catalog: Catalog, source: string): string | undefined {
  return catalog.traitGiverByAcquisitionGameName[source];
}

/** Spend matching force only when this exact reached offer materializes as free loot. */
export function consumeOlympianProviderForReachedOffer(
  catalog: Catalog,
  branch: RewardBranchState,
  origin: SemanticAddress,
  provenance: 'free' | 'paid',
): RewardBranchState {
  if (
    provenance === 'paid' ||
    !branch.keepsakes.olympianSources.some((source) => source.remainingForceUses === 1)
  )
    return branch;
  const offer = reachedOfferForOrigin(branch, origin);
  const sources =
    offer?.payload?.kind === 'BoonSource'
      ? [offer.payload.source]
      : offer?.payload?.kind === 'DevotionPair'
        ? [offer.payload.chosenSource, offer.payload.spurnedSource]
        : [];
  const providers = sources.flatMap((source) => {
    const provider = traitProviderForLootSource(catalog, source);
    return provider === undefined ? [] : [provider];
  });
  return providers.reduce(
    (current, provider) =>
      Object.freeze({
        ...current,
        keepsakes: consumeOlympianProviderMaterialized(current.keepsakes, provider, provenance),
      }),
    branch,
  );
}
