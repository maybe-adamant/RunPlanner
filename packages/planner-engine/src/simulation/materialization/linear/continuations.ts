import {
  createBatchRewardStoreAddress,
  createContinuationAddress,
  createPickedAddress,
  createTargetAddress,
  type BiomeAddress,
} from '../../../authored-project/addresses';
import type {
  BatchRewardStoreState,
  LinearBatchContinuation,
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  RoomOccurrence,
} from '../../../authored-project/model';
import type {
  Catalog,
  FixedEntryDescriptor,
  LinearBiomeLayout,
  RoomDeclaration,
} from '../../../catalog-schema';
import type { CompleteLinearCompletenessResult } from '../../completeness';
import { materializeCompletionRooms } from '../completion';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBatchRewardStore,
  CanonicalBatchState,
  CanonicalFixedEntryRoom,
  CanonicalLinearBiome,
  CanonicalPhysicalExit,
  CanonicalRoomReference,
  CanonicalTarget,
  CanonicalTargetContinuation,
  CanonicalTerminalEntry,
} from '../model';

import { fail } from './contract';
import { materializeAuthoredRoom, materializeFixedEntryRoom, type AuthoredRoomRole } from './rooms';

export function roomReference(
  room: CanonicalAuthoredRoom | CanonicalFixedEntryRoom,
): CanonicalRoomReference {
  return Object.freeze({
    origin: room.origin,
    ...(room.kind === 'authored' ? { occurrenceId: room.occurrenceId } : {}),
    gameName: room.gameName,
  });
}

function canonicalExit(room: RoomDeclaration, exitIndex: number): CanonicalPhysicalExit {
  const exit = room.exits.find((candidate) => candidate.index === exitIndex);
  if (exit === undefined) {
    return Object.freeze({ kind: 'unavailable', index: exitIndex });
  }
  return Object.freeze({
    kind: 'available',
    index: exit.index,
    type: exit.type,
    compatibilityPolicyKey: exit.compatibilityPolicyKey,
  });
}

export function canonicalRewardStore(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId | null,
  state: BatchRewardStoreState,
): CanonicalBatchRewardStore {
  const origin = createBatchRewardStoreAddress(biome, parentOccurrenceId);
  switch (state.kind) {
    case 'authoredBaseStore':
      return Object.freeze({
        origin,
        kind: state.kind,
        baseRewardStoreKey: state.baseRewardStoreKey,
      });
    case 'sourceOfferPoint':
    case 'none':
      return Object.freeze({ origin, kind: state.kind });
  }
}

function requireOccurrence(
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrences.get(occurrenceId);
  if (occurrence === undefined) {
    fail(`trusted topology lost occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function requireRoom(catalog: Catalog, occurrence: RoomOccurrence): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    fail(`trusted topology lost room ${occurrence.gameName}`);
  }
  return room;
}

export function finalSharedRewardStoreKey(
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  source: CanonicalAuthoredRoom | CanonicalFixedEntryRoom,
  rewardStore: BatchRewardStoreState,
  targets: LinearContinuation['targets'],
): string | undefined {
  let storeKey: string | undefined;
  if (rewardStore.kind === 'authoredBaseStore') {
    storeKey = rewardStore.baseRewardStoreKey;
  } else if (rewardStore.kind === 'sourceOfferPoint') {
    const wheel = source.kind === 'authored' ? source.rewardWheels?.at(-1) : undefined;
    if (wheel === undefined) {
      fail(`${source.gameName} has no active source reward wheel`);
    }
    storeKey = wheel.storeKey;
  }
  for (const target of targets) {
    const occurrence = requireOccurrence(occurrences, target.occurrenceId);
    const room = requireRoom(catalog, occurrence);
    if (room.forcedRewardStoreKey !== undefined) {
      storeKey = room.forcedRewardStoreKey;
    }
  }
  return storeKey;
}

export function canonicalBatchState(
  catalog: Catalog,
  layout: LinearBiomeLayout,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  continuation: LinearBatchContinuation,
): CanonicalBatchState {
  const policy = layout.continuation.batchPolicy;
  if (policy.kind === 'standard') {
    if (continuation.batchState !== null) {
      fail(`${layout.biomeKey} standard batch owns unexpected authored state`);
    }
    return Object.freeze({ kind: 'standard' });
  }
  if (policy.kind !== 'fields' || continuation.batchState === null) {
    fail(`${layout.biomeKey} does not expose a materializable batch state`);
  }
  let batchCapacity = policy.maxDoorCageRewards;
  let cageTargetCount = 0;
  for (const target of continuation.targets) {
    const occurrence = requireOccurrence(occurrences, target.occurrenceId);
    const room = requireRoom(catalog, occurrence);
    if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') {
      continue;
    }
    const cages = room.localChildren[0];
    if (cages?.kind !== 'boundedRewardSlots' || cages.key !== 'cages') {
      fail(`${room.gameName} has no Fields cage capacity`);
    }
    cageTargetCount += 1;
    batchCapacity = Math.min(batchCapacity, cages.maxActiveSlots);
  }
  const cageOutcome = continuation.batchState.cageOutcome;
  return Object.freeze({
    kind: 'fields',
    cageOutcome,
    batchCapacity,
    cageTargetCount,
    doorCageRewardCount: cageOutcome === 'min' ? policy.minDoorCageRewards : batchCapacity,
  });
}

export function projectLinearBatchState(
  catalog: Catalog,
  biome: BiomeAddress,
  topology: LinearBiomeTopology,
  continuation: LinearBatchContinuation,
): CanonicalBatchState {
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    fail(`${biome.biomeKey} is not a linear biome`);
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const owned = topology.continuations.find(
    (candidate) =>
      candidate.kind === 'batch' &&
      candidate.parentOccurrenceId === continuation.parentOccurrenceId,
  );
  if (owned === undefined || owned.kind !== 'batch') {
    fail(`batch ${continuation.parentOccurrenceId} does not belong to the supplied topology`);
  }
  return canonicalBatchState(
    catalog,
    layout,
    new Map(topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence])),
    owned,
  );
}

function requirePickedExit(continuation: LinearContinuation): number {
  if (continuation.pickedExitIndex === null) {
    fail(`complete continuation ${continuation.parentOccurrenceId} lost its pick`);
  }
  return continuation.pickedExitIndex;
}

export function materializeTarget(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  parentRoom: RoomDeclaration,
  continuation: LinearContinuation,
  target: LinearContinuation['targets'][number],
  role: AuthoredRoomRole,
  effect: CanonicalTargetContinuation,
  batchStoreKey?: string,
  activeCageCount?: number,
  clockworkReward?: 'goal' | 'nonGoal',
  entered: boolean = continuation.pickedExitIndex === target.exitIndex,
): CanonicalTarget {
  const occurrence = requireOccurrence(occurrences, target.occurrenceId);
  const room = requireRoom(catalog, occurrence);
  const picked = continuation.pickedExitIndex === target.exitIndex;
  return Object.freeze({
    origin: createTargetAddress(biome, continuation.parentOccurrenceId, target.exitIndex),
    exit: canonicalExit(parentRoom, target.exitIndex),
    picked,
    continuation: picked ? effect : 'deadLeaf',
    room: materializeAuthoredRoom({
      catalog,
      biome,
      room,
      occurrence,
      role,
      entered,
      ...(batchStoreKey === undefined ? {} : { batchStoreKey }),
      ...(activeCageCount === undefined ? {} : { activeCageCount }),
      ...(clockworkReward === undefined ? {} : { clockworkReward }),
    }),
  });
}

interface ClockworkProjectionState {
  readonly goalsRemaining: number;
  readonly nonGoalRewardsAcquired: number;
  readonly maxNonGoalRewards: number;
}

export interface ClockworkTargetProjection {
  readonly exitIndex: number;
  readonly occurrenceId: OccurrenceId;
  readonly reward: 'goal' | 'nonGoal';
}

export interface ClockworkBatchProjection {
  readonly parentOccurrenceId: OccurrenceId | null;
  readonly batchState: Extract<CanonicalBatchState, { readonly kind: 'clockwork' }>;
  readonly targets: readonly ClockworkTargetProjection[];
}

function clockworkBatchState(
  state: ClockworkProjectionState,
): Extract<CanonicalBatchState, { readonly kind: 'clockwork' }> {
  return Object.freeze({ kind: 'clockwork', ...state });
}

function clockworkReward(
  room: RoomDeclaration,
  state: ClockworkProjectionState,
  goalAlreadyOffered: boolean,
  terminalRoomGameName: string,
): 'goal' | 'nonGoal' {
  if (room.gameName === terminalRoomGameName) {
    return 'goal';
  }
  if (room.kind !== 'Combat') {
    return 'nonGoal';
  }
  return (state.goalsRemaining > 0 && !goalAlreadyOffered) ||
    state.nonGoalRewardsAcquired >= state.maxNonGoalRewards
    ? 'goal'
    : 'nonGoal';
}

function advanceClockworkState(
  state: ClockworkProjectionState,
  reward: 'goal' | 'nonGoal',
): ClockworkProjectionState {
  return reward === 'goal'
    ? Object.freeze({ ...state, goalsRemaining: Math.max(0, state.goalsRemaining - 1) })
    : Object.freeze({
        ...state,
        nonGoalRewardsAcquired: state.nonGoalRewardsAcquired + 1,
      });
}

function projectClockworkBatches(
  catalog: Catalog,
  layout: LinearBiomeLayout,
  topology: LinearBiomeTopology,
  maxNonGoalRewards: number,
): readonly ClockworkBatchProjection[] {
  if (
    layout.start.kind !== 'fixedEntry' ||
    layout.terminal.kind !== 'generatedTarget' ||
    layout.continuation.batchPolicy.kind !== 'clockwork'
  ) {
    fail(`${layout.biomeKey} is not a Clockwork linear biome`);
  }
  let state: ClockworkProjectionState = Object.freeze({
    goalsRemaining: layout.continuation.batchPolicy.initialGoalCount,
    nonGoalRewardsAcquired: 0,
    maxNonGoalRewards,
  });
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const batches: ClockworkBatchProjection[] = [];
  for (const continuation of topology.continuations) {
    if (continuation.kind !== 'batch') {
      fail(`${layout.biomeKey} Clockwork topology contains an independent terminal transition`);
    }
    const batchState = clockworkBatchState(state);
    let goalAlreadyOffered = false;
    const targets = Object.freeze(
      [...continuation.targets]
        .sort((left, right) => left.exitIndex - right.exitIndex)
        .map((target): ClockworkTargetProjection => {
          const occurrence = requireOccurrence(occurrences, target.occurrenceId);
          const room = requireRoom(catalog, occurrence);
          const reward = clockworkReward(
            room,
            state,
            goalAlreadyOffered,
            layout.terminal.roomGameName,
          );
          if (reward === 'goal') {
            goalAlreadyOffered = true;
          }
          return Object.freeze({
            exitIndex: target.exitIndex,
            occurrenceId: target.occurrenceId,
            reward,
          });
        }),
    );
    batches.push(
      Object.freeze({
        parentOccurrenceId: continuation.parentOccurrenceId,
        batchState,
        targets,
      }),
    );
    const picked = targets.find((target) => target.exitIndex === continuation.pickedExitIndex);
    if (picked !== undefined) {
      state = advanceClockworkState(state, picked.reward);
    }
  }
  return Object.freeze(batches);
}

export function projectClockworkTopology(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: LinearBiomePlan,
): readonly ClockworkBatchProjection[] {
  if (plan.biomeKey !== biome.biomeKey) {
    fail(`${biome.biomeKey} projection received ${plan.biomeKey} plan`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    fail(`${biome.biomeKey} is not a linear biome`);
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const maxNonGoalRewards = plan.state.maxNonGoalRewards;
  if (typeof maxNonGoalRewards !== 'number' || !Number.isInteger(maxNonGoalRewards)) {
    fail(`${layout.biomeKey} has no projectable maxNonGoalRewards`);
  }
  return plan.topology === null
    ? Object.freeze([])
    : projectClockworkBatches(catalog, layout, plan.topology, maxNonGoalRewards);
}

export function materializeClockworkBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: LinearBiomeLayout,
  completeness: CompleteLinearCompletenessResult,
): CanonicalLinearBiome {
  if (
    layout.start.kind !== 'fixedEntry' ||
    layout.terminal.kind !== 'generatedTarget' ||
    layout.continuation.batchPolicy.kind !== 'clockwork'
  ) {
    fail(`${layout.biomeKey} is not a Clockwork linear biome`);
  }
  const maxNonGoalRewards = completeness.biomeState.maxNonGoalRewards;
  if (typeof maxNonGoalRewards !== 'number' || !Number.isInteger(maxNonGoalRewards)) {
    fail(`${layout.biomeKey} has no materializable maxNonGoalRewards`);
  }
  const entryDescriptors = [layout.start, ...layout.entries] as readonly FixedEntryDescriptor[];
  const entryRooms = Object.freeze(
    entryDescriptors.map((descriptor) => materializeFixedEntryRoom(catalog, biome, descriptor)),
  );
  const initialSource = entryRooms.at(-1);
  if (initialSource === undefined) {
    fail(`${layout.biomeKey} has no fixed entry source`);
  }
  let source: CanonicalAuthoredRoom | CanonicalFixedEntryRoom = initialSource;
  const topology = completeness.topology;
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const batches: CanonicalBatch[] = [];
  let terminalEntry: CanonicalTerminalEntry | undefined;
  const projectedBatches = projectClockworkBatches(catalog, layout, topology, maxNonGoalRewards);

  for (const [batchIndex, continuation] of topology.continuations.entries()) {
    if (continuation.kind !== 'batch') {
      fail(`${layout.biomeKey} Clockwork topology contains an independent terminal transition`);
    }
    const expectedParent = source.kind === 'fixedEntry' ? null : source.occurrenceId;
    if (continuation.parentOccurrenceId !== expectedParent) {
      fail(`Clockwork batch ${batchIndex + 1} is disconnected from ${source.gameName}`);
    }
    const sourceDeclaration: RoomDeclaration | undefined = catalog.rooms.byKey[source.gameName];
    if (sourceDeclaration === undefined) {
      fail(`trusted Clockwork source lost room ${source.gameName}`);
    }
    const pickedExitIndex = requirePickedExit(continuation);
    const projectedBatch = projectedBatches[batchIndex];
    if (projectedBatch === undefined) {
      fail(`Clockwork batch ${batchIndex + 1} has no projection`);
    }
    const batchState = projectedBatch.batchState;
    const targets: readonly CanonicalTarget[] = Object.freeze(
      [...continuation.targets]
        .sort((left, right) => left.exitIndex - right.exitIndex)
        .map((target): CanonicalTarget => {
          const occurrence = requireOccurrence(occurrences, target.occurrenceId);
          const room = requireRoom(catalog, occurrence);
          const reward = projectedBatch.targets.find(
            (candidate) => candidate.exitIndex === target.exitIndex,
          )?.reward;
          if (reward === undefined) {
            fail(`Clockwork batch ${batchIndex + 1} target ${target.exitIndex} has no projection`);
          }
          const terminal = room.gameName === layout.terminal.roomGameName;
          return materializeTarget(
            catalog,
            biome,
            occurrences,
            sourceDeclaration,
            continuation,
            target,
            terminal ? 'terminalShop' : 'ordinary',
            terminal ? 'entersTerminal' : 'continuesSpine',
            undefined,
            undefined,
            reward,
          );
        }),
    );
    const picked: CanonicalTarget | undefined = targets.find(
      (target) => target.exit.index === pickedExitIndex,
    );
    if (picked === undefined) {
      fail(`Clockwork batch ${batchIndex + 1} lost its picked target`);
    }
    const rewardStore = canonicalRewardStore(biome, continuation.parentOccurrenceId, {
      kind: 'none',
    });
    if (picked.room.gameName === layout.terminal.roomGameName) {
      terminalEntry = Object.freeze({
        origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
        predecessor: roomReference(source),
        targets,
        pickedExitIndex,
        pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
        rewardStore,
        batchState,
      });
      break;
    }
    batches.push(
      Object.freeze({
        origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
        parent: roomReference(source),
        rewardStore,
        batchState,
        targets,
        pickedExitIndex,
        pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
      }),
    );
    source = picked.room;
  }

  if (terminalEntry === undefined) {
    fail(`complete ${layout.biomeKey} Clockwork topology has no picked terminal target`);
  }
  const terminalDeclaration = catalog.rooms.byKey[layout.terminal.roomGameName];
  if (terminalDeclaration === undefined) {
    fail(`${layout.terminal.roomGameName} has no terminal declaration`);
  }
  return Object.freeze({
    kind: 'LinearBiome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRooms,
    batches: Object.freeze(batches),
    terminalEntry,
    completionRooms: materializeCompletionRooms({
      catalog,
      biome,
      completion: layout.completion,
      enteredStorePolicy: {
        kind: 'declared',
        ...(terminalDeclaration.forcedRewardStoreKey === undefined
          ? {}
          : { resolvedOfferStoreKey: terminalDeclaration.forcedRewardStoreKey }),
      },
      lifecycleProducerPolicy: 'encounterCompatible',
      fail,
    }),
    biomeState: Object.freeze({ ...completeness.biomeState }),
  });
}

export function materializeStandardLinearBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: LinearBiomeLayout,
  completeness: CompleteLinearCompletenessResult,
): CanonicalLinearBiome {
  const topology = completeness.topology;
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  if (topology.startOccurrenceId === null) {
    fail(`${layout.biomeKey} derived entry materialization is not implemented`);
  }
  const startOccurrence = requireOccurrence(occurrences, topology.startOccurrenceId);
  const startRoom = requireRoom(catalog, startOccurrence);
  const canonicalByOccurrence = new Map<OccurrenceId, CanonicalAuthoredRoom>();
  const start = materializeAuthoredRoom({
    catalog,
    biome,
    room: startRoom,
    occurrence: startOccurrence,
    role: 'ordinary',
    entered: true,
  });
  canonicalByOccurrence.set(start.occurrenceId, start);

  const batches: CanonicalBatch[] = [];
  let terminalEntry: CanonicalTerminalEntry | undefined;
  for (const continuation of topology.continuations) {
    if (continuation.parentOccurrenceId === null) {
      fail(`${layout.biomeKey} derived entry continuation is not implemented`);
    }
    const parent = canonicalByOccurrence.get(continuation.parentOccurrenceId);
    if (parent === undefined) {
      fail(
        `continuation parent ${continuation.parentOccurrenceId} is not on the materialized spine`,
      );
    }
    const parentOccurrence = requireOccurrence(occurrences, continuation.parentOccurrenceId);
    const parentRoom = requireRoom(catalog, parentOccurrence);
    const pickedExitIndex = requirePickedExit(continuation);

    if (continuation.kind === 'batch') {
      const batchState = canonicalBatchState(catalog, layout, occurrences, continuation);
      const sharedStoreKey = finalSharedRewardStoreKey(
        catalog,
        occurrences,
        parent,
        continuation.rewardStore,
        continuation.targets,
      );
      const targets = Object.freeze(
        continuation.targets.map((target) =>
          materializeTarget(
            catalog,
            biome,
            occurrences,
            parentRoom,
            continuation,
            target,
            'ordinary',
            'continuesSpine',
            sharedStoreKey,
            batchState.kind === 'fields' ? batchState.doorCageRewardCount : undefined,
          ),
        ),
      );
      for (const target of targets) {
        canonicalByOccurrence.set(target.room.occurrenceId, target.room);
      }
      batches.push(
        Object.freeze({
          origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
          parent: roomReference(parent),
          rewardStore: canonicalRewardStore(
            biome,
            continuation.parentOccurrenceId,
            continuation.rewardStore,
          ),
          batchState,
          targets,
          pickedExitIndex,
          pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
        }),
      );
      continue;
    }

    const terminalRewardStore =
      layout.terminal.kind === 'directTransition' ? continuation.rewardStore : undefined;
    if (layout.terminal.kind === 'directTransition' && terminalRewardStore === undefined) {
      fail(`${layout.biomeKey} direct terminal has no reward store`);
    }
    const terminalStoreKey =
      terminalRewardStore === undefined
        ? undefined
        : finalSharedRewardStoreKey(
            catalog,
            occurrences,
            parent,
            terminalRewardStore,
            continuation.targets,
          );
    const targets = Object.freeze(
      continuation.targets.map((target) =>
        materializeTarget(
          catalog,
          biome,
          occurrences,
          parentRoom,
          continuation,
          target,
          layout.terminal.kind === 'directTransition' || target.exitIndex === 1
            ? 'terminalShop'
            : 'terminalFreeReward',
          'entersTerminal',
          terminalStoreKey,
        ),
      ),
    );
    terminalEntry = Object.freeze({
      origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
      predecessor: roomReference(parent),
      targets,
      pickedExitIndex,
      pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
      ...(terminalRewardStore === undefined
        ? {}
        : {
            rewardStore: canonicalRewardStore(
              biome,
              continuation.parentOccurrenceId,
              terminalRewardStore,
            ),
          }),
    });
  }

  if (terminalEntry === undefined) {
    fail(`complete ${layout.biomeKey} topology has no terminal entry`);
  }
  const terminalDeclaration = catalog.rooms.byKey[layout.terminal.roomGameName];
  if (terminalDeclaration === undefined) {
    fail(`${layout.terminal.roomGameName} has no terminal declaration`);
  }
  const enteredTerminal = terminalEntry.targets.find((target) => target.picked)?.room;
  const completionStoreKey = enteredTerminal?.incomingReward?.resolvedStoreKey;
  return Object.freeze({
    kind: 'LinearBiome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRooms: Object.freeze([start]),
    batches: Object.freeze(batches),
    terminalEntry,
    completionRooms: materializeCompletionRooms({
      catalog,
      biome,
      completion: layout.completion,
      enteredStorePolicy: {
        kind: 'declared',
        ...(completionStoreKey === undefined
          ? terminalDeclaration.forcedRewardStoreKey === undefined
            ? {}
            : { resolvedOfferStoreKey: terminalDeclaration.forcedRewardStoreKey }
          : { resolvedOfferStoreKey: completionStoreKey }),
      },
      lifecycleProducerPolicy: 'encounterCompatible',
      fail,
    }),
    biomeState: Object.freeze({ ...completeness.biomeState }),
  });
}
