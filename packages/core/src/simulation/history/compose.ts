import type { Catalog } from '../../catalog';
import {
  createBiomeAddress,
  createFixedEntryTargetAddress,
  semanticAddressKey,
  type BiomeAddress,
  type ContinuationAddress,
} from '../../project/addresses';
import type { EnteredRewardStoreHistoryPolicy } from '../../rewards';
import {
  executeRoomLifecycle,
  type RoomHistoryOrigin,
  type RoomLifecycleEvent,
} from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatchState,
  CanonicalFixedEntryRoom,
  CanonicalLinearBiome,
  CanonicalRoom,
  CanonicalTarget,
} from '../materialization';
import { foldLinearHistoryEvents } from './fold';
import type { CanonicalLinearHistory, LinearHistoryEvent, RoomCreatedHistoryEvent } from './model';

export class LinearHistoryCompositionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearHistoryCompositionContractError';
  }
}

interface EventBuilder {
  readonly events: LinearHistoryEvent[];
  readonly sequenceBase: number;
}

type LinearHistoryEventData<Event extends LinearHistoryEvent = LinearHistoryEvent> =
  Event extends LinearHistoryEvent ? Omit<Event, 'sequence'> : never;

function append(builder: EventBuilder, event: LinearHistoryEventData): void {
  builder.events.push(
    Object.freeze({
      ...event,
      sequence: builder.sequenceBase + builder.events.length + 1,
    }) as LinearHistoryEvent,
  );
}

function appendLifecycleEvent(builder: EventBuilder, event: RoomLifecycleEvent): void {
  const { sequence: localSequence, ...data } = event;
  if (localSequence <= 0) {
    throw new LinearHistoryCompositionContractError('room fragment has an invalid local sequence');
  }
  append(builder, data);
}

function standaloneRoomCreated(
  builder: EventBuilder,
  room: CanonicalRoom,
  source: 'biomeEntry' | 'layoutCompletion',
): void {
  append(builder, {
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    source,
    picked: true,
  });
}

function generatedTargetCreated(
  builder: EventBuilder,
  parentOrigin: RoomHistoryOrigin,
  target: CanonicalTarget,
  generationIndex: number,
  generationCount: number,
): void {
  const event: LinearHistoryEventData<RoomCreatedHistoryEvent> = {
    kind: 'roomCreated',
    origin: target.room.origin,
    gameName: target.room.gameName,
    encounterProfileKey: target.room.encounterProfileKey,
    source: 'generatedTarget',
    picked: target.picked,
    parentOrigin,
    targetOrigin: target.origin,
    generationIndex,
    generationCount,
  };
  append(builder, event);
  append(builder, {
    kind: 'targetGenerationCompleted',
    origin: target.origin,
    roomOrigin: target.room.origin,
    parentOrigin,
    generationIndex,
    generationCount,
  });
}

function layoutEntryCreated(
  builder: EventBuilder,
  parentOrigin: RoomHistoryOrigin,
  room: CanonicalFixedEntryRoom,
): void {
  const biome = createBiomeAddress(parentOrigin.routeKey, parentOrigin.biomeKey);
  const targetOrigin = createFixedEntryTargetAddress(biome, room.role);
  append(builder, {
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    source: 'layoutEntry',
    picked: true,
    parentOrigin,
    targetOrigin,
    generationIndex: 1,
    generationCount: 1,
  });
  append(builder, {
    kind: 'targetGenerationCompleted',
    origin: targetOrigin,
    roomOrigin: room.origin,
    parentOrigin,
    generationIndex: 1,
    generationCount: 1,
  });
}

function enteredStoreKey(
  policy: EnteredRewardStoreHistoryPolicy,
  room: CanonicalRoom,
): string | undefined {
  if (room.kind === 'authored' && room.clockworkReward === 'goal') {
    return undefined;
  }
  switch (policy.kind) {
    case 'fixed':
      return policy.storeKey;
    case 'none':
      return undefined;
    case 'resolvedOffer': {
      const resolvedStoreKey =
        room.kind === 'completion'
          ? room.enteredRewardStoreKey
          : room.incomingReward?.resolvedStoreKey;
      if (resolvedStoreKey === undefined) {
        throw new LinearHistoryCompositionContractError(
          `${room.gameName} requires resolved entered-store provenance`,
        );
      }
      return resolvedStoreKey;
    }
  }
}

function lifecycleInput(catalog: Catalog, room: CanonicalRoom) {
  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration === undefined) {
    throw new LinearHistoryCompositionContractError(`unknown canonical room ${room.gameName}`);
  }
  const storeKey = enteredStoreKey(declaration.enteredRewardStoreHistory, room);
  return {
    origin: room.origin,
    lifecycleProfileKey: room.lifecycleProfileKey,
    encounterProfileKey: room.encounterProfileKey,
    counterEffects: room.counterEffects,
    ...(room.kind !== 'completion' && room.incomingReward !== undefined
      ? {
          producer: {
            lifecycleProfileKey: room.incomingReward.producerLifecycleKey,
            offer: room.incomingReward.offer,
          },
        }
      : {}),
    ...(storeKey === undefined ? {} : { enteredRewardStoreKey: storeKey }),
  };
}

function appendGeneratedTargets(
  builder: EventBuilder,
  parentOrigin: RoomHistoryOrigin,
  targets: readonly CanonicalTarget[],
): void {
  targets.forEach((target, index) =>
    generatedTargetCreated(builder, parentOrigin, target, index + 1, targets.length),
  );
}

function appendBatchState(
  builder: EventBuilder,
  origin: ContinuationAddress,
  batchState: CanonicalBatchState,
): void {
  if (batchState.kind !== 'fields') {
    if (batchState.kind === 'clockwork') {
      append(builder, {
        kind: 'clockworkBatchStateRecorded',
        origin,
        goalsRemaining: batchState.goalsRemaining,
        nonGoalRewardsAcquired: batchState.nonGoalRewardsAcquired,
        maxNonGoalRewards: batchState.maxNonGoalRewards,
      });
    }
    return;
  }
  append(builder, {
    kind: 'fieldsBatchOutcomeRecorded',
    origin,
    cageOutcome: batchState.cageOutcome,
    batchCapacity: batchState.batchCapacity,
    cageTargetCount: batchState.cageTargetCount,
    doorCageRewardCount: batchState.doorCageRewardCount,
  });
}

function appendRoomLifecycle(
  builder: EventBuilder,
  catalog: Catalog,
  room: CanonicalRoom,
  generatedTargets?: readonly CanonicalTarget[],
  batchState?: CanonicalBatchState,
  batchOrigin?: ContinuationAddress,
  layoutEntry?: CanonicalFixedEntryRoom,
): void {
  if (room.kind === 'authored' && !room.entered) {
    throw new LinearHistoryCompositionContractError(
      `unpicked occurrence ${semanticAddressKey(room.origin)} cannot execute a lifecycle`,
    );
  }
  const fragment = executeRoomLifecycle(catalog, lifecycleInput(catalog, room));
  const clockworkNonGoalSpawnsBeforeCombat =
    room.kind === 'authored' &&
    room.clockworkReward === 'nonGoal' &&
    fragment.events.some(
      (event) => event.kind === 'producerRoleAdvanced' && event.lifecyclePoint === 'beforeCombat',
    );
  let injectedTargets = false;
  let injectedClockworkReward = false;
  for (const event of fragment.events) {
    if (
      clockworkNonGoalSpawnsBeforeCombat &&
      event.kind === 'producerRoleAdvanced' &&
      event.lifecyclePoint === 'beforeCombat'
    ) {
      if (injectedClockworkReward) {
        throw new LinearHistoryCompositionContractError(
          `${room.gameName} reached more than one Clockwork producer point`,
        );
      }
      append(builder, { kind: 'clockworkNonGoalRewardSpawned', origin: room.origin });
      injectedClockworkReward = true;
    }
    appendLifecycleEvent(builder, event);
    if (
      room.kind === 'authored' &&
      ((event.kind === 'roomEntered' && room.clockworkReward === 'goal') ||
        (event.kind === 'encounterCompleted' &&
          room.clockworkReward === 'nonGoal' &&
          !clockworkNonGoalSpawnsBeforeCombat))
    ) {
      if (injectedClockworkReward) {
        throw new LinearHistoryCompositionContractError(
          `${room.gameName} reached more than one Clockwork producer point`,
        );
      }
      append(
        builder,
        room.clockworkReward === 'goal'
          ? { kind: 'clockworkGoalAcquired', origin: room.origin }
          : { kind: 'clockworkNonGoalRewardSpawned', origin: room.origin },
      );
      injectedClockworkReward = true;
    }
    if (event.kind === 'outgoingGenerationCheckpoint') {
      if ((generatedTargets === undefined) === (layoutEntry === undefined)) {
        throw new LinearHistoryCompositionContractError(
          `${room.gameName} requires exactly one outgoing-generation projection`,
        );
      }
      if (batchState !== undefined) {
        if (batchOrigin === undefined) {
          throw new LinearHistoryCompositionContractError(
            `${room.gameName} has batch state without a continuation origin`,
          );
        }
        appendBatchState(builder, batchOrigin, batchState);
      }
      if (generatedTargets !== undefined) {
        appendGeneratedTargets(builder, room.origin, generatedTargets);
      } else {
        layoutEntryCreated(builder, room.origin, layoutEntry!);
      }
      injectedTargets = true;
    }
  }
  if (room.kind === 'authored' && room.clockworkReward !== undefined && !injectedClockworkReward) {
    throw new LinearHistoryCompositionContractError(
      `${room.gameName} has no Clockwork producer point`,
    );
  }
  if ((generatedTargets !== undefined || layoutEntry !== undefined) && !injectedTargets) {
    throw new LinearHistoryCompositionContractError(
      `${room.gameName} has canonical targets but no outgoing-generation operation`,
    );
  }
}

function pickedRoom(targets: readonly CanonicalTarget[], owner: string): CanonicalAuthoredRoom {
  const picked = targets.filter((target) => target.picked);
  if (picked.length !== 1 || picked[0] === undefined) {
    throw new LinearHistoryCompositionContractError(
      `${owner} must contain exactly one picked target`,
    );
  }
  return picked[0].room;
}

function requireParent(
  source: CanonicalAuthoredRoom | CanonicalFixedEntryRoom,
  parent: RoomHistoryOrigin,
  owner: string,
): void {
  if (semanticAddressKey(source.origin) !== semanticAddressKey(parent)) {
    throw new LinearHistoryCompositionContractError(
      `${owner} parent ${semanticAddressKey(parent)} does not match ${semanticAddressKey(source.origin)}`,
    );
  }
}

function requireLinearLayout(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  previous?: CanonicalLinearHistory,
) {
  const route = catalog.routes.byKey[snapshot.routeKey];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (
    route === undefined ||
    !route.biomeKeys.includes(snapshot.biomeKey) ||
    layout?.kind !== 'LinearBiome'
  ) {
    throw new LinearHistoryCompositionContractError(
      `catalog cannot place canonical ${snapshot.biomeKey} history`,
    );
  }
  const biomeIndex = route.biomeKeys.indexOf(snapshot.biomeKey);
  const expectedPreviousBiomeKey = route.biomeKeys[biomeIndex - 1];
  if (expectedPreviousBiomeKey === undefined) {
    if (previous !== undefined) {
      throw new LinearHistoryCompositionContractError(
        `${snapshot.biomeKey} is the first ${route.key} biome and cannot consume prior history`,
      );
    }
  } else if (
    previous === undefined ||
    previous.routeKey !== snapshot.routeKey ||
    previous.biomeKey !== expectedPreviousBiomeKey
  ) {
    throw new LinearHistoryCompositionContractError(
      `${snapshot.biomeKey} requires validated ${expectedPreviousBiomeKey} history`,
    );
  }
  return layout;
}

export function composeLinearHistory(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  previous?: CanonicalLinearHistory,
): CanonicalLinearHistory {
  const layout = requireLinearLayout(catalog, snapshot, previous);
  const seed = previous?.afterTransition;
  const entry = snapshot.entryRooms[0];
  if (entry === undefined) {
    throw new LinearHistoryCompositionContractError(
      `${snapshot.biomeKey} history requires a canonical entry room`,
    );
  }
  const builder: EventBuilder = { events: [], sequenceBase: seed?.sequence ?? 0 };
  const biome: BiomeAddress = createBiomeAddress(snapshot.routeKey, snapshot.biomeKey);
  const clockworkMaxNonGoalRewards = snapshot.biomeState.maxNonGoalRewards;
  if (
    layout.continuation.batchPolicy.kind === 'clockwork' &&
    (typeof clockworkMaxNonGoalRewards !== 'number' ||
      !Number.isInteger(clockworkMaxNonGoalRewards))
  ) {
    throw new LinearHistoryCompositionContractError(
      `${snapshot.biomeKey} has no canonical maxNonGoalRewards`,
    );
  }
  const clockworkCounters =
    layout.continuation.batchPolicy.kind === 'clockwork'
      ? {
          clockworkGoalsRemaining: layout.continuation.batchPolicy.initialGoalCount,
          clockworkNonGoalRewardsAcquired: 0,
          clockworkMaxNonGoalRewards: clockworkMaxNonGoalRewards as number,
        }
      : {};
  append(builder, {
    kind: 'biomeStarted',
    origin: biome,
    counters: Object.freeze({
      biomeDepthCache: layout.initialCounters.biomeDepthCache,
      biomeEncounterDepth: layout.initialCounters.biomeEncounterDepth,
      routeEncounterDepth: seed?.ledgers.counters.routeEncounterDepth ?? 1,
      roomHistoryOrdinal: seed?.ledgers.counters.roomHistoryOrdinal ?? 0,
      ...(layout.continuation.batchPolicy.kind === 'fields' ? { fieldsMaxDoorsRolled: 0 } : {}),
      ...clockworkCounters,
    }),
  });
  standaloneRoomCreated(builder, entry, 'biomeEntry');
  let source = entry;

  for (const fixedEntry of snapshot.entryRooms.slice(1)) {
    if (fixedEntry.kind !== 'fixedEntry') {
      throw new LinearHistoryCompositionContractError(
        `${snapshot.biomeKey} has an authored room after its entry`,
      );
    }
    appendRoomLifecycle(builder, catalog, source, undefined, undefined, undefined, fixedEntry);
    source = fixedEntry;
  }

  for (const batch of snapshot.batches) {
    requireParent(source, batch.parent.origin, 'batch');
    appendRoomLifecycle(builder, catalog, source, batch.targets, batch.batchState, batch.origin);
    source = pickedRoom(batch.targets, semanticAddressKey(batch.origin));
  }

  requireParent(source, snapshot.terminalEntry.predecessor.origin, 'terminal entry');
  appendRoomLifecycle(
    builder,
    catalog,
    source,
    snapshot.terminalEntry.targets,
    snapshot.terminalEntry.batchState,
    snapshot.terminalEntry.origin,
  );
  const terminal = pickedRoom(
    snapshot.terminalEntry.targets,
    semanticAddressKey(snapshot.terminalEntry.origin),
  );
  appendRoomLifecycle(builder, catalog, terminal);

  for (const completion of snapshot.completionRooms) {
    standaloneRoomCreated(builder, completion, 'layoutCompletion');
    appendRoomLifecycle(builder, catalog, completion);
  }

  append(builder, { kind: 'biomeCompleted', origin: biome });
  for (const effect of layout.completion.transitionEffects) {
    append(builder, {
      kind: 'biomeCounterReset',
      origin: biome,
      axis: effect.axis,
      value: 0,
    });
  }
  return foldLinearHistoryEvents(builder.events, seed);
}

export function composeFHistory(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
): CanonicalLinearHistory {
  if (snapshot.biomeKey !== 'F') {
    throw new LinearHistoryCompositionContractError(
      `F history cannot compose biome ${snapshot.biomeKey}`,
    );
  }
  return composeLinearHistory(catalog, snapshot);
}
