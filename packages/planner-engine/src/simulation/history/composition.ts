import type { BiomeTransitionCounterReset, Catalog } from '../../catalog-schema';
import { createBiomeAddress, type BiomeAddress } from '../../authored-project/addresses';
import { executeRoomLifecycle, type RoomLifecycleEvent } from '../lifecycle';
import type { CanonicalCompletionRoom } from '../materialization';
import { foldHistoryEvents } from './fold';
import { createRoomLifecycleInput, type CanonicalLifecycleRoom } from './lifecycleInput';
import type {
  CanonicalBiomeHistory,
  HistoryCounters,
  HistoryEvent,
  HistoryStateView,
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
}

interface BiomeHistoryEnvelopeOptions<Entry, Predecessor, Terminal extends CanonicalLifecycleRoom> {
  readonly catalog: Catalog;
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly initialCounters: HistoryCounters;
  readonly seed?: HistoryStateView;
  readonly completionRooms: readonly CanonicalCompletionRoom[];
  readonly transitionEffects: readonly BiomeTransitionCounterReset[];
  readonly composeEntry: (writer: HistorySegmentWriter) => Entry;
  readonly composeBody: (writer: HistorySegmentWriter, entry: Entry) => Predecessor;
  readonly composeTerminal: (writer: HistorySegmentWriter, predecessor: Predecessor) => Terminal;
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
  for (const event of fragment.events) {
    options.beforeEvent?.(writer, event);
    appendLifecycleEvent(writer, event, fail);
    options.afterEvent?.(writer, event);
    if (event.kind === 'outgoingGenerationCheckpoint') {
      if (options.outgoing === undefined || projectedOutgoing) {
        fail(`${room.gameName} has no unique canonical outgoing projection`);
      }
      options.outgoing(writer, room);
      projectedOutgoing = true;
    }
  }
  if ((options.outgoing !== undefined) !== projectedOutgoing) {
    fail(`${room.gameName} canonical outgoing projection does not match its lifecycle`);
  }
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
  terminal: CanonicalLifecycleRoom,
  completionRooms: readonly CanonicalCompletionRoom[],
  fail: (detail: string) => never,
): void {
  if (
    terminal.origin.routeKey !== biome.routeKey ||
    terminal.origin.biomeKey !== biome.biomeKey ||
    !terminal.entered
  ) {
    fail('terminal composer did not return the entered terminal room for this biome');
  }
  for (const completion of completionRooms) {
    appendStandaloneRoomCreated(writer, completion, 'layoutCompletion');
    appendRoomLifecycle(writer, catalog, completion, fail);
  }
}

export function composeBiomeHistoryEnvelope<
  Entry,
  Predecessor,
  Terminal extends CanonicalLifecycleRoom,
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
  composeTerminal,
  fail,
}: BiomeHistoryEnvelopeOptions<Entry, Predecessor, Terminal>): CanonicalBiomeHistory {
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
  const terminal = composeTerminal(writer, predecessor);
  appendCompletionTail(writer, catalog, biome, terminal, completionRooms, fail);
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
