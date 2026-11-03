import type { Catalog, RoomDeclaration } from '../../catalog-schema';

import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';

import {
  applyOfferProjection,
  consumeCountedOffer,
  countedStoreExhausted,
  countedStoreTypeStanding,
  drawSoleEligibleRewardType,
  oldestSupportedRewardPriority,
  isOfferSupportedAtResolutionPoint,
  isPayloadLocallyValid,
  sameRewardOffer,
  type CountedOfferTransitionOptions,
  type CountedStoreTypeStanding,
  type RewardBagState,
  type RewardPeerContext,
  type RewardStoreDeclaration,
  type ResolvedRewardOffer,
} from '../../reward-kernel';
import { sourceSupportExclusion } from '../../reward-kernel/support';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import { evaluateRequirement } from '../../requirements/evaluator';

import type { CanonicalResolvedIncomingReward } from '../materialization';
import type { FindingEvidence, RewardGenerationFindingCode } from '../model';
import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';
import {
  olympianProviderForOffer,
  consumeOlympianProviderMaterialized,
} from '../keepsakes/reward-effects';
import {
  appendRewardEvent,
  freezeRecord,
  offerEvidence,
  type RewardBranchState,
} from './branch-primitives';
import { historyChronology } from './findings';
import type { RewardFactsFactory } from './acquisition/contracts';
import { withBag } from './branch-primitives';

import { addRewardFinding, rewardFinding } from './findings';
import {
  reachedRewardOfferExclusion,
  countedBagReason,
  sourceSupportReason,
  staticCountedOfferExclusion,
  staticRewardOfferExclusion,
  type RewardOfferExclusionReason,
} from './offer-exclusions';

function semanticAddressEvidence(origin: SemanticAddress): FindingEvidence {
  return Object.freeze({ ...origin }) as FindingEvidence;
}

/**
 * Earlier hidden return doors in this biome that drew from the same store at
 * the reached state, naming an alternative repair for an unavailable bag entry.
 */
function phantomExitDrawEvidence(
  branch: RewardBranchState | undefined,
  origin: SemanticAddress,
  storeKey: string | undefined,
): FindingEvidence {
  if (storeKey === undefined || !('biomeKey' in origin) || branch === undefined) return {};
  const draws = new Map<string, FindingEvidence>();
  for (const event of branch.events)
    if (
      event.kind === 'rewardOffered' &&
      event.storeKey === storeKey &&
      event.origin.kind === 'phantomExit' &&
      event.origin.biomeKey === origin.biomeKey
    )
      draws.set(semanticAddressKey(event.origin), semanticAddressEvidence(event.origin));
  return draws.size === 0 ? {} : { phantomExitDraws: Object.freeze([...draws.values()]) };
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
  incomingBinding: import('../../reward-kernel/bindings').RewardProducerBinding = declaration.incomingReward,
): CountedRewardBinding | undefined {
  if (incoming.producerKind === 'freeReward') {
    const policy = declaration.prebossBatchPolicy;
    const remaining = policy?.kind === 'takeOverNormalDoors' ? policy.remainingOffers : undefined;
    return remaining?.kind === 'counted' ? remaining.reward : undefined;
  }
  return incomingBinding.kind === 'countedChoice' ? incomingBinding : undefined;
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

/**
 * Offers the reward at the reached state, returning the state it leaves; an
 * unsupported offer, or none reached, records its finding and leaves none.
 */
export function processRewardOffer(
  branch: RewardBranchState | undefined,
  context: OfferProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): RewardBranchState | undefined {
  const { reward, historySequence, findingChronology } = context;
  if (!offerPayloadValid(context)) {
    addRewardFinding(
      findings,
      rewardFinding('rewardPayloadInvalid', reward.origin, offerEvidence(reward.offer)),
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
    return undefined;
  }
  const draw = branch === undefined ? undefined : drawRewardOffer(branch, context);
  if (draw?.branch !== undefined) return draw.branch;
  const code: RewardGenerationFindingCode = draw?.sourceFailure
    ? 'rewardSourceUnavailable'
    : draw?.bagSupportEmpty
      ? 'rewardBagSupportEmpty'
      : 'rewardBagEntryUnavailable';
  const siblingConflicts = draw?.siblingConflicts;
  addRewardFinding(
    findings,
    rewardFinding(code, reward.origin, {
      ...offerEvidence(reward.offer),
      storeKey: reward.resolvedStoreKey ?? null,
      ...phantomExitDrawEvidence(branch, reward.origin, reward.resolvedStoreKey),
      ...(siblingConflicts === undefined
        ? {}
        : {
            priorOffers: [...siblingConflicts.values()].map((peer) => ({
              origin: semanticAddressEvidence(peer.origin),
              offer: resolvedOfferEvidence(peer.offer),
            })),
          }),
    }),
    ownerRegion(reward.origin),
    findingChronology ?? historyChronology(historySequence),
  );
  return undefined;
}

function offerPayloadValid({ catalog, reward }: OfferProcessingContext): boolean {
  const rewardType = catalog.rewards.rewardTypes.byKey[reward.offer.rewardType];
  return (
    rewardType !== undefined &&
    isPayloadLocallyValid(catalog.rewards, rewardType, reward.offer.payload)
  );
}

/**
 * Draws a roll that is never offered or acquired: the sole reward type the
 * binding's store can yield loses its canonical entry, with the same refills
 * as any counted draw. No offer history, priority or source is involved.
 */
export function drawUnspawnedRewardRoll(
  catalog: Catalog,
  branch: RewardBranchState,
  roll: { readonly binding: CountedRewardBinding; readonly storeKey: string },
  facts: RewardFactsFactory,
): RewardBranchState | undefined {
  const prepared = withBag(catalog, branch, roll.storeKey);
  const store = catalog.rewards.stores.byKey[roll.storeKey];
  if (prepared === undefined || store === undefined) return undefined;
  const drawn = drawSoleEligibleRewardType(store, prepared.bag, facts(prepared.branch.state), {
    ...(roll.binding.eligibleRewardTypes.length === 0
      ? {}
      : { eligibleRewardTypes: new Set(roll.binding.eligibleRewardTypes) }),
    ...(roll.binding.ineligibleRewardTypes.length === 0
      ? {}
      : { ineligibleRewardTypes: new Set(roll.binding.ineligibleRewardTypes) }),
  });
  if (drawn === undefined) return undefined;
  return Object.freeze({
    ...prepared.branch,
    state: Object.freeze({
      ...prepared.branch.state,
      bags: freezeRecord({ ...prepared.branch.state.bags, [roll.storeKey]: drawn.bag }),
    }),
  });
}

/** The offer gate that rejected the reached state, in gate order. */
type OfferGate =
  | 'forcedReward'
  | 'olympianProvider'
  | 'source'
  | 'storeBinding'
  | 'priority'
  | 'bag'
  | 'storeExhausted';

/**
 * One offer drawn at the reached state: the state it leaves, or the gate that
 * rejected it with what the rejection's finding cites.
 */
interface OfferDraw {
  readonly branch?: RewardBranchState;
  readonly gate?: OfferGate;
  readonly sourceFailure: boolean;
  readonly bagSupportEmpty: boolean;
  /** Earlier peers the offer cannot be drawn beside, when any were found. */
  readonly siblingConflicts?: ReadonlyMap<string, OfferProcessingPeer>;
}

interface CountedOfferInputs {
  readonly storeKey: string;
  readonly store: RewardStoreDeclaration;
  readonly prepared: { readonly branch: RewardBranchState; readonly bag: RewardBagState };
  readonly options: CountedOfferTransitionOptions;
}

function countedOfferInputs(
  context: OfferProcessingContext,
  binding: CountedRewardBinding,
  branch: RewardBranchState,
  peers: RewardPeerContext,
): CountedOfferInputs | undefined {
  const storeKey = context.reward.resolvedStoreKey;
  if (storeKey === undefined || !binding.storeKeys.includes(storeKey)) return undefined;
  const prepared = withBag(context.catalog, branch, storeKey);
  const store = context.catalog.rewards.stores.byKey[storeKey];
  if (prepared === undefined || store === undefined) return undefined;
  return {
    storeKey,
    store,
    prepared,
    options: {
      ...(binding.eligibleRewardTypes.length === 0
        ? {}
        : { eligibleRewardTypes: new Set(binding.eligibleRewardTypes) }),
      ...(binding.ineligibleRewardTypes.length === 0
        ? {}
        : { ineligibleRewardTypes: new Set(binding.ineligibleRewardTypes) }),
      peers,
    },
  };
}

function drawRewardOffer(branch: RewardBranchState, context: OfferProcessingContext): OfferDraw {
  const { catalog, reward, historySequence } = context;
  let sawSourceFailure = false;
  let sawBagSupportEmpty = false;
  let sawSiblingFailure = false;
  const siblingConflicts = new Map<string, OfferProcessingPeer>();
  const recordSiblingConflict = (peer: OfferProcessingPeer) => {
    siblingConflicts.set(semanticAddressKey(peer.origin), peer);
  };
  const rejected = (gate: OfferGate): OfferDraw =>
    Object.freeze({
      gate,
      sourceFailure: sawSourceFailure,
      bagSupportEmpty: sawBagSupportEmpty,
      ...(sawSiblingFailure ? { siblingConflicts } : {}),
    });
  const offered = (branch: RewardBranchState): OfferDraw =>
    Object.freeze({ branch, sourceFailure: false, bagSupportEmpty: false });
  // ChooseRoomReward returns a qualifying ForcedRewards entry before the bag,
  // reward priorities, ChooseLoot and ForceBoonName are consulted.
  const forced = forcedRewardFor(context, branch);
  if (forced !== undefined) {
    if (!sameRewardOffer(forced.offer, reward.offer)) {
      if (forced.offer.rewardType === reward.offer.rewardType) sawSourceFailure = true;
      return rejected('forcedReward');
    }
    return offered(recordCanonicalOffer(branch, context));
  }
  // ForceBoonName participates only in counted room-reward setup. Fixed
  // rewards, direct pickups, and inventory offers retain their own provider.
  const requiredProvider =
    context.binding === undefined
      ? undefined
      : requiredOlympianProviderForOffer(catalog, branch, reward.offer, context.peers);
  // Provider pressure constrains the retained authored offer at its existing
  // reward owner.  It is deliberately not a runtime rewrite: an author can
  // repair the same payload control and no hidden forced-provider field is
  // introduced into authored state.
  if (
    requiredProvider !== undefined &&
    !offerContainsProvider(catalog, reward.offer, requiredProvider)
  ) {
    sawSourceFailure = true;
    return rejected('olympianProvider');
  }
  const effectiveOffer = reward.offer;
  const facts = context.facts(branch.state);
  const peers = { priorOffers: context.peers.map((peer) => peer.offer) };
  // A forced boon replaces ChooseLoot's pick, so the god cap is never consulted.
  const forcedBoonSource =
    requiredProvider !== undefined && effectiveOffer.payload?.kind === 'BoonSource'
      ? effectiveOffer.payload.source
      : undefined;
  if (
    forcedBoonSource === undefined &&
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
    return rejected('source');
  }

  if (context.binding === undefined) {
    const history = applyOfferProjection(
      catalog.rewards,
      branch.state.rewardHistory,
      effectiveOffer,
      facts,
    );
    return offered(
      appendRewardEvent(
        Object.freeze({
          ...branch,
          state: Object.freeze({ ...branch.state, rewardHistory: history }),
        }),
        historySequence,
        {
          kind: 'rewardOffered',
          origin: reward.origin,
          offer: effectiveOffer,
          ...(reward.resolvedStoreKey === undefined ? {} : { storeKey: reward.resolvedStoreKey }),
        },
      ),
    );
  }

  const counted = countedOfferInputs(context, context.binding, branch, peers);
  if (counted === undefined) {
    sawBagSupportEmpty = true;
    return rejected('storeBinding');
  }
  const { storeKey, store, prepared } = counted;
  const bagOptions =
    forcedBoonSource === undefined ? counted.options : { ...counted.options, forcedBoonSource };
  const requiredPriority = oldestSupportedRewardPriority(
    store,
    prepared.bag,
    branch.state.rewardPriorities,
    facts,
    bagOptions,
  );
  if (requiredPriority !== undefined && effectiveOffer.rewardType !== requiredPriority) {
    sawBagSupportEmpty = true;
    return rejected('priority');
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
  const bag = consumeCountedOffer(
    catalog.rewards,
    store,
    prepared.bag,
    effectiveOffer,
    facts,
    bagOptions,
  );
  if (bag === undefined) {
    if (countedStoreExhausted(store, prepared.bag, facts, bagOptions)) {
      sawBagSupportEmpty = true;
      return rejected('storeExhausted');
    }
    return rejected('bag');
  }
  const history = applyOfferProjection(
    catalog.rewards,
    prepared.branch.state.rewardHistory,
    effectiveOffer,
    facts,
  );
  return offered(
    appendRewardEvent(
      Object.freeze({
        ...prepared.branch,
        state: Object.freeze({
          ...prepared.branch.state,
          bags: freezeRecord({ ...prepared.branch.state.bags, [storeKey]: bag }),
          rewardPriorities:
            requiredPriority === undefined
              ? prepared.branch.state.rewardPriorities
              : Object.freeze(
                  prepared.branch.state.rewardPriorities.filter(
                    (priority, index) =>
                      priority !== requiredPriority ||
                      index !== prepared.branch.state.rewardPriorities.indexOf(requiredPriority),
                  ),
                ),
          rewardHistory: history,
        }),
      }),
      historySequence,
      { kind: 'rewardOffered', origin: reward.origin, offer: effectiveOffer, storeKey },
    ),
  );
}

/**
 * Explains an offer that `processRewardOffer` rejected at the reached state by
 * replaying its gates; callers run it only on that failure path.
 */
export function explainRewardOfferExclusions(
  branch: RewardBranchState | undefined,
  context: OfferProcessingContext,
): readonly RewardOfferExclusionReason[] | undefined {
  if (branch === undefined) return undefined;
  const fixed = staticOfferExclusion(branch, context);
  if (fixed !== undefined) return staticRewardOfferExclusion(fixed);
  const gate = offerPayloadValid(context) ? drawRewardOffer(branch, context).gate : undefined;
  return gate === undefined
    ? undefined
    : reachedRewardOfferExclusion(rejectedOfferExclusion(context, branch, gate));
}

/**
 * How many entries of the offer's reward type its counted draw could take at
 * the reached state; none for an uncounted producer or a forced reward, which
 * bypasses the bag.
 */
export function countedStoreStanding(
  branch: RewardBranchState | undefined,
  context: OfferProcessingContext,
): CountedStoreTypeStanding | undefined {
  if (branch === undefined || context.binding === undefined) return undefined;
  if (forcedRewardFor(context, branch) !== undefined) return undefined;
  const counted = countedOfferInputs(context, context.binding, branch, {
    priorOffers: context.peers.map((peer) => peer.offer),
  });
  if (counted === undefined) return undefined;
  return countedStoreTypeStanding(
    counted.store,
    counted.prepared.bag,
    context.reward.offer.rewardType,
    context.facts(branch.state),
    counted.options,
  );
}

/**
 * The focused cohort offer's standing after the earlier peers draw in order;
 * a peer that cannot draw is skipped, as its own repair. `drawn` peers join
 * each later draw as prior offers; `declared` keeps each context's own peers.
 */
export function countedStoreStandingInDrawOrder(
  branch: RewardBranchState | undefined,
  earlier: readonly OfferProcessingContext[],
  focused: OfferProcessingContext,
  peers: 'drawn' | 'declared',
): CountedStoreTypeStanding | undefined {
  let reached = branch;
  const accepted: OfferProcessingPeer[] = [];
  const withPeers = (context: OfferProcessingContext): OfferProcessingContext =>
    peers === 'declared' ? context : { ...context, peers: Object.freeze([...accepted]) };
  for (const context of earlier) {
    const next = processRewardOffer(reached, withPeers(context), new Map());
    if (next === undefined) continue;
    reached = next;
    accepted.push(Object.freeze({ origin: context.reward.origin, offer: context.reward.offer }));
  }
  return countedStoreStanding(reached, withPeers(focused));
}

/**
 * Explains a cohort member its ordered cohort rejected: its own cause alone,
 * or the authored peers it cannot be generated beside. `peersFirst` assesses
 * each earlier peer before the focused offer as Fields does; `listed` draws
 * the pair in source order, earlier peers before it and later peers after.
 */
export function explainCohortOfferExclusions(
  branch: RewardBranchState | undefined,
  focused: OfferProcessingContext,
  peers: {
    readonly earlier: readonly OfferProcessingContext[];
    readonly later?: readonly OfferProcessingContext[];
  },
  ordering: 'peersFirst' | 'listed',
): readonly RewardOfferExclusionReason[] | undefined {
  if (processRewardOffer(branch, focused, new Map()) === undefined)
    return explainRewardOfferExclusions(branch, focused);
  // An independently invalid peer is its own repair, not this offer's conflict.
  const peerAloneValid = (peer: OfferProcessingContext) =>
    processRewardOffer(branch, peer, new Map()) !== undefined;
  const pairFails = (pair: readonly OfferProcessingContext[]) =>
    processOfferGenerationCohort(branch, pair, new Map()) === undefined;
  const conflicting = [
    ...peers.earlier.filter(
      (peer) =>
        peerAloneValid(peer) &&
        (ordering === 'peersFirst'
          ? processRewardOffer(processRewardOffer(branch, peer, new Map()), focused, new Map()) ===
            undefined
          : pairFails([peer, focused])),
    ),
    ...(ordering === 'listed' ? (peers.later ?? []) : []).filter(
      (peer) => peerAloneValid(peer) && pairFails([focused, peer]),
    ),
  ];
  const cited = conflicting.length > 0 ? conflicting : [...peers.earlier, ...(peers.later ?? [])];
  return cited.length === 0
    ? undefined
    : reachedRewardOfferExclusion({
        kind: 'peerConflict',
        peers: cited.map((peer) => ({ origin: peer.reward.origin, offer: peer.reward.offer })),
      });
}

function staticOfferExclusion(
  branch: RewardBranchState,
  context: OfferProcessingContext,
): RewardOfferExclusionReason | undefined {
  return staticCountedOfferExclusion(
    context.catalog,
    context.binding,
    context.reward.resolvedStoreKey,
    context.reward.offer,
    branch.state.reached.routePosition.routeKey,
  );
}

function rejectedOfferExclusion(
  context: OfferProcessingContext,
  branch: RewardBranchState,
  gate: OfferGate,
): RewardOfferExclusionReason | undefined {
  const { catalog, reward } = context;
  const offer = reward.offer;
  const facts = context.facts(branch.state);
  const peers = { priorOffers: context.peers.map((peer) => peer.offer) };
  switch (gate) {
    case 'forcedReward': {
      const forced = forcedRewardFor(context, branch);
      return forced === undefined ? undefined : { kind: 'forcedReward', offer: forced.offer };
    }
    case 'olympianProvider': {
      const providerKey = requiredOlympianProviderForOffer(catalog, branch, offer, context.peers);
      return providerKey === undefined
        ? undefined
        : { kind: 'olympianProviderForced', providerKey };
    }
    case 'source':
      return sourceExclusion(context, facts);
    case 'storeBinding':
      return {
        kind: 'notInStore',
        rewardType: offer.rewardType,
        storeKey: reward.resolvedStoreKey ?? null,
      };
    case 'storeExhausted':
    case 'priority':
    case 'bag': {
      const counted =
        context.binding === undefined
          ? undefined
          : countedOfferInputs(context, context.binding, branch, peers);
      if (counted === undefined) return undefined;
      const { storeKey, store, prepared, options } = counted;
      if (gate === 'storeExhausted')
        return {
          kind: 'storeExhausted',
          storeKey,
          fallbackRewardType: catalog.rewards.countedStoreFallbackRewardType,
        };
      if (gate === 'priority') {
        const rewardType = oldestSupportedRewardPriority(
          store,
          prepared.bag,
          branch.state.rewardPriorities,
          facts,
          options,
        );
        return rewardType === undefined
          ? undefined
          : { kind: 'priorityRequired', rewardType, storeKey };
      }
      return bagExclusion(context, store, prepared.bag, facts, options);
    }
  }
}

function sourceExclusion(
  context: OfferProcessingContext,
  facts: ReturnType<OfferProcessingContext['facts']>,
): RewardOfferExclusionReason | undefined {
  const offer = context.reward.offer;
  if (sourceSupportExclusion(context.catalog.rewards, offer, facts, 'offer') === undefined)
    return context.peers.length === 0
      ? undefined
      : {
          kind: 'peerConflict',
          peers: sourceConflictingPeers(offer, context.peers).map(({ origin, offer: peer }) => ({
            origin,
            offer: peer,
          })),
        };
  return sourceSupportReason(context.catalog.rewards, offer, facts, 'offer');
}

function bagExclusion(
  context: OfferProcessingContext,
  store: RewardStoreDeclaration,
  bag: RewardBagState,
  facts: ReturnType<OfferProcessingContext['facts']>,
  options: CountedOfferTransitionOptions,
): RewardOfferExclusionReason | undefined {
  return countedBagReason(
    context.catalog.rewards,
    store,
    bag,
    context.reward.offer,
    facts,
    options,
    context.peers,
  );
}

function forcedRewardFor(
  context: OfferProcessingContext,
  branch: RewardBranchState,
): import('../../reward-kernel').ForcedCountedReward | undefined {
  const forcedRewards = context.binding?.forcedRewards;
  if (forcedRewards === undefined) return undefined;
  const facts = context.facts(branch.state);
  return forcedRewards.find(
    ({ requirement }) =>
      requirement === undefined || evaluateRequirement(requirement, facts.requirements),
  );
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
  if (!branch.state.keepsakes.olympianSources.some((source) => source.remainingForceUses === 1))
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
    const provider = olympianProviderForOffer(branch.state.keepsakes, siblingProviders);
    return provider;
  }
  if (offer.rewardType !== 'Devotion' || offer.payload?.kind !== 'DevotionPair') return undefined;
  const interactedProviders = new Set(
    Object.entries(catalog.traitGiverByAcquisitionGameName).flatMap(([source, giverKey]) =>
      branch.state.rewardHistory.lootTypeHistory[source] !== undefined ? [giverKey] : [],
    ),
  );
  const provider = olympianProviderForOffer(branch.state.keepsakes, [], true, interactedProviders);
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
  const facts = context.facts(branch.state);
  const history = applyOfferProjection(
    context.catalog.rewards,
    branch.state.rewardHistory,
    context.reward.offer,
    facts,
  );
  return appendRewardEvent(
    Object.freeze({ ...branch, state: Object.freeze({ ...branch.state, rewardHistory: history }) }),
    context.historySequence,
    {
      kind: 'rewardOffered',
      origin: context.reward.origin,
      offer: context.reward.offer,
      ...(context.reward.resolvedStoreKey === undefined
        ? {}
        : { storeKey: context.reward.resolvedStoreKey }),
    },
  );
}

/**
 * Draws a cohort's offers in the given order, each after the ones before it,
 * and records them on the reached state in history order.
 */
export function processOfferGenerationCohort(
  branch: RewardBranchState | undefined,
  contexts: readonly OfferProcessingContext[],
  findings: Map<string, FindingRegionEntry>,
  policy: { readonly atomicRegion?: string } = {},
): RewardBranchState | undefined {
  if (contexts.length <= 1) {
    const context = contexts[0];
    return context === undefined ? branch : processRewardOffer(branch, context, findings);
  }
  if (branch === undefined) return undefined;
  const failed = (localFindings: ReadonlyMap<string, FindingRegionEntry>): undefined => {
    for (const value of localFindings.values())
      addRewardFinding(
        findings,
        value.finding,
        policy.atomicRegion ?? value.atomicRegion,
        value.chronology,
      );
    return undefined;
  };
  let candidate: RewardBranchState | undefined = branch;
  const localFindings = new Map<string, FindingRegionEntry>();
  const priorOffers: OfferProcessingPeer[] = [];
  for (const context of contexts) {
    candidate = processRewardOffer(
      candidate,
      { ...context, peers: Object.freeze([...priorOffers]) },
      localFindings,
    );
    if (candidate === undefined) return failed(localFindings);
    priorOffers.push({ origin: context.reward.origin, offer: context.reward.offer });
  }
  // The cohort's offers are recorded in history order whatever order was drawn.
  let canonical: RewardBranchState = Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      bags: candidate.state.bags,
      rewardPriorities: candidate.state.rewardPriorities,
    }),
  });
  for (const context of [...contexts].sort(
    (left, right) => left.historySequence - right.historySequence,
  ))
    canonical = recordCanonicalOffer(canonical, context);
  return canonical;
}

/**
 * Assesses one offer at its place in a cohort's draw order against the
 * authored peers. Earlier peers draw first; one that cannot is its own repair
 * and is skipped. The offer is then drawn, and each later peer that draws
 * without it must still draw after it, or the offer conflicts with that peer.
 */
export function processFocusedOfferInDrawOrder(
  branch: RewardBranchState | undefined,
  peers: {
    readonly earlier: readonly OfferProcessingContext[];
    readonly later: readonly OfferProcessingContext[];
  },
  focusedContext: OfferProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): {
  readonly branch: RewardBranchState | undefined;
  readonly countedStore?: CountedStoreTypeStanding;
  readonly exclusions?: readonly RewardOfferExclusionReason[];
} {
  const draw = (
    from: RewardBranchState | undefined,
    prior: readonly OfferProcessingPeer[],
    contexts: readonly OfferProcessingContext[],
    onFailure?: (context: OfferProcessingContext, failed: Map<string, FindingRegionEntry>) => void,
  ) => {
    let reached = from;
    const accepted = [...prior];
    for (const context of contexts) {
      const failed = new Map<string, FindingRegionEntry>();
      const next = processRewardOffer(
        reached,
        { ...context, peers: Object.freeze([...accepted]) },
        failed,
      );
      if (next === undefined) {
        onFailure?.(context, failed);
        continue;
      }
      reached = next;
      accepted.push(Object.freeze({ origin: context.reward.origin, offer: context.reward.offer }));
    }
    return { reached, accepted: Object.freeze(accepted) };
  };
  const before = draw(branch, [], peers.earlier);
  const focused = { ...focusedContext, peers: before.accepted };
  const standing = countedStoreStanding(before.reached, focused);
  const countedStore = standing === undefined ? {} : { countedStore: standing };
  const focusedFindings = new Map<string, FindingRegionEntry>();
  const supported = processRewardOffer(before.reached, focused, focusedFindings);
  if (supported === undefined) {
    for (const value of focusedFindings.values()) {
      addRewardFinding(findings, value.finding, value.atomicRegion, value.chronology);
    }
    const exclusions = explainRewardOfferExclusions(before.reached, focused);
    return {
      branch: undefined,
      ...countedStore,
      ...(exclusions === undefined ? {} : { exclusions }),
    };
  }
  const drawnWithout = new Set(
    draw(before.reached, before.accepted, peers.later).accepted.map((peer) =>
      semanticAddressKey(peer.origin),
    ),
  );
  const conflicts: OfferProcessingContext[] = [];
  const after = draw(
    supported,
    [
      ...before.accepted,
      Object.freeze({ origin: focused.reward.origin, offer: focused.reward.offer }),
    ],
    peers.later,
    (context, failed) => {
      if (!drawnWithout.has(semanticAddressKey(context.reward.origin))) return;
      conflicts.push(context);
      for (const value of failed.values()) {
        addRewardFinding(findings, value.finding, value.atomicRegion, value.chronology);
      }
    },
  );
  if (conflicts.length === 0) return { branch: after.reached, ...countedStore };
  const exclusions = reachedRewardOfferExclusion({
    kind: 'peerConflict',
    peers: conflicts.map((peer) => ({ origin: peer.reward.origin, offer: peer.reward.offer })),
  });
  return {
    branch: undefined,
    ...countedStore,
    ...(exclusions === undefined ? {} : { exclusions }),
  };
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
    !branch.state.keepsakes.olympianSources.some((source) => source.remainingForceUses === 1)
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
        state: Object.freeze({
          ...current.state,
          keepsakes: consumeOlympianProviderMaterialized(
            current.state.keepsakes,
            provider,
            provenance,
          ),
        }),
      }),
    branch,
  );
}
