import type { Catalog, HubBiomeLayout } from '../../catalog-schema';
import {
  createBiomeAddress,
  createFixedEntryTargetAddress,
  semanticAddressKey,
  type BiomeAddress,
} from '../../authored-project/addresses';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubBiome,
  CanonicalHubRoom,
  CanonicalHubTarget,
  CanonicalHubVisit,
  CanonicalLocalChildRoom,
  CanonicalRoomRestore,
  MaterializedHubBiomePrefix,
  MaterializedHubVisitFrontier,
} from '../materialization';
import {
  appendRoomLifecycle as appendCanonicalRoomLifecycle,
  appendStandaloneRoomCreated,
  composeBiomeHistoryPrefix,
  composeBiomeHistoryEnvelope,
  composeFixedEntryChain,
  type HistorySegmentWriter,
} from './composition';
import type { CanonicalLifecycleRoom } from './lifecycleInput';
import type { CanonicalHubHistory, HubBiomeHistoryPrefix, RoomCreatedHistoryEvent } from './model';

export class HubHistoryCompositionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HubHistoryCompositionContractError';
  }
}

type OutgoingProjection = (writer: HistorySegmentWriter, parent: CanonicalLifecycleRoom) => void;
type FixedTerminalHubLayout = HubBiomeLayout & {
  readonly terminal: Extract<HubBiomeLayout['terminal'], { readonly kind: 'fixedAuthoredSlot' }>;
};

function fail(detail: string): never {
  throw new HubHistoryCompositionContractError(detail);
}

function roomEntered(room: CanonicalLifecycleRoom): boolean {
  return room.entered;
}

function appendRoomLifecycle(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  room: CanonicalLifecycleRoom,
  outgoing?: OutgoingProjection,
  stopAfterOutgoing = false,
): void {
  if (!roomEntered(room)) {
    fail(`unentered room ${semanticAddressKey(room.origin)} cannot execute a lifecycle`);
  }
  appendCanonicalRoomLifecycle(writer, catalog, room, fail, {
    ...(outgoing === undefined ? {} : { outgoing }),
    ...(stopAfterOutgoing ? { stopAfterOutgoing: true } : {}),
  });
}

function appendGenerationCompleted(
  writer: HistorySegmentWriter,
  event: Omit<
    Extract<
      RoomCreatedHistoryEvent,
      { readonly source: 'hubTarget' | 'layoutEntry' | 'localChild' }
    >,
    'sequence'
  >,
): void {
  writer.append({
    kind: 'targetGenerationCompleted',
    origin: event.targetOrigin,
    roomOrigin: event.origin,
    parentOrigin: event.parentOrigin,
    generationIndex: event.generationIndex,
    generationCount: event.generationCount,
  });
}

function layoutEntryCreated(
  writer: HistorySegmentWriter,
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
  writer.append(event);
  appendGenerationCompleted(writer, event);
}

function hubTargetCreated(
  writer: HistorySegmentWriter,
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
  writer.append(event);
  appendGenerationCompleted(writer, event);
}

function localChildCreated(
  writer: HistorySegmentWriter,
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
  writer.append(event);
  appendGenerationCompleted(writer, event);
}

function terminalCreated(
  writer: HistorySegmentWriter,
  biome: BiomeAddress,
  parent: CanonicalHubRoom,
  room: CanonicalAuthoredRoom,
  role: string,
): void {
  writer.append({
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
  writer: HistorySegmentWriter,
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
  writer.append({
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

function sideRoomProjection(
  visit: Pick<CanonicalHubVisit, 'localSlots' | 'target' | 'visitIndex'>,
): OutgoingProjection {
  return (builder, parent) => {
    if (parent.kind !== 'authored' || parent !== visit.target.room) {
      fail(`visit ${visit.visitIndex} side generation has no canonical parent`);
    }
    const generated = [...visit.localSlots]
      .filter((room) => room.generation === 'generated')
      .sort((left, right) => left.availabilityRank - right.availabilityRank);
    if (generated.length === 0) {
      builder.append({ kind: 'emptyOutgoingGenerationCompleted', origin: parent.origin });
      return;
    }
    generated.forEach((room, index) =>
      localChildCreated(builder, parent, room, index + 1, generated.length),
    );
  };
}

function composeFrontierVisit(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  visit: MaterializedHubVisitFrontier,
): void {
  if (visit.kind === 'targetLifecycle') {
    appendRoomLifecycle(writer, catalog, visit.target.room, undefined, true);
    return;
  }
  if (visit.kind === 'sideGeneration') {
    appendRoomLifecycle(writer, catalog, visit.target.room, sideRoomProjection(visit), true);
    return;
  }
  appendRoomLifecycle(writer, catalog, visit.target.room, sideRoomProjection(visit));
  for (const [index, sideRoom] of visit.enteredLocalRooms.entries()) {
    appendRoomLifecycle(writer, catalog, sideRoom);
    const restore = visit.parentRestores[index];
    if (restore === undefined) {
      if (index !== visit.enteredLocalRooms.length - 1) {
        fail(`visit ${visit.visitIndex} frontier loses a non-final parent restore`);
      }
      return;
    }
    appendRestore(writer, restore, visit.target.room, 'parent');
  }
  fail(`visit ${visit.visitIndex} local lifecycle frontier has no stopping room`);
}

function requireHubLayout(
  catalog: Catalog,
  snapshot: {
    readonly routeKey: string;
    readonly biomeKey: string;
    readonly hubRoom?: CanonicalHubRoom;
  },
): FixedTerminalHubLayout {
  const route = catalog.routes.byKey[snapshot.routeKey];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (
    route === undefined ||
    route.biomeKeys[0] !== snapshot.biomeKey ||
    layout?.kind !== 'HubBiome' ||
    (snapshot.hubRoom !== undefined && layout.hub.roomGameName !== snapshot.hubRoom.gameName) ||
    layout.terminal.kind !== 'fixedAuthoredSlot'
  ) {
    fail(`catalog cannot place canonical ${snapshot.biomeKey} Hub history`);
  }
  return layout as FixedTerminalHubLayout;
}

export function composeHubHistoryPrefix(
  catalog: Catalog,
  snapshot: MaterializedHubBiomePrefix,
): HubBiomeHistoryPrefix {
  const layout = requireHubLayout(catalog, snapshot);
  const entry = snapshot.entryRooms[0];
  if (
    entry === undefined ||
    snapshot.entryRooms.length > layout.entries.length ||
    (snapshot.frontierEntry !== undefined &&
      snapshot.frontierEntry.entryIndex !== snapshot.entryRooms.length - 1)
  ) {
    fail(`${snapshot.biomeKey} Hub prefix history requires its fixed entry rooms`);
  }
  return composeBiomeHistoryPrefix({
    routeKey: snapshot.routeKey,
    biomeKey: snapshot.biomeKey,
    initialCounters: {
      biomeDepthCache: layout.initialCounters.biomeDepthCache,
      biomeEncounterDepth: layout.initialCounters.biomeEncounterDepth,
      routeEncounterDepth: 1,
      roomHistoryOrdinal: 0,
      numSubRoomsSpawned: 0,
      soulPylonsSpawned: 0,
      soulPylonsCompleted: 0,
    },
    compose(writer) {
      appendStandaloneRoomCreated(writer, entry, 'biomeEntry');
      if (!entry.entered) {
        return;
      }
      let source = entry;
      for (const [targetIndex, nextEntry] of snapshot.entryRooms.slice(1).entries()) {
        const descriptor = layout.entries[targetIndex + 1];
        if (
          descriptor?.kind !== 'fixedAuthoredSlot' ||
          descriptor.roomGameName !== nextEntry.gameName
        ) {
          fail(`${snapshot.biomeKey} fixed Hub entry ${targetIndex + 2} does not match its layout`);
        }
        appendRoomLifecycle(writer, catalog, source, (outgoingWriter, parent) =>
          layoutEntryCreated(outgoingWriter, parent, nextEntry, descriptor.slotKey),
        );
        source = nextEntry;
        if (!source.entered) {
          return;
        }
      }
      if (snapshot.frontierEntry !== undefined) {
        appendRoomLifecycle(writer, catalog, source, undefined, true);
        return;
      }
      const hubRoom = snapshot.hubRoom;
      if (hubRoom === undefined) {
        fail(`${snapshot.biomeKey} Hub prefix ends after entries without a frontier`);
      }
      appendRoomLifecycle(writer, catalog, source, (outgoingWriter, parent) =>
        layoutEntryCreated(outgoingWriter, parent, hubRoom, 'hub'),
      );
      if (snapshot.hubBoard === undefined) {
        appendRoomLifecycle(writer, catalog, hubRoom, undefined, true);
        return;
      }
      appendRoomLifecycle(writer, catalog, hubRoom, boardProjection(snapshot.hubBoard));
      for (const visit of snapshot.visits) {
        composeVisit(writer, catalog, visit, hubRoom);
      }
      if (snapshot.frontierVisit !== undefined) {
        composeFrontierVisit(writer, catalog, snapshot.frontierVisit);
      }
    },
  });
}

function composeVisit(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  visit: CanonicalHubVisit,
  hubRoom: CanonicalHubRoom,
): void {
  appendRoomLifecycle(writer, catalog, visit.target.room, sideRoomProjection(visit));
  for (const [index, sideRoom] of visit.enteredLocalRooms.entries()) {
    if (!sideRoom.entered || sideRoom.generation !== 'generated') {
      fail(`visit ${visit.visitIndex} enters an unavailable local room`);
    }
    appendRoomLifecycle(writer, catalog, sideRoom);
    const restore = visit.parentRestores[index];
    if (
      restore === undefined ||
      semanticAddressKey(restore.after) !== semanticAddressKey(sideRoom.origin)
    ) {
      fail(`visit ${visit.visitIndex} has no ordered parent restore for ${sideRoom.slotKey}`);
    }
    appendRestore(writer, restore, visit.target.room, 'parent');
  }
  if (visit.parentRestores.length !== visit.enteredLocalRooms.length) {
    fail(`visit ${visit.visitIndex} parent restore count is inconsistent`);
  }
  if (semanticAddressKey(visit.hubRestore.after) !== semanticAddressKey(visit.origin)) {
    fail(`visit ${visit.visitIndex} Hub restore has the wrong visit owner`);
  }
  appendRestore(writer, visit.hubRestore, hubRoom, 'hub');
}

export function composeHubHistory(
  catalog: Catalog,
  snapshot: CanonicalHubBiome,
): CanonicalHubHistory {
  const layout = requireHubLayout(catalog, {
    routeKey: snapshot.routeKey,
    biomeKey: snapshot.biomeKey,
    hubRoom: snapshot.hubBoard.room,
  });
  const biome = createBiomeAddress(snapshot.routeKey, snapshot.biomeKey);
  const entry = snapshot.entryRooms[0];
  if (entry === undefined) {
    fail(`${snapshot.biomeKey} Hub history requires a canonical entry room`);
  }
  if (
    layout.terminal.roomGameName !== snapshot.terminalEntry.gameName ||
    layout.entries.length !== snapshot.entryRooms.length ||
    snapshot.visits.length !== layout.hub.requiredVisits
  ) {
    fail(`catalog cannot place complete ${snapshot.biomeKey} Hub history`);
  }
  return composeBiomeHistoryEnvelope({
    catalog,
    routeKey: snapshot.routeKey,
    biomeKey: snapshot.biomeKey,
    initialCounters: {
      biomeDepthCache: layout.initialCounters.biomeDepthCache,
      biomeEncounterDepth: layout.initialCounters.biomeEncounterDepth,
      routeEncounterDepth: 1,
      roomHistoryOrdinal: 0,
      numSubRoomsSpawned: 0,
      soulPylonsSpawned: 0,
      soulPylonsCompleted: 0,
    },
    completionRooms: snapshot.completionRooms,
    transitionEffects: layout.completion.transitionEffects,
    composeEntry(writer) {
      return composeFixedEntryChain(
        writer,
        snapshot.entryRooms,
        (targetWriter, source, nextEntry, targetIndex) => {
          const descriptor = layout.entries[targetIndex];
          if (
            descriptor?.kind !== 'fixedAuthoredSlot' ||
            descriptor.roomGameName !== nextEntry.gameName
          ) {
            fail(
              `${snapshot.biomeKey} fixed Hub entry ${targetIndex + 1} does not match its layout`,
            );
          }
          appendRoomLifecycle(targetWriter, catalog, source, (outgoingWriter, parent) =>
            layoutEntryCreated(outgoingWriter, parent, nextEntry, descriptor.slotKey),
          );
        },
        fail,
      );
    },
    composeBody(writer, source) {
      appendRoomLifecycle(writer, catalog, source, (outgoingWriter, parent) =>
        layoutEntryCreated(outgoingWriter, parent, snapshot.hubBoard.room, 'hub'),
      );
      appendRoomLifecycle(
        writer,
        catalog,
        snapshot.hubBoard.room,
        boardProjection(snapshot.hubBoard),
      );
      for (const visit of snapshot.visits) {
        composeVisit(writer, catalog, visit, snapshot.hubBoard.room);
      }
      return snapshot.hubBoard.room;
    },
    composeTerminal(writer, predecessor) {
      terminalCreated(writer, biome, predecessor, snapshot.terminalEntry, layout.terminal.slotKey);
      appendRoomLifecycle(writer, catalog, snapshot.terminalEntry);
      return snapshot.terminalEntry;
    },
    fail,
  });
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
