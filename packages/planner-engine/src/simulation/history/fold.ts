import type { BiomeTransitionCounterAxis } from '../../catalog-schema';
import { semanticAddressKey } from '../../authored-project/addresses';
import type {
  CanonicalBiomeHistory,
  EncounterHistoryEntry,
  EnteredRewardStoreHistoryEntry,
  HistoryCounters,
  HistoryEvent,
  HistoryLedgers,
  OfferPointView,
  AcquisitionPointView,
  BiomeHistoryPrefix,
  ProgressiveRoomHistoryViews,
  HistoryStateView,
  RoomHistoryViews,
  TargetGenerationView,
  RequiredObjectHistoryEntry,
  RoomAppearanceHistoryEntry,
  RoomCreatedHistoryEvent,
  RoomRestoreHistoryEntry,
} from './model';

interface MutableLedgers {
  roomCreations: RoomCreatedHistoryEvent[];
  roomAppearances: RoomAppearanceHistoryEntry[];
  encounterRecords: EncounterHistoryEntry[];
  encounterStarts: EncounterHistoryEntry[];
  encounterCompletions: EncounterHistoryEntry[];
  enteredRewardStores: EnteredRewardStoreHistoryEntry[];
  requiredObjectSpawns: RequiredObjectHistoryEntry[];
  requiredObjectCompletions: RequiredObjectHistoryEntry[];
  roomRestores: RoomRestoreHistoryEntry[];
  counters: {
    biomeDepthCache: number;
    biomeEncounterDepth: number;
    routeEncounterDepth: number;
    roomHistoryOrdinal: number;
    fieldsMaxDoorsRolled?: number;
    clockworkGoalsRemaining?: number;
    clockworkNonGoalRewardsAcquired?: number;
    clockworkMaxNonGoalRewards?: number;
    numSubRoomsSpawned?: number;
    soulPylonsSpawned?: number;
    soulPylonsCompleted?: number;
  };
}

interface MutableRoomViews {
  readonly origin: RoomHistoryViews['origin'];
  preparation?: HistoryStateView;
  entry?: HistoryStateView;
  preOutgoing?: HistoryStateView;
  readonly offerPoints: OfferPointView[];
  readonly acquisitionPoints: AcquisitionPointView[];
  readonly targetGenerations: TargetGenerationView[];
  outgoingGeneration?: HistoryStateView;
  postCommit?: HistoryStateView;
  exit?: HistoryStateView;
}

interface PendingTargetGeneration {
  readonly creation: Extract<
    RoomCreatedHistoryEvent,
    {
      readonly source: 'generatedTarget' | 'hubDecision' | 'hubTarget' | 'localVisit';
    }
  >;
  readonly before: HistoryStateView;
}

export class HistoryFoldContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HistoryFoldContractError';
  }
}

function frozenCounters(counters: MutableLedgers['counters']): HistoryCounters {
  return Object.freeze({ ...counters });
}

function frozenLedgers(ledgers: MutableLedgers): HistoryLedgers {
  return Object.freeze({
    roomCreations: Object.freeze([...ledgers.roomCreations]),
    roomAppearances: Object.freeze([...ledgers.roomAppearances]),
    encounterRecords: Object.freeze([...ledgers.encounterRecords]),
    encounterStarts: Object.freeze([...ledgers.encounterStarts]),
    encounterCompletions: Object.freeze([...ledgers.encounterCompletions]),
    enteredRewardStores: Object.freeze([...ledgers.enteredRewardStores]),
    requiredObjectSpawns: Object.freeze([...ledgers.requiredObjectSpawns]),
    requiredObjectCompletions: Object.freeze([...ledgers.requiredObjectCompletions]),
    roomRestores: Object.freeze([...ledgers.roomRestores]),
    counters: frozenCounters(ledgers.counters),
  });
}

function stateView(sequence: number, ledgers: MutableLedgers): HistoryStateView {
  return Object.freeze({ sequence, ledgers: frozenLedgers(ledgers) });
}

function roomName(
  namesByOrigin: ReadonlyMap<string, string>,
  event: Extract<
    HistoryEvent,
    | { readonly kind: 'encounterCompleted' }
    | { readonly kind: 'encounterRecorded' }
    | { readonly kind: 'encounterStarted' }
    | { readonly kind: 'enteredRewardStoreRecorded' }
    | { readonly kind: 'offerPointAcquired' }
    | { readonly kind: 'requiredObjectCompleted' }
    | { readonly kind: 'requiredObjectSpawned' }
    | { readonly kind: 'roomEntered' }
    | { readonly kind: 'roomRestored' }
  >,
): string {
  const gameName = namesByOrigin.get(semanticAddressKey(event.origin));
  if (gameName === undefined) {
    throw new HistoryFoldContractError(
      `${event.kind} references uncreated room ${semanticAddressKey(event.origin)}`,
    );
  }
  return gameName;
}

function requireRoomViews(
  viewsByOrigin: ReadonlyMap<string, MutableRoomViews>,
  event: Extract<HistoryEvent, { readonly origin: RoomHistoryViews['origin'] }>,
): MutableRoomViews {
  const views = viewsByOrigin.get(semanticAddressKey(event.origin));
  if (views === undefined) {
    throw new HistoryFoldContractError(
      `${event.kind} references unprepared room ${semanticAddressKey(event.origin)}`,
    );
  }
  return views;
}

function encounterEntry(
  event: Extract<HistoryEvent, { readonly kind: 'encounterRecorded' | 'encounterStarted' }>,
  namesByOrigin: ReadonlyMap<string, string>,
): EncounterHistoryEntry {
  return Object.freeze({
    sequence: event.sequence,
    origin: event.origin,
    gameName: roomName(namesByOrigin, event),
    encounterEnvelopeKey: event.encounterEnvelopeKey,
    slotKey: event.phaseKey,
    encounterKey: event.encounterKey,
    phaseKind: event.phaseKind,
  });
}

function encounterKey(event: {
  readonly origin: RoomHistoryViews['origin'];
  readonly phaseKey: string;
}) {
  return JSON.stringify([semanticAddressKey(event.origin), event.phaseKey]);
}

function requireEncounterEnvelope(
  envelopesByOrigin: ReadonlyMap<string, string>,
  event: Extract<HistoryEvent, { readonly kind: 'encounterRecorded' | 'encounterStarted' }>,
): void {
  const ownerEnvelope = envelopesByOrigin.get(semanticAddressKey(event.origin));
  if (ownerEnvelope === undefined || ownerEnvelope !== event.encounterEnvelopeKey) {
    throw new HistoryFoldContractError(
      `${event.phaseKey} does not match its room encounter envelope`,
    );
  }
}

function requiredObjectKey(event: {
  readonly origin: RoomHistoryViews['origin'];
  readonly objectKey: string;
}) {
  return JSON.stringify([semanticAddressKey(event.origin), event.objectKey]);
}

function freezeProgressiveRoomViews(views: MutableRoomViews): ProgressiveRoomHistoryViews {
  if (views.preparation === undefined || views.entry === undefined) {
    throw new HistoryFoldContractError(
      `room ${semanticAddressKey(views.origin)} has an incomplete lifecycle view set`,
    );
  }
  if (views.preOutgoing === undefined && views.targetGenerations.length !== 0) {
    throw new HistoryFoldContractError(
      `room ${semanticAddressKey(views.origin)} has an incomplete outgoing-generation view set`,
    );
  }
  return Object.freeze({
    origin: views.origin,
    preparation: views.preparation,
    entry: views.entry,
    ...(views.offerPoints.length === 0
      ? {}
      : { offerPoints: Object.freeze([...views.offerPoints]) }),
    ...(views.acquisitionPoints.length === 0
      ? {}
      : { acquisitionPoints: Object.freeze([...views.acquisitionPoints]) }),
    ...(views.preOutgoing === undefined ? {} : { preOutgoing: views.preOutgoing }),
    targetGenerations: Object.freeze([...views.targetGenerations]),
    ...(views.outgoingGeneration === undefined
      ? {}
      : { outgoingGeneration: views.outgoingGeneration }),
    ...(views.postCommit === undefined ? {} : { postCommit: views.postCommit }),
    ...(views.exit === undefined ? {} : { exit: views.exit }),
  });
}

function freezeRoomViews(views: MutableRoomViews): RoomHistoryViews {
  const progressive = freezeProgressiveRoomViews(views);
  if (progressive.postCommit === undefined || progressive.exit === undefined) {
    throw new HistoryFoldContractError(
      `room ${semanticAddressKey(views.origin)} has an incomplete lifecycle view set`,
    );
  }
  if ((progressive.preOutgoing === undefined) !== (progressive.outgoingGeneration === undefined)) {
    throw new HistoryFoldContractError(
      `room ${semanticAddressKey(views.origin)} has an incomplete outgoing-generation view set`,
    );
  }
  return progressive as RoomHistoryViews;
}

function foldHistoryEventStream(
  events: readonly HistoryEvent[],
  seed?: HistoryStateView,
  mode: 'complete' | 'prefix' = 'complete',
): CanonicalBiomeHistory | BiomeHistoryPrefix {
  const immutableEvents = Object.freeze(
    events.map((event) =>
      event.kind === 'biomeStarted'
        ? Object.freeze({ ...event, counters: Object.freeze({ ...event.counters }) })
        : Object.freeze({ ...event }),
    ),
  );
  const ledgers: MutableLedgers = {
    roomCreations: [...(seed?.ledgers.roomCreations ?? [])],
    roomAppearances: [...(seed?.ledgers.roomAppearances ?? [])],
    encounterRecords: [...(seed?.ledgers.encounterRecords ?? [])],
    encounterStarts: [...(seed?.ledgers.encounterStarts ?? [])],
    encounterCompletions: [...(seed?.ledgers.encounterCompletions ?? [])],
    enteredRewardStores: [...(seed?.ledgers.enteredRewardStores ?? [])],
    requiredObjectSpawns: [...(seed?.ledgers.requiredObjectSpawns ?? [])],
    requiredObjectCompletions: [...(seed?.ledgers.requiredObjectCompletions ?? [])],
    roomRestores: [...(seed?.ledgers.roomRestores ?? [])],
    counters: {
      ...(seed?.ledgers.counters ?? {
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        routeEncounterDepth: 0,
        roomHistoryOrdinal: 0,
      }),
    },
  };
  const namesByOrigin = new Map<string, string>();
  const encounterEnvelopesByOrigin = new Map<string, string>();
  const recordedEncounters = new Map<string, EncounterHistoryEntry>();
  const activeEncounters = new Map<string, EncounterHistoryEntry>();
  const advancedEncounterDepths = new Set<string>();
  const activeRequiredObjects = new Set<string>();
  const viewsByOrigin = new Map<string, MutableRoomViews>();
  const orderedViews: MutableRoomViews[] = [];
  let pendingTargetGeneration: PendingTargetGeneration | undefined;
  let biomeStarted = false;
  let biomeCompletion: HistoryStateView | undefined;
  let biomeCompletionOrigin:
    Extract<HistoryEvent, { readonly kind: 'biomeCompleted' }>['origin'] | undefined;
  let biomeStartOrigin:
    Extract<HistoryEvent, { readonly kind: 'biomeStarted' }>['origin'] | undefined;
  const resetAxes: BiomeTransitionCounterAxis[] = [];
  const fieldsBatchOrigins = new Set<string>();
  const clockworkBatchOrigins = new Set<string>();

  for (const [index, event] of immutableEvents.entries()) {
    const expectedSequence = (seed?.sequence ?? 0) + index + 1;
    if (event.sequence !== expectedSequence) {
      throw new HistoryFoldContractError(
        `event ${index} has sequence ${event.sequence}; expected ${expectedSequence}`,
      );
    }
    switch (event.kind) {
      case 'biomeStarted':
        if (index !== 0 || biomeStarted) {
          throw new HistoryFoldContractError('history has an invalid biome start event');
        }
        Object.assign(ledgers.counters, event.counters);
        if (event.counters.fieldsMaxDoorsRolled === undefined) {
          delete ledgers.counters.fieldsMaxDoorsRolled;
        }
        if (event.counters.clockworkGoalsRemaining === undefined) {
          delete ledgers.counters.clockworkGoalsRemaining;
          delete ledgers.counters.clockworkNonGoalRewardsAcquired;
          delete ledgers.counters.clockworkMaxNonGoalRewards;
        }
        if (event.counters.numSubRoomsSpawned === undefined) {
          delete ledgers.counters.numSubRoomsSpawned;
          delete ledgers.counters.soulPylonsSpawned;
          delete ledgers.counters.soulPylonsCompleted;
        }
        biomeStarted = true;
        biomeStartOrigin = event.origin;
        break;
      case 'roomCreated': {
        if (!biomeStarted) {
          throw new HistoryFoldContractError('room creation precedes biome start');
        }
        const before = stateView(event.sequence - 1, ledgers);
        const key = semanticAddressKey(event.origin);
        if (namesByOrigin.has(key)) {
          throw new HistoryFoldContractError(`room ${key} was created more than once`);
        }
        namesByOrigin.set(key, event.gameName);
        encounterEnvelopesByOrigin.set(key, event.encounterEnvelopeKey);
        ledgers.roomCreations.push(event);
        if (event.source === 'additionalExit') {
          const parentViews = viewsByOrigin.get(semanticAddressKey(event.parentOrigin));
          if (parentViews?.entry === undefined) {
            throw new HistoryFoldContractError(
              `additional exit ${semanticAddressKey(event.additionalOrigin)} was created before its entered parent`,
            );
          }
        }
        if (event.source === 'localVisit') {
          if (ledgers.counters.numSubRoomsSpawned === undefined) {
            throw new HistoryFoldContractError(
              'local visit generation appeared outside a Hub biome',
            );
          }
          ledgers.counters.numSubRoomsSpawned += 1;
        }
        if (
          event.source === 'generatedTarget' ||
          event.source === 'hubTarget' ||
          event.source === 'hubDecision' ||
          event.source === 'localVisit'
        ) {
          if (pendingTargetGeneration !== undefined) {
            throw new HistoryFoldContractError('target generations cannot overlap');
          }
          if (
            !Number.isInteger(event.generationIndex) ||
            event.generationIndex <= 0 ||
            !Number.isInteger(event.generationCount) ||
            event.generationCount <= 0 ||
            event.generationIndex > event.generationCount
          ) {
            throw new HistoryFoldContractError(
              `target ${semanticAddressKey(event.targetOrigin)} has invalid generation position`,
            );
          }
          const parentViews = viewsByOrigin.get(semanticAddressKey(event.parentOrigin));
          if (parentViews === undefined) {
            throw new HistoryFoldContractError(
              `generated target ${semanticAddressKey(event.targetOrigin)} has no active parent`,
            );
          }
          if (
            parentViews.preOutgoing === undefined ||
            event.generationIndex !== parentViews.targetGenerations.length + 1
          ) {
            throw new HistoryFoldContractError(
              `target ${semanticAddressKey(event.targetOrigin)} is out of physical generation order`,
            );
          }
          pendingTargetGeneration = { creation: event, before };
        }
        break;
      }
      case 'targetGenerationCompleted': {
        const pending = pendingTargetGeneration;
        if (
          pending === undefined ||
          semanticAddressKey(pending.creation.targetOrigin) !== semanticAddressKey(event.origin) ||
          semanticAddressKey(pending.creation.origin) !== semanticAddressKey(event.roomOrigin) ||
          semanticAddressKey(pending.creation.parentOrigin) !==
            semanticAddressKey(event.parentOrigin) ||
          pending.creation.generationIndex !== event.generationIndex ||
          pending.creation.generationCount !== event.generationCount
        ) {
          throw new HistoryFoldContractError(
            `target ${semanticAddressKey(event.origin)} has no matching generation start`,
          );
        }
        const parentViews = viewsByOrigin.get(semanticAddressKey(event.parentOrigin));
        if (parentViews === undefined) {
          throw new HistoryFoldContractError(
            `target ${semanticAddressKey(event.origin)} lost its generation parent`,
          );
        }
        const after = stateView(event.sequence, ledgers);
        parentViews.targetGenerations.push(
          Object.freeze({
            targetOrigin: event.origin,
            roomOrigin: event.roomOrigin,
            roomCreationSequence: pending.creation.sequence,
            before: pending.before,
            after,
          }),
        );
        if (event.generationIndex === event.generationCount) {
          parentViews.outgoingGeneration = after;
        }
        pendingTargetGeneration = undefined;
        break;
      }
      case 'emptyOutgoingGenerationCompleted': {
        const views = requireRoomViews(viewsByOrigin, event);
        if (
          views.preOutgoing === undefined ||
          views.outgoingGeneration !== undefined ||
          views.targetGenerations.length !== 0
        ) {
          throw new HistoryFoldContractError(
            `room ${semanticAddressKey(event.origin)} cannot complete empty generation`,
          );
        }
        views.outgoingGeneration = stateView(event.sequence, ledgers);
        break;
      }
      case 'roomPrepared': {
        const key = semanticAddressKey(event.origin);
        if (!namesByOrigin.has(key) || viewsByOrigin.has(key)) {
          throw new HistoryFoldContractError(`room ${key} cannot begin preparation`);
        }
        const views: MutableRoomViews = {
          origin: event.origin,
          preparation: stateView(event.sequence, ledgers),
          offerPoints: [],
          acquisitionPoints: [],
          targetGenerations: [],
        };
        viewsByOrigin.set(key, views);
        orderedViews.push(views);
        break;
      }
      case 'roomEntered': {
        const entry = Object.freeze({
          sequence: event.sequence,
          origin: event.origin,
          gameName: roomName(namesByOrigin, event),
        });
        ledgers.roomAppearances.push(entry);
        requireRoomViews(viewsByOrigin, event).entry = stateView(event.sequence, ledgers);
        break;
      }
      case 'requiredObjectSpawned': {
        const key = requiredObjectKey(event);
        if (
          requireRoomViews(viewsByOrigin, event).entry === undefined ||
          activeRequiredObjects.has(key) ||
          ledgers.counters.soulPylonsSpawned === undefined
        ) {
          throw new HistoryFoldContractError(
            `${event.objectKey} has an invalid required-object spawn`,
          );
        }
        activeRequiredObjects.add(key);
        ledgers.requiredObjectSpawns.push(
          Object.freeze({
            sequence: event.sequence,
            origin: event.origin,
            gameName: roomName(namesByOrigin, event),
            objectKey: event.objectKey,
          }),
        );
        ledgers.counters.soulPylonsSpawned += 1;
        break;
      }
      case 'encounterRecorded': {
        const views = requireRoomViews(viewsByOrigin, event);
        if (views.preparation === undefined || views.entry !== undefined) {
          throw new HistoryFoldContractError(
            `${event.phaseKey} was recorded outside its room preparation checkpoint`,
          );
        }
        const entry = encounterEntry(event, namesByOrigin);
        requireEncounterEnvelope(encounterEnvelopesByOrigin, event);
        const key = encounterKey(event);
        if (recordedEncounters.has(key)) {
          throw new HistoryFoldContractError(`${event.phaseKey} was recorded more than once`);
        }
        recordedEncounters.set(key, entry);
        ledgers.encounterRecords.push(entry);
        break;
      }
      case 'encounterStarted': {
        const views = requireRoomViews(viewsByOrigin, event);
        if (views.entry === undefined || views.exit !== undefined) {
          throw new HistoryFoldContractError(
            `${event.phaseKey} started outside its room entry checkpoint`,
          );
        }
        const entry = encounterEntry(event, namesByOrigin);
        requireEncounterEnvelope(encounterEnvelopesByOrigin, event);
        const key = encounterKey(event);
        const recorded = recordedEncounters.get(key);
        if (
          recorded === undefined ||
          recorded.encounterEnvelopeKey !== entry.encounterEnvelopeKey ||
          recorded.encounterKey !== entry.encounterKey ||
          recorded.phaseKind !== entry.phaseKind
        ) {
          throw new HistoryFoldContractError(
            `${event.phaseKey} started without its matching preparation record`,
          );
        }
        if (activeEncounters.has(key)) {
          throw new HistoryFoldContractError(`${event.phaseKey} started more than once`);
        }
        activeEncounters.set(key, entry);
        ledgers.encounterStarts.push(entry);
        break;
      }
      case 'fieldsBatchOutcomeRecorded':
        if (
          ledgers.counters.fieldsMaxDoorsRolled === undefined ||
          biomeStartOrigin === undefined ||
          event.origin.routeKey !== biomeStartOrigin.routeKey ||
          event.origin.biomeKey !== biomeStartOrigin.biomeKey
        ) {
          throw new HistoryFoldContractError(
            'Fields batch outcome appeared outside a Fields biome',
          );
        }
        if (
          !Number.isInteger(event.batchCapacity) ||
          !Number.isInteger(event.cageTargetCount) ||
          !Number.isInteger(event.doorCageRewardCount) ||
          event.batchCapacity <= 0 ||
          event.cageTargetCount < 0 ||
          event.doorCageRewardCount <= 0 ||
          event.doorCageRewardCount > event.batchCapacity
        ) {
          throw new HistoryFoldContractError('Fields batch outcome has invalid cage counts');
        }
        if (fieldsBatchOrigins.has(semanticAddressKey(event.origin))) {
          throw new HistoryFoldContractError(
            `Fields batch ${semanticAddressKey(event.origin)} was recorded more than once`,
          );
        }
        fieldsBatchOrigins.add(semanticAddressKey(event.origin));
        if (event.cageOutcome === 'max') {
          ledgers.counters.fieldsMaxDoorsRolled += 1;
        }
        break;
      case 'clockworkBatchStateRecorded':
        if (
          biomeStartOrigin === undefined ||
          event.origin.routeKey !== biomeStartOrigin.routeKey ||
          event.origin.biomeKey !== biomeStartOrigin.biomeKey ||
          clockworkBatchOrigins.has(semanticAddressKey(event.origin)) ||
          ledgers.counters.clockworkGoalsRemaining !== event.goalsRemaining ||
          ledgers.counters.clockworkNonGoalRewardsAcquired !== event.nonGoalRewardsAcquired ||
          ledgers.counters.clockworkMaxNonGoalRewards !== event.maxNonGoalRewards
        ) {
          throw new HistoryFoldContractError(
            `Clockwork batch ${semanticAddressKey(event.origin)} does not match pre-generation history`,
          );
        }
        clockworkBatchOrigins.add(semanticAddressKey(event.origin));
        break;
      case 'clockworkGoalAcquired':
        if (
          event.origin.kind !== 'occurrence' ||
          biomeStartOrigin === undefined ||
          event.origin.routeKey !== biomeStartOrigin.routeKey ||
          event.origin.biomeKey !== biomeStartOrigin.biomeKey ||
          requireRoomViews(viewsByOrigin, event).entry === undefined ||
          ledgers.counters.clockworkGoalsRemaining === undefined
        ) {
          throw new HistoryFoldContractError('Clockwork Goal appeared outside biome I');
        }
        ledgers.counters.clockworkGoalsRemaining = Math.max(
          0,
          ledgers.counters.clockworkGoalsRemaining - 1,
        );
        break;
      case 'clockworkNonGoalRewardSpawned':
        if (
          event.origin.kind !== 'occurrence' ||
          biomeStartOrigin === undefined ||
          event.origin.routeKey !== biomeStartOrigin.routeKey ||
          event.origin.biomeKey !== biomeStartOrigin.biomeKey ||
          requireRoomViews(viewsByOrigin, event).entry === undefined ||
          ledgers.counters.clockworkNonGoalRewardsAcquired === undefined
        ) {
          throw new HistoryFoldContractError('Clockwork reward appeared outside biome I');
        }
        ledgers.counters.clockworkNonGoalRewardsAcquired += 1;
        break;
      case 'encounterDepthAdvanced': {
        const key = encounterKey(event);
        if (activeEncounters.get(key) === undefined || advancedEncounterDepths.has(key)) {
          throw new HistoryFoldContractError(
            `${event.phaseKey} advanced encounter depth without one active matching encounter`,
          );
        }
        advancedEncounterDepths.add(key);
        ledgers.counters.biomeEncounterDepth += event.biomeEncounterDepthDelta;
        ledgers.counters.routeEncounterDepth += event.routeEncounterDepthDelta;
        break;
      }
      case 'encounterCompleted': {
        const key = encounterKey(event);
        const started = activeEncounters.get(key);
        if (started === undefined) {
          throw new HistoryFoldContractError(
            `${event.phaseKey} completed without a matching encounter start`,
          );
        }
        activeEncounters.delete(key);
        ledgers.encounterCompletions.push(Object.freeze({ ...started, sequence: event.sequence }));
        break;
      }
      case 'requiredObjectCompleted': {
        const key = requiredObjectKey(event);
        if (
          !activeRequiredObjects.delete(key) ||
          ledgers.counters.soulPylonsCompleted === undefined
        ) {
          throw new HistoryFoldContractError(
            `${event.objectKey} completed without a matching spawn`,
          );
        }
        ledgers.requiredObjectCompletions.push(
          Object.freeze({
            sequence: event.sequence,
            origin: event.origin,
            gameName: roomName(namesByOrigin, event),
            objectKey: event.objectKey,
          }),
        );
        ledgers.counters.soulPylonsCompleted += 1;
        break;
      }
      case 'outgoingGenerationCheckpoint':
        requireRoomViews(viewsByOrigin, event).preOutgoing = stateView(event.sequence - 1, ledgers);
        break;
      case 'roomCountersAdvanced':
        ledgers.counters.biomeDepthCache += event.biomeDepthCacheDelta;
        ledgers.counters.roomHistoryOrdinal += event.roomHistoryOrdinalDelta;
        break;
      case 'enteredRewardStoreRecorded': {
        const entry: EnteredRewardStoreHistoryEntry = Object.freeze({
          sequence: event.sequence,
          origin: event.origin,
          gameName: roomName(namesByOrigin, event),
          storeKey: event.storeKey,
        });
        ledgers.enteredRewardStores.push(entry);
        break;
      }
      case 'roomExited': {
        const views = requireRoomViews(viewsByOrigin, event);
        views.postCommit = stateView(event.sequence - 1, ledgers);
        views.exit = stateView(event.sequence, ledgers);
        break;
      }
      case 'roomRestored': {
        const gameName = roomName(namesByOrigin, event);
        ledgers.roomAppearances.push(
          Object.freeze({ sequence: event.sequence, origin: event.origin, gameName }),
        );
        ledgers.roomRestores.push(
          Object.freeze({
            sequence: event.sequence,
            origin: event.origin,
            gameName,
            after: event.after,
            restoreKind: event.restoreKind,
          }),
        );
        ledgers.counters.biomeDepthCache += event.biomeDepthCacheDelta;
        ledgers.counters.roomHistoryOrdinal += event.roomHistoryOrdinalDelta;
        break;
      }
      case 'biomeCompleted':
        if (
          biomeCompletion !== undefined ||
          biomeStartOrigin === undefined ||
          semanticAddressKey(event.origin) !== semanticAddressKey(biomeStartOrigin)
        ) {
          throw new HistoryFoldContractError('history has an invalid biome completion event');
        }
        biomeCompletion = stateView(event.sequence, ledgers);
        biomeCompletionOrigin = event.origin;
        break;
      case 'biomeCounterReset': {
        const expectedAxis = (
          [
            'biomeDepthCache',
            'biomeEncounterDepth',
          ] as const satisfies readonly BiomeTransitionCounterAxis[]
        )[resetAxes.length];
        if (
          biomeCompletionOrigin === undefined ||
          semanticAddressKey(event.origin) !== semanticAddressKey(biomeCompletionOrigin) ||
          event.axis !== expectedAxis
        ) {
          throw new HistoryFoldContractError(`unexpected biome counter reset ${event.axis}`);
        }
        resetAxes.push(event.axis);
        ledgers.counters[event.axis] = event.value;
        break;
      }
      case 'offerPointMaterialized': {
        const views = requireRoomViews(viewsByOrigin, event);
        if (views.offerPoints.some((candidate) => candidate.offerPoint === event.offerPoint)) {
          throw new HistoryFoldContractError(
            `${event.offerPoint} materialized more than once in one room`,
          );
        }
        views.offerPoints.push(
          Object.freeze({
            offerPoint: event.offerPoint,
            before: stateView(event.sequence - 1, ledgers),
            after: stateView(event.sequence, ledgers),
          }),
        );
        break;
      }
      case 'offerPointAcquired': {
        const views = requireRoomViews(viewsByOrigin, event);
        const index = views.offerPoints.findIndex(
          (candidate) => candidate.offerPoint === event.offerPoint,
        );
        const offerPoint = views.offerPoints[index];
        if (offerPoint === undefined || offerPoint.acquisitionBefore !== undefined) {
          throw new HistoryFoldContractError(
            `${event.offerPoint} has no unique materialized acquisition point`,
          );
        }
        views.offerPoints[index] = Object.freeze({
          ...offerPoint,
          acquisitionBefore: stateView(event.sequence - 1, ledgers),
          acquisitionAfter: stateView(event.sequence, ledgers),
        });
        if (event.enteredRewardStoreKey !== undefined) {
          ledgers.enteredRewardStores.push(
            Object.freeze({
              sequence: event.sequence,
              origin: event.origin,
              gameName: roomName(namesByOrigin, event),
              storeKey: event.enteredRewardStoreKey,
            }),
          );
          views.offerPoints[index] = Object.freeze({
            ...views.offerPoints[index],
            acquisitionAfter: stateView(event.sequence, ledgers),
          });
        }
        break;
      }
      case 'acquisitionPointReached': {
        const views = requireRoomViews(viewsByOrigin, event);
        if (views.acquisitionPoints.some((candidate) => candidate.point === event.point)) {
          throw new HistoryFoldContractError(`${event.point} reached more than once in one room`);
        }
        views.acquisitionPoints.push(
          Object.freeze({
            point: event.point,
            before: stateView(event.sequence - 1, ledgers),
            after: stateView(event.sequence, ledgers),
          }),
        );
        break;
      }
      case 'producerRoleAdvanced':
      case 'producerPointReached':
      case 'roomCommitted':
        break;
    }
  }

  if (!biomeStarted) {
    throw new HistoryFoldContractError('history has no biome start event');
  }
  if (activeEncounters.size !== 0) {
    throw new HistoryFoldContractError('history ended with an active encounter');
  }
  if (activeRequiredObjects.size !== 0) {
    throw new HistoryFoldContractError('history ended with an active required object');
  }
  if (pendingTargetGeneration !== undefined) {
    throw new HistoryFoldContractError('history ended during target generation');
  }
  if (mode === 'prefix') {
    if (
      biomeCompletion !== undefined ||
      biomeCompletionOrigin !== undefined ||
      resetAxes.length !== 0 ||
      biomeStartOrigin === undefined
    ) {
      throw new HistoryFoldContractError('prefix history contains biome completion facts');
    }
    const preparedUnentered = orderedViews.filter((views) => views.entry === undefined);
    if (preparedUnentered.length > 1) {
      throw new HistoryFoldContractError(
        'prefix history has more than one unentered prepared room',
      );
    }
    const blockedRoom = preparedUnentered[0];
    if (
      blockedRoom !== undefined &&
      (orderedViews.at(-1) !== blockedRoom ||
        blockedRoom.offerPoints.length !== 0 ||
        blockedRoom.preOutgoing !== undefined ||
        blockedRoom.targetGenerations.length !== 0 ||
        blockedRoom.outgoingGeneration !== undefined ||
        blockedRoom.postCommit !== undefined ||
        blockedRoom.exit !== undefined)
    ) {
      throw new HistoryFoldContractError(
        'prefix history has an unentered room outside its terminal preparation record',
      );
    }
    const lastSequence = immutableEvents.at(-1)?.sequence ?? seed?.sequence ?? 0;
    return Object.freeze({
      routeKey: biomeStartOrigin.routeKey,
      biomeKey: biomeStartOrigin.biomeKey,
      events: immutableEvents,
      ledgers: frozenLedgers(ledgers),
      // A blocked encounter can legitimately finish preparation and record a
      // valid earlier phase without entering its room. Its records remain in
      // the current history view, but it has not established a room lifecycle
      // view for downstream traversal yet.
      rooms: Object.freeze(
        orderedViews.filter((views) => views.entry !== undefined).map(freezeProgressiveRoomViews),
      ),
      current: stateView(lastSequence, ledgers),
    });
  }
  if (biomeCompletion === undefined || biomeCompletionOrigin === undefined) {
    throw new HistoryFoldContractError('history has no biome completion event');
  }
  if (resetAxes.length !== 2) {
    throw new HistoryFoldContractError('history has an incomplete biome reset sequence');
  }
  return Object.freeze({
    routeKey: biomeCompletionOrigin.routeKey,
    biomeKey: biomeCompletionOrigin.biomeKey,
    events: immutableEvents,
    ledgers: frozenLedgers(ledgers),
    rooms: Object.freeze(orderedViews.map(freezeRoomViews)),
    biomeCompletion,
    afterTransition: stateView(immutableEvents.at(-1)!.sequence, ledgers),
  });
}

export function foldHistoryEvents(
  events: readonly HistoryEvent[],
  seed?: HistoryStateView,
): CanonicalBiomeHistory {
  return foldHistoryEventStream(events, seed, 'complete') as CanonicalBiomeHistory;
}

export function foldBiomeHistoryPrefixEvents(
  events: readonly HistoryEvent[],
  seed?: HistoryStateView,
): BiomeHistoryPrefix {
  return foldHistoryEventStream(events, seed, 'prefix') as BiomeHistoryPrefix;
}
