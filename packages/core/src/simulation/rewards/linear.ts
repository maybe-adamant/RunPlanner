import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../../catalog';
import { semanticAddressKey, type OccurrenceAddress } from '../../project/addresses';
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
  factsWithHistory,
  isOfferSupportedAtResolutionPoint,
  isPayloadLocallyValid,
  resolveAcquisitionRole,
  type AuthoredShopOffer,
  type RewardBagState,
  type RewardHistoryState,
  type RewardKernelFacts,
  type ShopGenerationWitness,
  type ShopGenerationSupport,
  type ShopPurchaseFailure,
} from '../../rewardKernel';
import type { CountedRewardBinding } from '../../rewards';
import type { RequirementEvaluationContext } from '../../requirementEvaluator';
import type {
  CanonicalLinearHistory,
  LinearHistoryStateView,
  LinearRoomHistoryViews,
} from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalLinearBiome,
  CanonicalLocalReward,
  CanonicalResolvedIncomingReward,
  CanonicalTarget,
} from '../materialization';
import type { FindingEvidence, RewardGenerationFindingCode, SemanticFinding } from '../model';
import type {
  LinearRewardBranch,
  LinearRewardEvent,
  LinearRewardSimulation,
  LinearRewardStoreSupportEntry,
} from './model';

interface PendingShopState {
  readonly profileKey: string;
  readonly witness: ShopGenerationWitness;
}

interface RewardBranchState {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly LinearRewardEvent[];
  readonly pendingShops: Readonly<Record<string, PendingShopState>>;
  readonly processedThroughHistorySequence: number;
}

type LinearRewardEventData<Event extends LinearRewardEvent = LinearRewardEvent> =
  Event extends LinearRewardEvent ? Omit<Event, 'historySequence' | 'rewardSequence'> : never;

export class LinearRewardSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearRewardSimulationContractError';
  }
}

function freezeRecord<T>(value: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
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

function mergeEquivalentBranchStates(
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

function appendRewardEvent(
  branch: RewardBranchState,
  historySequence: number,
  event: LinearRewardEventData,
): RewardBranchState {
  const next = Object.freeze({
    ...event,
    rewardSequence: branch.events.length + 1,
    historySequence,
  }) as LinearRewardEvent;
  return Object.freeze({
    ...branch,
    events: Object.freeze([...branch.events, next]),
    processedThroughHistorySequence: historySequence,
  });
}

function advanceBranch(branch: RewardBranchState, historySequence: number): RewardBranchState {
  return branch.processedThroughHistorySequence >= historySequence
    ? branch
    : Object.freeze({ ...branch, processedThroughHistorySequence: historySequence });
}

function countByGameName(
  entries: readonly { readonly gameName: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.gameName] = (counts[entry.gameName] ?? 0) + 1;
  }
  return counts;
}

function recentEncounterPhases(view: LinearHistoryStateView) {
  const ordered = new Map<string, { readonly profileKey: string; readonly phaseKeys: string[] }>();
  for (const encounter of view.ledgers.encounterStarts) {
    const key = semanticAddressKey(encounter.origin);
    const current = ordered.get(key);
    if (current === undefined) {
      ordered.set(key, {
        profileKey: encounter.encounterProfileKey,
        phaseKeys: [encounter.phaseKey],
      });
    } else {
      current.phaseKeys.push(encounter.phaseKey);
    }
  }
  return Object.freeze(
    [...ordered.values()].map((entry) =>
      Object.freeze({ profileKey: entry.profileKey, phaseKeys: Object.freeze(entry.phaseKeys) }),
    ),
  );
}

interface StaticRewardViewFacts {
  readonly peerGameNamesByParent: Map<string, readonly string[]>;
  readonly recentEncounterPhases: ReturnType<typeof recentEncounterPhases>;
  readonly roomsEntered: Readonly<Record<string, number>>;
}

const staticRewardFactsByCatalog = new WeakMap<
  Catalog,
  WeakMap<LinearHistoryStateView, StaticRewardViewFacts>
>();

function staticRewardViewFacts(
  catalog: Catalog,
  view: LinearHistoryStateView,
): StaticRewardViewFacts {
  let byView = staticRewardFactsByCatalog.get(catalog);
  if (byView === undefined) {
    byView = new WeakMap();
    staticRewardFactsByCatalog.set(catalog, byView);
  }
  const existing = byView.get(view);
  if (existing !== undefined) {
    return existing;
  }
  const facts = Object.freeze({
    peerGameNamesByParent: new Map<string, readonly string[]>(),
    recentEncounterPhases: recentEncounterPhases(view),
    roomsEntered: Object.freeze(countByGameName(view.ledgers.roomAppearances)),
  });
  byView.set(view, facts);
  return facts;
}

function priorPeerGameNames(
  catalog: Catalog,
  view: LinearHistoryStateView,
  parentOrigin: OccurrenceAddress,
): readonly string[] {
  const facts = staticRewardViewFacts(catalog, view);
  const parentKey = semanticAddressKey(parentOrigin);
  const existing = facts.peerGameNamesByParent.get(parentKey);
  if (existing !== undefined) {
    return existing;
  }
  const names = Object.freeze(
    view.ledgers.roomCreations
      .filter(
        (creation) =>
          creation.source === 'generatedTarget' &&
          semanticAddressKey(creation.parentOrigin) === parentKey,
      )
      .map((creation) => creation.gameName),
  );
  facts.peerGameNamesByParent.set(parentKey, names);
  return names;
}

function rewardFacts(
  catalog: Catalog,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: LinearHistoryStateView,
  history: RewardHistoryState,
  enteredBiomeCount: number,
  currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
): RewardKernelFacts {
  const staticFacts = staticRewardViewFacts(catalog, view);
  const requirements: RequirementEvaluationContext = Object.freeze({
    counters: Object.freeze({
      biomeDepthCache: view.ledgers.counters.biomeDepthCache,
      biomeEncounterDepth: view.ledgers.counters.biomeEncounterDepth,
      encounterDepth: view.ledgers.counters.routeEncounterDepth,
      enteredBiomes: enteredBiomeCount,
      upgradableTraitCount: history.upgradableTraitCount,
    }),
    records: Object.freeze({
      biomeUseRecord: history.biomeUseRecord,
      lootTypeHistory: history.lootTypeHistory,
      roomsEntered: staticFacts.roomsEntered,
      useRecord: history.useRecord,
    }),
    currentRoomShopOptionNames,
    currentRoomRewardType: source.incomingReward?.offer.rewardType,
    rewardLookups: Object.freeze({}),
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze(
      history.lastDevotionDepth === undefined ? {} : { Devotion: history.lastDevotionDepth },
    ),
    recentEncounterPhases: staticFacts.recentEncounterPhases,
    offeredExitCount: sourceDeclaration.exits.length,
    currentBatchRoomGameNames: priorPeerGameNames(catalog, view, source.origin),
    clockwork: undefined,
    flags: Object.freeze({ allSpellInvested: false, pendingSpellDrop: false }),
  });
  return factsWithHistory(Object.freeze({ requirements }), history, currentRoomShopOptionNames);
}

function finding(
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

function addFinding(findings: Map<string, SemanticFinding>, value: SemanticFinding): void {
  findings.set(findingKey(value), value);
}

function offerEvidence(offer: CanonicalResolvedIncomingReward['offer']): FindingEvidence {
  const payload = offer.payload;
  return {
    rewardType: offer.rewardType,
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { chosenSource: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  };
}

function requireLinearLayout(catalog: Catalog, snapshot: CanonicalLinearBiome): LinearBiomeLayout {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  const supportedPolicy =
    layout?.kind === 'LinearBiome' &&
    (layout.continuation.rewardStorePolicy.kind === 'authoredBaseStore' ||
      (layout.continuation.batchPolicy.kind === 'fields' &&
        layout.continuation.rewardStorePolicy.kind === 'none'));
  if (layout?.kind !== 'LinearBiome' || !supportedPolicy) {
    throw new LinearRewardSimulationContractError(
      `catalog does not provide supported ${snapshot.biomeKey} reward stores`,
    );
  }
  return layout;
}

function authoredRooms(snapshot: CanonicalLinearBiome): ReadonlyMap<string, CanonicalAuthoredRoom> {
  const rooms = [
    ...snapshot.entryRooms.filter((room) => room.kind === 'authored'),
    ...snapshot.batches.flatMap((batch) => batch.targets.map((target) => target.room)),
    ...snapshot.terminalEntry.targets.map((target) => target.room),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function roomViews(history: CanonicalLinearHistory): ReadonlyMap<string, LinearRoomHistoryViews> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function canonicalTargets(snapshot: CanonicalLinearBiome): ReadonlyMap<string, CanonicalTarget> {
  return new Map(
    [...snapshot.batches.flatMap((batch) => batch.targets), ...snapshot.terminalEntry.targets].map(
      (target) => [semanticAddressKey(target.origin), target],
    ),
  );
}

function enteredStoreKey(
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
): string | undefined {
  switch (declaration.enteredRewardStoreHistory.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return declaration.enteredRewardStoreHistory.storeKey;
    case 'resolvedOffer':
      return room.incomingReward?.resolvedStoreKey;
  }
}

function storeSupport(
  layout: LinearBiomeLayout,
  batch: CanonicalBatch,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: LinearHistoryStateView,
  historySequence: number,
): LinearRewardStoreSupportEntry {
  const policy = layout.continuation.rewardStorePolicy;
  if (policy.kind !== 'authoredBaseStore' || batch.rewardStore.kind !== 'authoredBaseStore') {
    throw new LinearRewardSimulationContractError(
      'linear batch lost its authored base-store contract',
    );
  }
  const priorStores = view.ledgers.enteredRewardStores
    .filter((entry) => entry.origin.biomeKey === source.origin.biomeKey)
    .map((entry) => entry.storeKey);
  const currentStore = enteredStoreKey(source, sourceDeclaration);
  const stores = currentStore === undefined ? priorStores : [...priorStores, currentStore];
  const metaCount = stores.filter((storeKey) => storeKey === 'MetaProgress').length;
  const ratio = stores.length === 0 ? null : metaCount / stores.length;
  const metaSelectionValue =
    ratio === null
      ? policy.targetMetaRewardsRatio
      : policy.targetMetaRewardsRatio +
        policy.targetMetaRewardsAdjustSpeed * (policy.targetMetaRewardsRatio - ratio);
  const supportStoreKeys = Object.freeze(
    metaSelectionValue <= 0
      ? policy.storeKeys.filter((storeKey) => storeKey !== 'MetaProgress')
      : metaSelectionValue >= 1
        ? policy.storeKeys.filter((storeKey) => storeKey === 'MetaProgress')
        : [...policy.storeKeys],
  );
  return Object.freeze({
    origin: batch.rewardStore.origin,
    historySequence,
    authoredStoreKey: batch.rewardStore.baseRewardStoreKey,
    enteredStoreCount: stores.length,
    enteredMetaStoreCount: metaCount,
    currentMetaRatio: ratio,
    metaSelectionValue,
    supportStoreKeys,
    selectedPossible: supportStoreKeys.includes(batch.rewardStore.baseRewardStoreKey),
  });
}

function expectedTargetStores(
  catalog: Catalog,
  targets: readonly CanonicalTarget[],
  initialSharedStoreKey: string | undefined,
): ReadonlyMap<string, string | undefined> {
  let finalSharedStoreKey = initialSharedStoreKey;
  for (const target of targets) {
    const declaration = catalog.rooms.byKey[target.room.gameName];
    if (declaration === undefined) {
      throw new LinearRewardSimulationContractError(`unknown target room ${target.room.gameName}`);
    }
    if (declaration.forcedRewardStoreKey !== undefined) {
      finalSharedStoreKey = declaration.forcedRewardStoreKey;
    }
  }
  return new Map(
    targets.map((target) => {
      const declaration = catalog.rooms.byKey[target.room.gameName]!;
      return [
        semanticAddressKey(target.origin),
        declaration.individualRewardStoreKey ??
          declaration.forcedRewardStoreKey ??
          finalSharedStoreKey,
      ];
    }),
  );
}

function countedBinding(
  declaration: RoomDeclaration,
  incoming: CanonicalResolvedIncomingReward,
): CountedRewardBinding | undefined {
  if (incoming.producerKind === 'freeReward') {
    return declaration.entryOfferPolicy?.freeReward;
  }
  return declaration.incomingReward.kind === 'countedChoice'
    ? declaration.incomingReward
    : undefined;
}

function localRewardBinding(
  declaration: RoomDeclaration,
  reward: CanonicalLocalReward,
): CountedRewardBinding {
  const descriptor = declaration.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.key === reward.groupKey,
  );
  if (
    descriptor?.kind !== 'boundedRewardSlots' ||
    !descriptor.slotKeys.includes(reward.slotKey) ||
    descriptor.reward.producerLifecycleKey !== reward.producerLifecycleKey
  ) {
    throw new LinearRewardSimulationContractError(
      `${declaration.gameName} does not own local reward ${reward.groupKey}.${reward.slotKey}`,
    );
  }
  return descriptor.reward;
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

interface OfferProcessingContext {
  readonly catalog: Catalog;
  readonly reward: Pick<
    CanonicalResolvedIncomingReward | CanonicalLocalReward,
    'offer' | 'origin' | 'producerLifecycleKey' | 'resolvedStoreKey'
  >;
  readonly binding?: CountedRewardBinding;
  readonly declaration: RoomDeclaration;
  readonly source: CanonicalAuthoredRoom;
  readonly view: LinearHistoryStateView;
  readonly historySequence: number;
  readonly peers: readonly CanonicalResolvedIncomingReward['offer'][];
  readonly currentRoomShopOptionNames: ReadonlySet<string>;
  readonly enteredBiomeCount: number;
}

function processRewardOffer(
  branches: readonly RewardBranchState[],
  context: OfferProcessingContext,
  findings: Map<string, SemanticFinding>,
): readonly RewardBranchState[] {
  const { catalog, reward, declaration, source, view, historySequence } = context;
  const rewardType = catalog.rewards.rewardTypes.byKey[reward.offer.rewardType];
  if (
    rewardType === undefined ||
    !isPayloadLocallyValid(catalog.rewards, rewardType, reward.offer.payload)
  ) {
    addFinding(
      findings,
      finding('rewardPayloadInvalid', reward.origin, offerEvidence(reward.offer)),
    );
    return [];
  }

  const binding = context.binding;
  const next: RewardBranchState[] = [];
  let sawSourceFailure = false;
  let sawBagInvariantFailure = false;
  for (const originalBranch of branches) {
    const facts = rewardFacts(
      catalog,
      source,
      catalog.rooms.byKey[source.gameName] ?? declaration,
      view,
      originalBranch.history,
      context.enteredBiomeCount,
      context.currentRoomShopOptionNames,
    );
    const peers = { priorOffers: context.peers };
    if (!isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, 'offer', peers)) {
      sawSourceFailure = true;
      continue;
    }

    if (binding === undefined) {
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
    if (storeKey === undefined || !binding.storeKeys.includes(storeKey)) {
      sawBagInvariantFailure = true;
      continue;
    }
    const prepared = withBag(catalog, originalBranch, storeKey);
    const store = catalog.rewards.stores.byKey[storeKey];
    if (prepared === undefined || store === undefined) {
      sawBagInvariantFailure = true;
      continue;
    }
    let transitions: readonly RewardBagState[];
    try {
      transitions = consumeCountedOffer(catalog.rewards, store, prepared.bag, reward.offer, facts, {
        ...(binding.eligibleRewardTypes.length === 0
          ? {}
          : { eligibleRewardTypes: new Set(binding.eligibleRewardTypes) }),
        ...(binding.ineligibleRewardTypes.length === 0
          ? {}
          : { ineligibleRewardTypes: new Set(binding.ineligibleRewardTypes) }),
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
          {
            kind: 'rewardOffered',
            origin: reward.origin,
            offer: reward.offer,
            storeKey,
          },
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
    addFinding(
      findings,
      finding(code, reward.origin, {
        ...offerEvidence(reward.offer),
        storeKey: reward.resolvedStoreKey ?? null,
      }),
    );
  }
  return Object.freeze(next);
}

function processShopInventory(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  view: LinearHistoryStateView,
  historySequence: number,
  findings: Map<string, SemanticFinding>,
  enteredBiomeCount: number,
): readonly RewardBranchState[] {
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    throw new LinearRewardSimulationContractError(
      `${room.gameName} materialized a missing shop state`,
    );
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    throw new LinearRewardSimulationContractError(`unknown shop profile ${entry.profileKey}`);
  }
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
    purchased: offer.purchased,
  }));
  const next: RewardBranchState[] = [];
  const supportResults: ShopGenerationSupport[] = [];
  for (const branch of branches) {
    const facts = rewardFacts(catalog, room, declaration, view, branch.history, enteredBiomeCount);
    const support = evaluateShopGenerationSupport(catalog.rewards, profile, authored, facts);
    supportResults.push(support);
    for (const witness of support.witnesses) {
      let candidate = branch;
      for (const offer of entry.offers) {
        const offerFacts = rewardFacts(
          catalog,
          room,
          declaration,
          view,
          candidate.history,
          enteredBiomeCount,
        );
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
      addFinding(findings, finding(code, offer.offerOrigin, offerEvidence(offer.offer)));
    }
    if (unsupportedIndexes.length === 0) {
      addFinding(
        findings,
        finding('shopOfferUnavailable', room.origin, {
          offerKeys: entry.offers.map((offer) => offer.offerKey),
          kind: 'jointOfferSet',
        }),
      );
    }
  }
  return Object.freeze(next);
}

function processShopPurchases(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  view: LinearHistoryStateView,
  historySequence: number,
  findings: Map<string, SemanticFinding>,
  enteredBiomeCount: number,
): readonly RewardBranchState[] {
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    throw new LinearRewardSimulationContractError(
      `${room.gameName} applied missing shop purchases`,
    );
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    throw new LinearRewardSimulationContractError(`unknown shop profile ${entry.profileKey}`);
  }
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
    purchased: offer.purchased,
  }));
  const next: RewardBranchState[] = [];
  const failures: ShopPurchaseFailure[] = [];
  for (const branch of branches) {
    const pending = branch.pendingShops[semanticAddressKey(room.origin)];
    if (pending?.profileKey !== profile.key) {
      throw new LinearRewardSimulationContractError(`${room.gameName} lost its shop witness`);
    }
    const facts = rewardFacts(catalog, room, declaration, view, branch.history, enteredBiomeCount);
    const simulation = evaluateShopPurchases(
      catalog.rewards,
      profile,
      authored,
      pending.witness,
      branch.history,
      facts,
    );
    failures.push(...simulation.failures);
    for (const result of simulation.results) {
      let candidate: RewardBranchState = Object.freeze({ ...branch, history: result.history });
      for (const acquisition of result.acquisitions) {
        const offer = entry.offers[acquisition.slotIndex];
        if (offer === undefined) {
          throw new LinearRewardSimulationContractError('shop acquisition has no semantic slot');
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
      addFinding(
        findings,
        finding('shopPurchaseUnavailable', offer.purchaseOrigin, offerEvidence(offer.offer)),
      );
    }
    if (failedIndexes.length === 0) {
      addFinding(
        findings,
        finding('shopPurchaseUnavailable', room.origin, {
          kind: 'jointPurchaseSet',
          offerKeys: purchasedIndexes.map((index) => entry.offers[index]!.offerKey),
        }),
      );
    }
  }
  return mergeEquivalentBranchStates(next);
}

function processProducerRole(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  view: LinearHistoryStateView,
  event: Extract<
    CanonicalLinearHistory['events'][number],
    { readonly kind: 'producerRoleAdvanced' }
  >,
  findings: Map<string, SemanticFinding>,
  enteredBiomeCount: number,
): readonly RewardBranchState[] {
  const incoming = room.incomingReward;
  if (
    incoming === undefined ||
    incoming.offer.rewardType !== event.rewardType ||
    incoming.producerLifecycleKey !== event.producerLifecycleKey
  ) {
    throw new LinearRewardSimulationContractError(
      `${room.gameName} producer event does not match its offer`,
    );
  }
  const next: RewardBranchState[] = [];
  for (const branch of branches) {
    const facts = rewardFacts(catalog, room, declaration, view, branch.history, enteredBiomeCount);
    if (
      !isOfferSupportedAtResolutionPoint(catalog.rewards, incoming.offer, facts, {
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
    addFinding(
      findings,
      finding('rewardAcquisitionUnavailable', incoming.origin, {
        ...offerEvidence(incoming.offer),
        role: event.role,
        lifecyclePoint: event.lifecyclePoint,
      }),
    );
  }
  return Object.freeze(next);
}

function processLocalRewardAcquisition(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  reward: CanonicalLocalReward,
  view: LinearHistoryStateView,
  historySequence: number,
  findings: Map<string, SemanticFinding>,
  enteredBiomeCount: number,
): readonly RewardBranchState[] {
  const producer = catalog.rewards.producerLifecycles.byKey[reward.producerLifecycleKey];
  const lifecycle = producer?.rewardTypes.byKey[reward.offer.rewardType];
  if (lifecycle === undefined) {
    throw new LinearRewardSimulationContractError(
      `${reward.producerLifecycleKey} does not support ${reward.offer.rewardType}`,
    );
  }
  let current = branches;
  for (const binding of lifecycle.acquisitionLifecycle) {
    const next: RewardBranchState[] = [];
    for (const branch of current) {
      const facts = rewardFacts(
        catalog,
        room,
        declaration,
        view,
        branch.history,
        enteredBiomeCount,
      );
      if (
        !isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, {
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
      addFinding(
        findings,
        finding('rewardAcquisitionUnavailable', reward.origin, {
          ...offerEvidence(reward.offer),
          role: binding.role,
          lifecyclePoint: binding.lifecyclePoint,
        }),
      );
      return Object.freeze([]);
    }
    current = Object.freeze(next);
  }
  return Object.freeze(current.map((branch) => advanceBranch(branch, historySequence)));
}

function publicBranch(branch: RewardBranchState): LinearRewardBranch {
  return Object.freeze({
    bags: branch.bags,
    history: branch.history,
    events: branch.events,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
  });
}

export function evaluateLinearRewards(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalLinearHistory,
  enteredBiomeCount: number,
  initialBranches?: readonly LinearRewardBranch[],
): LinearRewardSimulation {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new LinearRewardSimulationContractError(
      'linear reward inputs do not share one biome owner',
    );
  }
  const layout = requireLinearLayout(catalog, snapshot);
  const rooms = authoredRooms(snapshot);
  const views = roomViews(history);
  const targets = canonicalTargets(snapshot);
  const batchesByParent = new Map(
    snapshot.batches.map((batch) => [semanticAddressKey(batch.parent.origin), batch]),
  );
  const terminalParentKey = semanticAddressKey(snapshot.terminalEntry.predecessor.origin);
  const expectedStores = new Map<string, string | undefined>();
  const storeSupportEntries: LinearRewardStoreSupportEntry[] = [];
  const findings = new Map<string, SemanticFinding>();
  let peers: readonly CanonicalResolvedIncomingReward['offer'][] = Object.freeze([]);
  let branches: readonly RewardBranchState[] =
    initialBranches === undefined
      ? [
          Object.freeze({
            bags: Object.freeze({}),
            history: createRewardHistoryState(),
            events: Object.freeze([]),
            pendingShops: Object.freeze({}),
            processedThroughHistorySequence: 0,
          }),
        ]
      : initialBranches.map((branch) =>
          Object.freeze({
            bags: branch.bags,
            history: beginBiomeRewardHistory(branch.history),
            events: Object.freeze([]),
            pendingShops: Object.freeze({}),
            processedThroughHistorySequence: 0,
          }),
        );

  for (const event of history.events) {
    if (branches.length === 0) {
      break;
    }
    switch (event.kind) {
      case 'roomPrepared':
        branches = branches.map((branch) =>
          advanceBranch(
            Object.freeze({ ...branch, history: beginCurrentRoomRewardHistory(branch.history) }),
            event.sequence,
          ),
        );
        break;
      case 'roomCreated': {
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room === undefined) {
          branches = branches.map((branch) => advanceBranch(branch, event.sequence));
          break;
        }
        if (room.gameName !== event.gameName) {
          throw new LinearRewardSimulationContractError(
            `${semanticAddressKey(event.origin)} is ${room.gameName} in the snapshot but ${event.gameName} in history`,
          );
        }
        const incoming = room.incomingReward;
        const localRewards = room.localRewards ?? [];
        if (incoming === undefined && localRewards.length === 0) {
          branches = branches.map((branch) => advanceBranch(branch, event.sequence));
          break;
        }
        const declaration = catalog.rooms.byKey[room.gameName];
        if (declaration === undefined) {
          throw new LinearRewardSimulationContractError(`${room.gameName} has no declaration`);
        }
        let source = room;
        let view = views.get(semanticAddressKey(room.origin))?.preparation;
        let currentShopNames: ReadonlySet<string> = new Set();
        if (event.source === 'generatedTarget') {
          const target = targets.get(semanticAddressKey(event.targetOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          if (target === undefined || parent === undefined || parentViews === undefined) {
            throw new LinearRewardSimulationContractError('generated reward lost its source room');
          }
          if (
            semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin) ||
            semanticAddressKey(target.origin) !== semanticAddressKey(event.targetOrigin) ||
            semanticAddressKey(parent.origin) !== semanticAddressKey(event.parentOrigin)
          ) {
            throw new LinearRewardSimulationContractError(
              `target ${semanticAddressKey(event.targetOrigin)} does not match its reward history event`,
            );
          }
          source = parent;
          view =
            parentViews.targetGenerations.find(
              (candidate) =>
                semanticAddressKey(candidate.targetOrigin) ===
                semanticAddressKey(event.targetOrigin),
            )?.before ?? parentViews.preOutgoing!;
          currentShopNames = new Set(
            parent.entryState?.offers.map((offer) => offer.offer.rewardType) ?? [],
          );
          const expectedStore = expectedStores.get(semanticAddressKey(event.targetOrigin));
          const resolvedStores = [
            ...(incoming === undefined ? [] : [incoming.resolvedStoreKey]),
            ...localRewards.map((reward) => reward.resolvedStoreKey),
          ];
          if (resolvedStores.some((storeKey) => storeKey !== expectedStore)) {
            throw new LinearRewardSimulationContractError(
              `${room.gameName} resolved a reward store other than ${String(expectedStore)}`,
            );
          }
        } else if (localRewards.length !== 0) {
          throw new LinearRewardSimulationContractError(
            `${room.gameName} materialized local rewards outside a generated target`,
          );
        }
        if (view === undefined) {
          throw new LinearRewardSimulationContractError(
            `${room.gameName} has no offer-time history view`,
          );
        }
        if (incoming !== undefined) {
          const binding = countedBinding(declaration, incoming);
          branches = processRewardOffer(
            branches,
            {
              catalog,
              reward: incoming,
              ...(binding === undefined ? {} : { binding }),
              declaration,
              source,
              view,
              historySequence: event.sequence,
              peers,
              currentRoomShopOptionNames: currentShopNames,
              enteredBiomeCount,
            },
            findings,
          );
          if (event.source === 'generatedTarget') {
            peers = Object.freeze([...peers, incoming.offer]);
          }
        }
        for (const localReward of localRewards) {
          branches = processRewardOffer(
            branches,
            {
              catalog,
              reward: localReward,
              binding: localRewardBinding(declaration, localReward),
              declaration,
              source,
              view,
              historySequence: event.sequence,
              peers,
              currentRoomShopOptionNames: currentShopNames,
              enteredBiomeCount,
            },
            findings,
          );
          peers = Object.freeze([...peers, localReward.offer]);
        }
        break;
      }
      case 'outgoingGenerationCheckpoint': {
        const source = rooms.get(semanticAddressKey(event.origin));
        const sourceViews = views.get(semanticAddressKey(event.origin));
        const declaration = source && catalog.rooms.byKey[source.gameName];
        if (source === undefined || sourceViews === undefined || declaration === undefined) {
          throw new LinearRewardSimulationContractError(
            'outgoing reward checkpoint has no authored source',
          );
        }
        const batch = batchesByParent.get(semanticAddressKey(event.origin));
        const isTerminal = semanticAddressKey(event.origin) === terminalParentKey;
        const targetSet =
          batch?.targets ?? (isTerminal ? snapshot.terminalEntry.targets : undefined);
        if (targetSet === undefined) {
          throw new LinearRewardSimulationContractError(
            `${source.gameName} has no outgoing reward batch`,
          );
        }
        let sharedStore: string | undefined;
        if (batch !== undefined) {
          if (batch.rewardStore.kind === 'authoredBaseStore') {
            const support = storeSupport(
              layout,
              batch,
              source,
              declaration,
              sourceViews.preOutgoing ?? sourceViews.preparation,
              event.sequence,
            );
            storeSupportEntries.push(support);
            sharedStore = support.authoredStoreKey;
            if (!support.selectedPossible) {
              addFinding(
                findings,
                finding('baseRewardStoreUnavailable', support.origin, {
                  authoredStoreKey: support.authoredStoreKey,
                  enteredStoreCount: support.enteredStoreCount,
                  enteredMetaStoreCount: support.enteredMetaStoreCount,
                  currentMetaRatio: support.currentMetaRatio,
                  metaSelectionValue: support.metaSelectionValue,
                  supportStoreKeys: support.supportStoreKeys,
                }),
              );
            }
          } else if (batch.rewardStore.kind !== 'none') {
            throw new LinearRewardSimulationContractError(
              `${source.gameName} exposes an unsupported generated reward store`,
            );
          }
        }
        for (const [targetKey, storeKey] of expectedTargetStores(catalog, targetSet, sharedStore)) {
          expectedStores.set(targetKey, storeKey);
        }
        peers = Object.freeze([]);
        branches = branches.map((branch) => advanceBranch(branch, event.sequence));
        break;
      }
      case 'offerPointMaterialized': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          throw new LinearRewardSimulationContractError('shop offer point has no authored room');
        }
        branches = processShopInventory(
          catalog,
          branches,
          room,
          declaration,
          roomView.preparation,
          event.sequence,
          findings,
          enteredBiomeCount,
        );
        break;
      }
      case 'producerRoleAdvanced': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          throw new LinearRewardSimulationContractError('producer role has no authored room');
        }
        branches = processProducerRole(
          catalog,
          branches,
          room,
          declaration,
          roomView.preOutgoing ?? roomView.entry,
          event,
          findings,
          enteredBiomeCount,
        );
        break;
      }
      case 'encounterCompleted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          branches = branches.map((branch) => advanceBranch(branch, event.sequence));
          break;
        }
        const matchingRewards =
          room.localRewards?.filter((reward) => reward.encounterPhaseKey === event.phaseKey) ?? [];
        if (matchingRewards.length === 0) {
          branches = branches.map((branch) => advanceBranch(branch, event.sequence));
          break;
        }
        if (matchingRewards.length !== 1 || matchingRewards[0] === undefined) {
          throw new LinearRewardSimulationContractError(
            `${room.gameName}.${event.phaseKey} does not own exactly one local reward`,
          );
        }
        branches = processLocalRewardAcquisition(
          catalog,
          branches,
          room,
          declaration,
          matchingRewards[0],
          roomView.preOutgoing ?? roomView.entry,
          event.sequence,
          findings,
          enteredBiomeCount,
        );
        break;
      }
      case 'shopPurchasesApplied': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          throw new LinearRewardSimulationContractError('shop purchases have no authored room');
        }
        branches = processShopPurchases(
          catalog,
          branches,
          room,
          declaration,
          roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
          event.sequence,
          findings,
          enteredBiomeCount,
        );
        break;
      }
      default:
        branches = branches.map((branch) => advanceBranch(branch, event.sequence));
        break;
    }
  }

  const immutableFindings = Object.freeze([...findings.values()]);
  return Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    storeSupport: Object.freeze(storeSupportEntries),
    branches: Object.freeze(branches.map(publicBranch)),
    findings: immutableFindings,
  });
}

export function evaluateFRewards(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalLinearHistory,
): LinearRewardSimulation {
  if (snapshot.biomeKey !== 'F' || history.biomeKey !== 'F') {
    throw new LinearRewardSimulationContractError('F rewards require biome F');
  }
  return evaluateLinearRewards(catalog, snapshot, history, 1);
}
