import type {
  Catalog,
  EncounterPhase,
  LinearBiomeLayout,
  RoomDeclaration,
} from '../../catalog-schema';
import {
  createBiomeAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { ShipCombatState, ShopState } from '../../authored-project/model';
import { type RewardHistoryState, type RewardKernelFacts } from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type {
  EncounterHistoryEntry,
  LinearSimulationHistory,
  LinearHistoryStateView,
  LinearProgressiveRoomHistoryViews,
} from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalFixedEntryRoom,
  LinearSimulationMaterialization,
  CanonicalLocalReward,
  CanonicalResolvedIncomingReward,
  CanonicalRewardWheel,
  CanonicalTarget,
} from '../materialization';
import { materializeShipCombatState } from '../materialization';
import type { SemanticFinding } from '../model';
import type {
  LinearRewardBranch,
  LinearRewardSimulation,
  LinearRewardStoreSupportEntry,
  LinearTargetRewardHistoryCheckpoint,
} from './model';
import { createRewardFacts, createdPeerGameNames } from './facts';
import {
  indexRewardProducerFrontier,
  registerRoomLifecycleCandidateContexts,
  registerRewardProducerFrontiers,
  type RoomLifecycleCandidateResult,
  type RewardProducerCandidateResult,
  type RewardProducerFrontier,
  type ShipLifecycleCandidateContext,
  type ShopPurchaseCandidateContext,
} from './frontiers';
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

type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalFixedEntryRoom;

export class LinearRewardSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearRewardSimulationContractError';
  }
}

function fail(detail: string): never {
  throw new LinearRewardSimulationContractError(detail);
}

function rewardFacts(
  catalog: Catalog,
  source: CanonicalRewardRoom,
  sourceDeclaration: RoomDeclaration,
  view: LinearHistoryStateView,
  history: RewardHistoryState,
  enteredBiomeCount: number,
  currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
): RewardKernelFacts {
  return createRewardFacts({
    catalog,
    source,
    sourceDeclaration,
    view,
    history,
    enteredBiomeCount,
    currentBatchRoomGameNames: createdPeerGameNames(
      catalog,
      view,
      source.origin,
      'generatedTarget',
    ),
    currentRoomShopOptionNames,
    fail,
  });
}
function requireLinearLayout(
  catalog: Catalog,
  snapshot: LinearSimulationMaterialization,
): LinearBiomeLayout {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  const supportedPolicy =
    layout?.kind === 'LinearBiome' &&
    (layout.continuation.rewardStorePolicy.kind === 'authoredBaseStore' ||
      (layout.continuation.progressionPolicy.kind === 'staged' &&
        layout.continuation.batchPolicy.kind === 'standard' &&
        layout.continuation.rewardStorePolicy.kind === 'none') ||
      (layout.continuation.batchPolicy.kind === 'clockwork' &&
        layout.continuation.rewardStorePolicy.kind === 'none') ||
      (layout.continuation.batchPolicy.kind === 'fields' &&
        layout.continuation.rewardStorePolicy.kind === 'none'));
  if (layout?.kind !== 'LinearBiome' || !supportedPolicy) {
    throw new LinearRewardSimulationContractError(
      `catalog does not provide supported ${snapshot.biomeKey} reward stores`,
    );
  }
  return layout;
}

function frontierTargets(snapshot: LinearSimulationMaterialization): readonly CanonicalTarget[] {
  return snapshot.kind === 'LinearBiome'
    ? snapshot.terminalEntry.targets
    : (snapshot.frontierGeneration?.targets ?? []);
}

function rewardRooms(
  snapshot: LinearSimulationMaterialization,
): ReadonlyMap<string, CanonicalRewardRoom> {
  const rooms = [
    ...snapshot.entryRooms,
    ...snapshot.batches.flatMap((batch) => batch.targets.map((target) => target.room)),
    ...frontierTargets(snapshot).map((target) => target.room),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function roomViews(
  history: LinearSimulationHistory,
): ReadonlyMap<string, LinearProgressiveRoomHistoryViews> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function canonicalTargets(
  snapshot: LinearSimulationMaterialization,
): ReadonlyMap<string, CanonicalTarget> {
  return new Map(
    [...snapshot.batches.flatMap((batch) => batch.targets), ...frontierTargets(snapshot)].map(
      (target) => [semanticAddressKey(target.origin), target],
    ),
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

function storeSupport(
  layout: LinearBiomeLayout,
  batch: Pick<CanonicalBatch, 'rewardStore'>,
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

function rewardWheelBinding(
  catalog: Catalog,
  declaration: RoomDeclaration,
  wheel: CanonicalRewardWheel,
): CountedRewardBinding {
  const profile = catalog.encounterProfiles.byKey[declaration.encounterProfileKey];
  const descriptor = profile?.phases.find(
    (phase) => phase.key === wheel.encounterPhaseKey,
  )?.offerPoint;
  if (
    descriptor === undefined ||
    descriptor.key !== wheel.wheelKey ||
    descriptor.reward.producerLifecycleKey !== wheel.producerLifecycleKey ||
    !descriptor.reward.storeKeys.includes(wheel.storeKey)
  ) {
    throw new LinearRewardSimulationContractError(
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
  },
  view: LinearHistoryStateView,
  historySequence: number,
  findings: Map<string, SemanticFinding>,
  enteredBiomeCount: number,
): readonly RewardBranchState[] {
  return processOwnedRewardAcquisitionState(
    catalog,
    branches,
    reward,
    historySequence,
    (history) => rewardFacts(catalog, room, declaration, view, history, enteredBiomeCount),
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
  readonly generation: LinearHistoryStateView;
  readonly acquisition: LinearHistoryStateView;
  readonly acquisitionSequence: number;
}

function projectedEncounterEntry(
  room: CanonicalAuthoredRoom,
  phase: EncounterPhase,
  sequence: number,
): EncounterHistoryEntry {
  return Object.freeze({
    sequence,
    origin: room.origin,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    phaseKey: phase.key,
    phaseKind: phase.kind,
    ...(phase.baselineEncounterKey === undefined
      ? {}
      : { baselineEncounterKey: phase.baselineEncounterKey }),
  });
}

function projectDormantWheelView(
  room: CanonicalAuthoredRoom,
  phase: EncounterPhase,
  generation: LinearHistoryStateView,
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
  history: LinearSimulationHistory,
  room: CanonicalAuthoredRoom,
  roomView: LinearProgressiveRoomHistoryViews,
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
  const phase = room.encounterPhases.find((candidate) => candidate.key === wheel.encounterPhaseKey);
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
  roomView: LinearProgressiveRoomHistoryViews,
  history: LinearSimulationHistory,
  branchesBeforeFirstWheel: readonly RewardBranchState[],
  enteredBiomeCount: number,
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
        }),
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
          wheel.offers.map((offer) => ({
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
                declaration,
                lifecycleView.generation,
                branchHistory,
                enteredBiomeCount,
              ),
          })),
          candidateFindings,
        );
        const picked = wheel.offers.find((offer) => offer.picked);
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

function prepareShopPurchaseCandidateContext(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  roomView: LinearProgressiveRoomHistoryViews,
  branchesBeforePurchases: readonly RewardBranchState[],
  historySequence: number,
  enteredBiomeCount: number,
): ShopPurchaseCandidateContext {
  if (room.entryState?.kind !== 'shop') {
    return fail(`${room.gameName} has no shop purchase state`);
  }
  const entryState = room.entryState;
  const purchaseOrigins = Object.freeze(entryState.offers.map((offer) => offer.purchaseOrigin));
  return Object.freeze({
    origin: room.origin,
    purchaseOrigins,
    evaluateState: (state: ShopState): RoomLifecycleCandidateResult => {
      const candidateFindings = new Map<string, SemanticFinding>();
      const candidateRoom = Object.freeze({
        ...room,
        entryState: Object.freeze({
          kind: 'shop' as const,
          profileKey: state.profileKey,
          offers: Object.freeze(
            entryState.offers.map((offer) => {
              const candidate = state.offers[offer.offerKey];
              if (candidate === undefined) {
                return fail(`${room.gameName} lost shop offer ${offer.offerKey}`);
              }
              return Object.freeze({
                ...offer,
                offer: candidate.offer,
                purchased: candidate.purchased,
              });
            }),
          ),
        }),
      });
      const candidateBranches = processShopPurchases(
        branchesBeforePurchases,
        {
          catalog,
          room: candidateRoom,
          declaration,
          historySequence,
          facts: (branchHistory, shopNames = new Set()) =>
            rewardFacts(
              catalog,
              candidateRoom,
              declaration,
              roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
              branchHistory,
              enteredBiomeCount,
              shopNames,
            ),
          fail,
        },
        candidateFindings,
      );
      return lifecycleCandidateResult(candidateFindings, candidateBranches);
    },
  });
}

export function evaluateLinearRewards(
  catalog: Catalog,
  snapshot: LinearSimulationMaterialization,
  history: LinearSimulationHistory,
  enteredBiomeCount: number,
  initialBranches?: readonly LinearRewardBranch[],
): LinearRewardSimulation {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new LinearRewardSimulationContractError(
      'linear reward inputs do not share one biome owner',
    );
  }
  const layout = requireLinearLayout(catalog, snapshot);
  const rooms = rewardRooms(snapshot);
  const views = roomViews(history);
  const targets = canonicalTargets(snapshot);
  const batchesByParent = new Map(
    snapshot.batches.map((batch) => [semanticAddressKey(batch.parent.origin), batch]),
  );
  const frontierGeneration =
    snapshot.kind === 'LinearBiomePrefix' ? snapshot.frontierGeneration : undefined;
  const fixedEntryPredecessors = new Set(
    snapshot.entryRooms.slice(0, -1).map((room) => semanticAddressKey(room.origin)),
  );
  const terminalParentKey =
    snapshot.kind === 'LinearBiome'
      ? semanticAddressKey(snapshot.terminalEntry.predecessor.origin)
      : undefined;
  const expectedStores = new Map<string, string | undefined>();
  const storeSupportEntries: LinearRewardStoreSupportEntry[] = [];
  const targetHistory: LinearTargetRewardHistoryCheckpoint[] = [];
  const findings = new Map<string, SemanticFinding>();
  const producerFrontiers = new Map<string, RewardProducerFrontier>();
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
  const shopPurchaseContexts = new Map<string, ShopPurchaseCandidateContext>();
  let peers: readonly OfferProcessingPeer[] = Object.freeze([]);
  let branches: readonly RewardBranchState[] = initializeRewardBranches(initialBranches);

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
          throw new LinearRewardSimulationContractError(
            `${semanticAddressKey(event.origin)} is ${room.gameName} in the snapshot but ${event.gameName} in history`,
          );
        }
        const incoming = room.incomingReward;
        const localRewards = room.kind === 'authored' ? (room.localRewards ?? []) : [];
        if (event.source === 'generatedTarget') {
          targetHistory.push(
            Object.freeze({
              origin: event.targetOrigin,
              historySequence: event.sequence - 1,
              histories: Object.freeze(branches.map((branch) => branch.history)),
            }),
          );
        }
        if (incoming === undefined && localRewards.length === 0) {
          branches = advanceRewardBranches(branches, event.sequence);
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
            (parent.kind === 'authored' ? parent.entryState?.offers : undefined)?.map(
              (offer) => offer.offer.rewardType,
            ) ?? [],
          );
          const expectedStore = expectedStores.get(semanticAddressKey(event.targetOrigin));
          const resolvedStores = [
            ...(incoming === undefined || countedBinding(declaration, incoming) === undefined
              ? []
              : [incoming.resolvedStoreKey]),
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
                catalog.rooms.byKey[source.gameName] ?? declaration,
                view,
                branchHistory,
                enteredBiomeCount,
                currentShopNames,
              ),
          };
          const incomingOwnerKey = semanticAddressKey(incoming.origin);
          const acquisitionEvents = history.events.filter(
            (candidate) =>
              candidate.kind === 'producerRoleAdvanced' &&
              semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
          );
          const candidateRoomView = views.get(semanticAddressKey(room.origin));
          const acquisitionView = candidateRoomView?.preOutgoing ?? candidateRoomView?.entry;
          const acquisitionSequence =
            acquisitionEvents.at(-1)?.sequence ?? acquisitionView?.sequence;
          indexRewardProducerFrontier(
            producerFrontiers,
            Object.freeze({
              generationPolicy: 'sequential',
              generationHistorySequence: event.sequence,
              reachableBranchCount: frontierBranches.length,
              acquisitionHorizon: 'ownEnteredLifecycle',
              owners: Object.freeze([incoming.origin]),
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
          if (event.source === 'generatedTarget') {
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
              acquisitionHorizon: 'ownEnteredLifecycle',
              owners: Object.freeze([localReward.origin]),
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
        const isTerminal =
          terminalParentKey !== undefined && semanticAddressKey(event.origin) === terminalParentKey;
        const isFrontier =
          frontierGeneration !== undefined &&
          semanticAddressKey(event.origin) === semanticAddressKey(frontierGeneration.parent.origin);
        const targetSet =
          batch?.targets ??
          (isTerminal && snapshot.kind === 'LinearBiome'
            ? snapshot.terminalEntry.targets
            : isFrontier
              ? frontierGeneration.targets
              : undefined);
        if (targetSet === undefined) {
          if (fixedEntryPredecessors.has(semanticAddressKey(event.origin))) {
            peers = Object.freeze([]);
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          if (snapshot.kind === 'LinearBiomePrefix') {
            peers = Object.freeze([]);
            branches = advanceRewardBranches(branches, event.sequence);
            break;
          }
          throw new LinearRewardSimulationContractError(
            `${source.gameName} has no outgoing reward batch`,
          );
        }
        let sharedStore: string | undefined;
        const rewardStore =
          batch?.rewardStore ??
          (isTerminal && snapshot.kind === 'LinearBiome'
            ? snapshot.terminalEntry.rewardStore
            : isFrontier
              ? frontierGeneration.rewardStore
              : undefined);
        if (rewardStore !== undefined) {
          if (rewardStore.kind === 'authoredBaseStore') {
            if (source.kind !== 'authored') {
              throw new LinearRewardSimulationContractError(
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
              throw new LinearRewardSimulationContractError(
                `${source.gameName} cannot own a source reward wheel`,
              );
            }
            const wheel = source.rewardWheels?.at(-1);
            if (wheel === undefined) {
              throw new LinearRewardSimulationContractError(
                `${source.gameName} lost its active source reward wheel`,
              );
            }
            sharedStore = wheel.storeKey;
          } else if (rewardStore.kind !== 'none') {
            throw new LinearRewardSimulationContractError(
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
          throw new LinearRewardSimulationContractError('shop offer point has no authored room');
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
                declaration,
                roomView.preparation,
                branchHistory,
                enteredBiomeCount,
                shopNames,
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
          throw new LinearRewardSimulationContractError(
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
            rewardFacts(catalog, room, declaration, view, branchHistory, enteredBiomeCount),
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
            acquisitionHorizon: 'ownEnteredLifecycle',
            owners,
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
          throw new LinearRewardSimulationContractError(
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
          throw new LinearRewardSimulationContractError(
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
          throw new LinearRewardSimulationContractError('producer role has no authored room');
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
          throw new LinearRewardSimulationContractError(
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
          throw new LinearRewardSimulationContractError('shop purchases have no authored room');
        }
        const roomKey = semanticAddressKey(room.origin);
        if (!shopPurchaseContexts.has(roomKey)) {
          shopPurchaseContexts.set(
            roomKey,
            prepareShopPurchaseCandidateContext(
              catalog,
              room,
              declaration,
              roomView,
              branches,
              event.sequence,
              enteredBiomeCount,
            ),
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
                declaration,
                roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
                branchHistory,
                enteredBiomeCount,
                shopNames,
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

  const immutableFindings = Object.freeze([...findings.values()]);
  const simulation: LinearRewardSimulation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    storeSupport: Object.freeze(storeSupportEntries),
    targetHistory: Object.freeze(targetHistory),
    branches: Object.freeze(branches.map(publicRewardBranch)),
    findings: immutableFindings,
  });
  registerRewardProducerFrontiers(simulation, producerFrontiers);
  registerRoomLifecycleCandidateContexts(simulation, {
    shipsByOwner: shipLifecycleContexts,
    shopsByOwner: shopPurchaseContexts,
  });
  return simulation;
}
