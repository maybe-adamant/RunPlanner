import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
import {
  applyConcreteAcquisition,
  applyOfferProjection,
  beginBiomeRewardHistory,
  beginCurrentRoomRewardHistory,
  consumeCountedOffer,
  createRewardBagState,
  createRewardHistoryState,
  evaluateShopGenerationSupport,
  evaluateShopPurchases,
  isOfferSupportedAtResolutionPoint,
  isPayloadLocallyValid,
  resolveAcquisitionRole,
  type AuthoredShopOffer,
  type RewardBagState,
  type RewardHistoryState,
  type RewardKernelFacts,
  type ShopGenerationSupport,
  type ShopGenerationWitness,
  type ShopPurchaseFailure,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type { HistoryEvent } from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalLocalChildRoom,
  CanonicalResolvedIncomingReward,
} from '../materialization';
import type { FindingEvidence, RewardGenerationFindingCode, SemanticFinding } from '../model';
import type { RewardBranch, RewardEvent } from './model';

export type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalChildRoom;

interface PendingShopState {
  readonly profileKey: string;
  readonly witness: ShopGenerationWitness;
}

export interface RewardBranchState {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly RewardEvent[];
  readonly pendingShops: Readonly<Record<string, PendingShopState>>;
  readonly processedThroughHistorySequence: number;
}

export type RewardFactsFactory = (
  history: RewardHistoryState,
  currentRoomShopOptionNames?: ReadonlySet<string>,
) => RewardKernelFacts;

type RewardEventData<Event extends RewardEvent = RewardEvent> = Event extends RewardEvent
  ? Omit<Event, 'historySequence' | 'rewardSequence'>
  : never;

export function freezeRecord<T>(value: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.freeze({ ...value });
}

function orderedRecord<T>(value: Readonly<Record<string, T>>): readonly (readonly [string, T])[] {
  return Object.freeze(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => Object.freeze([key, entry] as const)),
  );
}

function equivalentBranchStateKey(branch: RewardBranchState): string {
  const history = branch.history;
  return JSON.stringify({
    bags: orderedRecord(branch.bags),
    history: {
      offerHistory: history.offerHistory,
      useRecord: orderedRecord(history.useRecord),
      biomeUseRecord: orderedRecord(history.biomeUseRecord),
      currentRoomUseRecord: orderedRecord(history.currentRoomUseRecord),
      lootTypeHistory: orderedRecord(history.lootTypeHistory),
      lootBiomeRecord: orderedRecord(history.lootBiomeRecord),
      consumableRecord: orderedRecord(history.consumableRecord),
      upgradableTraitCount: history.upgradableTraitCount,
      lastDevotionDepth: history.lastDevotionDepth,
    },
    pendingShops: orderedRecord(branch.pendingShops),
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
  });
}

export function mergeEquivalentRewardBranches(
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  const merged = new Map<string, RewardBranchState>();
  for (const branch of branches) {
    const key = equivalentBranchStateKey(branch);
    if (!merged.has(key)) {
      merged.set(key, branch);
    }
  }
  return Object.freeze([...merged.values()]);
}

export function appendRewardEvent(
  branch: RewardBranchState,
  historySequence: number,
  event: RewardEventData,
): RewardBranchState {
  const next = Object.freeze({
    ...event,
    rewardSequence: branch.events.length + 1,
    historySequence,
  }) as RewardEvent;
  return Object.freeze({
    ...branch,
    events: Object.freeze([...branch.events, next]),
    processedThroughHistorySequence: historySequence,
  });
}

export function advanceRewardBranch(
  branch: RewardBranchState,
  historySequence: number,
): RewardBranchState {
  return branch.processedThroughHistorySequence >= historySequence
    ? branch
    : Object.freeze({ ...branch, processedThroughHistorySequence: historySequence });
}

export function advanceRewardBranches(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(branches.map((branch) => advanceRewardBranch(branch, historySequence)));
}

export function beginRewardRoom(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(
    branches.map((branch) =>
      advanceRewardBranch(
        Object.freeze({ ...branch, history: beginCurrentRoomRewardHistory(branch.history) }),
        historySequence,
      ),
    ),
  );
}

export function initializeRewardBranches(
  initialBranches?: readonly RewardBranch[],
): readonly RewardBranchState[] {
  if (initialBranches === undefined) {
    return Object.freeze([
      Object.freeze({
        bags: Object.freeze({}),
        history: createRewardHistoryState(),
        events: Object.freeze([]),
        pendingShops: Object.freeze({}),
        processedThroughHistorySequence: 0,
      }),
    ]);
  }
  return Object.freeze(
    initialBranches.map((branch) =>
      Object.freeze({
        bags: branch.bags,
        history: beginBiomeRewardHistory(branch.history),
        events: Object.freeze([]),
        pendingShops: Object.freeze({}),
        processedThroughHistorySequence: 0,
      }),
    ),
  );
}

export function rewardFinding(
  code: RewardGenerationFindingCode,
  origin: SemanticFinding['origin'],
  evidence: FindingEvidence,
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze(evidence),
  });
}

function findingKey(value: SemanticFinding): string {
  return JSON.stringify([value.code, semanticAddressKey(value.origin), value.evidence]);
}

export function addRewardFinding(
  findings: Map<string, SemanticFinding>,
  value: SemanticFinding,
): void {
  findings.set(findingKey(value), value);
}

export function offerEvidence(offer: CanonicalResolvedIncomingReward['offer']): FindingEvidence {
  const payload = offer.payload;
  return {
    rewardType: offer.rewardType,
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { chosenSource: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  };
}

function semanticAddressEvidence(origin: SemanticAddress): FindingEvidence {
  return Object.freeze({ ...origin }) as FindingEvidence;
}

function resolvedOfferEvidence(offer: CanonicalResolvedIncomingReward['offer']): FindingEvidence {
  return Object.freeze({
    rewardType: offer.rewardType,
    ...(offer.payload === undefined
      ? {}
      : { payload: Object.freeze({ ...offer.payload }) as FindingEvidence }),
  });
}

function sourceConflictingPeers(
  offer: CanonicalResolvedIncomingReward['offer'],
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

function withBag(
  catalog: Catalog,
  branch: RewardBranchState,
  storeKey: string,
): { readonly branch: RewardBranchState; readonly bag: RewardBagState } | undefined {
  const store = catalog.rewards.stores.byKey[storeKey];
  if (store === undefined) {
    return undefined;
  }
  const current = branch.bags[storeKey];
  if (current !== undefined) {
    return { branch, bag: current };
  }
  const bag = createRewardBagState(store);
  return {
    branch: Object.freeze({ ...branch, bags: freezeRecord({ ...branch.bags, [storeKey]: bag }) }),
    bag,
  };
}

export interface OfferProcessingContext {
  readonly catalog: Catalog;
  readonly reward: {
    readonly origin: SemanticAddress;
    readonly offer: CanonicalResolvedIncomingReward['offer'];
    readonly producerLifecycleKey: string;
    readonly resolvedStoreKey?: string;
  };
  readonly binding?: CountedRewardBinding;
  readonly historySequence: number;
  readonly peers: readonly OfferProcessingPeer[];
  readonly facts: RewardFactsFactory;
}

export interface OfferProcessingPeer {
  readonly origin: SemanticAddress;
  readonly offer: CanonicalResolvedIncomingReward['offer'];
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

export function processRewardOffer(
  branches: readonly RewardBranchState[],
  context: OfferProcessingContext,
  findings: Map<string, SemanticFinding>,
): readonly RewardBranchState[] {
  const { catalog, reward, historySequence } = context;
  const rewardType = catalog.rewards.rewardTypes.byKey[reward.offer.rewardType];
  if (
    rewardType === undefined ||
    !isPayloadLocallyValid(catalog.rewards, rewardType, reward.offer.payload)
  ) {
    addRewardFinding(
      findings,
      rewardFinding('rewardPayloadInvalid', reward.origin, offerEvidence(reward.offer)),
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
    const facts = context.facts(originalBranch.history);
    const peers = { priorOffers: context.peers.map((peer) => peer.offer) };
    if (!isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, 'offer', peers)) {
      sawSourceFailure = true;
      if (
        context.peers.length > 0 &&
        isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, 'offer', {
          priorOffers: [],
        })
      ) {
        sawSiblingFailure = true;
        sourceConflictingPeers(reward.offer, context.peers).forEach(recordSiblingConflict);
      }
      continue;
    }

    if (context.binding === undefined) {
      const history = applyOfferProjection(
        catalog.rewards,
        originalBranch.history,
        reward.offer,
        facts,
      );
      next.push(
        appendRewardEvent(Object.freeze({ ...originalBranch, history }), historySequence, {
          kind: 'rewardOffered',
          origin: reward.origin,
          offer: reward.offer,
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
    if (
      context.peers.some((peer) => peer.offer.rewardType === reward.offer.rewardType) &&
      store.entries.some(
        (entry) => entry.rewardType === reward.offer.rewardType && !entry.allowDuplicates,
      )
    ) {
      sawSiblingFailure = true;
      context.peers
        .filter((peer) => peer.offer.rewardType === reward.offer.rewardType)
        .forEach(recordSiblingConflict);
    }
    let transitions: readonly RewardBagState[];
    try {
      transitions = consumeCountedOffer(catalog.rewards, store, prepared.bag, reward.offer, facts, {
        ...(context.binding.eligibleRewardTypes.length === 0
          ? {}
          : { eligibleRewardTypes: new Set(context.binding.eligibleRewardTypes) }),
        ...(context.binding.ineligibleRewardTypes.length === 0
          ? {}
          : { ineligibleRewardTypes: new Set(context.binding.ineligibleRewardTypes) }),
        peers,
      });
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
        reward.offer,
        facts,
      );
      next.push(
        appendRewardEvent(
          Object.freeze({
            ...prepared.branch,
            bags: freezeRecord({ ...prepared.branch.bags, [storeKey]: bag }),
            history,
          }),
          historySequence,
          { kind: 'rewardOffered', origin: reward.origin, offer: reward.offer, storeKey },
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
    );
  }
  return Object.freeze(next);
}

function recordCanonicalOffer(
  branch: RewardBranchState,
  context: OfferProcessingContext,
): RewardBranchState {
  const facts = context.facts(branch.history);
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

export function processJointUnorderedOffers(
  branches: readonly RewardBranchState[],
  contexts: readonly OfferProcessingContext[],
  findings: Map<string, SemanticFinding>,
): readonly RewardBranchState[] {
  if (contexts.length <= 1) {
    const context = contexts[0];
    return context === undefined ? branches : processRewardOffer(branches, context, findings);
  }
  const supported: RewardBranchState[] = [];
  let representativeFailures: readonly SemanticFinding[] = Object.freeze([]);
  for (const branch of branches) {
    for (const ordering of permutations(contexts)) {
      let candidates: readonly RewardBranchState[] = Object.freeze([branch]);
      const localFindings = new Map<string, SemanticFinding>();
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
          ...branch,
          bags: candidate.bags,
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
      addRewardFinding(findings, value);
    }
  }
  return mergeEquivalentRewardBranches(supported);
}

function shopRequirements(
  declaration: RoomDeclaration,
  profileKey: string,
  fail: (detail: string) => never,
) {
  const binding = declaration.incomingReward;
  if (binding.kind !== 'shop' || binding.shopProfileKey !== profileKey) {
    return fail(`${declaration.gameName} has no ${profileKey} shop binding`);
  }
  return binding.additionalOptionRequirements ?? Object.freeze({});
}

interface ShopProcessingContext {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly historySequence: number;
  readonly facts: RewardFactsFactory;
  readonly fail: (detail: string) => never;
}

export function processShopInventory(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, SemanticFinding>,
): readonly RewardBranchState[] {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    return fail(`${room.gameName} materialized a missing shop state`);
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    return fail(`unknown shop profile ${entry.profileKey}`);
  }
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
    purchased: offer.purchased,
  }));
  const next: RewardBranchState[] = [];
  const supportResults: ShopGenerationSupport[] = [];
  for (const branch of branches) {
    const support = evaluateShopGenerationSupport(
      catalog.rewards,
      profile,
      authored,
      context.facts(branch.history, new Set()),
      requirements,
    );
    supportResults.push(support);
    for (const witness of support.witnesses) {
      let candidate = branch;
      for (const offer of entry.offers) {
        const offerFacts = context.facts(candidate.history, new Set());
        const history = applyOfferProjection(
          catalog.rewards,
          candidate.history,
          offer.offer,
          offerFacts,
        );
        candidate = appendRewardEvent(Object.freeze({ ...candidate, history }), historySequence, {
          kind: 'rewardOffered',
          origin: offer.offerOrigin,
          offer: offer.offer,
        });
      }
      candidate = appendRewardEvent(candidate, historySequence, {
        kind: 'shopInventorySupported',
        origin: room.origin,
        profileKey: profile.key,
        optionKeys: witness.optionKeys,
      });
      next.push(
        Object.freeze({
          ...candidate,
          pendingShops: freezeRecord({
            ...candidate.pendingShops,
            [semanticAddressKey(room.origin)]: Object.freeze({
              profileKey: profile.key,
              witness,
            }),
          }),
        }),
      );
    }
  }
  if (next.length === 0) {
    const unsupportedIndexes = entry.offers.flatMap((_, index) =>
      supportResults.every((support) => support.unsupportedSlotIndexes.includes(index))
        ? [index]
        : [],
    );
    for (const index of unsupportedIndexes) {
      const offer = entry.offers[index]!;
      const rewardType = catalog.rewards.rewardTypes.byKey[offer.offer.rewardType];
      const code: RewardGenerationFindingCode =
        rewardType === undefined ||
        !isPayloadLocallyValid(catalog.rewards, rewardType, offer.offer.payload)
          ? 'rewardPayloadInvalid'
          : 'shopOfferUnavailable';
      addRewardFinding(
        findings,
        rewardFinding(code, offer.offerOrigin, offerEvidence(offer.offer)),
      );
    }
    if (unsupportedIndexes.length === 0) {
      addRewardFinding(
        findings,
        rewardFinding('shopOfferUnavailable', room.origin, {
          offerKeys: entry.offers.map((offer) => offer.offerKey),
          kind: 'jointOfferSet',
        }),
      );
    }
  }
  return Object.freeze(next);
}

export function processShopPurchases(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, SemanticFinding>,
): readonly RewardBranchState[] {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    return fail(`${room.gameName} applied missing shop purchases`);
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    return fail(`unknown shop profile ${entry.profileKey}`);
  }
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
    purchased: offer.purchased,
  }));
  const next: RewardBranchState[] = [];
  const failures: ShopPurchaseFailure[] = [];
  for (const branch of branches) {
    const pending = branch.pendingShops[semanticAddressKey(room.origin)];
    if (pending?.profileKey !== profile.key) {
      return fail(`${room.gameName} lost its shop witness`);
    }
    const simulation = evaluateShopPurchases(
      catalog.rewards,
      profile,
      authored,
      pending.witness,
      branch.history,
      context.facts(branch.history, new Set()),
      requirements,
    );
    failures.push(...simulation.failures);
    for (const result of simulation.results) {
      let candidate: RewardBranchState = Object.freeze({ ...branch, history: result.history });
      for (const acquisition of result.acquisitions) {
        const offer = entry.offers[acquisition.slotIndex];
        if (offer === undefined) {
          return fail('shop acquisition has no semantic slot');
        }
        candidate = appendRewardEvent(candidate, historySequence, {
          kind: 'concreteAcquisition',
          origin: offer.purchaseOrigin,
          acquisition: acquisition.event,
        });
      }
      candidate = appendRewardEvent(candidate, historySequence, {
        kind: 'shopPurchasesSupported',
        origin: room.origin,
        profileKey: profile.key,
        purchaseOrder: Object.freeze(
          result.purchaseOrder.map((slotIndex) => entry.offers[slotIndex]!.offerKey),
        ),
      });
      const { [semanticAddressKey(room.origin)]: completed, ...remainingShops } =
        candidate.pendingShops;
      void completed;
      next.push(Object.freeze({ ...candidate, pendingShops: freezeRecord(remainingShops) }));
    }
  }
  if (next.length === 0) {
    const purchasedIndexes = entry.offers.flatMap((offer, index) =>
      offer.purchased ? [index] : [],
    );
    const failedIndexes = purchasedIndexes.filter(
      (index) =>
        failures.length > 0 && failures.every((failure) => failure.failedSlotIndex === index),
    );
    for (const index of failedIndexes) {
      const offer = entry.offers[index]!;
      addRewardFinding(
        findings,
        rewardFinding('shopPurchaseUnavailable', offer.purchaseOrigin, offerEvidence(offer.offer)),
      );
    }
    if (failedIndexes.length === 0) {
      addRewardFinding(
        findings,
        rewardFinding('shopPurchaseUnavailable', room.origin, {
          kind: 'jointPurchaseSet',
          offerKeys: purchasedIndexes.map((index) => entry.offers[index]!.offerKey),
        }),
      );
    }
  }
  return mergeEquivalentRewardBranches(next);
}

export function processProducerRole(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalRewardRoom,
  event: Extract<HistoryEvent, { readonly kind: 'producerRoleAdvanced' }>,
  facts: RewardFactsFactory,
  findings: Map<string, SemanticFinding>,
  fail: (detail: string) => never,
): readonly RewardBranchState[] {
  const incoming = room.incomingReward;
  if (
    incoming === undefined ||
    incoming.offer.rewardType !== event.rewardType ||
    incoming.producerLifecycleKey !== event.producerLifecycleKey
  ) {
    return fail(`${room.gameName} producer event does not match its offer`);
  }
  const next: RewardBranchState[] = [];
  for (const branch of branches) {
    const branchFacts = facts(branch.history);
    if (
      !isOfferSupportedAtResolutionPoint(catalog.rewards, incoming.offer, branchFacts, {
        acquisitionRole: event.role,
      })
    ) {
      continue;
    }
    const acquisition = resolveAcquisitionRole(
      catalog.rewards,
      incoming.offer,
      event.role,
      event.lifecyclePoint,
    );
    const history = applyConcreteAcquisition(
      catalog.rewards,
      branch.history,
      acquisition.acquisition,
    );
    next.push(
      appendRewardEvent(Object.freeze({ ...branch, history }), event.sequence, {
        kind: 'concreteAcquisition',
        origin: incoming.origin,
        acquisition,
      }),
    );
  }
  if (next.length === 0) {
    addRewardFinding(
      findings,
      rewardFinding('rewardAcquisitionUnavailable', incoming.origin, {
        ...offerEvidence(incoming.offer),
        role: event.role,
        lifecyclePoint: event.lifecyclePoint,
      }),
    );
  }
  return Object.freeze(next);
}

export function processOwnedRewardAcquisition(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  reward: {
    readonly offer: CanonicalResolvedIncomingReward['offer'];
    readonly origin: SemanticAddress;
    readonly producerLifecycleKey: string;
  },
  historySequence: number,
  facts: RewardFactsFactory,
  findings: Map<string, SemanticFinding>,
  fail: (detail: string) => never,
): readonly RewardBranchState[] {
  const producer = catalog.rewards.producerLifecycles.byKey[reward.producerLifecycleKey];
  const lifecycle = producer?.rewardTypes.byKey[reward.offer.rewardType];
  if (lifecycle === undefined) {
    return fail(`${reward.producerLifecycleKey} does not support ${reward.offer.rewardType}`);
  }
  let current = branches;
  for (const binding of lifecycle.acquisitionLifecycle) {
    const next: RewardBranchState[] = [];
    for (const branch of current) {
      const branchFacts = facts(branch.history);
      if (
        !isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, branchFacts, {
          acquisitionRole: binding.role,
        })
      ) {
        continue;
      }
      const acquisition = resolveAcquisitionRole(
        catalog.rewards,
        reward.offer,
        binding.role,
        binding.lifecyclePoint,
      );
      const history = applyConcreteAcquisition(
        catalog.rewards,
        branch.history,
        acquisition.acquisition,
      );
      next.push(
        appendRewardEvent(Object.freeze({ ...branch, history }), historySequence, {
          kind: 'concreteAcquisition',
          origin: reward.origin,
          acquisition,
        }),
      );
    }
    if (next.length === 0) {
      addRewardFinding(
        findings,
        rewardFinding('rewardAcquisitionUnavailable', reward.origin, {
          ...offerEvidence(reward.offer),
          role: binding.role,
          lifecyclePoint: binding.lifecyclePoint,
        }),
      );
      return Object.freeze([]);
    }
    current = Object.freeze(next);
  }
  return Object.freeze(current.map((branch) => advanceRewardBranch(branch, historySequence)));
}

export function publicRewardBranch(branch: RewardBranchState): RewardBranch {
  return Object.freeze({
    bags: branch.bags,
    history: branch.history,
    events: branch.events,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
  });
}
