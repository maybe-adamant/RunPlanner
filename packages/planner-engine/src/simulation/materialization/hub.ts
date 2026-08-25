import type { Catalog, HubDecisionDescriptor, RoomDeclaration } from '../../catalog-schema';
import { createDefaultRoomEncounterState } from '../../authored-project/room-state/encounter-envelope';
import { alwaysActiveEncounterSlotKeys, resolveEncounterPhases } from '../encounters';
import {
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubRoomAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  type BiomeAddress,
} from '../../authored-project/addresses';
import type {
  HubDecision,
  LocalVisitDecision,
  OccurrenceId,
  RoomOccurrence,
  RouteWeaponAspectLoadout,
} from '../../authored-project/model';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubBoard,
  CanonicalHubDecision,
  CanonicalHubRoom,
  CanonicalHubRoomReference,
  CanonicalHubTarget,
  CanonicalHubVisit,
  CanonicalLocalVisitRoom,
  CanonicalResolvedIncomingReward,
  CanonicalRoomReference,
} from './model';
import { materializeAuthoredRoom } from './rooms';

export class HubMaterializationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HubMaterializationContractError';
  }
}

function fail(detail: string): never {
  throw new HubMaterializationContractError(detail);
}

function requireRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) fail(`trusted Hub topology lost room ${gameName}`);
  return room;
}

function requireOccurrence(
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrences.get(occurrenceId);
  if (occurrence === undefined) fail(`trusted Hub topology lost occurrence ${occurrenceId}`);
  return occurrence;
}

function fixedEncounterPhases(catalog: Catalog, room: RoomDeclaration) {
  return resolveEncounterPhases(
    catalog,
    room,
    createDefaultRoomEncounterState(catalog, room, `${room.gameName}.encounters`),
    alwaysActiveEncounterSlotKeys(catalog, room, room.gameName),
    room.gameName,
  );
}

function requireLifecycle(
  catalog: Catalog,
  room: RoomDeclaration,
  lifecycleProfileKey: string,
  incomingReward: CanonicalResolvedIncomingReward | undefined,
): void {
  const lifecycle = catalog.roomLifecycleProfiles.byKey[lifecycleProfileKey];
  if (
    lifecycle === undefined ||
    !lifecycle.encounterEnvelopeKeys.includes(room.encounterEnvelopeKey)
  ) {
    fail(`${room.gameName} cannot use lifecycle ${lifecycleProfileKey}`);
  }
  if (incomingReward === undefined) {
    if (lifecycle.producer.kind !== 'none') fail(`${room.gameName} lifecycle requires a producer`);
    return;
  }
  if (
    lifecycle.producer.kind !== 'required' ||
    !lifecycle.producer.lifecycleProfileKeys.includes(incomingReward.producerLifecycleKey)
  ) {
    fail(`${room.gameName} producer is incompatible with ${lifecycleProfileKey}`);
  }
}

function materializeHubRoom(
  catalog: Catalog,
  biome: BiomeAddress,
  descriptor: HubDecisionDescriptor,
): CanonicalHubRoom {
  const room = requireRoom(catalog, descriptor.terminal.roomGameName);
  if (
    room.mode.kind !== 'derived' ||
    room.mode.classification !== 'hub' ||
    room.incomingReward.kind !== 'none'
  ) {
    fail(`${room.gameName} is not a derived, reward-free Hub room`);
  }
  requireLifecycle(catalog, room, 'EphyraHubRoom', undefined);
  return Object.freeze({
    kind: 'hub',
    origin: createHubRoomAddress(biome, descriptor.hubKey),
    gameName: room.gameName,
    encounterEnvelopeKey: room.encounterEnvelopeKey,
    encounterPhases: fixedEncounterPhases(catalog, room),
    lifecycleProfileKey: 'EphyraHubRoom',
    counterEffects: room.counters,
    entered: true,
  });
}

function hubRoomReference(room: CanonicalHubRoom): CanonicalHubRoomReference {
  return Object.freeze({ origin: room.origin, gameName: room.gameName });
}

function authoredRoomReference(room: CanonicalAuthoredRoom): CanonicalRoomReference {
  return Object.freeze({
    origin: room.origin,
    occurrenceId: room.occurrenceId,
    gameName: room.gameName,
  });
}

function hubSourceReference(
  biome: BiomeAddress,
  decision: HubDecision,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
): CanonicalRoomReference {
  const occurrence = requireOccurrence(occurrences, decision.source.occurrenceId);
  return Object.freeze({
    origin: createOccurrenceAddress(biome, occurrence.occurrenceId),
    occurrenceId: occurrence.occurrenceId,
    gameName: occurrence.gameName,
  });
}

function materializeLocalSlots(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  localDecision: LocalVisitDecision | undefined,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  loadout: RouteWeaponAspectLoadout,
): readonly CanonicalLocalVisitRoom[] {
  const descriptor = room.localChildren[0];
  if (descriptor === undefined) return Object.freeze([]);
  if (
    room.localChildren.length !== 1 ||
    descriptor.kind !== 'fixedRoomSlots' ||
    localDecision?.sourceOccurrenceId !== occurrence.occurrenceId ||
    localDecision.groupKey !== descriptor.key
  ) {
    fail(`${room.gameName} has no materializable fixed side-room group`);
  }
  return Object.freeze(
    descriptor.slots.map((slot): CanonicalLocalVisitRoom => {
      const target = localDecision.targetsBySlot[slot.slotKey];
      if (target === undefined) fail(`${room.gameName} is missing side room ${slot.slotKey}`);
      const authored = requireOccurrence(occurrences, target.occurrenceId);
      const sideRoom = requireRoom(catalog, slot.roomGameName);
      if (sideRoom.mode.kind !== 'authored' || sideRoom.mode.templateKey !== 'EphyraSideRoom') {
        fail(`${sideRoom.gameName} is not an Ephyra side room`);
      }
      const enteredOrdinal = localDecision.visitOrder.indexOf(authored.occurrenceId);
      const materialized = materializeAuthoredRoom({
        catalog,
        biome,
        room: sideRoom,
        occurrence: authored,
        role: 'ordinary',
        entered: enteredOrdinal >= 0,
        lifecycleProfileKey: 'EphyraSideRoom',
        loadout,
      });
      return Object.freeze({
        ...materialized,
        localVisit: Object.freeze({
          origin: createLocalVisitSlotAddress(
            biome,
            occurrence.occurrenceId,
            descriptor.key,
            slot.slotKey,
          ),
          groupKey: descriptor.key,
          slotKey: slot.slotKey,
          physicalDoorId: slot.physicalDoorId,
          availabilityRank: slot.availabilityRank,
          generation: target.generation,
          enteredOrdinal: enteredOrdinal < 0 ? null : enteredOrdinal + 1,
        }),
      });
    }),
  );
}

function materializeBoard(
  catalog: Catalog,
  biome: BiomeAddress,
  descriptor: HubDecisionDescriptor,
  decision: HubDecision,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  room: CanonicalHubRoom,
  loadout: RouteWeaponAspectLoadout,
): CanonicalHubBoard {
  const bySlot = new Map(decision.openTargets.map((target) => [target.hubSlotKey, target]));
  const visited = new Set(decision.visitOrder);
  return Object.freeze({
    origin: createHubOpenSetAddress(biome, descriptor.hubKey),
    room,
    targets: Object.freeze(
      descriptor.slots.flatMap((slot): readonly CanonicalHubTarget[] => {
        const target = bySlot.get(slot.slotKey);
        if (target === undefined) return [];
        const occurrence = requireOccurrence(occurrences, target.occurrenceId);
        const declaration = requireRoom(catalog, occurrence.gameName);
        return [
          Object.freeze({
            origin: createHubSlotAddress(biome, descriptor.hubKey, slot.slotKey),
            hubSlotKey: slot.slotKey,
            physicalDoorId: slot.physicalDoorId,
            room: materializeAuthoredRoom({
              catalog,
              biome,
              room: declaration,
              occurrence,
              role: 'ordinary',
              entered: visited.has(slot.slotKey),
              lifecycleProfileKey: 'EphyraMainRoom',
              ...(loadout === undefined ? {} : { loadout }),
            }),
          }),
        ];
      }),
    ),
  });
}

function materializeVisits(
  catalog: Catalog,
  biome: BiomeAddress,
  descriptor: HubDecisionDescriptor,
  decision: HubDecision,
  localDecisions: readonly LocalVisitDecision[],
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  board: CanonicalHubBoard,
  loadout: RouteWeaponAspectLoadout,
): readonly CanonicalHubVisit[] {
  const targets = new Map(board.targets.map((target) => [target.hubSlotKey, target]));
  return Object.freeze(
    decision.visitOrder.map((slotKey, index): CanonicalHubVisit => {
      const target = targets.get(slotKey);
      if (target === undefined) fail(`Hub visit ${index + 1} lost open slot ${slotKey}`);
      const occurrence = requireOccurrence(occurrences, target.room.occurrenceId);
      const declaration = requireRoom(catalog, occurrence.gameName);
      const localDecision = localDecisions.find(
        (candidate) => candidate.sourceOccurrenceId === occurrence.occurrenceId,
      );
      const localSlots = materializeLocalSlots(
        catalog,
        biome,
        occurrence,
        declaration,
        localDecision,
        occurrences,
        loadout,
      );
      const enteredLocalRooms = Object.freeze(
        localSlots
          .filter((local) => local.localVisit.enteredOrdinal !== null)
          .sort(
            (left, right) =>
              (left.localVisit.enteredOrdinal as number) -
              (right.localVisit.enteredOrdinal as number),
          ),
      );
      const origin = createHubVisitAddress(biome, descriptor.hubKey, index + 1);
      const parent = authoredRoomReference(target.room);
      return Object.freeze({
        origin,
        visitIndex: index + 1,
        target,
        localSlots,
        enteredLocalRooms,
        parentRestores: Object.freeze(
          enteredLocalRooms.map((local) =>
            Object.freeze({
              kind: 'restore' as const,
              after: local.localVisit.origin,
              room: parent,
            }),
          ),
        ),
        hubRestore: Object.freeze({
          kind: 'restore',
          after: origin,
          room: hubRoomReference(board.room),
        }),
      });
    }),
  );
}

export function materializeHubDecision(
  catalog: Catalog,
  biome: BiomeAddress,
  descriptor: HubDecisionDescriptor,
  decision: HubDecision,
  localDecisions: readonly LocalVisitDecision[],
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  loadout: RouteWeaponAspectLoadout,
): CanonicalHubDecision {
  if (loadout.weaponKey.length === 0 || loadout.aspectKey.length === 0) {
    fail(`${descriptor.hubKey} Hub materialization requires a route loadout`);
  }
  if (decision.hubKey !== descriptor.hubKey) {
    fail(`Hub decision ${decision.hubKey} does not match ${descriptor.hubKey}`);
  }
  const room = materializeHubRoom(catalog, biome, descriptor);
  const board = materializeBoard(catalog, biome, descriptor, decision, occurrences, room, loadout);
  return Object.freeze({
    kind: 'hub',
    origin: createHubDecisionAddress(biome, descriptor.hubKey),
    source: hubSourceReference(biome, decision, occurrences),
    room,
    board,
    visits: materializeVisits(
      catalog,
      biome,
      descriptor,
      decision,
      localDecisions,
      occurrences,
      board,
      loadout,
    ),
  });
}
