import type { Catalog, HubBiomeLayout } from '../../catalog';
import {
  createBiomeAddress,
  createFixedEntryTargetAddress,
  semanticAddressKey,
  type BiomeAddress,
} from '../../project/addresses';
import { executeRoomLifecycle, type RoomLifecycleEvent } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubBiome,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalHubVisit,
  CanonicalLocalChildRoom,
  CanonicalRoomRestore,
} from '../materialization';
import { foldHubHistoryEvents } from './fold';
import { createRoomLifecycleInput, type CanonicalLifecycleRoom } from './lifecycleInput';
import type { CanonicalHubHistory, HistoryEvent, RoomCreatedHistoryEvent } from './model';

export class HubHistoryCompositionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HubHistoryCompositionContractError';
  }
}

interface EventBuilder {
  readonly events: HistoryEvent[];
}

type HistoryEventData<Event extends HistoryEvent = HistoryEvent> = Event extends HistoryEvent
  ? Omit<Event, 'sequence'>
  : never;

type OutgoingProjection = (builder: EventBuilder, parent: CanonicalLifecycleRoom) => void;
type FixedTerminalHubLayout = HubBiomeLayout & {
  readonly terminal: Extract<HubBiomeLayout['terminal'], { readonly kind: 'fixedAuthoredSlot' }>;
};

function fail(detail: string): never {
  throw new HubHistoryCompositionContractError(detail);
}

function append(builder: EventBuilder, event: HistoryEventData): void {
  builder.events.push(
    Object.freeze({ ...event, sequence: builder.events.length + 1 }) as HistoryEvent,
  );
}

function appendLifecycleEvent(builder: EventBuilder, event: RoomLifecycleEvent): void {
  const { sequence: localSequence, ...data } = event;
  if (localSequence <= 0) {
    fail('room fragment has an invalid local sequence');
  }
  append(builder, data);
}

function roomEntered(room: CanonicalLifecycleRoom): boolean {
  return room.entered;
}

function appendRoomLifecycle(
  builder: EventBuilder,
  catalog: Catalog,
  room: CanonicalLifecycleRoom,
  outgoing?: OutgoingProjection,
): void {
  if (!roomEntered(room)) {
    fail(`unentered room ${semanticAddressKey(room.origin)} cannot execute a lifecycle`);
  }
  const fragment = executeRoomLifecycle(catalog, createRoomLifecycleInput(catalog, room));
  let projectedOutgoing = false;
  for (const event of fragment.events) {
    appendLifecycleEvent(builder, event);
    if (event.kind === 'outgoingGenerationCheckpoint') {
      if (outgoing === undefined || projectedOutgoing) {
        fail(`${room.gameName} has no unique Hub outgoing projection`);
      }
      outgoing(builder, room);
      projectedOutgoing = true;
    }
  }
  if ((outgoing !== undefined) === projectedOutgoing) {
    return;
  }
  fail(`${room.gameName} canonical outgoing projection does not match its lifecycle`);
}

function standaloneRoomCreated(
  builder: EventBuilder,
  room: CanonicalLifecycleRoom,
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

function appendGenerationCompleted(
  builder: EventBuilder,
  event: Omit<
    Extract<
      RoomCreatedHistoryEvent,
      { readonly source: 'hubTarget' | 'layoutEntry' | 'localChild' }
    >,
    'sequence'
  >,
): void {
  append(builder, {
    kind: 'targetGenerationCompleted',
    origin: event.targetOrigin,
    roomOrigin: event.origin,
    parentOrigin: event.parentOrigin,
    generationIndex: event.generationIndex,
    generationCount: event.generationCount,
  });
}

function layoutEntryCreated(
  builder: EventBuilder,
  parent: CanonicalLifecycleRoom,
  room: CanonicalAuthoredRoom | CanonicalHubRoom,
  role: string,
): void {
  const biome = createBiomeAddress(parent.origin.routeKey, parent.origin.biomeKey);
  const event: Omit<
    Extract<RoomCreatedHistoryEvent, { readonly source: 'layoutEntry' }>,
    'sequence'
  > = {
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    source: 'layoutEntry',
    picked: true,
    parentOrigin: parent.origin,
    targetOrigin: createFixedEntryTargetAddress(biome, role),
    generationIndex: 1,
    generationCount: 1,
  };
  append(builder, event);
  appendGenerationCompleted(builder, event);
}

function hubTargetCreated(
  builder: EventBuilder,
  parent: CanonicalHubRoom,
  target: CanonicalHubTarget,
  generationIndex: number,
  generationCount: number,
): void {
  const event: Omit<
    Extract<RoomCreatedHistoryEvent, { readonly source: 'hubTarget' }>,
    'sequence'
  > = {
    kind: 'roomCreated',
    origin: target.room.origin,
    gameName: target.room.gameName,
    encounterProfileKey: target.room.encounterProfileKey,
    source: 'hubTarget',
    picked: target.room.entered,
    parentOrigin: parent.origin,
    targetOrigin: target.origin,
    generationIndex,
    generationCount,
  };
  append(builder, event);
  appendGenerationCompleted(builder, event);
}

function localChildCreated(
  builder: EventBuilder,
  parent: CanonicalAuthoredRoom,
  room: CanonicalLocalChildRoom,
  generationIndex: number,
  generationCount: number,
): void {
  const event: Omit<
    Extract<RoomCreatedHistoryEvent, { readonly source: 'localChild' }>,
    'sequence'
  > = {
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    source: 'localChild',
    picked: room.entered,
    parentOrigin: parent.origin,
    targetOrigin: room.origin,
    generationIndex,
    generationCount,
  };
  append(builder, event);
  appendGenerationCompleted(builder, event);
}

function terminalCreated(
  builder: EventBuilder,
  biome: BiomeAddress,
  parent: CanonicalHubRoom,
  room: CanonicalAuthoredRoom,
  role: string,
): void {
  append(builder, {
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    source: 'layoutTerminal',
    picked: true,
    parentOrigin: parent.origin,
    targetOrigin: createFixedEntryTargetAddress(biome, role),
  });
}

function appendRestore(
  builder: EventBuilder,
  restore: CanonicalRoomRestore,
  room: CanonicalAuthoredRoom | CanonicalHubRoom,
  restoreKind: 'hub' | 'parent',
): void {
  if (
    semanticAddressKey(restore.room.origin) !== semanticAddressKey(room.origin) ||
    restore.room.gameName !== room.gameName
  ) {
    fail(`${restoreKind} restore does not reference its canonical room`);
  }
  append(builder, {
    kind: 'roomRestored',
    origin: room.origin,
    after: restore.after,
    restoreKind,
    biomeDepthCacheDelta: room.counterEffects.biomeDepthCache,
    roomHistoryOrdinalDelta: room.counterEffects.roomHistoryOrdinal,
  });
}

function boardProjection(board: CanonicalHubBiome['hubBoard']): OutgoingProjection {
  return (builder, parent) => {
    if (parent.kind !== 'hub' || parent !== board.room) {
      fail('Hub board generation has no canonical persistent Hub parent');
    }
    board.targets.forEach((target, index) =>
      hubTargetCreated(builder, parent, target, index + 1, board.targets.length),
    );
  };
}

function sideRoomProjection(visit: CanonicalHubVisit): OutgoingProjection {
  return (builder, parent) => {
    if (parent.kind !== 'authored' || parent !== visit.target.room) {
      fail(`visit ${visit.visitIndex} side generation has no canonical parent`);
    }
    const generated = [...visit.localSlots]
      .filter((room) => room.generation === 'generated')
      .sort((left, right) => left.availabilityRank - right.availabilityRank);
    if (generated.length === 0) {
      append(builder, { kind: 'emptyOutgoingGenerationCompleted', origin: parent.origin });
      return;
    }
    generated.forEach((room, index) =>
      localChildCreated(builder, parent, room, index + 1, generated.length),
    );
  };
}

function requireHubLayout(catalog: Catalog, snapshot: CanonicalHubBiome): FixedTerminalHubLayout {
  const route = catalog.routes.byKey[snapshot.routeKey];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (
    route === undefined ||
    route.biomeKeys[0] !== snapshot.biomeKey ||
    layout?.kind !== 'HubBiome' ||
    layout.hub.roomGameName !== snapshot.hubBoard.room.gameName ||
    layout.terminal.kind !== 'fixedAuthoredSlot' ||
    layout.terminal.roomGameName !== snapshot.terminalEntry.gameName ||
    layout.entries.length !== snapshot.entryRooms.length ||
    snapshot.visits.length !== layout.hub.requiredVisits
  ) {
    fail(`catalog cannot place canonical ${snapshot.biomeKey} Hub history`);
  }
  return layout as FixedTerminalHubLayout;
}

function composeVisit(
  builder: EventBuilder,
  catalog: Catalog,
  visit: CanonicalHubVisit,
  hubRoom: CanonicalHubRoom,
): void {
  appendRoomLifecycle(builder, catalog, visit.target.room, sideRoomProjection(visit));
  for (const [index, sideRoom] of visit.enteredLocalRooms.entries()) {
    if (!sideRoom.entered || sideRoom.generation !== 'generated') {
      fail(`visit ${visit.visitIndex} enters an unavailable local room`);
    }
    appendRoomLifecycle(builder, catalog, sideRoom);
    const restore = visit.parentRestores[index];
    if (
      restore === undefined ||
      semanticAddressKey(restore.after) !== semanticAddressKey(sideRoom.origin)
    ) {
      fail(`visit ${visit.visitIndex} has no ordered parent restore for ${sideRoom.slotKey}`);
    }
    appendRestore(builder, restore, visit.target.room, 'parent');
  }
  if (visit.parentRestores.length !== visit.enteredLocalRooms.length) {
    fail(`visit ${visit.visitIndex} parent restore count is inconsistent`);
  }
  if (semanticAddressKey(visit.hubRestore.after) !== semanticAddressKey(visit.origin)) {
    fail(`visit ${visit.visitIndex} Hub restore has the wrong visit owner`);
  }
  appendRestore(builder, visit.hubRestore, hubRoom, 'hub');
}

export function composeHubHistory(
  catalog: Catalog,
  snapshot: CanonicalHubBiome,
): CanonicalHubHistory {
  const layout = requireHubLayout(catalog, snapshot);
  const biome = createBiomeAddress(snapshot.routeKey, snapshot.biomeKey);
  const entry = snapshot.entryRooms[0];
  if (entry === undefined) {
    fail(`${snapshot.biomeKey} Hub history requires a canonical entry room`);
  }
  const builder: EventBuilder = { events: [] };
  append(builder, {
    kind: 'biomeStarted',
    origin: biome,
    counters: Object.freeze({
      biomeDepthCache: layout.initialCounters.biomeDepthCache,
      biomeEncounterDepth: layout.initialCounters.biomeEncounterDepth,
      routeEncounterDepth: 1,
      roomHistoryOrdinal: 0,
      numSubRoomsSpawned: 0,
      soulPylonsSpawned: 0,
      soulPylonsCompleted: 0,
    }),
  });
  standaloneRoomCreated(builder, entry, 'biomeEntry');

  let source: CanonicalAuthoredRoom = entry;
  for (const [index, nextEntry] of snapshot.entryRooms.slice(1).entries()) {
    const descriptor = layout.entries[index + 1];
    if (
      descriptor?.kind !== 'fixedAuthoredSlot' ||
      descriptor.roomGameName !== nextEntry.gameName
    ) {
      fail(`${snapshot.biomeKey} fixed Hub entry ${index + 2} does not match its layout`);
    }
    appendRoomLifecycle(builder, catalog, source, (targetBuilder, parent) =>
      layoutEntryCreated(targetBuilder, parent, nextEntry, descriptor.slotKey),
    );
    source = nextEntry;
  }

  appendRoomLifecycle(builder, catalog, source, (targetBuilder, parent) =>
    layoutEntryCreated(targetBuilder, parent, snapshot.hubBoard.room, 'hub'),
  );
  appendRoomLifecycle(builder, catalog, snapshot.hubBoard.room, boardProjection(snapshot.hubBoard));

  for (const visit of snapshot.visits) {
    composeVisit(builder, catalog, visit, snapshot.hubBoard.room);
  }

  terminalCreated(
    builder,
    biome,
    snapshot.hubBoard.room,
    snapshot.terminalEntry,
    layout.terminal.slotKey,
  );
  appendRoomLifecycle(builder, catalog, snapshot.terminalEntry);

  for (const completion of snapshot.completionRooms) {
    standaloneRoomCreated(builder, completion, 'layoutCompletion');
    appendRoomLifecycle(builder, catalog, completion);
  }

  append(builder, { kind: 'biomeCompleted', origin: biome });
  for (const effect of layout.completion.transitionEffects) {
    append(builder, { kind: 'biomeCounterReset', origin: biome, axis: effect.axis, value: 0 });
  }
  return foldHubHistoryEvents(builder.events);
}

export function composeNHistory(
  catalog: Catalog,
  snapshot: CanonicalHubBiome,
): CanonicalHubHistory {
  if (snapshot.biomeKey !== 'N') {
    fail(`N history cannot compose biome ${snapshot.biomeKey}`);
  }
  return composeHubHistory(catalog, snapshot);
}
