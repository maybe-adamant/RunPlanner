import type { Catalog, BiomeLayout, RoomDeclaration } from '../../catalog-schema';
import {
  createBiomeAddress,
  createTargetAddress,
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type ExitDecisionAddress,
  type SemanticAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type { RouteLoadout, ShipCombatState } from '../../authored-project/model';
import { encounterEnvelopeSlots } from '../../authored-project/room-state/encounters';
import { type RewardHistoryState, type RewardKernelFacts } from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type {
  EncounterHistoryEntry,
  BiomeHistoryPrefix,
  CanonicalBiomeHistory,
  HistoryStateView,
  ProgressiveRoomHistoryViews,
  RoomCreationSource,
} from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalAdditionalContinuation,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalLocalChildRoom,
  CanonicalLocalReward,
  CanonicalResolvedIncomingReward,
  CanonicalRewardWheel,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedHubVisitFrontier,
} from '../materialization';
import type { CanonicalDecision } from '../materialization/model';
import { materializeShipCombatState } from '../materialization';
import type { ResolvedEncounterPhase } from '../encounters';
import type { SemanticFinding } from '../model';
import type {
  RewardBranch,
  BiomeRewardSimulation,
  RewardStoreCandidateSupport,
  RewardStoreSupportEntry,
  TargetRewardHistoryCheckpoint,
} from './model';
import { createRewardFacts, createdPeerGameNames } from './facts';
import {
  createRoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateResult,
  type ShipLifecycleCandidateContext,
  type ShopPurchaseCandidateContext,
} from './lifecycle-artifacts';
import {
  createRewardProducerCandidateArtifacts,
  indexRewardProducerFrontier,
  type RewardProducerCandidateArtifacts,
  type RewardProducerCandidateResult,
  type RewardProducerFrontier,
} from './producer-frontiers';
import {
  addRewardFinding,
  advanceRewardBranches,
  beginRewardRoom,
  countedBinding,
  initializeRewardBranches,
  processProducerRole,
  processJointUnorderedOffers,
  processOwnedRewardAcquisition as processOwnedRewardAcquisitionState,
  processRewardOffer,
  processShopInventory,
  processShopPurchases,
  publicRewardBranch,
  rewardFinding,
  type OfferProcessingPeer,
  type RewardBranchState,
} from './processing';
import { prepareShopPurchaseCandidateContext } from './shop-candidates';

type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalChildRoom;
type CanonicalRewardSource = CanonicalRewardRoom | CanonicalHubRoom;

/** The reward engine only needs materialized rooms and selected decisions. */
export type BiomeRewardSnapshot =
  CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom });
export type BiomeRewardHistory = CanonicalBiomeHistory | BiomeHistoryPrefix;

export class BiomeRewardSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeRewardSimulationContractError';
  }
}

function fail(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

function rewardFacts(
  catalog: Catalog,
  source: CanonicalRewardSource,
  currentRoom: CanonicalRewardSource | undefined,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  history: RewardHistoryState,
  enteredBiomeCount: number,
  currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
  peerParentOrigin = source.origin,
  peerCreationSource: RoomCreationSource = 'generatedTarget',
  rewardLookups: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({}),
): RewardKernelFacts {
  return createRewardFacts({
    catalog,
    currentRoom,
    sourceDeclaration,
    view,
    history,
    enteredBiomeCount,
    currentBatchRoomGameNames: createdPeerGameNames(
      catalog,
      view,
      peerParentOrigin,
      peerCreationSource,
    ),
    currentRoomShopOptionNames,
    rewardLookups,
    fail,
  });
}
function requireRewardLayout(catalog: Catalog, snapshot: BiomeRewardSnapshot): BiomeLayout {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  const supportedPolicy =
    layout !== undefined &&
    (layout.progression.kind === 'hub' ||
      layout.progression.rewardStorePolicy.kind === 'authoredBaseStore' ||
      (layout.progression.progressionPolicy.kind === 'staged' &&
        layout.progression.batchPolicy.kind === 'standard' &&
        layout.progression.rewardStorePolicy.kind === 'none') ||
      (layout.progression.batchPolicy.kind === 'clockwork' &&
        layout.progression.rewardStorePolicy.kind === 'none') ||
      (layout.progression.batchPolicy.kind === 'fields' &&
        layout.progression.rewardStorePolicy.kind === 'none'));
  if (layout === undefined || !supportedPolicy) {
    throw new BiomeRewardSimulationContractError(
      `catalog does not provide supported ${snapshot.biomeKey} reward stores`,
    );
  }
  return layout;
}

function frontierBatch(snapshot: BiomeRewardSnapshot): readonly CanonicalBatch[] {
  return snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
    ? snapshot.frontier.partialBatch === undefined
      ? Object.freeze([])
      : Object.freeze([snapshot.frontier.partialBatch])
    : Object.freeze([]);
}

function frontierAdditional(
  snapshot: BiomeRewardSnapshot,
): readonly CanonicalAdditionalContinuation[] {
  return snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
    ? snapshot.frontier.additional
    : Object.freeze([]);
}

function rewardDecisions(snapshot: BiomeRewardSnapshot): readonly CanonicalDecision[] {
  return Object.freeze([...snapshot.decisions, ...frontierBatch(snapshot)]);
}

function batches(snapshot: BiomeRewardSnapshot): readonly CanonicalBatch[] {
  return rewardDecisions(snapshot).filter(
    (decision): decision is CanonicalBatch => decision.kind === 'batch',
  );
}

function hasHubVisitDetails(
  frontier: MaterializedBiomePrefix['frontier'] | undefined,
): frontier is MaterializedHubVisitFrontier {
  return frontier?.kind === 'hubVisit' && 'phase' in frontier;
}

function hubVisitFrontier(snapshot: BiomeRewardSnapshot): MaterializedHubVisitFrontier | undefined {
  const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
  return hasHubVisitDetails(frontier) ? frontier : undefined;
}

function hubFrontierRooms(snapshot: BiomeRewardSnapshot): readonly CanonicalRewardSource[] {
  const frontier = hubVisitFrontier(snapshot);
  if (frontier === undefined) return Object.freeze([]);
  return Object.freeze([frontier.target.room, ...frontier.localSlots]);
}

function rewardRooms(snapshot: BiomeRewardSnapshot): ReadonlyMap<string, CanonicalRewardSource> {
  const rooms = [
    snapshot.entryRoom,
    ...rewardDecisions(snapshot).flatMap((decision) =>
      decision.kind === 'batch'
        ? [
            ...decision.targets.map((target) => target.room),
            ...decision.additional.map((continuation) => continuation.room),
          ]
        : [
            decision.room,
            ...decision.board.targets.map((target) => target.room),
            ...decision.visits.flatMap((visit) => visit.localSlots),
          ],
    ),
    ...frontierAdditional(snapshot).map((continuation) => continuation.room),
    ...hubFrontierRooms(snapshot),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function canonicalAdditionalContinuations(
  snapshot: BiomeRewardSnapshot,
): ReadonlyMap<string, CanonicalAdditionalContinuation> {
  return new Map(
    [
      ...rewardDecisions(snapshot).flatMap((decision) =>
        decision.kind === 'batch' ? decision.additional : [],
      ),
      ...frontierAdditional(snapshot),
    ].map((continuation) => [semanticAddressKey(continuation.origin), continuation]),
  );
}

function hubTargets(snapshot: BiomeRewardSnapshot): ReadonlyMap<string, CanonicalHubTarget> {
  return new Map(
    rewardDecisions(snapshot)
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .flatMap((decision) => decision.board.targets)
      .map((target) => [semanticAddressKey(target.origin), target]),
  );
}

function hubRewardLookups(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
): {
  readonly internal: Readonly<Record<string, ReadonlySet<string>>>;
  readonly public: Readonly<Record<string, readonly string[]>>;
} {
  const descriptor = catalog.biomeLayouts.byKey[snapshot.biomeKey]?.progression;
  const hub = snapshot.decisions.find(
    (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
      decision.kind === 'hub',
  );
  if (descriptor?.kind !== 'hub' || hub === undefined) {
    return Object.freeze({ internal: Object.freeze({}), public: Object.freeze({}) });
  }
  if (hub.origin.hubKey !== descriptor.hubKey) {
    throw new BiomeRewardSimulationContractError(
      `${snapshot.biomeKey} reward lookup has the wrong Hub decision`,
    );
  }
  const orderedTypes: string[] = [];
  const uniqueTypes = new Set<string>();
  for (const target of hub.board.targets) {
    const incoming = target.room.incomingReward;
    if (incoming === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${target.room.gameName} has no Hub-board reward for ${descriptor.rewardLookup.key}`,
      );
    }
    if (!uniqueTypes.has(incoming.offer.rewardType)) {
      uniqueTypes.add(incoming.offer.rewardType);
      orderedTypes.push(incoming.offer.rewardType);
    }
  }
  return Object.freeze({
    internal: Object.freeze({ [descriptor.rewardLookup.key]: uniqueTypes }),
    public: Object.freeze({ [descriptor.rewardLookup.key]: Object.freeze(orderedTypes) }),
  });
}

function roomViews(history: BiomeRewardHistory): ReadonlyMap<string, ProgressiveRoomHistoryViews> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function canonicalTargets(snapshot: BiomeRewardSnapshot): ReadonlyMap<string, CanonicalTarget> {
  return new Map(
    rewardDecisions(snapshot)
      .flatMap((decision) => (decision.kind === 'batch' ? decision.targets : []))
      .map((target) => [semanticAddressKey(target.origin), target]),
  );
}

function enteredStoreKey(
  room: CanonicalRewardRoom,
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

export function rewardStoreCandidateSupport(
  layout: BiomeLayout,
  origin: BatchRewardStoreAddress,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  historySequence: number,
): RewardStoreCandidateSupport {
  if (layout.progression.kind !== 'generated') {
    throw new BiomeRewardSimulationContractError(
      'Hub progression has no authored base-store policy',
    );
  }
  const policy = layout.progression.rewardStorePolicy;
  if (policy.kind !== 'authoredBaseStore') {
    throw new BiomeRewardSimulationContractError(
      'generated progression lost its authored base-store contract',
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
    origin,
    historySequence,
    enteredStoreCount: stores.length,
    enteredMetaStoreCount: metaCount,
    currentMetaRatio: ratio,
    metaSelectionValue,
    supportStoreKeys,
  });
}

function storeSupport(
  layout: BiomeLayout,
  batch: Pick<CanonicalBatch, 'rewardStore'>,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  historySequence: number,
): RewardStoreSupportEntry {
  if (batch.rewardStore.kind !== 'authoredBaseStore') {
    throw new BiomeRewardSimulationContractError(
      'generated batch lost its authored base-store contract',
    );
  }
  const support = rewardStoreCandidateSupport(
    layout,
    batch.rewardStore.origin,
    source,
    sourceDeclaration,
    view,
    historySequence,
  );
  return Object.freeze({
    ...support,
    authoredStoreKey: batch.rewardStore.baseRewardStoreKey,
    selectedPossible: support.supportStoreKeys.includes(batch.rewardStore.baseRewardStoreKey),
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
      throw new BiomeRewardSimulationContractError(`unknown target room ${target.room.gameName}`);
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
        declaration.forcedRewardStoreKey ??
          declaration.individualRewardStoreKey ??
          finalSharedStoreKey,
      ];
    }),
  );
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
    throw new BiomeRewardSimulationContractError(
      `${declaration.gameName} does not own local reward ${reward.groupKey}.${reward.slotKey}`,
    );
  }
  return descriptor.reward;
}

function rewardWheelBinding(
  catalog: Catalog,
  declaration: RoomDeclaration,
  wheel: CanonicalRewardWheel,
): CountedRewardBinding {
  const descriptor = encounterEnvelopeSlots(catalog, declaration, declaration.gameName).find(
    (slot) => slot.key === wheel.encounterPhaseKey,
  )?.rewardAttachment;
  if (
    descriptor?.kind !== 'rewardWheel' ||
    descriptor.key !== wheel.wheelKey ||
    descriptor.reward.producerLifecycleKey !== wheel.producerLifecycleKey ||
    !descriptor.reward.storeKeys.includes(wheel.storeKey)
  ) {
    throw new BiomeRewardSimulationContractError(
      `${declaration.gameName} does not own reward wheel ${wheel.wheelKey}`,
    );
  }
  return descriptor.reward;
}

function processOwnedRewardAcquisition(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalRewardRoom,
  declaration: RoomDeclaration,
  reward: {
    readonly offer: CanonicalResolvedIncomingReward['offer'];
    readonly origin: SemanticAddress;
    readonly producerLifecycleKey: string;
    readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
  },
  view: HistoryStateView,
  historySequence: number,
  findings: Map<string, SemanticFinding>,
  enteredBiomeCount: number,
): readonly RewardBranchState[] {
  return processOwnedRewardAcquisitionState(
    catalog,
    branches,
    reward,
    historySequence,
    (history) => rewardFacts(catalog, room, room, declaration, view, history, enteredBiomeCount),
    findings,
    fail,
  );
}

function candidateResult(
  findings: Map<string, SemanticFinding>,
  branches: readonly RewardBranchState[],
): RewardProducerCandidateResult {
  return Object.freeze({
    findings: Object.freeze([...findings.values()]),
    supported: branches.length > 0,
  });
}

function lifecycleCandidateResult(
  findings: Map<string, SemanticFinding>,
  branches: readonly RewardBranchState[],
): RoomLifecycleCandidateResult {
  return candidateResult(findings, branches);
}

interface WheelLifecycleView {
  readonly generation: HistoryStateView;
  readonly acquisition: HistoryStateView;
  readonly acquisitionSequence: number;
}

function projectedEncounterEntry(
  room: CanonicalAuthoredRoom,
  phase: ResolvedEncounterPhase,
  sequence: number,
): EncounterHistoryEntry {
  return Object.freeze({
    sequence,
    origin: room.origin,
    gameName: room.gameName,
    encounterEnvelopeKey: phase.envelopeKey,
    slotKey: phase.slotKey,
    encounterKey: phase.encounterKey,
    phaseKind: phase.kind,
  });
}

function projectDormantWheelView(
  room: CanonicalAuthoredRoom,
  phase: ResolvedEncounterPhase,
  generation: HistoryStateView,
): WheelLifecycleView {
  const start = projectedEncounterEntry(room, phase, generation.sequence + 2);
  const completion = projectedEncounterEntry(room, phase, generation.sequence + 4);
  const encounterDelta = phase.countsEncounterDepth ? 1 : 0;
  const acquisition = Object.freeze({
    sequence: completion.sequence,
    ledgers: Object.freeze({
      ...generation.ledgers,
      encounterStarts: Object.freeze([...generation.ledgers.encounterStarts, start]),
      encounterCompletions: Object.freeze([...generation.ledgers.encounterCompletions, completion]),
      counters: Object.freeze({
        ...generation.ledgers.counters,
        biomeEncounterDepth: generation.ledgers.counters.biomeEncounterDepth + encounterDelta,
        routeEncounterDepth: generation.ledgers.counters.routeEncounterDepth + encounterDelta,
      }),
    }),
  });
  return Object.freeze({
    generation,
    acquisition,
    acquisitionSequence: acquisition.sequence + 1,
  });
}

function wheelLifecycleViews(
  history: BiomeRewardHistory,
  room: CanonicalAuthoredRoom,
  roomView: ProgressiveRoomHistoryViews,
  wheel: CanonicalRewardWheel,
): WheelLifecycleView {
  const selected = roomView.offerPoints?.find(
    (candidate) => candidate.offerPoint === wheel.wheelKey,
  );
  if (selected !== undefined) {
    const acquisitionEvent = history.events.find(
      (candidate) =>
        candidate.kind === 'offerPointAcquired' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin) &&
        candidate.offerPoint === wheel.wheelKey,
    );
    if (selected.acquisitionBefore === undefined || acquisitionEvent === undefined) {
      return fail(`${room.gameName}.${wheel.wheelKey} has no acquisition lifecycle view`);
    }
    return Object.freeze({
      generation: selected.before,
      acquisition: selected.acquisitionBefore,
      acquisitionSequence: acquisitionEvent.sequence,
    });
  }
  const phase = room.encounterPhases.find(
    (candidate) => candidate.slotKey === wheel.encounterPhaseKey,
  );
  const generation = roomView.preOutgoing;
  if (phase === undefined || generation === undefined) {
    return fail(`${room.gameName}.${wheel.wheelKey} has no dormant lifecycle view`);
  }
  return projectDormantWheelView(room, phase, generation);
}

function prepareShipLifecycleCandidateContext(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  roomView: ProgressiveRoomHistoryViews,
  history: BiomeRewardHistory,
  branchesBeforeFirstWheel: readonly RewardBranchState[],
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
): ShipLifecycleCandidateContext {
  const activeWheelKeys = Object.freeze(room.rewardWheels?.map((wheel) => wheel.wheelKey) ?? []);
  return Object.freeze({
    origin: room.origin,
    activeWheelKeys,
    evaluateState: (state: ShipCombatState): RoomLifecycleCandidateResult => {
      const ship = materializeShipCombatState(
        catalog,
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        declaration,
        Object.freeze({
          occurrenceId: room.occurrenceId,
          gameName: room.gameName,
          state,
          encounters: room.encounters,
          additionalExits: Object.freeze([]),
        }),
        routeLoadout,
      );
      const candidateRoom = Object.freeze({
        ...room,
        encounterPhases: ship.encounterPhases,
        rewardWheels: ship.rewardWheels,
      });
      const candidateFindings = new Map<string, SemanticFinding>();
      let candidateBranches = branchesBeforeFirstWheel;
      for (const wheel of ship.rewardWheels) {
        if (candidateBranches.length === 0) {
          break;
        }
        const lifecycleView = wheelLifecycleViews(history, candidateRoom, roomView, wheel);
        const binding = rewardWheelBinding(catalog, declaration, wheel);
        candidateBranches = processJointUnorderedOffers(
          candidateBranches,
          wheel.offers.map((offer: CanonicalRewardWheel['offers'][number]) => ({
            catalog,
            reward: {
              ...offer,
              producerLifecycleKey: wheel.producerLifecycleKey,
              resolvedStoreKey: wheel.storeKey,
            },
            binding,
            historySequence: lifecycleView.generation.sequence + 1,
            peers: Object.freeze([]),
            facts: (branchHistory: RewardHistoryState) =>
              rewardFacts(
                catalog,
                candidateRoom,
                candidateRoom,
                declaration,
                lifecycleView.generation,
                branchHistory,
                enteredBiomeCount,
              ),
          })),
          candidateFindings,
        );
        const picked = wheel.offers.find(
          (offer: CanonicalRewardWheel['offers'][number]) => offer.picked,
        );
        if (picked === undefined) {
          return fail(`${room.gameName}.${wheel.wheelKey} has no picked offer`);
        }
        if (candidateBranches.length > 0) {
          candidateBranches = processOwnedRewardAcquisition(
            catalog,
            candidateBranches,
            candidateRoom,
            declaration,
            Object.freeze({ ...picked, producerLifecycleKey: wheel.producerLifecycleKey }),
            lifecycleView.acquisition,
            lifecycleView.acquisitionSequence,
            candidateFindings,
            enteredBiomeCount,
          );
        }
      }
      return lifecycleCandidateResult(candidateFindings, candidateBranches);
    },
  });
}

export interface BiomeRewardEvaluationAssembly {
  readonly simulation: BiomeRewardSimulation;
  readonly producerArtifacts: RewardProducerCandidateArtifacts;
  readonly lifecycleArtifacts: RoomLifecycleCandidateArtifacts;
}

export function evaluateBiomeRewardsAssembly(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
): BiomeRewardEvaluationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRewardSimulationContractError('reward inputs do not share one biome owner');
  }
  const layout = requireRewardLayout(catalog, snapshot);
  const rewardLookup = hubRewardLookups(catalog, snapshot);
  const rooms = rewardRooms(snapshot);
  const views = roomViews(history);
  const targets = canonicalTargets(snapshot);
  const additionalContinuations = canonicalAdditionalContinuations(snapshot);
  const hubTargetByOrigin = hubTargets(snapshot);
  const batchesByParent = new Map(
    batches(snapshot).map((batch) => [semanticAddressKey(batch.parent.origin), batch]),
  );
  // A Hub replaces its source's zero-target terminal envelope. Its source
  // still reaches an outgoing lifecycle checkpoint, but that checkpoint
  // creates the Hub rather than a normal reward batch.
  const hubTakeoverSources = new Set(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => semanticAddressKey(decision.source.origin)),
  );
  // Hub visit targets and their entered local children restore to an existing
  // parent rather than generating another ordinary decision. Their outgoing
  // checkpoints must still advance reward history without inventing a batch.
  const activeHubVisit = hubVisitFrontier(snapshot);
  const hubRestoringSources = new Set([
    ...snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .flatMap((decision) =>
        decision.visits.flatMap((visit) => [
          semanticAddressKey(visit.target.room.origin),
          ...visit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
      ),
    ...(activeHubVisit === undefined
      ? []
      : [
          semanticAddressKey(activeHubVisit.target.room.origin),
          ...activeHubVisit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
  ]);
  const frontierSource =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? semanticAddressKey(snapshot.frontier.parent.origin)
      : undefined;
  const expectedStores = new Map<string, string | undefined>();
  const storeSupportEntries: RewardStoreSupportEntry[] = [];
  const targetHistoryByOrigin = new Map<string, TargetRewardHistoryCheckpoint>();
  const targetGenerationByParent = new Map<
    string,
    {
      readonly origin: ExitDecisionAddress;
      readonly exitKeys: readonly string[];
    }
  >();
  const findings = new Map<string, SemanticFinding>();
  const producerFrontiers = new Map<string, RewardProducerFrontier>();
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
  const shopPurchaseContexts = new Map<string, ShopPurchaseCandidateContext>();
  let peers: readonly OfferProcessingPeer[] = Object.freeze([]);
  let branches: readonly RewardBranchState[] = initializeRewardBranches(initialBranches);

  function recordTargetSlotHistory(origin: TargetAddress, historySequence: number): void {
    if (branches.length === 0) {
      return;
    }
    targetHistoryByOrigin.set(
      semanticAddressKey(origin),
      Object.freeze({
        origin,
        historySequence,
        histories: Object.freeze(branches.map((branch) => branch.history)),
      }),
    );
  }

  function recordBlankFrontierTargetHistory(): void {
    const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
    if (frontier?.kind !== 'exitDecision' || frontier.parent.origin.kind !== 'occurrence') {
      return;
    }
    const source = rooms.get(semanticAddressKey(frontier.parent.origin));
    const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
    if (source === undefined || declaration === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${semanticAddressKey(frontier.origin)} has no reward-history frontier source`,
      );
    }
    const exitKeys =
      layout.progression.kind === 'hub'
        ? semanticAddressKey(frontier.parent.origin) ===
          semanticAddressKey(snapshot.entryRoom.origin)
          ? Object.freeze([layout.progression.entry.exitKey])
          : Object.freeze([])
        : Object.freeze(
            [...declaration.exits]
              .sort((left, right) => left.index - right.index)
              .map((exit) => `exit${exit.index}`),
          );
    const nextExitKey = exitKeys[frontier.targets.length];
    const historySequence = history.events.at(-1)?.sequence;
    if (nextExitKey === undefined || historySequence === undefined) {
      return;
    }
    const origin = createTargetAddress(
      createBiomeAddress(frontier.origin.routeKey, frontier.origin.biomeKey),
      frontier.origin.source,
      nextExitKey,
    );
    if (!targetHistoryByOrigin.has(semanticAddressKey(origin))) {
      recordTargetSlotHistory(origin, historySequence);
    }
  }

  for (const event of history.events) {
    if (branches.length === 0) {
      break;
    }
    switch (event.kind) {
      case 'roomPrepared':
        branches = beginRewardRoom(branches, event.sequence);
        break;
      case 'roomCreated': {
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room === undefined) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (room.gameName !== event.gameName) {
          throw new BiomeRewardSimulationContractError(
            `${semanticAddressKey(event.origin)} is ${room.gameName} in the snapshot but ${event.gameName} in history`,
          );
        }
        if (room.kind === 'hub') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const incoming = room.incomingReward;
        const localRewards = room.kind === 'authored' ? (room.localRewards ?? []) : [];
        if (incoming === undefined && localRewards.length === 0) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const declaration = catalog.rooms.byKey[room.gameName];
        if (declaration === undefined) {
          throw new BiomeRewardSimulationContractError(`${room.gameName} has no declaration`);
        }
        let source: CanonicalRewardSource = room;
        let currentRoom: CanonicalRewardSource | undefined =
          event.source === 'biomeEntry' ? undefined : room;
        let view = views.get(semanticAddressKey(room.origin))?.preparation;
        let currentShopNames: ReadonlySet<string> = new Set();
        let peerParentOrigin: CanonicalRewardSource['origin'] = source.origin;
        let peerCreationSource: RoomCreationSource = 'generatedTarget';
        if (event.source === 'generatedTarget') {
          const target = targets.get(semanticAddressKey(event.targetOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          if (target === undefined) {
            throw new BiomeRewardSimulationContractError('generated reward lost its source room');
          }
          if (
            semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin) ||
            semanticAddressKey(target.origin) !== semanticAddressKey(event.targetOrigin)
          ) {
            throw new BiomeRewardSimulationContractError(
              `target ${semanticAddressKey(event.targetOrigin)} does not match its reward history event`,
            );
          }
          if (parent !== undefined && parentViews !== undefined) {
            if (semanticAddressKey(parent.origin) !== semanticAddressKey(event.parentOrigin)) {
              throw new BiomeRewardSimulationContractError(
                `target ${semanticAddressKey(event.targetOrigin)} has the wrong reward parent`,
              );
            }
            source = parent;
            currentRoom = parent;
            view =
              parentViews.targetGenerations.find(
                (candidate) =>
                  semanticAddressKey(candidate.targetOrigin) ===
                  semanticAddressKey(event.targetOrigin),
              )?.before ?? parentViews.preOutgoing!;
            currentShopNames = new Set(
              (parent.kind === 'authored' ? parent.entryState?.offers : undefined)?.map(
                (offer) => offer.offer.rewardType,
              ) ?? [],
            );
          } else if (event.parentOrigin.kind !== 'hubRoom') {
            throw new BiomeRewardSimulationContractError('generated reward lost its source room');
          }
          const targetKey = semanticAddressKey(event.targetOrigin);
          const expectedStore = expectedStores.get(targetKey);
          const resolvedStores = [
            ...(incoming === undefined || countedBinding(declaration, incoming) === undefined
              ? []
              : [incoming.resolvedStoreKey]),
            ...localRewards.map((reward) => reward.resolvedStoreKey),
          ];
          if (
            expectedStores.has(targetKey) &&
            resolvedStores.some((storeKey) => storeKey !== expectedStore)
          ) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} resolved a reward store other than ${String(expectedStore)}`,
            );
          }
        } else if (event.source === 'additionalExit') {
          const continuation = additionalContinuations.get(
            semanticAddressKey(event.additionalOrigin),
          );
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          if (
            continuation === undefined ||
            parent === undefined ||
            parent.kind !== 'authored' ||
            parentViews?.entry === undefined ||
            semanticAddressKey(continuation.room.origin) !== semanticAddressKey(event.origin)
          ) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} lost its entry-time additional continuation source`,
            );
          }
          source = parent;
          currentRoom = parent;
          view = parentViews.entry;
          currentShopNames = new Set(
            (parent.entryState?.kind === 'shop' ? parent.entryState.offers : []).map(
              (offer) => offer.offer.rewardType,
            ),
          );
        } else if (event.source === 'hubTarget') {
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const target = hubTargetByOrigin.get(semanticAddressKey(event.targetOrigin));
          if (
            parent?.kind !== 'hub' ||
            target === undefined ||
            semanticAddressKey(target.room.origin) !== semanticAddressKey(event.origin)
          ) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} lost its declaration-owned Hub reward source`,
            );
          }
          source = parent;
          currentRoom = parent;
          view = parentViews?.targetGenerations.find(
            (candidate) =>
              semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
          )?.before;
          peerParentOrigin = parent.origin;
          peerCreationSource = 'hubTarget';
        } else if (event.source === 'localChild') {
          const parentViews = views.get(semanticAddressKey(event.parentOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          if (parent?.kind !== 'authored') {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} lost its parent-local reward source`,
            );
          }
          source = parent;
          currentRoom = parent;
          view = parentViews?.targetGenerations.find(
            (candidate) =>
              semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(event.targetOrigin),
          )?.before;
          peerParentOrigin = parent.origin;
          peerCreationSource = 'localChild';
        } else if (localRewards.length !== 0) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} materialized local rewards outside a generated target`,
          );
        }
        if (view === undefined) {
          // A blocked entry can publish only its valid encounter-record
          // prefix. It deliberately has no room-preparation view and therefore
          // cannot acquire or publish entry-owned reward effects. Generated
          // targets keep their parent offer-time view above, so their already
          // offered door rewards remain independently modeled.
          if (event.source === 'biomeEntry' && !views.has(semanticAddressKey(room.origin))) {
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} has no offer-time history view`,
          );
        }
        if (incoming !== undefined) {
          const binding = countedBinding(declaration, incoming);
          const frontierBranches = branches;
          const offerContext = {
            catalog,
            reward: incoming,
            ...(binding === undefined ? {} : { binding }),
            historySequence: event.sequence,
            peers,
            facts: (branchHistory: RewardHistoryState) =>
              rewardFacts(
                catalog,
                source,
                currentRoom,
                catalog.rooms.byKey[source.gameName] ?? declaration,
                view,
                branchHistory,
                enteredBiomeCount,
                currentShopNames,
                source.kind === 'hub' ? source.origin : peerParentOrigin,
                source.kind === 'hub' ? 'hubTarget' : peerCreationSource,
              ),
          };
          const incomingOwnerKey = semanticAddressKey(incoming.origin);
          const acquisitionEvents = history.events.filter(
            (candidate) =>
              candidate.kind === 'producerRoleAdvanced' &&
              semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
          );
          const candidateRoomView = views.get(semanticAddressKey(room.origin));
          // An Anomaly failure still owns a consumed door offer, but its
          // lifecycle deliberately omits the producer acquisition. Candidate
          // evaluation must not manufacture that missing event from the
          // room's generic lifecycle view.
          const acquisitionView =
            incoming.acquisitionEnabled === false
              ? undefined
              : (candidateRoomView?.preOutgoing ?? candidateRoomView?.entry);
          const acquisitionSequence =
            incoming.acquisitionEnabled === false
              ? undefined
              : (acquisitionEvents.at(-1)?.sequence ?? acquisitionView?.sequence);
          indexRewardProducerFrontier(
            producerFrontiers,
            Object.freeze({
              generationPolicy: 'sequential',
              generationHistorySequence: event.sequence,
              reachableBranchCount: frontierBranches.length,
              acquisitionHorizon:
                acquisitionView === undefined || acquisitionSequence === undefined
                  ? 'generationOnly'
                  : 'ownEnteredLifecycle',
              owners: Object.freeze([incoming.origin]),
              ...(binding === undefined || incoming.resolvedStoreKey === undefined
                ? {}
                : { resolvedStoreKey: incoming.resolvedStoreKey }),
              evaluateOffer: (
                owner: SemanticAddress,
                offer: CanonicalResolvedIncomingReward['offer'],
              ) => {
                if (semanticAddressKey(owner) !== incomingOwnerKey) {
                  return fail('sequential reward frontier received a foreign owner');
                }
                const candidateFindings = new Map<string, SemanticFinding>();
                let candidateBranches = processRewardOffer(
                  frontierBranches,
                  {
                    ...offerContext,
                    reward: Object.freeze({ ...incoming, offer }),
                  },
                  candidateFindings,
                );
                if (candidateBranches.length === 0) {
                  return candidateResult(candidateFindings, candidateBranches);
                }
                if (acquisitionView === undefined || acquisitionSequence === undefined) {
                  return candidateResult(candidateFindings, candidateBranches);
                }
                candidateBranches = processOwnedRewardAcquisition(
                  catalog,
                  candidateBranches,
                  room,
                  declaration,
                  Object.freeze({ ...incoming, offer }),
                  acquisitionView,
                  acquisitionSequence,
                  candidateFindings,
                  enteredBiomeCount,
                );
                return candidateResult(candidateFindings, candidateBranches);
              },
            }),
          );
          branches = processRewardOffer(branches, offerContext, findings);
          if (
            event.source === 'generatedTarget' ||
            event.source === 'hubTarget' ||
            event.source === 'localChild'
          ) {
            peers = Object.freeze([
              ...peers,
              { origin: event.targetOrigin, offer: incoming.offer },
            ]);
          }
        }
        for (const localReward of localRewards) {
          const frontierBranches = branches;
          const offerContext = {
            catalog,
            reward: localReward,
            binding: localRewardBinding(declaration, localReward),
            historySequence: event.sequence,
            peers,
            facts: (branchHistory: RewardHistoryState) =>
              rewardFacts(
                catalog,
                source,
                currentRoom,
                catalog.rooms.byKey[source.gameName] ?? declaration,
                view,
                branchHistory,
                enteredBiomeCount,
                currentShopNames,
              ),
          };
          const localOwnerKey = semanticAddressKey(localReward.origin);
          const acquisitionEvent = history.events.find(
            (candidate) =>
              candidate.kind === 'encounterCompleted' &&
              semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin) &&
              candidate.phaseKey === localReward.encounterPhaseKey,
          );
          const candidateRoomView = views.get(semanticAddressKey(room.origin));
          const acquisitionView = candidateRoomView?.preOutgoing ?? candidateRoomView?.entry;
          indexRewardProducerFrontier(
            producerFrontiers,
            Object.freeze({
              generationPolicy: 'sequential',
              generationHistorySequence: event.sequence,
              reachableBranchCount: frontierBranches.length,
              acquisitionHorizon:
                acquisitionEvent?.kind !== 'encounterCompleted' || acquisitionView === undefined
                  ? 'generationOnly'
                  : 'ownEnteredLifecycle',
              owners: Object.freeze([localReward.origin]),
              resolvedStoreKey: localReward.resolvedStoreKey,
              evaluateOffer: (
                owner: SemanticAddress,
                offer: CanonicalResolvedIncomingReward['offer'],
              ) => {
                if (semanticAddressKey(owner) !== localOwnerKey) {
                  return fail('local reward frontier received a foreign owner');
                }
                const candidateFindings = new Map<string, SemanticFinding>();
                let candidateBranches = processRewardOffer(
                  frontierBranches,
                  {
                    ...offerContext,
                    reward: Object.freeze({ ...localReward, offer }),
                  },
                  candidateFindings,
                );
                if (
                  candidateBranches.length > 0 &&
                  acquisitionEvent?.kind === 'encounterCompleted' &&
                  acquisitionView !== undefined
                ) {
                  candidateBranches = processOwnedRewardAcquisition(
                    catalog,
                    candidateBranches,
                    room,
                    declaration,
                    Object.freeze({ ...localReward, offer }),
                    acquisitionView,
                    acquisitionEvent.sequence,
                    candidateFindings,
                    enteredBiomeCount,
                  );
                }
                return candidateResult(candidateFindings, candidateBranches);
              },
            }),
          );
          branches = processRewardOffer(branches, offerContext, findings);
          peers = Object.freeze([
            ...peers,
            { origin: localReward.origin, offer: localReward.offer },
          ]);
        }
        break;
      }
      case 'targetGenerationCompleted': {
        if (event.origin.kind === 'target') {
          const generation = targetGenerationByParent.get(semanticAddressKey(event.parentOrigin));
          const currentOffset = generation?.exitKeys.indexOf(event.origin.exitKey) ?? -1;
          if (generation !== undefined && currentOffset + 1 === event.generationIndex) {
            const nextExitKey = generation.exitKeys[currentOffset + 1];
            if (nextExitKey !== undefined) {
              recordTargetSlotHistory(
                createTargetAddress(
                  createBiomeAddress(generation.origin.routeKey, generation.origin.biomeKey),
                  generation.origin.source,
                  nextExitKey,
                ),
                event.sequence,
              );
            }
          }
        }
        branches = advanceRewardBranches(branches, event.sequence);
        break;
      }
      case 'outgoingGenerationCheckpoint': {
        if (event.origin.kind === 'hubRoom') {
          peers = Object.freeze([]);
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const source = rooms.get(semanticAddressKey(event.origin));
        const sourceViews = views.get(semanticAddressKey(event.origin));
        const declaration = source && catalog.rooms.byKey[source.gameName];
        if (source === undefined || sourceViews === undefined || declaration === undefined) {
          throw new BiomeRewardSimulationContractError(
            'outgoing reward checkpoint has no authored source',
          );
        }
        const batch = batchesByParent.get(semanticAddressKey(event.origin));
        const targetSet = batch?.targets;
        if (targetSet === undefined) {
          if (
            hubTakeoverSources.has(semanticAddressKey(event.origin)) ||
            hubRestoringSources.has(semanticAddressKey(event.origin)) ||
            semanticAddressKey(event.origin) === frontierSource
          ) {
            peers = Object.freeze([]);
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          throw new BiomeRewardSimulationContractError(
            `${source.gameName} has no outgoing reward batch`,
          );
        }
        const generationOrigin = batch?.origin;
        if (generationOrigin === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${source.gameName} has no outgoing generation owner`,
          );
        }
        const exitKeys = Object.freeze(targetSet.map((target) => target.exit.exitKey));
        targetGenerationByParent.set(
          semanticAddressKey(event.origin),
          Object.freeze({ origin: generationOrigin, exitKeys }),
        );
        const firstExitKey = exitKeys[0];
        if (firstExitKey !== undefined) {
          recordTargetSlotHistory(
            createTargetAddress(
              createBiomeAddress(generationOrigin.routeKey, generationOrigin.biomeKey),
              generationOrigin.source,
              firstExitKey,
            ),
            event.sequence,
          );
        }
        let sharedStore: string | undefined;
        const rewardStore = batch?.rewardStore;
        if (rewardStore !== undefined) {
          if (rewardStore.kind === 'authoredBaseStore') {
            if (source.kind !== 'authored') {
              throw new BiomeRewardSimulationContractError(
                `${source.gameName} cannot own an authored base reward store`,
              );
            }
            const support = storeSupport(
              layout,
              { rewardStore },
              source,
              declaration,
              sourceViews.preOutgoing ?? sourceViews.preparation,
              event.sequence,
            );
            storeSupportEntries.push(support);
            sharedStore = support.authoredStoreKey;
            if (!support.selectedPossible) {
              addRewardFinding(
                findings,
                rewardFinding('baseRewardStoreUnavailable', support.origin, {
                  authoredStoreKey: support.authoredStoreKey,
                  enteredStoreCount: support.enteredStoreCount,
                  enteredMetaStoreCount: support.enteredMetaStoreCount,
                  currentMetaRatio: support.currentMetaRatio,
                  metaSelectionValue: support.metaSelectionValue,
                  supportStoreKeys: support.supportStoreKeys,
                }),
              );
            }
          } else if (rewardStore.kind === 'sourceOfferPoint') {
            if (source.kind !== 'authored') {
              throw new BiomeRewardSimulationContractError(
                `${source.gameName} cannot own a source reward wheel`,
              );
            }
            const wheel = source.rewardWheels?.at(-1);
            if (wheel === undefined) {
              throw new BiomeRewardSimulationContractError(
                `${source.gameName} lost its active source reward wheel`,
              );
            }
            sharedStore = wheel.storeKey;
          } else if (rewardStore.kind !== 'none') {
            throw new BiomeRewardSimulationContractError(
              `${source.gameName} exposes an unsupported generated reward store`,
            );
          }
        }
        for (const [targetKey, storeKey] of expectedTargetStores(catalog, targetSet, sharedStore)) {
          expectedStores.set(targetKey, storeKey);
        }
        peers = Object.freeze([]);
        branches = advanceRewardBranches(branches, event.sequence);
        break;
      }
      case 'offerPointMaterialized': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (
          room === undefined ||
          room.kind !== 'authored' ||
          declaration === undefined ||
          roomView === undefined
        ) {
          throw new BiomeRewardSimulationContractError('shop offer point has no authored room');
        }
        if (event.offerPoint === 'shopInventory') {
          const frontierBranches = branches;
          const owners = Object.freeze(
            (room.entryState?.kind === 'shop' ? room.entryState.offers : []).map(
              (offer) => offer.offerOrigin,
            ),
          );
          const ownerKeys = new Set(owners.map(semanticAddressKey));
          const shopContext = {
            catalog,
            room,
            declaration,
            historySequence: event.sequence,
            facts: (
              branchHistory: RewardHistoryState,
              shopNames: ReadonlySet<string> = new Set(),
            ) =>
              rewardFacts(
                catalog,
                room,
                room,
                declaration,
                roomView.preparation,
                branchHistory,
                enteredBiomeCount,
                shopNames,
                undefined,
                undefined,
                rewardLookup.internal,
              ),
            fail,
          };
          if (owners.length > 0) {
            indexRewardProducerFrontier(
              producerFrontiers,
              Object.freeze({
                generationPolicy: 'jointShopInventory',
                generationHistorySequence: event.sequence,
                reachableBranchCount: frontierBranches.length,
                acquisitionHorizon: 'generationOnly',
                owners,
                evaluateOffer: (
                  owner: SemanticAddress,
                  offer: CanonicalResolvedIncomingReward['offer'],
                ) => {
                  if (room.entryState?.kind !== 'shop') {
                    return fail(`${room.gameName} lost its shop candidate state`);
                  }
                  const ownerKey = semanticAddressKey(owner);
                  if (!ownerKeys.has(ownerKey)) {
                    return fail('shop reward frontier received a foreign owner');
                  }
                  const candidateRoom = Object.freeze({
                    ...room,
                    entryState: Object.freeze({
                      ...room.entryState,
                      offers: Object.freeze(
                        room.entryState.offers.map((entry) =>
                          semanticAddressKey(entry.offerOrigin) === ownerKey
                            ? Object.freeze({ ...entry, offer })
                            : entry,
                        ),
                      ),
                    }),
                  });
                  const candidateFindings = new Map<string, SemanticFinding>();
                  const candidateBranches = processShopInventory(
                    frontierBranches,
                    { ...shopContext, room: candidateRoom },
                    candidateFindings,
                  );
                  return candidateResult(candidateFindings, candidateBranches);
                },
              }),
            );
          }
          branches = processShopInventory(branches, shopContext, findings);
          break;
        }
        const wheel = room.rewardWheels?.find(
          (candidate) => candidate.wheelKey === event.offerPoint,
        );
        const view = roomView.offerPoints?.find(
          (candidate) => candidate.offerPoint === event.offerPoint,
        )?.before;
        if (wheel === undefined || view === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} has no canonical ${event.offerPoint} materialization`,
          );
        }
        const binding = rewardWheelBinding(catalog, declaration, wheel);
        const roomKey = semanticAddressKey(room.origin);
        if (room.rewardWheels?.[0] === wheel && !shipLifecycleContexts.has(roomKey)) {
          shipLifecycleContexts.set(
            roomKey,
            prepareShipLifecycleCandidateContext(
              catalog,
              room,
              declaration,
              roomView,
              history,
              branches,
              enteredBiomeCount,
              routeLoadout,
            ),
          );
        }
        const contexts = wheel.offers.map((offer) => ({
          catalog,
          reward: {
            ...offer,
            producerLifecycleKey: wheel.producerLifecycleKey,
            resolvedStoreKey: wheel.storeKey,
          },
          binding,
          historySequence: event.sequence,
          peers: Object.freeze([]),
          facts: (branchHistory: RewardHistoryState) =>
            rewardFacts(catalog, room, room, declaration, view, branchHistory, enteredBiomeCount),
        }));
        const frontierBranches = branches;
        const owners = Object.freeze(wheel.offers.map((offer) => offer.origin));
        const ownerKeys = new Set(owners.map(semanticAddressKey));
        const acquisitionView = roomView.offerPoints?.find(
          (candidate) => candidate.offerPoint === event.offerPoint,
        )?.acquisitionBefore;
        const acquisitionEvent = history.events.find(
          (candidate) =>
            candidate.kind === 'offerPointAcquired' &&
            semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin) &&
            candidate.offerPoint === wheel.wheelKey,
        );
        indexRewardProducerFrontier(
          producerFrontiers,
          Object.freeze({
            generationPolicy: 'jointUnordered',
            generationHistorySequence: event.sequence,
            reachableBranchCount: frontierBranches.length,
            acquisitionHorizon:
              acquisitionEvent?.kind !== 'offerPointAcquired' || acquisitionView === undefined
                ? 'generationOnly'
                : 'ownEnteredLifecycle',
            owners,
            resolvedStoreKey: wheel.storeKey,
            evaluateOffer: (
              owner: SemanticAddress,
              offer: CanonicalResolvedIncomingReward['offer'],
            ) => {
              const ownerKey = semanticAddressKey(owner);
              if (!ownerKeys.has(ownerKey)) {
                return fail('reward-wheel frontier received a foreign owner');
              }
              const candidateFindings = new Map<string, SemanticFinding>();
              let candidateBranches = processJointUnorderedOffers(
                frontierBranches,
                contexts.map((context) =>
                  semanticAddressKey(context.reward.origin) === ownerKey
                    ? {
                        ...context,
                        reward: Object.freeze({ ...context.reward, offer }),
                      }
                    : context,
                ),
                candidateFindings,
              );
              const selectedOffer = wheel.offers.find(
                (candidate) => semanticAddressKey(candidate.origin) === ownerKey,
              );
              if (
                candidateBranches.length > 0 &&
                selectedOffer?.picked === true &&
                acquisitionView !== undefined &&
                acquisitionEvent?.kind === 'offerPointAcquired'
              ) {
                candidateBranches = processOwnedRewardAcquisition(
                  catalog,
                  candidateBranches,
                  room,
                  declaration,
                  Object.freeze({
                    ...selectedOffer,
                    offer,
                    producerLifecycleKey: wheel.producerLifecycleKey,
                  }),
                  acquisitionView,
                  acquisitionEvent.sequence,
                  candidateFindings,
                  enteredBiomeCount,
                );
              }
              return candidateResult(candidateFindings, candidateBranches);
            },
          }),
        );
        branches = processJointUnorderedOffers(branches, contexts, findings);
        break;
      }
      case 'offerPointAcquired': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (
          room === undefined ||
          room.kind !== 'authored' ||
          declaration === undefined ||
          roomView === undefined
        ) {
          throw new BiomeRewardSimulationContractError(
            'reward-wheel acquisition has no authored room',
          );
        }
        const wheel = room.rewardWheels?.find(
          (candidate) => candidate.wheelKey === event.offerPoint,
        );
        const picked = wheel?.offers.find((offer) => offer.picked);
        const view = roomView.offerPoints?.find(
          (candidate) => candidate.offerPoint === event.offerPoint,
        )?.acquisitionBefore;
        if (wheel === undefined || picked === undefined || view === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName} has no canonical ${event.offerPoint} acquisition`,
          );
        }
        branches = processOwnedRewardAcquisition(
          catalog,
          branches,
          room,
          declaration,
          { ...picked, producerLifecycleKey: wheel.producerLifecycleKey },
          view,
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
          throw new BiomeRewardSimulationContractError('producer role has no authored room');
        }
        if (room.kind === 'hub') {
          throw new BiomeRewardSimulationContractError('Hub room cannot advance a reward producer');
        }
        branches = processProducerRole(
          catalog,
          branches,
          room,
          event,
          (branchHistory) =>
            rewardFacts(
              catalog,
              room,
              room,
              declaration,
              roomView.preOutgoing ?? roomView.entry,
              branchHistory,
              enteredBiomeCount,
            ),
          findings,
          fail,
        );
        break;
      }
      case 'encounterCompleted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const declaration = room && catalog.rooms.byKey[room.gameName];
        const roomView = views.get(semanticAddressKey(event.origin));
        if (room === undefined || declaration === undefined || roomView === undefined) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (room.kind !== 'authored') {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        const matchingRewards =
          room.localRewards?.filter((reward) => reward.encounterPhaseKey === event.phaseKey) ?? [];
        if (matchingRewards.length === 0) {
          branches = advanceRewardBranches(branches, event.sequence);
          break;
        }
        if (matchingRewards.length !== 1 || matchingRewards[0] === undefined) {
          throw new BiomeRewardSimulationContractError(
            `${room.gameName}.${event.phaseKey} does not own exactly one local reward`,
          );
        }
        branches = processOwnedRewardAcquisition(
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
        if (
          room === undefined ||
          room.kind !== 'authored' ||
          declaration === undefined ||
          roomView === undefined
        ) {
          throw new BiomeRewardSimulationContractError('shop purchases have no authored room');
        }
        const roomKey = semanticAddressKey(room.origin);
        if (!shopPurchaseContexts.has(roomKey)) {
          shopPurchaseContexts.set(
            roomKey,
            prepareShopPurchaseCandidateContext({
              catalog,
              room,
              declaration,
              branchesBeforePurchases: branches,
              historySequence: event.sequence,
              facts: (candidateRoom, branchHistory, shopNames) =>
                rewardFacts(
                  catalog,
                  candidateRoom,
                  candidateRoom,
                  declaration,
                  roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
                  branchHistory,
                  enteredBiomeCount,
                  shopNames,
                  undefined,
                  undefined,
                  rewardLookup.internal,
                ),
              fail,
            }),
          );
        }
        branches = processShopPurchases(
          branches,
          {
            catalog,
            room,
            declaration,
            historySequence: event.sequence,
            facts: (branchHistory, shopNames = new Set()) =>
              rewardFacts(
                catalog,
                room,
                room,
                declaration,
                roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
                branchHistory,
                enteredBiomeCount,
                shopNames,
                undefined,
                undefined,
                rewardLookup.internal,
              ),
            fail,
          },
          findings,
        );
        break;
      }
      default:
        branches = advanceRewardBranches(branches, event.sequence);
        break;
    }
  }

  recordBlankFrontierTargetHistory();
  const immutableFindings = Object.freeze([...findings.values()]);
  const simulation: BiomeRewardSimulation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    storeSupport: Object.freeze(storeSupportEntries),
    targetHistory: Object.freeze([...targetHistoryByOrigin.values()]),
    branches: Object.freeze(branches.map(publicRewardBranch)),
    findings: immutableFindings,
    rewardLookups: rewardLookup.public,
  });
  return Object.freeze({
    simulation,
    producerArtifacts: createRewardProducerCandidateArtifacts(producerFrontiers),
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(
      shipLifecycleContexts,
      shopPurchaseContexts,
    ),
  });
}

export function evaluateBiomeRewards(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  enteredBiomeCount: number,
  routeLoadout: RouteLoadout,
  initialBranches?: readonly RewardBranch[],
): BiomeRewardSimulation {
  return evaluateBiomeRewardsAssembly(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    routeLoadout,
    initialBranches,
  ).simulation;
}
