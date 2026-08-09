import type { BiomeTransitionCounterReset, Catalog } from '../../catalog-schema';
import { createBiomeAddress, type BiomeAddress } from '../../authored-project/addresses';
import {
  executeEncounterRecordPrefix,
  executeRoomLifecycle,
  type RoomLifecycleEvent,
} from '../lifecycle';
import {
  prepareRoomEncounterPhases,
  type EncounterAuthoringRoom,
  type PreparedEncounterPhases,
} from '../encounters/preparation';
import type { CanonicalCompletionRoom } from '../materialization';
import { foldHistoryEvents } from './fold';
import { foldBiomeHistoryPrefixEvents } from './fold';
import { projectRoomPreparationCheckpoint } from './facts';
import { createRoomLifecycleInput, type CanonicalLifecycleRoom } from './lifecycleInput';
import type {
  CanonicalBiomeHistory,
  HistoryCounters,
  HistoryEvent,
  HistoryStateView,
  BiomeHistoryPrefix,
} from './model';

type EnvelopeHistoryEvent = Extract<
  HistoryEvent,
  | { readonly kind: 'biomeCompleted' }
  | { readonly kind: 'biomeCounterReset' }
  | { readonly kind: 'biomeStarted' }
>;
type SegmentHistoryEvent = Exclude<HistoryEvent, EnvelopeHistoryEvent>;
type HistoryEventData<Event extends HistoryEvent = HistoryEvent> = Event extends HistoryEvent
  ? Omit<Event, 'sequence'>
  : never;
type SegmentHistoryEventData = HistoryEventData<SegmentHistoryEvent>;

interface EventBuilder {
  readonly events: HistoryEvent[];
  readonly sequenceBase: number;
  readonly seed?: HistoryStateView;
  readonly validateEncounterResolution: boolean;
}

export interface HistorySegmentWriter {
  append(event: SegmentHistoryEventData): void;
  current(): HistoryStateView;
  readonly validatesEncounterResolution: boolean;
}

export interface EncounterHistoryBlock {
  readonly room: EncounterAuthoringRoom;
  readonly before: HistoryStateView;
  readonly afterValidRecordPrefix: HistoryStateView;
  readonly preparation: PreparedEncounterPhases;
  readonly blockedAt: NonNullable<PreparedEncounterPhases['blockedAt']>;
}

export type EncounterValidatedPrefixHistory =
  | { readonly kind: 'complete'; readonly history: BiomeHistoryPrefix }
  | {
      readonly kind: 'blocked';
      readonly history: BiomeHistoryPrefix;
      readonly block: EncounterHistoryBlock;
    };

export type EncounterValidatedBiomeHistory =
  | { readonly kind: 'complete'; readonly history: CanonicalBiomeHistory }
  | {
      readonly kind: 'blocked';
      readonly history: BiomeHistoryPrefix;
      readonly block: EncounterHistoryBlock;
    };

/**
 * A room with an invalid active encounter cannot enter its lifecycle. Valid
 * preceding phase records are already canonical events; the caller folds that
 * partial stream and retains this exact phase owner as its evaluation block.
 */
export class EncounterLifecycleBlocked extends Error {
  constructor(
    readonly room: EncounterAuthoringRoom,
    readonly before: HistoryStateView,
    readonly preparation: PreparedEncounterPhases,
  ) {
    if (preparation.valid || preparation.blockedAt === undefined) {
      throw new Error('encounter lifecycle block requires an invalid preparation result');
    }
    super(`encounter lifecycle blocked at ${preparation.blockedAt.phaseKey}`);
    this.name = 'EncounterLifecycleBlocked';
  }

  get blockedAt() {
    return this.preparation.blockedAt!;
  }
}

export interface RoomLifecycleCompositionOptions {
  readonly prepare?: (events: readonly RoomLifecycleEvent[]) => void;
  readonly beforeEvent?: (writer: HistorySegmentWriter, event: RoomLifecycleEvent) => void;
  readonly afterEvent?: (writer: HistorySegmentWriter, event: RoomLifecycleEvent) => void;
  readonly outgoing?: (writer: HistorySegmentWriter, parent: CanonicalLifecycleRoom) => void;
  readonly stopAfterOutgoing?: boolean;
}

interface BiomeHistoryEnvelopeOptions<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
> {
  readonly catalog: Catalog;
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly initialCounters: HistoryCounters;
  readonly seed?: HistoryStateView;
  readonly validateEncounterResolution?: boolean;
  readonly completionRooms: readonly CanonicalCompletionRoom[];
  readonly transitionEffects: readonly BiomeTransitionCounterReset[];
  readonly composeEntry: (writer: HistorySegmentWriter) => Entry;
  readonly composeBody: (writer: HistorySegmentWriter, entry: Entry) => Predecessor;
  readonly composeCompletionPredecessor: (
    writer: HistorySegmentWriter,
    predecessor: Predecessor,
  ) => CompletionPredecessor;
  readonly fail: (detail: string) => never;
}

function appendEnvelope(
  builder: EventBuilder,
  event: HistoryEventData<EnvelopeHistoryEvent>,
): void {
  builder.events.push(
    Object.freeze({
      ...event,
      sequence: builder.sequenceBase + builder.events.length + 1,
    }) as EnvelopeHistoryEvent,
  );
}

function segmentWriter(builder: EventBuilder): HistorySegmentWriter {
  return Object.freeze({
    append(event: SegmentHistoryEventData): void {
      builder.events.push(
        Object.freeze({
          ...event,
          sequence: builder.sequenceBase + builder.events.length + 1,
        }) as SegmentHistoryEvent,
      );
    },
    current(): HistoryStateView {
      return foldBiomeHistoryPrefixEvents(builder.events, builder.seed).current;
    },
    validatesEncounterResolution: builder.validateEncounterResolution,
  });
}

function appendLifecycleEvent(
  writer: HistorySegmentWriter,
  event: RoomLifecycleEvent,
  fail: (detail: string) => never,
): void {
  const { sequence: localSequence, ...data } = event;
  if (localSequence <= 0) {
    fail('room fragment has an invalid local sequence');
  }
  writer.append(data);
}

export function appendStandaloneRoomCreated(
  writer: HistorySegmentWriter,
  room: CanonicalLifecycleRoom,
  source: 'biomeEntry' | 'layoutCompletion',
): void {
  writer.append({
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    encounterEnvelopeKey: room.encounterEnvelopeKey,
    source,
    picked: true,
  });
}

export function appendRoomLifecycle(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  room: CanonicalLifecycleRoom,
  fail: (detail: string) => never,
  options: RoomLifecycleCompositionOptions = {},
): void {
  if (!room.entered) {
    fail(`unentered room cannot execute a lifecycle`);
  }
  const authoringRoom: EncounterAuthoringRoom | undefined =
    room.kind === 'authored' || room.kind === 'localChild' ? room : undefined;
  const beforeEncounterPreparation = writer.validatesEncounterResolution
    ? writer.current()
    : undefined;
  const encounterPreparation =
    writer.validatesEncounterResolution && authoringRoom !== undefined
      ? prepareRoomEncounterPhases(
          catalog,
          authoringRoom,
          projectRoomPreparationCheckpoint(beforeEncounterPreparation!),
        )
      : undefined;
  const encounterPhases = encounterPreparation?.validPrefix ?? room.encounterPhases;
  if (encounterPreparation !== undefined && !encounterPreparation.valid) {
    const prefix = executeEncounterRecordPrefix(
      catalog,
      createRoomLifecycleInput(catalog, room, encounterPhases),
    );
    for (const event of prefix.events) appendLifecycleEvent(writer, event, fail);
    throw new EncounterLifecycleBlocked(
      authoringRoom!,
      beforeEncounterPreparation!,
      encounterPreparation,
    );
  }
  const fragment = executeRoomLifecycle(
    catalog,
    createRoomLifecycleInput(catalog, room, encounterPhases),
  );
  options.prepare?.(fragment.events);
  let projectedOutgoing = false;
  let reachedOutgoing = false;
  for (const event of fragment.events) {
    options.beforeEvent?.(writer, event);
    appendLifecycleEvent(writer, event, fail);
    options.afterEvent?.(writer, event);
    if (event.kind === 'outgoingGenerationCheckpoint') {
      reachedOutgoing = true;
      if ((options.outgoing === undefined && !options.stopAfterOutgoing) || projectedOutgoing) {
        fail(`${room.gameName} has no unique canonical outgoing projection`);
      }
      options.outgoing?.(writer, room);
      projectedOutgoing = options.outgoing !== undefined;
      if (options.stopAfterOutgoing) {
        return;
      }
    }
  }
  if (options.stopAfterOutgoing && !reachedOutgoing) {
    fail(`${room.gameName} has no outgoing checkpoint for prefix composition`);
  }
  if ((options.outgoing !== undefined) !== projectedOutgoing) {
    fail(`${room.gameName} canonical outgoing projection does not match its lifecycle`);
  }
}

interface BiomeHistoryPrefixOptions {
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly initialCounters: HistoryCounters;
  readonly seed?: HistoryStateView;
  readonly validateEncounterResolution?: boolean;
  readonly compose: (writer: HistorySegmentWriter) => void;
}

function composeBiomeHistoryPrefixResult({
  routeKey,
  biomeKey,
  initialCounters,
  seed,
  validateEncounterResolution = false,
  compose,
}: BiomeHistoryPrefixOptions): EncounterValidatedPrefixHistory {
  const builder: EventBuilder = {
    events: [],
    sequenceBase: seed?.sequence ?? 0,
    ...(seed === undefined ? {} : { seed }),
    validateEncounterResolution,
  };
  appendEnvelope(builder, {
    kind: 'biomeStarted',
    origin: createBiomeAddress(routeKey, biomeKey),
    counters: Object.freeze({ ...initialCounters }),
  });
  try {
    compose(segmentWriter(builder));
  } catch (error) {
    if (!(error instanceof EncounterLifecycleBlocked)) throw error;
    const history = foldBiomeHistoryPrefixEvents(builder.events, seed);
    return Object.freeze({
      kind: 'blocked',
      history,
      block: Object.freeze({
        room: error.room,
        before: error.before,
        afterValidRecordPrefix: history.current,
        preparation: error.preparation,
        blockedAt: error.blockedAt,
      }),
    });
  }
  return Object.freeze({
    kind: 'complete',
    history: foldBiomeHistoryPrefixEvents(builder.events, seed),
  });
}

export function composeBiomeHistoryPrefix({
  routeKey,
  biomeKey,
  initialCounters,
  seed,
  compose,
}: Omit<BiomeHistoryPrefixOptions, 'validateEncounterResolution'>): BiomeHistoryPrefix {
  const result = composeBiomeHistoryPrefixResult({
    routeKey,
    biomeKey,
    initialCounters,
    ...(seed === undefined ? {} : { seed }),
    validateEncounterResolution: false,
    compose,
  });
  if (result.kind !== 'complete') {
    throw new Error('ordinary prefix composition unexpectedly encountered encounter validation');
  }
  return result.history;
}

export function composeBiomeHistoryPrefixWithEncounterValidation({
  routeKey,
  biomeKey,
  initialCounters,
  seed,
  compose,
}: Omit<
  BiomeHistoryPrefixOptions,
  'validateEncounterResolution'
>): EncounterValidatedPrefixHistory {
  return composeBiomeHistoryPrefixResult({
    routeKey,
    biomeKey,
    initialCounters,
    ...(seed === undefined ? {} : { seed }),
    validateEncounterResolution: true,
    compose,
  });
}

export function appendCompletionTail(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  biome: BiomeAddress,
  predecessor: CanonicalLifecycleRoom,
  completionRooms: readonly CanonicalCompletionRoom[],
  fail: (detail: string) => never,
): void {
  if (
    predecessor.origin.routeKey !== biome.routeKey ||
    predecessor.origin.biomeKey !== biome.biomeKey ||
    !predecessor.entered
  ) {
    fail('completion composer did not return the entered Preboss for this biome');
  }
  for (const completion of completionRooms) {
    appendStandaloneRoomCreated(writer, completion, 'layoutCompletion');
    appendRoomLifecycle(writer, catalog, completion, fail);
  }
}

function composeBiomeHistoryEnvelopeResult<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
>({
  catalog,
  routeKey,
  biomeKey,
  initialCounters,
  seed,
  validateEncounterResolution = false,
  completionRooms,
  transitionEffects,
  composeEntry,
  composeBody,
  composeCompletionPredecessor,
  fail,
}: BiomeHistoryEnvelopeOptions<
  Entry,
  Predecessor,
  CompletionPredecessor
>): EncounterValidatedBiomeHistory {
  const biome = createBiomeAddress(routeKey, biomeKey);
  const builder: EventBuilder = {
    events: [],
    sequenceBase: seed?.sequence ?? 0,
    ...(seed === undefined ? {} : { seed }),
    validateEncounterResolution,
  };
  const writer = segmentWriter(builder);
  appendEnvelope(builder, {
    kind: 'biomeStarted',
    origin: biome,
    counters: Object.freeze({ ...initialCounters }),
  });
  try {
    const entry = composeEntry(writer);
    const predecessor = composeBody(writer, entry);
    const completionPredecessor = composeCompletionPredecessor(writer, predecessor);
    appendCompletionTail(writer, catalog, biome, completionPredecessor, completionRooms, fail);
    appendEnvelope(builder, { kind: 'biomeCompleted', origin: biome });
    for (const effect of transitionEffects) {
      appendEnvelope(builder, {
        kind: 'biomeCounterReset',
        origin: biome,
        axis: effect.axis,
        value: 0,
      });
    }
  } catch (error) {
    if (!(error instanceof EncounterLifecycleBlocked)) throw error;
    const history = foldBiomeHistoryPrefixEvents(builder.events, seed);
    return Object.freeze({
      kind: 'blocked',
      history,
      block: Object.freeze({
        room: error.room,
        before: error.before,
        afterValidRecordPrefix: history.current,
        preparation: error.preparation,
        blockedAt: error.blockedAt,
      }),
    });
  }
  return Object.freeze({ kind: 'complete', history: foldHistoryEvents(builder.events, seed) });
}

export function composeBiomeHistoryEnvelope<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
>(
  options: Omit<
    BiomeHistoryEnvelopeOptions<Entry, Predecessor, CompletionPredecessor>,
    'validateEncounterResolution'
  >,
): CanonicalBiomeHistory {
  const result = composeBiomeHistoryEnvelopeResult({
    ...options,
    validateEncounterResolution: false,
  });
  if (result.kind !== 'complete') {
    throw new Error('ordinary biome composition unexpectedly encountered encounter validation');
  }
  return result.history;
}

export function composeBiomeHistoryEnvelopeWithEncounterValidation<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
>(
  options: Omit<
    BiomeHistoryEnvelopeOptions<Entry, Predecessor, CompletionPredecessor>,
    'validateEncounterResolution'
  >,
): EncounterValidatedBiomeHistory {
  return composeBiomeHistoryEnvelopeResult({
    ...options,
    validateEncounterResolution: true,
  });
}
