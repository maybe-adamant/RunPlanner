import type {
  Catalog,
  HubDecisionDescriptor,
  LocalChildDescriptor,
  RoomDeclaration,
} from '../../catalog-schema';
import { createDefaultRoomEncounterState } from '../../authored-project/room-state/encounters';
import { alwaysActiveEncounterSlotKeys, resolveEncounterPhases } from '../encounters';
import {
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubRoomAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  type BiomeAddress,
} from '../../authored-project/addresses';
import type {
  EphyraCombatState,
  EphyraSideRoomState,
  HubDecision,
  OccurrenceId,
  RoomOccurrence,
  RouteWeaponAspectLoadout,
} from '../../authored-project/model';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubBoard,
  CanonicalHubDecision,
  CanonicalHubRoom,
  CanonicalHubRoomReference,
  CanonicalHubTarget,
  CanonicalHubVisit,
  CanonicalLocalChildRoom,
  CanonicalResolvedIncomingReward,
  CanonicalRoomReference,
} from './model';
import { materializeAuthoredRoom } from './rooms';

type FixedRoomSlotDescriptor = Extract<
  LocalChildDescriptor,
  { readonly kind: 'fixedRoomSlots' }
>['slots'][number];

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

function requireCountedBinding(room: RoomDeclaration): CountedRewardBinding {
  if (room.incomingReward.kind !== 'countedChoice') {
    fail(`${room.gameName} requires a counted reward binding`);
  }
  return room.incomingReward;
}

function localIncomingReward(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId,
  groupKey: string,
  slot: FixedRoomSlotDescriptor,
  room: RoomDeclaration,
  state: EphyraSideRoomState,
  loadout?: RouteWeaponAspectLoadout,
): CanonicalResolvedIncomingReward {
  if (loadout === undefined || loadout.weaponKey.length === 0 || loadout.aspectKey.length === 0) {
    fail(`${room.gameName} side-room materialization requires a route loadout`);
  }
  const binding = requireCountedBinding(room);
  const resolvedStoreKey = room.forcedRewardStoreKey ?? room.individualRewardStoreKey;
  if (resolvedStoreKey === undefined) fail(`${room.gameName} has no resolved side-room store`);
  return Object.freeze({
    origin: createLocalRewardAddress(biome, parentOccurrenceId, groupKey, slot.slotKey),
    kind: 'resolved',
    producerKind: 'countedChoice',
    instanceProvenance: 'free',
    producerLifecycleKey: binding.producerLifecycleKey,
    offer: state.reward.offer,
    traitOffersByAcquisitionRole: state.reward.traitOffersByAcquisitionRole,
    levelResolutionsByAcquisitionRole: state.reward.levelResolutionsByAcquisitionRole,
    dispositionByAcquisitionRole: state.reward.dispositionByAcquisitionRole,
    traitContext: Object.freeze({
      ...loadout,
      blockGiftBoons: room.blockGiftBoons,
      devotionNoDuo: state.reward.offer.rewardType === 'Devotion',
    }),
    resolvedStoreKey,
  });
}

function materializeLocalSlots(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  loadout?: RouteWeaponAspectLoadout,
): readonly CanonicalLocalChildRoom[] {
  const descriptor = room.localChildren[0];
  if (descriptor === undefined) return Object.freeze([]);
  if (
    room.localChildren.length !== 1 ||
    descriptor.kind !== 'fixedRoomSlots' ||
    occurrence.state.kind !== 'ephyraCombat'
  ) {
    fail(`${room.gameName} has no materializable fixed side-room group`);
  }
  const state: EphyraCombatState = occurrence.state;
  return Object.freeze(
    descriptor.slots.map((slot): CanonicalLocalChildRoom => {
      const authored = state.sideRooms[slot.slotKey];
      if (authored === undefined) fail(`${room.gameName} is missing side room ${slot.slotKey}`);
      const sideRoom = requireRoom(catalog, slot.roomGameName);
      if (sideRoom.mode.kind !== 'authored' || sideRoom.mode.templateKey !== 'EphyraSideRoom') {
        fail(`${sideRoom.gameName} is not an Ephyra side room`);
      }
      const incomingReward =
        authored.generation === 'generated'
          ? localIncomingReward(
              biome,
              occurrence.occurrenceId,
              descriptor.key,
              slot,
              sideRoom,
              authored,
              loadout,
            )
          : undefined;
      if (incomingReward !== undefined) {
        requireLifecycle(catalog, sideRoom, 'EphyraSideRoom', incomingReward);
      }
      return Object.freeze({
        kind: 'localChild',
        origin: createLocalChildAddress(
          biome,
          occurrence.occurrenceId,
          descriptor.key,
          slot.slotKey,
        ),
        groupKey: descriptor.key,
        slotKey: slot.slotKey,
        gameName: sideRoom.gameName,
        physicalDoorId: slot.physicalDoorId,
        availabilityRank: slot.availabilityRank,
        generation: authored.generation,
        enteredOrdinal: authored.enteredOrdinal,
        encounters: authored.encounters,
        encounterEnvelopeKey: sideRoom.encounterEnvelopeKey,
        encounterPhases: resolveEncounterPhases(
          catalog,
          sideRoom,
          authored.encounters,
          alwaysActiveEncounterSlotKeys(catalog, sideRoom, sideRoom.gameName),
          sideRoom.gameName,
        ),
        lifecycleProfileKey: 'EphyraSideRoom',
        counterEffects: sideRoom.counters,
        entered: authored.enteredOrdinal !== null,
        ...(incomingReward === undefined ? {} : { incomingReward }),
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
  loadout?: RouteWeaponAspectLoadout,
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
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  board: CanonicalHubBoard,
  loadout?: RouteWeaponAspectLoadout,
): readonly CanonicalHubVisit[] {
  const targets = new Map(board.targets.map((target) => [target.hubSlotKey, target]));
  return Object.freeze(
    decision.visitOrder.map((slotKey, index): CanonicalHubVisit => {
      const target = targets.get(slotKey);
      if (target === undefined) fail(`Hub visit ${index + 1} lost open slot ${slotKey}`);
      const occurrence = requireOccurrence(occurrences, target.room.occurrenceId);
      const declaration = requireRoom(catalog, occurrence.gameName);
      const localSlots = materializeLocalSlots(catalog, biome, occurrence, declaration, loadout);
      const enteredLocalRooms = Object.freeze(
        localSlots
          .filter((local) => local.enteredOrdinal !== null)
          .sort(
            (left, right) => (left.enteredOrdinal as number) - (right.enteredOrdinal as number),
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
            Object.freeze({ kind: 'restore' as const, after: local.origin, room: parent }),
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
    visits: materializeVisits(catalog, biome, descriptor, decision, occurrences, board, loadout),
  });
}
