import type { BiomeTransitionCounterAxis } from '../../catalog';
import { semanticAddressKey } from '../../project/addresses';
import type {
  CanonicalLinearHistory,
  EncounterHistoryEntry,
  EnteredRewardStoreHistoryEntry,
  LinearHistoryCounters,
  LinearHistoryEvent,
  LinearHistoryLedgers,
  LinearHistoryStateView,
  LinearRoomHistoryViews,
  LinearTargetGenerationView,
  RoomAppearanceHistoryEntry,
  RoomCreatedHistoryEvent,
} from './model';

interface MutableLedgers {
  roomCreations: RoomCreatedHistoryEvent[];
  roomAppearances: RoomAppearanceHistoryEntry[];
  encounterStarts: EncounterHistoryEntry[];
  encounterCompletions: EncounterHistoryEntry[];
  enteredRewardStores: EnteredRewardStoreHistoryEntry[];
  counters: {
    biomeDepthCache: number;
    biomeEncounterDepth: number;
    routeEncounterDepth: number;
    roomHistoryOrdinal: number;
    fieldsMaxDoorsRolled?: number;
  };
}

interface MutableRoomViews {
  readonly origin: LinearRoomHistoryViews['origin'];
  preparation?: LinearHistoryStateView;
  entry?: LinearHistoryStateView;
  preOutgoing?: LinearHistoryStateView;
  readonly targetGenerations: LinearTargetGenerationView[];
  outgoingGeneration?: LinearHistoryStateView;
  postCommit?: LinearHistoryStateView;
  exit?: LinearHistoryStateView;
}

interface PendingTargetGeneration {
  readonly creation: Extract<RoomCreatedHistoryEvent, { readonly source: 'generatedTarget' }>;
  readonly before: LinearHistoryStateView;
}

export class LinearHistoryFoldContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearHistoryFoldContractError';
  }
}

function frozenCounters(counters: MutableLedgers['counters']): LinearHistoryCounters {
  return Object.freeze({ ...counters });
}

function frozenLedgers(ledgers: MutableLedgers): LinearHistoryLedgers {
  return Object.freeze({
    roomCreations: Object.freeze([...ledgers.roomCreations]),
    roomAppearances: Object.freeze([...ledgers.roomAppearances]),
    encounterStarts: Object.freeze([...ledgers.encounterStarts]),
    encounterCompletions: Object.freeze([...ledgers.encounterCompletions]),
    enteredRewardStores: Object.freeze([...ledgers.enteredRewardStores]),
    counters: frozenCounters(ledgers.counters),
  });
}

function stateView(sequence: number, ledgers: MutableLedgers): LinearHistoryStateView {
  return Object.freeze({ sequence, ledgers: frozenLedgers(ledgers) });
}

function roomName(
  namesByOrigin: ReadonlyMap<string, string>,
  event: Extract<
    LinearHistoryEvent,
    | { readonly kind: 'encounterCompleted' }
    | { readonly kind: 'encounterStarted' }
    | { readonly kind: 'enteredRewardStoreRecorded' }
    | { readonly kind: 'roomEntered' }
  >,
): string {
  const gameName = namesByOrigin.get(semanticAddressKey(event.origin));
  if (gameName === undefined) {
    throw new LinearHistoryFoldContractError(
      `${event.kind} references uncreated room ${semanticAddressKey(event.origin)}`,
    );
  }
  return gameName;
}

function requireRoomViews(
  viewsByOrigin: ReadonlyMap<string, MutableRoomViews>,
  event: Extract<LinearHistoryEvent, { readonly origin: LinearRoomHistoryViews['origin'] }>,
): MutableRoomViews {
  const views = viewsByOrigin.get(semanticAddressKey(event.origin));
  if (views === undefined) {
    throw new LinearHistoryFoldContractError(
      `${event.kind} references unprepared room ${semanticAddressKey(event.origin)}`,
    );
  }
  return views;
}

function encounterEntry(
  event: Extract<LinearHistoryEvent, { readonly kind: 'encounterStarted' }>,
  namesByOrigin: ReadonlyMap<string, string>,
  encounterProfilesByOrigin: ReadonlyMap<string, string>,
): EncounterHistoryEntry {
  const encounterProfileKey = encounterProfilesByOrigin.get(semanticAddressKey(event.origin));
  if (encounterProfileKey === undefined) {
    throw new LinearHistoryFoldContractError(
      `${event.kind} references a room without an encounter profile`,
    );
  }
  return Object.freeze({
    sequence: event.sequence,
    origin: event.origin,
    gameName: roomName(namesByOrigin, event),
    encounterProfileKey,
    phaseKey: event.phaseKey,
    phaseKind: event.phaseKind,
    ...(event.baselineEncounterKey === undefined
      ? {}
      : { baselineEncounterKey: event.baselineEncounterKey }),
  });
}

function encounterKey(event: {
  readonly origin: LinearRoomHistoryViews['origin'];
  readonly phaseKey: string;
}) {
  return JSON.stringify([semanticAddressKey(event.origin), event.phaseKey]);
}

function freezeRoomViews(views: MutableRoomViews): LinearRoomHistoryViews {
  if (
    views.preparation === undefined ||
    views.entry === undefined ||
    views.postCommit === undefined ||
    views.exit === undefined
  ) {
    throw new LinearHistoryFoldContractError(
      `room ${semanticAddressKey(views.origin)} has an incomplete lifecycle view set`,
    );
  }
  if (
    (views.preOutgoing === undefined) !== (views.outgoingGeneration === undefined) ||
    (views.preOutgoing === undefined && views.targetGenerations.length !== 0)
  ) {
    throw new LinearHistoryFoldContractError(
      `room ${semanticAddressKey(views.origin)} has an incomplete outgoing-generation view set`,
    );
  }
  return Object.freeze({
    origin: views.origin,
    preparation: views.preparation,
    entry: views.entry,
    ...(views.preOutgoing === undefined ? {} : { preOutgoing: views.preOutgoing }),
    targetGenerations: Object.freeze([...views.targetGenerations]),
    ...(views.outgoingGeneration === undefined
      ? {}
      : { outgoingGeneration: views.outgoingGeneration }),
    postCommit: views.postCommit,
    exit: views.exit,
  });
}

export function foldLinearHistoryEvents(
  events: readonly LinearHistoryEvent[],
  seed?: LinearHistoryStateView,
): CanonicalLinearHistory {
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
    encounterStarts: [...(seed?.ledgers.encounterStarts ?? [])],
    encounterCompletions: [...(seed?.ledgers.encounterCompletions ?? [])],
    enteredRewardStores: [...(seed?.ledgers.enteredRewardStores ?? [])],
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
  const encounterProfilesByOrigin = new Map<string, string>();
  const activeEncounters = new Map<string, EncounterHistoryEntry>();
  const viewsByOrigin = new Map<string, MutableRoomViews>();
  const orderedViews: MutableRoomViews[] = [];
  let pendingTargetGeneration: PendingTargetGeneration | undefined;
  let biomeStarted = false;
  let biomeCompletion: LinearHistoryStateView | undefined;
  let biomeCompletionOrigin:
    Extract<LinearHistoryEvent, { readonly kind: 'biomeCompleted' }>['origin'] | undefined;
  let biomeStartOrigin:
    Extract<LinearHistoryEvent, { readonly kind: 'biomeStarted' }>['origin'] | undefined;
  const resetAxes: BiomeTransitionCounterAxis[] = [];
  const fieldsBatchOrigins = new Set<string>();

  for (const [index, event] of immutableEvents.entries()) {
    const expectedSequence = (seed?.sequence ?? 0) + index + 1;
    if (event.sequence !== expectedSequence) {
      throw new LinearHistoryFoldContractError(
        `event ${index} has sequence ${event.sequence}; expected ${expectedSequence}`,
      );
    }
    switch (event.kind) {
      case 'biomeStarted':
        if (index !== 0 || biomeStarted) {
          throw new LinearHistoryFoldContractError('history has an invalid biome start event');
        }
        Object.assign(ledgers.counters, event.counters);
        if (event.counters.fieldsMaxDoorsRolled === undefined) {
          delete ledgers.counters.fieldsMaxDoorsRolled;
        }
        biomeStarted = true;
        biomeStartOrigin = event.origin;
        break;
      case 'roomCreated': {
        if (!biomeStarted) {
          throw new LinearHistoryFoldContractError('room creation precedes biome start');
        }
        const before = stateView(event.sequence - 1, ledgers);
        const key = semanticAddressKey(event.origin);
        if (namesByOrigin.has(key)) {
          throw new LinearHistoryFoldContractError(`room ${key} was created more than once`);
        }
        namesByOrigin.set(key, event.gameName);
        encounterProfilesByOrigin.set(key, event.encounterProfileKey);
        ledgers.roomCreations.push(event);
        if (event.source === 'generatedTarget') {
          if (pendingTargetGeneration !== undefined) {
            throw new LinearHistoryFoldContractError('target generations cannot overlap');
          }
          if (
            !Number.isInteger(event.generationIndex) ||
            event.generationIndex <= 0 ||
            !Number.isInteger(event.generationCount) ||
            event.generationCount <= 0 ||
            event.generationIndex > event.generationCount
          ) {
            throw new LinearHistoryFoldContractError(
              `target ${semanticAddressKey(event.targetOrigin)} has invalid generation position`,
            );
          }
          const parentViews = viewsByOrigin.get(semanticAddressKey(event.parentOrigin));
          if (parentViews === undefined) {
            throw new LinearHistoryFoldContractError(
              `generated target ${semanticAddressKey(event.targetOrigin)} has no active parent`,
            );
          }
          if (
            parentViews.preOutgoing === undefined ||
            event.generationIndex !== parentViews.targetGenerations.length + 1
          ) {
            throw new LinearHistoryFoldContractError(
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
          throw new LinearHistoryFoldContractError(
            `target ${semanticAddressKey(event.origin)} has no matching generation start`,
          );
        }
        const parentViews = viewsByOrigin.get(semanticAddressKey(event.parentOrigin));
        if (parentViews === undefined) {
          throw new LinearHistoryFoldContractError(
            `target ${semanticAddressKey(event.origin)} lost its generation parent`,
          );
        }
        const after = stateView(event.sequence, ledgers);
        parentViews.targetGenerations.push(
          Object.freeze({
            targetOrigin: event.origin,
            roomOrigin: event.roomOrigin,
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
      case 'roomPrepared': {
        const key = semanticAddressKey(event.origin);
        if (!namesByOrigin.has(key) || viewsByOrigin.has(key)) {
          throw new LinearHistoryFoldContractError(`room ${key} cannot begin preparation`);
        }
        const views: MutableRoomViews = {
          origin: event.origin,
          preparation: stateView(event.sequence, ledgers),
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
      case 'encounterStarted': {
        const entry = encounterEntry(event, namesByOrigin, encounterProfilesByOrigin);
        const key = encounterKey(event);
        if (activeEncounters.has(key)) {
          throw new LinearHistoryFoldContractError(`${event.phaseKey} started more than once`);
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
          throw new LinearHistoryFoldContractError(
            'Fields batch outcome appeared outside a Fields biome',
          );
        }
        if (
          !Number.isInteger(event.batchCapacity) ||
          !Number.isInteger(event.activeCageCount) ||
          event.batchCapacity <= 0 ||
          event.activeCageCount <= 0 ||
          event.activeCageCount > event.batchCapacity
        ) {
          throw new LinearHistoryFoldContractError('Fields batch outcome has invalid cage counts');
        }
        if (fieldsBatchOrigins.has(semanticAddressKey(event.origin))) {
          throw new LinearHistoryFoldContractError(
            `Fields batch ${semanticAddressKey(event.origin)} was recorded more than once`,
          );
        }
        fieldsBatchOrigins.add(semanticAddressKey(event.origin));
        if (event.cageOutcome === 'max') {
          ledgers.counters.fieldsMaxDoorsRolled += 1;
        }
        break;
      case 'encounterDepthAdvanced':
        ledgers.counters.biomeEncounterDepth += event.biomeEncounterDepthDelta;
        ledgers.counters.routeEncounterDepth += event.routeEncounterDepthDelta;
        break;
      case 'encounterCompleted': {
        const key = encounterKey(event);
        const started = activeEncounters.get(key);
        if (started === undefined) {
          throw new LinearHistoryFoldContractError(
            `${event.phaseKey} completed without a matching encounter start`,
          );
        }
        activeEncounters.delete(key);
        ledgers.encounterCompletions.push(Object.freeze({ ...started, sequence: event.sequence }));
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
      case 'biomeCompleted':
        if (
          biomeCompletion !== undefined ||
          biomeStartOrigin === undefined ||
          semanticAddressKey(event.origin) !== semanticAddressKey(biomeStartOrigin)
        ) {
          throw new LinearHistoryFoldContractError('history has an invalid biome completion event');
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
          throw new LinearHistoryFoldContractError(`unexpected biome counter reset ${event.axis}`);
        }
        resetAxes.push(event.axis);
        ledgers.counters[event.axis] = event.value;
        break;
      }
      case 'offerPointMaterialized':
      case 'producerRoleAdvanced':
      case 'roomCommitted':
      case 'shopPurchasesApplied':
        break;
    }
  }

  if (biomeCompletion === undefined || biomeCompletionOrigin === undefined) {
    throw new LinearHistoryFoldContractError('history has no biome completion event');
  }
  if (!biomeStarted) {
    throw new LinearHistoryFoldContractError('history has no biome start event');
  }
  if (resetAxes.length !== 2) {
    throw new LinearHistoryFoldContractError('history has an incomplete biome reset sequence');
  }
  if (activeEncounters.size !== 0) {
    throw new LinearHistoryFoldContractError('history ended with an active encounter');
  }
  if (pendingTargetGeneration !== undefined) {
    throw new LinearHistoryFoldContractError('history ended during target generation');
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

export function foldFHistoryEvents(events: readonly LinearHistoryEvent[]): CanonicalLinearHistory {
  const start = events[0];
  if (start?.kind !== 'biomeStarted' || start.origin.biomeKey !== 'F') {
    throw new LinearHistoryFoldContractError('F history requires an F biome start');
  }
  return foldLinearHistoryEvents(events);
}
