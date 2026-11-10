import { hubRerolledOwners } from '../../authored-project/rerolls';
import type { Catalog, HubDecisionDescriptor, RoomDeclaration } from '../../catalog-schema';
import { createDefaultRoomEncounterState } from '../../authored-project/room-state/encounter-envelope';
import { alwaysActiveEncounterSlotKeys, materializeEncounterPhases } from '../encounters/resolve';
import {
  createHubDecisionAddress,
  createHubFountainAddress,
  createHubRerollAddress,
  createHubOpenSetAddress,
  createHubRoomAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  type BiomeAddress,
} from '../../authored-project/addresses';
import type {
  BiomeTopology,
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
import { materializeAuthoredRoom } from './rooms/assemble';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import {
  firstRepeatedVisitIndex,
  hubFountainPrecedingVisitCount,
  hubVisitSlotKeys,
  visitsBeforeRepeat,
} from '../../authored-project/topology/query';

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

function requireOccurrence(topology: BiomeTopology, occurrenceId: OccurrenceId): RoomOccurrence {
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) fail(`trusted Hub topology lost occurrence ${occurrenceId}`);
  return occurrence;
}

function fixedEncounterPhases(catalog: Catalog, room: RoomDeclaration) {
  return materializeEncounterPhases(
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
    ...(room.unmodeledEncounterKeys === undefined
      ? {}
      : { unmodeledEncounterKeys: room.unmodeledEncounterKeys }),
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
  topology: BiomeTopology,
): CanonicalRoomReference {
  const occurrence = requireOccurrence(topology, decision.source.occurrenceId);
  return Object.freeze({
    origin: createOccurrenceAddress(biome, occurrence.occurrenceId),
    occurrenceId: occurrence.occurrenceId,
    gameName: occurrence.gameName,
  });
}

function materializeLocalSlots(
  catalog: Catalog,
  biome: BiomeAddress,
  routePosition: ResolvedRoutePosition,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  localDecision: LocalVisitDecision | undefined,
  topology: BiomeTopology,
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
  // Side rooms are entered only up to the first repeated entry.
  const reachedOrder = visitsBeforeRepeat(localDecision.visitOrder);
  return Object.freeze(
    descriptor.slots.map((slot): CanonicalLocalVisitRoom => {
      const target = localDecision.targetsBySlot[slot.slotKey];
      if (target === undefined) fail(`${room.gameName} is missing side room ${slot.slotKey}`);
      const authored = requireOccurrence(topology, target.occurrenceId);
      const sideRoom = requireRoom(catalog, slot.roomGameName);
      if (sideRoom.mode.kind !== 'authored' || sideRoom.mode.templateKey !== 'EphyraSideRoom') {
        fail(`${sideRoom.gameName} is not an Ephyra side room`);
      }
      const enteredOrdinal = reachedOrder.indexOf(authored.occurrenceId);
      const materialized = materializeAuthoredRoom({
        catalog,
        biome,
        topology,
        routePosition,
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
  routePosition: ResolvedRoutePosition,
  descriptor: HubDecisionDescriptor,
  decision: HubDecision,
  topology: BiomeTopology,
  room: CanonicalHubRoom,
  loadout: RouteWeaponAspectLoadout,
): CanonicalHubBoard {
  const bySlot = new Map(decision.openTargets.map((target) => [target.hubSlotKey, target]));
  const visited = new Set(hubVisitSlotKeys(decision));
  const rerolledOwners = hubRerolledOwners(biome, decision);
  return Object.freeze({
    origin: createHubOpenSetAddress(biome, descriptor.hubKey),
    room,
    targets: Object.freeze(
      descriptor.slots.flatMap((slot): readonly CanonicalHubTarget[] => {
        const target = bySlot.get(slot.slotKey);
        if (target === undefined) return [];
        const occurrence = requireOccurrence(topology, target.occurrenceId);
        const declaration = requireRoom(catalog, occurrence.gameName);
        return [
          Object.freeze({
            origin: createHubSlotAddress(biome, descriptor.hubKey, slot.slotKey),
            hubSlotKey: slot.slotKey,
            physicalDoorId: slot.physicalDoorId,
            offeredExitInsertionRank: slot.offeredExitInsertionRank,
            room: materializeAuthoredRoom({
              catalog,
              biome,
              topology,
              routePosition,
              room: declaration,
              occurrence,
              role: 'ordinary',
              entered: visited.has(slot.slotKey),
              lifecycleProfileKey: 'EphyraMainRoom',
              ...(loadout === undefined ? {} : { loadout }),
              rerolledOwners,
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
  routePosition: ResolvedRoutePosition,
  descriptor: HubDecisionDescriptor,
  decision: HubDecision,
  localDecisions: readonly LocalVisitDecision[],
  topology: BiomeTopology,
  board: CanonicalHubBoard,
  loadout: RouteWeaponAspectLoadout,
): readonly CanonicalHubVisit[] {
  const targets = new Map(board.targets.map((target) => [target.hubSlotKey, target]));
  return Object.freeze(
    hubVisitSlotKeys(decision).map((slotKey, index): CanonicalHubVisit => {
      const target = targets.get(slotKey);
      if (target === undefined) fail(`Hub visit ${index + 1} lost open slot ${slotKey}`);
      const occurrence = requireOccurrence(topology, target.room.occurrenceId);
      const declaration = requireRoom(catalog, occurrence.gameName);
      const localDecision = localDecisions.find(
        (candidate) => candidate.sourceOccurrenceId === occurrence.occurrenceId,
      );
      const localSlots = materializeLocalSlots(
        catalog,
        biome,
        routePosition,
        occurrence,
        declaration,
        localDecision,
        topology,
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
      const localRepeat =
        localDecision === undefined ? undefined : firstRepeatedVisitIndex(localDecision.visitOrder);
      const repeatedLocalVisit =
        localDecision === undefined || localRepeat === undefined
          ? undefined
          : Object.freeze({
              origin: createLocalVisitOrderAddress(
                biome,
                localDecision.sourceOccurrenceId,
                localDecision.groupKey,
              ),
              visitIndex: localRepeat + 1,
              occurrenceId: localDecision.visitOrder[localRepeat]!,
              firstVisitIndex:
                localDecision.visitOrder.indexOf(localDecision.visitOrder[localRepeat]!) + 1,
            });
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
        ...(repeatedLocalVisit === undefined ? {} : { repeatedLocalVisit }),
      });
    }),
  );
}

/** Index in the action order of the zero-based room visit. */
function hubVisitActionIndex(decision: HubDecision, visitIndex: number): number {
  let visits = -1;
  const index = decision.actions.findIndex(
    (action) => action.kind === 'roomVisit' && (visits += 1) === visitIndex,
  );
  if (index < 0) fail(`${decision.hubKey} has no room visit ${visitIndex + 1}`);
  return index;
}

export function materializeHubDecision(
  catalog: Catalog,
  biome: BiomeAddress,
  routePosition: ResolvedRoutePosition,
  descriptor: HubDecisionDescriptor,
  authored: HubDecision,
  localDecisions: readonly LocalVisitDecision[],
  topology: BiomeTopology,
  loadout: RouteWeaponAspectLoadout,
): CanonicalHubDecision {
  if (loadout.weaponKey?.length === 0 || loadout.aspectKey?.length === 0) {
    fail(`${descriptor.hubKey} Hub materialization requires a route loadout`);
  }
  if (authored.hubKey !== descriptor.hubKey) {
    fail(`Hub decision ${authored.hubKey} does not match ${descriptor.hubKey}`);
  }
  // The walk stops before the first visit repeating an earlier one; no action
  // from it on is reached.
  const storedVisits = hubVisitSlotKeys(authored);
  const repeat = firstRepeatedVisitIndex(storedVisits);
  const decision =
    repeat === undefined
      ? authored
      : Object.freeze({
          ...authored,
          actions: Object.freeze(authored.actions.slice(0, hubVisitActionIndex(authored, repeat))),
        });
  const repeatedVisit =
    repeat === undefined
      ? undefined
      : Object.freeze({
          origin: createHubVisitAddress(biome, descriptor.hubKey, repeat + 1),
          hubSlotKey: storedVisits[repeat]!,
          firstVisitIndex: storedVisits.indexOf(storedVisits[repeat]!) + 1,
        });
  const room = materializeHubRoom(catalog, biome, descriptor);
  const board = materializeBoard(
    catalog,
    biome,
    routePosition,
    descriptor,
    decision,
    topology,
    room,
    loadout,
  );
  const precedingVisitCount = hubFountainPrecedingVisitCount(decision);
  const rerolls = Object.freeze(
    decision.actions.flatMap((action, index) => {
      if (action.kind !== 'reroll') return [];
      const before = decision.actions.slice(0, index);
      const visited = before.flatMap((earlier) =>
        earlier.kind === 'roomVisit' ? [earlier.hubSlotKey] : [],
      );
      return [
        Object.freeze({
          origin: createHubRerollAddress(biome, descriptor.hubKey, action.rerollId),
          hubSlotKey: action.hubSlotKey,
          reward: action.reward,
          precedingVisitCount: visited.length,
          afterFountain: before.some((earlier) => earlier.kind === 'useFountain'),
          slotEntered: visited.includes(action.hubSlotKey),
        }),
      ];
    }),
  );
  return Object.freeze({
    kind: 'hub',
    origin: createHubDecisionAddress(biome, descriptor.hubKey),
    source: hubSourceReference(biome, decision, topology),
    room,
    board,
    rerolls,
    ...(precedingVisitCount === undefined
      ? {}
      : {
          fountain: Object.freeze({
            origin: createHubFountainAddress(biome, descriptor.hubKey),
            precedingVisitCount,
            ...(decision.fountainRarityResult === undefined
              ? {}
              : { fountainRarityResult: decision.fountainRarityResult }),
          }),
        }),
    visits: materializeVisits(
      catalog,
      biome,
      routePosition,
      descriptor,
      decision,
      localDecisions,
      topology,
      board,
      loadout,
    ),
    ...(repeatedVisit === undefined ? {} : { repeatedVisit }),
  });
}
