import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress, semanticAddressKey } from '../../authored-project/addresses';
import type {
  CanonicalAdditionalContinuation,
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalHubDecision,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalHubVisit,
  CanonicalLocalVisitRoom,
  CanonicalRoomRestore,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedHubVisitFrontier,
} from '../materialization';
import { selectedBatchContinuation } from '../materialization';
import type { RoomHistoryOrigin, RoomLifecycleEvent } from '../lifecycle';
import {
  appendRoomLifecycle as appendCanonicalRoomLifecycle,
  appendStandaloneRoomCreated,
  appendAutomaticTail,
  composeBiomeHistoryEnvelope,
  composeBiomeHistoryEnvelopeWithEncounterValidation,
  composeBiomeHistoryPrefix as composePrefixHistoryEnvelope,
  composeBiomeHistoryPrefixWithEncounterValidation as composeValidatedPrefixHistoryEnvelope,
  type HistorySegmentWriter,
  type EncounterValidatedBiomeHistory,
  type EncounterValidatedPrefixHistory,
  type FigLeafLifecycleState,
} from './composition';
import type { CanonicalLifecycleRoom } from './lifecycleInput';
import type {
  BiomeHistoryPrefix,
  CanonicalBiomeHistory,
  HistoryStateView,
  RoomCreatedHistoryEvent,
} from './model';

export class BiomeHistoryCompositionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeHistoryCompositionContractError';
  }
}

function fail(detail: string): never {
  throw new BiomeHistoryCompositionContractError(detail);
}

function requireParent(
  current: CanonicalLifecycleRoom,
  expected: RoomHistoryOrigin,
  owner: string,
): void {
  if (semanticAddressKey(current.origin) !== semanticAddressKey(expected)) {
    fail(`${owner} is detached from the selected decision spine`);
  }
}

function selectedTarget(batch: CanonicalBatch): CanonicalTarget {
  const target = batch.targets.find((candidate) => candidate.picked);
  if (target === undefined) fail(`${semanticAddressKey(batch.origin)} has no selected target`);
  return target;
}

function selectedContinuation(
  batch: CanonicalBatch,
): CanonicalTarget | CanonicalAdditionalContinuation {
  const continuation = selectedBatchContinuation(batch);
  if (continuation === undefined) {
    fail(`${semanticAddressKey(batch.origin)} has no selected continuation`);
  }
  return continuation.kind === 'normal' ? continuation.target : continuation.continuation;
}

function appendBatchState(
  writer: HistorySegmentWriter,
  batch: Pick<CanonicalBatch, 'batchState' | 'origin'>,
): void {
  if (batch.batchState.kind === 'fields') {
    writer.append({
      kind: 'fieldsBatchOutcomeRecorded',
      origin: batch.origin,
      cageOutcome: batch.batchState.cageOutcome,
      batchCapacity: batch.batchState.batchCapacity,
      cageTargetCount: batch.batchState.cageTargetCount,
      doorCageRewardCount: batch.batchState.doorCageRewardCount,
    });
  }
  if (batch.batchState.kind === 'clockwork') {
    writer.append({
      kind: 'clockworkBatchStateRecorded',
      origin: batch.origin,
      goalsRemaining: batch.batchState.goalsRemaining,
      nonGoalRewardsAcquired: batch.batchState.nonGoalRewardsAcquired,
      maxNonGoalRewards: batch.batchState.maxNonGoalRewards,
    });
  }
}

function appendGeneratedTargets(
  writer: HistorySegmentWriter,
  parentOrigin: RoomHistoryOrigin,
  targets: readonly CanonicalTarget[],
  generation: { readonly startIndex?: number; readonly count?: number } = {},
): void {
  const startIndex = generation.startIndex ?? 0;
  const generationCount = generation.count ?? targets.length;
  targets.forEach((target, index) => {
    const event: Omit<
      Extract<RoomCreatedHistoryEvent, { readonly source: 'generatedTarget' }>,
      'sequence'
    > = {
      kind: 'roomCreated',
      origin: target.room.origin,
      gameName: target.room.gameName,
      encounterEnvelopeKey: target.room.encounterEnvelopeKey,
      source: 'generatedTarget',
      picked: target.picked,
      parentOrigin,
      targetOrigin: target.origin,
      generationIndex: startIndex + index + 1,
      generationCount,
    };
    writer.append(event);
    writer.append({
      kind: 'targetGenerationCompleted',
      origin: target.origin,
      roomOrigin: target.room.origin,
      parentOrigin,
      generationIndex: startIndex + index + 1,
      generationCount,
    });
  });
}

function appendAdditionalContinuations(
  writer: HistorySegmentWriter,
  parent: CanonicalAuthoredRoom,
  continuations: readonly CanonicalAdditionalContinuation[],
): void {
  for (const continuation of continuations) {
    writer.append({
      kind: 'roomCreated',
      origin: continuation.room.origin,
      gameName: continuation.room.gameName,
      encounterEnvelopeKey: continuation.room.encounterEnvelopeKey,
      source: 'additionalExit',
      picked: continuation.picked,
      parentOrigin: parent.origin,
      additionalOrigin: continuation.origin,
    });
  }
}

function appendHubCreated(
  writer: HistorySegmentWriter,
  parent: CanonicalAuthoredRoom,
  hub: CanonicalHubDecision,
): void {
  writer.append({
    kind: 'roomCreated',
    origin: hub.room.origin,
    gameName: hub.room.gameName,
    encounterEnvelopeKey: hub.room.encounterEnvelopeKey,
    source: 'hubDecision',
    picked: true,
    parentOrigin: parent.origin,
    targetOrigin: hub.origin,
    generationIndex: 1,
    generationCount: 1,
  });
  writer.append({
    kind: 'targetGenerationCompleted',
    origin: hub.origin,
    roomOrigin: hub.room.origin,
    parentOrigin: parent.origin,
    generationIndex: 1,
    generationCount: 1,
  });
}

function appendHubTargets(
  writer: HistorySegmentWriter,
  hub: CanonicalHubRoom,
  targets: readonly CanonicalHubTarget[],
  generation: { readonly startIndex?: number; readonly count?: number } = {},
): void {
  const startIndex = generation.startIndex ?? 0;
  const generationCount = generation.count ?? targets.length;
  targets.forEach((target, index) => {
    const event: Omit<
      Extract<RoomCreatedHistoryEvent, { readonly source: 'hubTarget' }>,
      'sequence'
    > = {
      kind: 'roomCreated',
      origin: target.room.origin,
      gameName: target.room.gameName,
      encounterEnvelopeKey: target.room.encounterEnvelopeKey,
      source: 'hubTarget',
      picked: target.room.entered,
      parentOrigin: hub.origin,
      targetOrigin: target.origin,
      generationIndex: startIndex + index + 1,
      generationCount,
    };
    writer.append(event);
    writer.append({
      kind: 'targetGenerationCompleted',
      origin: target.origin,
      roomOrigin: target.room.origin,
      parentOrigin: hub.origin,
      generationIndex: startIndex + index + 1,
      generationCount,
    });
  });
}

function appendLocalTargets(
  writer: HistorySegmentWriter,
  parent: CanonicalAuthoredRoom,
  rooms: readonly CanonicalLocalVisitRoom[],
): void {
  const generated = [...rooms]
    .filter((room) => room.localVisit.generation === 'generated')
    .sort((left, right) => left.localVisit.availabilityRank - right.localVisit.availabilityRank);
  if (generated.length === 0) {
    writer.append({ kind: 'emptyOutgoingGenerationCompleted', origin: parent.origin });
    return;
  }
  generated.forEach((room, index) => {
    const event: Omit<
      Extract<RoomCreatedHistoryEvent, { readonly source: 'localVisit' }>,
      'sequence'
    > = {
      kind: 'roomCreated',
      origin: room.origin,
      gameName: room.gameName,
      encounterEnvelopeKey: room.encounterEnvelopeKey,
      source: 'localVisit',
      picked: room.entered,
      parentOrigin: parent.origin,
      targetOrigin: room.localVisit.origin,
      generationIndex: index + 1,
      generationCount: generated.length,
    };
    writer.append(event);
    writer.append({
      kind: 'targetGenerationCompleted',
      origin: room.localVisit.origin,
      roomOrigin: room.origin,
      parentOrigin: parent.origin,
      generationIndex: index + 1,
      generationCount: generated.length,
    });
  });
}

function appendRestore(
  writer: HistorySegmentWriter,
  restore: CanonicalRoomRestore,
  room: CanonicalLifecycleRoom,
  restoreKind: 'hub' | 'parent',
): void {
  if (semanticAddressKey(restore.room.origin) !== semanticAddressKey(room.origin)) {
    fail(`${restoreKind} restore has the wrong canonical room`);
  }
  writer.append({
    kind: 'roomRestored',
    origin: room.origin,
    after: restore.after,
    restoreKind,
    biomeDepthCacheDelta: room.counterEffects.biomeDepthCache,
    roomHistoryOrdinalDelta: room.counterEffects.roomHistoryOrdinal,
    surfaceShopPresent: room.kind === 'authored' && room.hermesShrine !== undefined,
    roomShopPresent: room.kind === 'authored' && room.stygianWell !== undefined,
  });
}

function appendVisit(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  visit: CanonicalHubVisit,
  hub: CanonicalHubRoom,
): void {
  appendCanonicalRoomLifecycle(writer, catalog, visit.target.room, fail, {
    outgoing(outgoingWriter) {
      appendLocalTargets(outgoingWriter, visit.target.room, visit.localSlots);
    },
  });
  for (const [index, local] of visit.enteredLocalRooms.entries()) {
    if (!local.entered || local.localVisit.generation !== 'generated') {
      fail(`Hub visit ${visit.visitIndex} enters an unavailable side room`);
    }
    appendCanonicalRoomLifecycle(writer, catalog, local, fail);
    const restore = visit.parentRestores[index];
    if (restore === undefined) fail(`Hub visit ${visit.visitIndex} has no parent restore`);
    appendRestore(writer, restore, visit.target.room, 'parent');
  }
  appendRestore(writer, visit.hubRestore, hub, 'hub');
}

/**
 * A blocked visit is not a completed visit. Its frontier carries exactly the
 * lifecycle phase reached before the invalid owner, so replay never invents a
 * later local entry, parent restore, or return to the persistent Hub.
 */
function appendHubVisitFrontier(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  visit: MaterializedHubVisitFrontier,
): void {
  if (visit.phase === 'targetLifecycle') {
    appendCanonicalRoomLifecycle(writer, catalog, visit.target.room, fail, {
      stopAfterOutgoing: true,
    });
    return;
  }
  if (visit.phase === 'sideGeneration') {
    appendCanonicalRoomLifecycle(writer, catalog, visit.target.room, fail, {
      outgoing(outgoingWriter) {
        appendLocalTargets(outgoingWriter, visit.target.room, visit.localSlots);
      },
      stopAfterOutgoing: true,
    });
    return;
  }
  appendCanonicalRoomLifecycle(writer, catalog, visit.target.room, fail, {
    outgoing(outgoingWriter) {
      appendLocalTargets(outgoingWriter, visit.target.room, visit.localSlots);
    },
  });
  for (const [index, local] of visit.enteredLocalRooms.entries()) {
    if (!local.entered || local.localVisit.generation !== 'generated') {
      fail(`Hub visit ${visit.origin.visitIndex} enters an unavailable frontier side room`);
    }
    appendCanonicalRoomLifecycle(writer, catalog, local, fail);
    const restore = visit.parentRestores[index];
    if (restore === undefined) {
      if (index === visit.enteredLocalRooms.length - 1) return;
      fail(`Hub visit ${visit.origin.visitIndex} loses a non-final parent restore`);
    }
    appendRestore(writer, restore, visit.target.room, 'parent');
  }
  if (visit.enteredLocalRooms.length === 0) {
    fail(`Hub visit ${visit.origin.visitIndex} local lifecycle frontier has no stopping room`);
  }
}

/**
 * A Hub owns both its declaration-ordered board and its eventual Handoff
 * batch. The board is generated when the Hub reaches its outgoing checkpoint;
 * the Handoff target is appended after the chosen visits, but remains in that
 * same physical generation sequence. This preserves the persistent Hub as
 * the stable parent without inventing a second outgoing lifecycle.
 */
function appendHubDecision(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  preHub: CanonicalAuthoredRoom,
  decision: CanonicalHubDecision,
  handoff?: CanonicalBatch,
): CanonicalLifecycleRoom {
  requireParent(preHub, decision.source.origin, 'Hub decision');
  appendCanonicalRoomLifecycle(writer, catalog, preHub, fail, {
    outgoing(outgoingWriter) {
      appendHubCreated(outgoingWriter, preHub, decision);
    },
  });
  const generationCount = decision.board.targets.length + (handoff?.targets.length ?? 0);
  appendCanonicalRoomLifecycle(writer, catalog, decision.room, fail, {
    outgoing(outgoingWriter) {
      appendHubTargets(outgoingWriter, decision.room, decision.board.targets, {
        count: generationCount,
      });
    },
  });
  for (const visit of decision.visits) appendVisit(writer, catalog, visit, decision.room);
  if (handoff === undefined) return decision.room;
  appendBatchState(writer, handoff);
  appendGeneratedTargets(writer, decision.room.origin, handoff.targets, {
    startIndex: decision.board.targets.length,
    count: generationCount,
  });
  return selectedTarget(handoff).room;
}

interface ClockworkAwareLifecycleOptions {
  readonly outgoing?: (writer: HistorySegmentWriter) => void;
  readonly stopAfterOutgoing?: boolean;
  readonly continueThroughAcquisitionPoint?: string;
  readonly beforeEvent?: (writer: HistorySegmentWriter, event: RoomLifecycleEvent) => void;
  readonly afterEvent?: (writer: HistorySegmentWriter, event: RoomLifecycleEvent) => void;
}

function postOutgoingAcquisitionPoint(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): string | undefined {
  const profile = catalog.roomLifecycleProfiles.byKey[room.lifecycleProfileKey];
  if (profile === undefined)
    fail(`${room.gameName} has unknown lifecycle profile ${room.lifecycleProfileKey}`);
  let outgoingSeen = false;
  for (const operation of profile.operations) {
    if (operation.kind === 'generateOutgoingBatch') outgoingSeen = true;
    if (outgoingSeen && operation.kind === 'settleAcquisitionPoint') return operation.point;
  }
  return undefined;
}

function postOutgoingAcquisitionOption(catalog: Catalog, room: CanonicalAuthoredRoom) {
  const point = postOutgoingAcquisitionPoint(catalog, room);
  return point === undefined ? {} : { continueThroughAcquisitionPoint: point };
}

/**
 * Clockwork Goal/NonGoal acquisition belongs to the entered source room and
 * therefore precedes its outgoing generation checkpoint. Complete decisions
 * and progressive frontiers must replay that same lifecycle even when the
 * outgoing batch has no targets yet.
 */
function appendClockworkAwareRoomLifecycle(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  options: ClockworkAwareLifecycleOptions = {},
): void {
  let emitted = false;
  const emitClockworkReward = (eventWriter: HistorySegmentWriter): void => {
    if (emitted) fail(`${room.gameName} has multiple Clockwork reward points`);
    eventWriter.append(
      room.clockworkReward === 'goal'
        ? { kind: 'clockworkGoalAcquired', origin: room.origin }
        : { kind: 'clockworkNonGoalRewardSpawned', origin: room.origin },
    );
    emitted = true;
  };
  appendCanonicalRoomLifecycle(writer, catalog, room, fail, {
    ...(options.outgoing === undefined ? {} : { outgoing: options.outgoing }),
    ...(options.stopAfterOutgoing === undefined
      ? {}
      : { stopAfterOutgoing: options.stopAfterOutgoing }),
    ...(options.continueThroughAcquisitionPoint === undefined
      ? {}
      : { continueThroughAcquisitionPoint: options.continueThroughAcquisitionPoint }),
    beforeEvent(beforeWriter, event) {
      options.beforeEvent?.(beforeWriter, event);
      if (
        room.clockworkReward === 'nonGoal' &&
        room.incomingReward?.offer.rewardType === 'Devotion' &&
        event.kind === 'producerRoleAdvanced' &&
        event.lifecyclePoint === 'beforeCombat'
      ) {
        emitClockworkReward(beforeWriter);
      }
    },
    afterEvent(afterWriter, event) {
      if (room.clockworkReward !== undefined) {
        if (
          (room.clockworkReward === 'goal' && event.kind === 'roomEntered') ||
          (room.clockworkReward === 'nonGoal' &&
            room.incomingReward?.offer.rewardType !== 'Devotion' &&
            event.kind === 'encounterCompleted')
        ) {
          emitClockworkReward(afterWriter);
        }
      }
      options.afterEvent?.(afterWriter, event);
    },
  });
  if (room.clockworkReward !== undefined && !emitted) {
    fail(`${room.gameName} has no Clockwork reward point`);
  }
}

function appendRoomWithBatch(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  batch: CanonicalBatch,
): void {
  appendClockworkAwareRoomLifecycle(writer, catalog, room, {
    afterEvent(afterWriter, event) {
      if (event.kind === 'roomEntered') {
        appendAdditionalContinuations(afterWriter, room, batch.additional);
      }
    },
    outgoing(outgoingWriter) {
      appendBatchState(outgoingWriter, batch);
      appendGeneratedTargets(outgoingWriter, room.origin, batch.targets);
    },
  });
}

function appendEnteredPreboss(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): void {
  appendClockworkAwareRoomLifecycle(writer, catalog, room);
}

function initialCounters(
  catalog: Catalog,
  snapshot: Pick<CanonicalBiome, 'biomeKey' | 'biomeState'>,
  seed: HistoryStateView | undefined,
) {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout === undefined) fail(`catalog lost ${snapshot.biomeKey} layout`);
  const progression = layout.progression;
  return Object.freeze({
    biomeDepthCache: layout.initialCounters.biomeDepthCache,
    biomeEncounterDepth: layout.initialCounters.biomeEncounterDepth,
    routeEncounterDepth: seed?.ledgers.counters.routeEncounterDepth ?? 1,
    roomHistoryOrdinal: seed?.ledgers.counters.roomHistoryOrdinal ?? 0,
    ...(progression.kind === 'generated' && progression.batchPolicy.kind === 'fields'
      ? { fieldsMaxDoorsRolled: 0 }
      : {}),
    ...(progression.kind === 'generated' && progression.batchPolicy.kind === 'clockwork'
      ? {
          clockworkGoalsRemaining: progression.batchPolicy.initialGoalCount,
          clockworkNonGoalRewardsAcquired: 0,
          clockworkMaxNonGoalRewards: snapshot.biomeState.maxNonGoalRewards as number,
        }
      : {}),
    ...(progression.kind === 'hub'
      ? { numSubRoomsSpawned: 0, soulPylonsSpawned: 0, soulPylonsCompleted: 0 }
      : {}),
  });
}

function appendCompletedDecision(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  decision: CanonicalBiome['decisions'][number],
  current: CanonicalLifecycleRoom,
): CanonicalLifecycleRoom {
  if (decision.kind === 'hub') {
    if (current.kind !== 'authored') fail('Hub decision must follow an authored PreHub room');
    return appendHubDecision(writer, catalog, current, decision);
  }
  if (decision.parent.origin.kind === 'hubRoom') {
    if (current.kind !== 'hub') fail('completed-Hub batch must follow the Hub room');
    appendBatchState(writer, decision);
    appendGeneratedTargets(writer, current.origin, decision.targets);
  } else {
    requireParent(current, decision.parent.origin, 'normal-door batch');
    if (current.kind !== 'authored') fail('normal-door batch source must be authored');
    appendRoomWithBatch(writer, catalog, current, decision);
  }
  return selectedContinuation(decision).room;
}

function composeBiomeHistoryResult(
  catalog: Catalog,
  snapshot: CanonicalBiome,
  seed?: HistoryStateView,
  validateEncounterResolution = false,
  figLeafState?: FigLeafLifecycleState,
  pendingSpellDrop = false,
  allSpellInvested = false,
): EncounterValidatedBiomeHistory {
  let completionPredecessor: CanonicalAuthoredRoom | undefined;
  const options = {
    catalog,
    routeKey: snapshot.routeKey,
    biomeKey: snapshot.biomeKey,
    initialCounters: initialCounters(catalog, snapshot, seed),
    ...(seed === undefined ? {} : { seed }),
    ...(figLeafState === undefined ? {} : { figLeafState }),
    pendingSpellDrop,
    allSpellInvested,
    automaticRooms: snapshot.automaticRooms,
    transitionEffects:
      catalog.biomeLayouts.byKey[snapshot.biomeKey]?.completion.transitionEffects ?? [],
    composeEntry(writer: HistorySegmentWriter): CanonicalAuthoredRoom {
      appendStandaloneRoomCreated(writer, snapshot.entryRoom, 'biomeEntry');
      return snapshot.entryRoom;
    },
    composeBody(writer: HistorySegmentWriter, entry: CanonicalAuthoredRoom): CanonicalAuthoredRoom {
      let current: CanonicalLifecycleRoom = entry;
      for (let decisionIndex = 0; decisionIndex < snapshot.decisions.length; decisionIndex += 1) {
        const decision = snapshot.decisions[decisionIndex]!;
        if (decision.kind === 'hub') {
          if (current.kind !== 'authored') fail('Hub decision must follow an authored PreHub room');
          const candidateHandoff = snapshot.decisions[decisionIndex + 1];
          const handoff =
            candidateHandoff?.kind === 'batch' && candidateHandoff.parent.origin.kind === 'hubRoom'
              ? candidateHandoff
              : undefined;
          current = appendHubDecision(writer, catalog, current, decision, handoff);
          if (handoff !== undefined) decisionIndex += 1;
          if (
            handoff !== undefined &&
            selectedTarget(handoff).continuation === 'startsCompletion'
          ) {
            if (current.kind !== 'authored')
              fail('Hub Handoff selected a non-authored automatic room');
            completionPredecessor = current;
            break;
          }
          continue;
        }
        if (decision.parent.origin.kind === 'hubRoom') {
          if (current.kind !== 'hub') fail('completed-Hub batch must follow the Hub room');
          appendBatchState(writer, decision);
          appendGeneratedTargets(writer, current.origin, decision.targets);
        } else {
          requireParent(current, decision.parent.origin, 'normal-door batch');
          if (current.kind !== 'authored') fail('normal-door batch source must be authored');
          appendRoomWithBatch(writer, catalog, current, decision);
        }
        const selected = selectedBatchContinuation(decision);
        if (selected === undefined) {
          fail(`${semanticAddressKey(decision.origin)} has no selected continuation`);
        }
        current = selected.kind === 'normal' ? selected.target.room : selected.continuation.room;
        if (selected.kind === 'normal' && selected.target.continuation === 'startsCompletion') {
          completionPredecessor = selected.target.room;
          break;
        }
      }
      if (completionPredecessor === undefined)
        fail(`${snapshot.biomeKey} never selected a Preboss`);
      return completionPredecessor;
    },
    composeCompletionPredecessor(
      writer: HistorySegmentWriter,
      predecessor: CanonicalAuthoredRoom,
    ): CanonicalAuthoredRoom {
      appendEnteredPreboss(writer, catalog, predecessor);
      return predecessor;
    },
    fail,
  };
  return validateEncounterResolution
    ? composeBiomeHistoryEnvelopeWithEncounterValidation(options)
    : Object.freeze({ kind: 'complete' as const, history: composeBiomeHistoryEnvelope(options) });
}

export function composeBiomeHistory(
  catalog: Catalog,
  snapshot: CanonicalBiome,
  seed?: HistoryStateView,
): CanonicalBiomeHistory {
  const result = composeBiomeHistoryResult(catalog, snapshot, seed);
  if (result.kind !== 'complete') {
    throw new Error('ordinary biome composition unexpectedly encountered encounter validation');
  }
  return result.history;
}

export function composeBiomeHistoryWithEncounterValidation(
  catalog: Catalog,
  snapshot: CanonicalBiome,
  seed?: HistoryStateView,
  figLeafState?: FigLeafLifecycleState,
  pendingSpellDrop = false,
  allSpellInvested = false,
): EncounterValidatedBiomeHistory {
  return composeBiomeHistoryResult(
    catalog,
    snapshot,
    seed,
    true,
    figLeafState,
    pendingSpellDrop,
    allSpellInvested,
  );
}

function composeBiomeHistoryPrefixResult(
  catalog: Catalog,
  snapshot: MaterializedBiomePrefix,
  seed?: HistoryStateView,
  validateEncounterResolution = false,
  figLeafState?: FigLeafLifecycleState,
  pendingSpellDrop = false,
  allSpellInvested = false,
): EncounterValidatedPrefixHistory | null {
  const entry = snapshot.entryRoom;
  if (entry === undefined) return null;
  const options = {
    routeKey: snapshot.routeKey,
    biomeKey: snapshot.biomeKey,
    initialCounters: initialCounters(catalog, snapshot, seed),
    ...(seed === undefined ? {} : { seed }),
    ...(figLeafState === undefined ? {} : { figLeafState }),
    pendingSpellDrop,
    allSpellInvested,
    compose(writer: HistorySegmentWriter): void {
      appendStandaloneRoomCreated(writer, entry, 'biomeEntry');
      let current: CanonicalLifecycleRoom = entry;
      for (let decisionIndex = 0; decisionIndex < snapshot.decisions.length; decisionIndex += 1) {
        const decision = snapshot.decisions[decisionIndex]!;
        if (decision.kind === 'hub') {
          if (current.kind !== 'authored') fail('Hub decision must follow an authored PreHub room');
          const candidateHandoff = snapshot.decisions[decisionIndex + 1];
          const handoff =
            candidateHandoff?.kind === 'batch' && candidateHandoff.parent.origin.kind === 'hubRoom'
              ? candidateHandoff
              : undefined;
          current = appendHubDecision(writer, catalog, current, decision, handoff);
          if (handoff !== undefined) decisionIndex += 1;
          continue;
        }
        current = appendCompletedDecision(writer, catalog, decision, current);
      }
      const frontier = snapshot.frontier;
      if (frontier === undefined && snapshot.automaticRooms !== undefined) {
        if (current.kind !== 'authored') {
          fail('completion tail does not follow an authored Preboss room');
        }
        appendCanonicalRoomLifecycle(writer, catalog, current, fail);
        appendAutomaticTail(
          writer,
          catalog,
          createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
          current,
          snapshot.automaticRooms,
          fail,
        );
        return;
      }
      if (frontier?.kind === 'exitDecision') {
        if (current.kind === 'hub') {
          if (frontier.targets.length > 0) {
            fail('completed-Hub frontier targets must be materialized with the Hub handoff');
          }
          // appendHubDecision has already replayed the completed board and all
          // visits. With no authored Handoff batch, the next decision is an
          // available Hub-owned source frontier, not another room lifecycle.
          return;
        }
        if (current.kind !== 'authored') {
          fail('ordinary decision frontier does not follow an authored room');
        }
        if (frontier.targets.length === 0) {
          if (frontier.hubContinuation !== undefined) {
            // The materializer has already established one of N's two closed
            // bounded-Hub empty envelopes. It is not an ordinary missing
            // decision: complete this source lifecycle through commit/exit so
            // its declaration-owned depth checkpoint is available to the
            // entry or terminal candidate. The empty projection preserves the
            // normal outgoing-generation closure without inventing a target.
            appendClockworkAwareRoomLifecycle(writer, catalog, current, {
              afterEvent(afterWriter, event) {
                if (event.kind === 'roomEntered') {
                  appendAdditionalContinuations(afterWriter, current, frontier.additional);
                }
              },
              outgoing(outgoingWriter) {
                outgoingWriter.append({
                  kind: 'emptyOutgoingGenerationCompleted',
                  origin: current.origin,
                });
              },
            });
          } else {
            appendClockworkAwareRoomLifecycle(writer, catalog, current, {
              afterEvent(afterWriter, event) {
                if (event.kind === 'roomEntered') {
                  appendAdditionalContinuations(afterWriter, current, frontier.additional);
                }
              },
              stopAfterOutgoing: true,
              ...postOutgoingAcquisitionOption(catalog, current),
            });
          }
        } else {
          appendClockworkAwareRoomLifecycle(writer, catalog, current, {
            afterEvent(afterWriter, event) {
              if (event.kind === 'roomEntered') {
                appendAdditionalContinuations(afterWriter, current, frontier.additional);
              }
            },
            outgoing(outgoingWriter) {
              if (frontier.batchState !== undefined) {
                appendBatchState(outgoingWriter, {
                  origin: frontier.origin,
                  batchState: frontier.batchState,
                });
              }
              appendGeneratedTargets(outgoingWriter, current.origin, frontier.targets);
            },
            stopAfterOutgoing: true,
            ...postOutgoingAcquisitionOption(catalog, current),
          });
        }
      } else if (snapshot.frontier?.kind === 'hubBoard') {
        const retainedHub = snapshot.decisions.some((decision) => decision.kind === 'hub');
        if (!retainedHub) {
          if (current.kind !== 'authored')
            fail('Hub board frontier does not follow the PreHub room');
          appendCanonicalRoomLifecycle(writer, catalog, current, fail, { stopAfterOutgoing: true });
        } else if (current.kind !== 'hub') {
          fail('retained Hub board did not restore the Hub lifecycle');
        }
      } else if (snapshot.frontier?.kind === 'hubVisit' && 'phase' in snapshot.frontier) {
        if (current.kind !== 'hub') fail('Hub visit frontier does not follow the persistent Hub');
        appendHubVisitFrontier(writer, catalog, snapshot.frontier);
      }
    },
  };
  return validateEncounterResolution
    ? composeValidatedPrefixHistoryEnvelope(options)
    : Object.freeze({ kind: 'complete' as const, history: composePrefixHistoryEnvelope(options) });
}

export function composeBiomeHistoryPrefix(
  catalog: Catalog,
  snapshot: MaterializedBiomePrefix,
  seed?: HistoryStateView,
): BiomeHistoryPrefix | null {
  const result = composeBiomeHistoryPrefixResult(catalog, snapshot, seed);
  if (result === null) return null;
  if (result.kind !== 'complete') {
    throw new Error('ordinary prefix composition unexpectedly encountered encounter validation');
  }
  return result.history;
}

export function composeBiomeHistoryPrefixWithEncounterValidation(
  catalog: Catalog,
  snapshot: MaterializedBiomePrefix,
  seed?: HistoryStateView,
  figLeafState?: FigLeafLifecycleState,
  pendingSpellDrop = false,
  allSpellInvested = false,
): EncounterValidatedPrefixHistory | null {
  return composeBiomeHistoryPrefixResult(
    catalog,
    snapshot,
    seed,
    true,
    figLeafState,
    pendingSpellDrop,
    allSpellInvested,
  );
}
