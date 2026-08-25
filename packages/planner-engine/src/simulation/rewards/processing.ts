import type { Catalog, KeepsakeRank, RoomDeclaration } from '../../catalog-schema';

import {
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';

import {
  applyOfferProjection,
  beginBiomeRewardHistory,
  beginCurrentRoomRewardHistory,
  consumeCountedOffer,
  createRewardBagState,
  createRewardHistoryState,
  isOfferSupportedAtResolutionPoint,
  isPayloadLocallyValid,
  type RewardBagState,
  type ResolvedRewardOffer,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';

import type { CanonicalResolvedIncomingReward } from '../materialization';
import { type FindingEvidence, type RewardGenerationFindingCode } from '../model';
import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';
import type { RewardBranch } from './model';
import {
  attachTraitHistory,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  recordReachedTraitOffer,
  recordAspectStartingTrait,
} from '../traits';
import { type AuthoredTraitOffer } from '../../authored-project/traits';

import type { ArcanaFearState } from '../arcana-fear';
import { beginBiomeArcanaFearState } from '../arcana-fear';
import {
  createKeepsakeState,
  assessExperimentalHammerEquipResult,
  equipExperimentalHammer,
  assessJeweledPomEquipResult,
  equipJeweledPom,
  jeweledPomEffectForKey,
  beginBiomeKeepsakeState,
} from '../keepsakes';
import {
  appendRewardEvent,
  freezeRecord,
  mergeEquivalentRewardBranches,
  offerEvidence,
  type RewardBranchState,
} from './branch-primitives';
import { historyChronology, type RewardFactsFactory } from './acquisition-settlement';

import { addRewardFinding, rewardFinding } from './findings';

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
  initialArcanaFear?: ArcanaFearState,
  catalog?: Catalog,
  startingKeepsakeKey?: string,
  startingKeepsakeEquipResults?: AuthoredKeepsakeEquipResults,
  routeKey?: string,
  loadout?: { readonly weaponKey: string; readonly aspectKey: string },
): readonly RewardBranchState[] {
  if (initialBranches === undefined) {
    if (
      initialArcanaFear === undefined ||
      catalog === undefined ||
      startingKeepsakeKey === undefined
    )
      throw new Error('initial branch state is required');
    const branch = Object.freeze({
      bags: Object.freeze({}),
      history: createRewardHistoryState(),
      events: Object.freeze([]),
      pendingShops: Object.freeze({}),
      pendingHermesShrineDeliveries: Object.freeze({}),
      stygianWell: Object.freeze({
        sparkUses: 0,
        yarnUses: 0,
        hymnUses: 0,
        discountUses: Object.freeze([]),
        emptySlotUses: Object.freeze([]),
        extendedUses: 0,
      }),
      processedThroughHistorySequence: 0,
      traitHistory: createTraitHistoryState(),
      traitEvaluations: Object.freeze([]),
      arcanaFear: initialArcanaFear,
      keepsakes: createKeepsakeState(catalog, startingKeepsakeKey, initialArcanaFear),
    });
    const pomApplied = applyJeweledPomEquipResult(
      catalog,
      branch,
      startingKeepsakeKey,
      startingKeepsakeEquipResults,
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
        'jeweledPom',
      ),
      0,
    );
    const initialized = applyExperimentalHammerEquipResult(
      catalog,
      pomApplied,
      startingKeepsakeKey,
      startingKeepsakeEquipResults,
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
        'experimentalHammer',
      ),
      0,
      loadout ?? { weaponKey: '', aspectKey: '' },
    );
    const traitHistory = recordAspectStartingTrait(
      catalog,
      initialized.traitHistory ?? createTraitHistoryState(),
      createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
      loadout ?? { aspectKey: '' },
    );
    return Object.freeze([
      traitHistory === initialized.traitHistory
        ? initialized
        : Object.freeze({
            ...initialized,
            history: attachTraitHistory(initialized.history, traitHistory),
            traitHistory,
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
        pendingHermesShrineDeliveries: branch.pendingHermesShrineDeliveries ?? Object.freeze({}),
        stygianWell:
          branch.stygianWell ??
          Object.freeze({
            sparkUses: 0,
            yarnUses: 0,
            hymnUses: 0,
            discountUses: Object.freeze([]),
            emptySlotUses: Object.freeze([]),
            extendedUses: 0,
          }),
        processedThroughHistorySequence: 0,
        traitHistory: branch.traitHistory ?? createTraitHistoryState(),
        traitEvaluations: Object.freeze([]),
        arcanaFear: beginBiomeArcanaFearState(branch.arcanaFear),
        keepsakes: beginBiomeKeepsakeState(branch.keepsakes),
      }),
    ),
  );
}

/** Applies the closed immediate Jeweled Pom result through ordinary trait history. */
export function applyJeweledPomEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
  equippedRank?: KeepsakeRank,
): RewardBranchState {
  const result = results?.jeweledPom;
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = jeweledPomEffectForKey(catalog, equippedKeepsakeKey);
  if (keepsake === undefined || effect === undefined || result === undefined) return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessJeweledPomEquipResult(catalog, result, before, branch.keepsakes.fatedStatus).legal)
    return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      {
        traitKey: result.traitKey,
        ...(result.rarity === undefined ? {} : { rarity: result.rarity }),
      },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'jeweledPomEquip',
    offer,
    before,
    {
      resolvedProviderKey: effect.giverKey,
    },
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipJeweledPom(
      branch.keepsakes,
      result.traitKey,
      effect.subsequentEligibleTraitLevelsByRank[equippedRank ?? keepsake.rank],
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

/** Applies the one direct, rarityless Experimental Hammer acquisition. */
export function applyExperimentalHammerEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
  equippedRank?: KeepsakeRank,
): RewardBranchState {
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = keepsake?.effect;
  const result = results?.experimentalHammer;
  if (keepsake === undefined || effect?.kind !== 'experimentalHammer' || result === undefined)
    return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessExperimentalHammerEquipResult(catalog, result, before, loadout).legal) return branch;
  if (result.kind === 'exhausted') return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      { traitKey: result.traitKey },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'experimentalHammerEquip',
    offer,
    before,
    loadout,
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipExperimentalHammer(
      branch.keepsakes,
      result.traitKey,
      effect.qualifyingEncounterUsesByRank[equippedRank ?? keepsake.rank],
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

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
    const facts = context.facts(originalBranch.history, undefined, originalBranch);
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
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
  }
  return Object.freeze(next);
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

export function publicRewardBranch(branch: RewardBranchState): RewardBranch {
  return Object.freeze({
    bags: branch.bags,
    history: branch.history,
    events: branch.events,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
    ...(branch.traitHistory === undefined ? {} : { traitHistory: branch.traitHistory }),
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
    ...(Object.keys(branch.pendingHermesShrineDeliveries).length === 0
      ? {}
      : { pendingHermesShrineDeliveries: branch.pendingHermesShrineDeliveries }),
    ...(branch.stygianWell.sparkUses === 0 &&
    branch.stygianWell.yarnUses === 0 &&
    branch.stygianWell.hymnUses === 0 &&
    branch.stygianWell.extendedUses === 0 &&
    branch.stygianWell.discountUses.length === 0 &&
    branch.stygianWell.emptySlotUses.length === 0
      ? {}
      : { stygianWell: branch.stygianWell }),
  });
}
