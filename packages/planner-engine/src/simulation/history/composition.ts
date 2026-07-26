import type { BiomeTransitionCounterReset, Catalog } from '../../catalog-schema';
import { createBiomeAddress, type BiomeAddress } from '../../authored-project/addresses';
import { executeRoomLifecycle, type RoomLifecycleEvent } from '../lifecycle';
import type { CanonicalCompletionRoom } from '../materialization';
import { foldHistoryEvents } from './fold';
import { foldBiomeHistoryPrefixEvents } from './fold';
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
}

export interface HistorySegmentWriter {
  append(event: SegmentHistoryEventData): void;
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
    encounterProfileKey: room.encounterProfileKey,
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
  const fragment = executeRoomLifecycle(catalog, createRoomLifecycleInput(catalog, room));
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
  readonly compose: (writer: HistorySegmentWriter) => void;
}

export function composeBiomeHistoryPrefix({
  routeKey,
  biomeKey,
  initialCounters,
  seed,
  compose,
}: BiomeHistoryPrefixOptions): BiomeHistoryPrefix {
  const builder: EventBuilder = { events: [], sequenceBase: seed?.sequence ?? 0 };
  appendEnvelope(builder, {
    kind: 'biomeStarted',
    origin: createBiomeAddress(routeKey, biomeKey),
    counters: Object.freeze({ ...initialCounters }),
  });
  compose(segmentWriter(builder));
  return foldBiomeHistoryPrefixEvents(builder.events, seed);
}

export function composeFixedEntryChain<Room extends CanonicalLifecycleRoom>(
  writer: HistorySegmentWriter,
  rooms: readonly Room[],
  connect: (writer: HistorySegmentWriter, source: Room, target: Room, targetIndex: number) => void,
  fail: (detail: string) => never,
): Room {
  const entry = rooms[0];
  if (entry === undefined) {
    return fail('history requires a canonical entry room');
  }
  appendStandaloneRoomCreated(writer, entry, 'biomeEntry');
  let source = entry;
  for (const [index, target] of rooms.slice(1).entries()) {
    connect(writer, source, target, index + 1);
    source = target;
  }
  return source;
}

function appendCompletionTail(
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

export function composeBiomeHistoryEnvelope<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
>({
  catalog,
  routeKey,
  biomeKey,
  initialCounters,
  seed,
  completionRooms,
  transitionEffects,
  composeEntry,
  composeBody,
  composeCompletionPredecessor,
  fail,
}: BiomeHistoryEnvelopeOptions<Entry, Predecessor, CompletionPredecessor>): CanonicalBiomeHistory {
  const biome = createBiomeAddress(routeKey, biomeKey);
  const builder: EventBuilder = { events: [], sequenceBase: seed?.sequence ?? 0 };
  const writer = segmentWriter(builder);
  appendEnvelope(builder, {
    kind: 'biomeStarted',
    origin: biome,
    counters: Object.freeze({ ...initialCounters }),
  });
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
  return foldHistoryEvents(builder.events, seed);
}
