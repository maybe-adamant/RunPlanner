import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createFixedEntryTargetAddress,
  semanticAddressKey,
  type ContinuationAddress,
} from '../../authored-project/addresses';
import type { RoomHistoryOrigin } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatchState,
  CanonicalFixedEntryRoom,
  CanonicalLinearBiome,
  CanonicalRoom,
  CanonicalTarget,
} from '../materialization';
import {
  appendRoomLifecycle as appendCanonicalRoomLifecycle,
  composeBiomeHistoryEnvelope,
  composeFixedEntryChain,
  type HistorySegmentWriter,
} from './composition';
import type { CanonicalLinearHistory, RoomCreatedHistoryEvent } from './model';

export class LinearHistoryCompositionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearHistoryCompositionContractError';
  }
}

function generatedTargetCreated(
  writer: HistorySegmentWriter,
  parentOrigin: RoomHistoryOrigin,
  target: CanonicalTarget,
  generationIndex: number,
  generationCount: number,
): void {
  const event: Omit<
    Extract<RoomCreatedHistoryEvent, { readonly source: 'generatedTarget' }>,
    'sequence'
  > = {
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
  writer.append(event);
  writer.append({
    kind: 'targetGenerationCompleted',
    origin: target.origin,
    roomOrigin: target.room.origin,
    parentOrigin,
    generationIndex,
    generationCount,
  });
}

function layoutEntryCreated(
  writer: HistorySegmentWriter,
  parentOrigin: RoomHistoryOrigin,
  room: CanonicalFixedEntryRoom,
): void {
  const biome = createBiomeAddress(parentOrigin.routeKey, parentOrigin.biomeKey);
  const targetOrigin = createFixedEntryTargetAddress(biome, room.role);
  writer.append({
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
  writer.append({
    kind: 'targetGenerationCompleted',
    origin: targetOrigin,
    roomOrigin: room.origin,
    parentOrigin,
    generationIndex: 1,
    generationCount: 1,
  });
}

function appendGeneratedTargets(
  writer: HistorySegmentWriter,
  parentOrigin: RoomHistoryOrigin,
  targets: readonly CanonicalTarget[],
): void {
  targets.forEach((target, index) =>
    generatedTargetCreated(writer, parentOrigin, target, index + 1, targets.length),
  );
}

function appendBatchState(
  writer: HistorySegmentWriter,
  origin: ContinuationAddress,
  batchState: CanonicalBatchState,
): void {
  if (batchState.kind !== 'fields') {
    if (batchState.kind === 'clockwork') {
      writer.append({
        kind: 'clockworkBatchStateRecorded',
        origin,
        goalsRemaining: batchState.goalsRemaining,
        nonGoalRewardsAcquired: batchState.nonGoalRewardsAcquired,
        maxNonGoalRewards: batchState.maxNonGoalRewards,
      });
    }
    return;
  }
  writer.append({
    kind: 'fieldsBatchOutcomeRecorded',
    origin,
    cageOutcome: batchState.cageOutcome,
    batchCapacity: batchState.batchCapacity,
    cageTargetCount: batchState.cageTargetCount,
    doorCageRewardCount: batchState.doorCageRewardCount,
  });
}

function appendRoomLifecycle(
  writer: HistorySegmentWriter,
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
  let clockworkNonGoalSpawnsBeforeCombat = false;
  let injectedTargets = false;
  let injectedClockworkReward = false;
  appendCanonicalRoomLifecycle(writer, catalog, room, fail, {
    prepare(events) {
      clockworkNonGoalSpawnsBeforeCombat =
        room.kind === 'authored' &&
        room.clockworkReward === 'nonGoal' &&
        events.some(
          (event) =>
            event.kind === 'producerRoleAdvanced' && event.lifecyclePoint === 'beforeCombat',
        );
    },
    beforeEvent(targetWriter, event) {
      if (
        clockworkNonGoalSpawnsBeforeCombat &&
        event.kind === 'producerRoleAdvanced' &&
        event.lifecyclePoint === 'beforeCombat'
      ) {
        if (injectedClockworkReward) {
          fail(`${room.gameName} reached more than one Clockwork producer point`);
        }
        targetWriter.append({ kind: 'clockworkNonGoalRewardSpawned', origin: room.origin });
        injectedClockworkReward = true;
      }
    },
    afterEvent(targetWriter, event) {
      if (
        room.kind === 'authored' &&
        ((event.kind === 'roomEntered' && room.clockworkReward === 'goal') ||
          (event.kind === 'encounterCompleted' &&
            room.clockworkReward === 'nonGoal' &&
            !clockworkNonGoalSpawnsBeforeCombat))
      ) {
        if (injectedClockworkReward) {
          fail(`${room.gameName} reached more than one Clockwork producer point`);
        }
        targetWriter.append(
          room.clockworkReward === 'goal'
            ? { kind: 'clockworkGoalAcquired', origin: room.origin }
            : { kind: 'clockworkNonGoalRewardSpawned', origin: room.origin },
        );
        injectedClockworkReward = true;
      }
    },
    ...(generatedTargets === undefined && layoutEntry === undefined
      ? {}
      : {
          outgoing(targetWriter: HistorySegmentWriter) {
            if ((generatedTargets === undefined) === (layoutEntry === undefined)) {
              fail(`${room.gameName} requires exactly one outgoing-generation projection`);
            }
            if (batchState !== undefined) {
              if (batchOrigin === undefined) {
                fail(`${room.gameName} has batch state without a continuation origin`);
              }
              appendBatchState(targetWriter, batchOrigin, batchState);
            }
            if (generatedTargets !== undefined) {
              appendGeneratedTargets(targetWriter, room.origin, generatedTargets);
            } else {
              layoutEntryCreated(targetWriter, room.origin, layoutEntry!);
            }
            injectedTargets = true;
          },
        }),
  });
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

function fail(detail: string): never {
  throw new LinearHistoryCompositionContractError(detail);
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
  return composeBiomeHistoryEnvelope({
    catalog,
    routeKey: snapshot.routeKey,
    biomeKey: snapshot.biomeKey,
    initialCounters: {
      biomeDepthCache: layout.initialCounters.biomeDepthCache,
      biomeEncounterDepth: layout.initialCounters.biomeEncounterDepth,
      routeEncounterDepth: seed?.ledgers.counters.routeEncounterDepth ?? 1,
      roomHistoryOrdinal: seed?.ledgers.counters.roomHistoryOrdinal ?? 0,
      ...(layout.continuation.batchPolicy.kind === 'fields' ? { fieldsMaxDoorsRolled: 0 } : {}),
      ...clockworkCounters,
    },
    ...(seed === undefined ? {} : { seed }),
    completionRooms: snapshot.completionRooms,
    transitionEffects: layout.completion.transitionEffects,
    composeEntry(writer) {
      return composeFixedEntryChain(
        writer,
        snapshot.entryRooms,
        (targetWriter, source, fixedEntry) => {
          if (fixedEntry.kind !== 'fixedEntry') {
            fail(`${snapshot.biomeKey} has an authored room after its entry`);
          }
          appendRoomLifecycle(
            targetWriter,
            catalog,
            source,
            undefined,
            undefined,
            undefined,
            fixedEntry,
          );
        },
        fail,
      );
    },
    composeBody(writer, entrySource) {
      let source = entrySource;
      for (const batch of snapshot.batches) {
        requireParent(source, batch.parent.origin, 'batch');
        appendRoomLifecycle(writer, catalog, source, batch.targets, batch.batchState, batch.origin);
        source = pickedRoom(batch.targets, semanticAddressKey(batch.origin));
      }
      return source;
    },
    composeTerminal(writer, source) {
      requireParent(source, snapshot.terminalEntry.predecessor.origin, 'terminal entry');
      appendRoomLifecycle(
        writer,
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
      appendRoomLifecycle(writer, catalog, terminal);
      return terminal;
    },
    fail,
  });
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
