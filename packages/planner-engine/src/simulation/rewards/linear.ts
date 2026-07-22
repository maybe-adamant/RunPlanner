import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../../catalog-schema';
import { semanticAddressKey } from '../../authored-project/addresses';
import {
  applyConcreteAcquisition,
  isOfferSupportedAtResolutionPoint,
  resolveAcquisitionRole,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type {
  CanonicalLinearHistory,
  LinearHistoryStateView,
  LinearRoomHistoryViews,
} from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalFixedEntryRoom,
  CanonicalLinearBiome,
  CanonicalLocalReward,
  CanonicalRewardWheel,
  CanonicalRewardWheelOffer,
  CanonicalResolvedIncomingReward,
  CanonicalTarget,
} from '../materialization';
import type { SemanticFinding } from '../model';
import type {
  LinearRewardBranch,
  LinearRewardSimulation,
  LinearRewardStoreSupportEntry,
  LinearTargetRewardHistoryCheckpoint,
} from './model';
import { createRewardFacts, createdPeerGameNames } from './facts';
import {
  addRewardFinding,
  advanceRewardBranch,
  advanceRewardBranches,
  appendRewardEvent,
  beginRewardRoom,
  countedBinding,
  initializeRewardBranches,
  offerEvidence,
  processProducerRole,
  processJointUnorderedOffers,
  processRewardOffer,
  processShopInventory,
  processShopPurchases,
  publicRewardBranch,
  rewardFinding,
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
function requireLinearLayout(catalog: Catalog, snapshot: CanonicalLinearBiome): LinearBiomeLayout {
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

function rewardRooms(snapshot: CanonicalLinearBiome): ReadonlyMap<string, CanonicalRewardRoom> {
  const rooms = [
    ...snapshot.entryRooms,
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
  room: CanonicalAuthoredRoom,
  declaration: RoomDeclaration,
  reward: Pick<CanonicalLocalReward | CanonicalRewardWheelOffer, 'offer' | 'origin'> & {
    readonly producerLifecycleKey: string;
  },
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
  const rooms = rewardRooms(snapshot);
  const views = roomViews(history);
  const targets = canonicalTargets(snapshot);
  const batchesByParent = new Map(
    snapshot.batches.map((batch) => [semanticAddressKey(batch.parent.origin), batch]),
  );
  const fixedEntryPredecessors = new Set(
    snapshot.entryRooms.slice(0, -1).map((room) => semanticAddressKey(room.origin)),
  );
  const terminalParentKey = semanticAddressKey(snapshot.terminalEntry.predecessor.origin);
  const expectedStores = new Map<string, string | undefined>();
  const storeSupportEntries: LinearRewardStoreSupportEntry[] = [];
  const targetHistory: LinearTargetRewardHistoryCheckpoint[] = [];
  const findings = new Map<string, SemanticFinding>();
  let peers: readonly CanonicalResolvedIncomingReward['offer'][] = Object.freeze([]);
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
          branches = processRewardOffer(
            branches,
            {
              catalog,
              reward: incoming,
              ...(binding === undefined ? {} : { binding }),
              historySequence: event.sequence,
              peers,
              facts: (branchHistory) =>
                rewardFacts(
                  catalog,
                  source,
                  catalog.rooms.byKey[source.gameName] ?? declaration,
                  view,
                  branchHistory,
                  enteredBiomeCount,
                  currentShopNames,
                ),
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
              historySequence: event.sequence,
              peers,
              facts: (branchHistory) =>
                rewardFacts(
                  catalog,
                  source,
                  catalog.rooms.byKey[source.gameName] ?? declaration,
                  view,
                  branchHistory,
                  enteredBiomeCount,
                  currentShopNames,
                ),
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
          if (fixedEntryPredecessors.has(semanticAddressKey(event.origin))) {
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
          batch?.rewardStore ?? (isTerminal ? snapshot.terminalEntry.rewardStore : undefined);
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
          branches = processShopInventory(
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
                  roomView.preparation,
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
        branches = processJointUnorderedOffers(
          branches,
          wheel.offers.map((offer) => ({
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
          })),
          findings,
        );
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
  return Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    storeSupport: Object.freeze(storeSupportEntries),
    targetHistory: Object.freeze(targetHistory),
    branches: Object.freeze(branches.map(publicRewardBranch)),
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
