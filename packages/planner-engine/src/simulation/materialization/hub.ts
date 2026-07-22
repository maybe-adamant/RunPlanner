import type {
  Catalog,
  FixedAuthoredSlotDescriptor,
  HubBiomeLayout,
  LocalChildDescriptor,
  RoomDeclaration,
} from '../../catalog-schema';
import {
  createHubOpenSetAddress,
  createHubRoomAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  type BiomeAddress,
} from '../../authored-project/addresses';
import type {
  EphyraCombatState,
  EphyraSideRoomState,
  HubBiomeTopology,
  OccurrenceId,
  RoomOccurrence,
  ShopState,
} from '../../authored-project/model';
import type { CountedRewardBinding, ShopRewardBinding } from '../../reward-kernel/bindings';
import type { CompleteHubCompletenessResult } from '../completeness';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubBiome,
  CanonicalHubBoard,
  CanonicalHubRoom,
  CanonicalHubRoomReference,
  CanonicalHubTarget,
  CanonicalHubVisit,
  CanonicalLocalChildRoom,
  CanonicalResolvedIncomingReward,
  CanonicalRoomRestore,
  CanonicalShopEntryState,
} from './model';
import { materializeCompletionRooms } from './completion';

type FixedRoomState = 'counted' | 'shop';
type FixedRoomDescriptor = FixedAuthoredSlotDescriptor & {
  readonly state: FixedRoomState;
};
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

function encounterPhases(catalog: Catalog, room: RoomDeclaration) {
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} references unknown encounter profile ${room.encounterProfileKey}`);
  }
  return profile.phases;
}

function requireRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    fail(`trusted Hub topology lost room ${gameName}`);
  }
  return room;
}

function requireOccurrence(
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrences.get(occurrenceId);
  if (occurrence === undefined) {
    fail(`trusted Hub topology lost occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function requireCountedBinding(room: RoomDeclaration): CountedRewardBinding {
  if (room.incomingReward.kind !== 'countedChoice') {
    fail(`${room.gameName} requires a counted reward binding`);
  }
  return room.incomingReward;
}

function requireShopBinding(room: RoomDeclaration): ShopRewardBinding {
  if (room.incomingReward.kind !== 'shop') {
    fail(`${room.gameName} requires a shop reward binding`);
  }
  return room.incomingReward;
}

function requireLifecycleSelection(
  catalog: Catalog,
  room: RoomDeclaration,
  lifecycleProfileKey: string,
  producer: CanonicalResolvedIncomingReward | undefined,
): void {
  const profile = catalog.roomLifecycleProfiles.byKey[lifecycleProfileKey];
  if (profile === undefined || !profile.encounterProfileKeys.includes(room.encounterProfileKey)) {
    fail(`${room.gameName} cannot use lifecycle ${lifecycleProfileKey}`);
  }
  if (producer === undefined) {
    if (profile.producer.kind !== 'none') {
      fail(`${room.gameName} lifecycle ${lifecycleProfileKey} requires a producer`);
    }
    return;
  }
  if (
    profile.producer.kind !== 'required' ||
    !profile.producer.lifecycleProfileKeys.includes(producer.producerLifecycleKey)
  ) {
    fail(
      `${room.gameName} producer ${producer.producerLifecycleKey} is incompatible with ${lifecycleProfileKey}`,
    );
  }
}

function countedIncomingReward(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
): CanonicalResolvedIncomingReward {
  const binding = requireCountedBinding(room);
  const state = occurrence.state;
  const offer =
    state.kind === 'counted'
      ? state.offer
      : state.kind === 'ephyraCombat'
        ? state.offer
        : fail(`${room.gameName} expected counted or Ephyra state, received ${state.kind}`);
  const resolvedStoreKey = room.forcedRewardStoreKey ?? room.individualRewardStoreKey;
  if (resolvedStoreKey === undefined) {
    fail(`${room.gameName} has no resolved counted reward store`);
  }
  return Object.freeze({
    origin: createIncomingRewardAddress(biome, occurrence.occurrenceId),
    kind: 'resolved',
    producerKind: 'countedChoice',
    producerLifecycleKey: binding.producerLifecycleKey,
    offer,
    resolvedStoreKey,
  });
}

function fixedIncomingReward(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
): CanonicalResolvedIncomingReward {
  const binding = room.incomingReward;
  if (binding.kind !== 'fixed' || occurrence.state.kind !== 'fixed') {
    fail(`${room.gameName} requires a fixed reward binding and state`);
  }
  const payload = occurrence.state.payload ?? binding.offer.payload;
  return Object.freeze({
    origin: createIncomingRewardAddress(biome, occurrence.occurrenceId),
    kind: 'resolved',
    producerKind: 'fixed',
    producerLifecycleKey: binding.producerLifecycleKey,
    offer: Object.freeze({
      rewardType: binding.offer.rewardType,
      ...(payload === undefined ? {} : { payload }),
    }),
  });
}

function shopEntryState(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  shop: ShopState,
): CanonicalShopEntryState {
  const profile = catalog.rewards.shops.byKey[shop.profileKey];
  if (profile === undefined) {
    fail(`${room.gameName} references unknown shop profile ${shop.profileKey}`);
  }
  return Object.freeze({
    kind: 'shop',
    profileKey: profile.key,
    offers: Object.freeze(
      profile.slots.values.map((slot) => {
        const authored = shop.offers[slot.key];
        if (authored === undefined) {
          fail(`${room.gameName} shop is missing offer ${slot.key}`);
        }
        return Object.freeze({
          offerKey: slot.key,
          offerOrigin: createShopOfferAddress(biome, occurrence.occurrenceId, slot.key),
          purchaseOrigin: createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key),
          offer: authored.offer,
          purchased: authored.purchased,
        });
      }),
    ),
  });
}

function shopIncomingReward(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
): CanonicalResolvedIncomingReward {
  const binding = requireShopBinding(room);
  return Object.freeze({
    origin: createIncomingRewardAddress(biome, occurrence.occurrenceId),
    kind: 'resolved',
    producerKind: 'shop',
    producerLifecycleKey: binding.producerLifecycleKey,
    offer: binding.offer,
  });
}

function materializeAuthoredRoom(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  entered: boolean,
  expectedState: FixedRoomState | 'hubTarget',
): CanonicalAuthoredRoom {
  if (room.mode.kind !== 'authored') {
    fail(`${room.gameName} is not an authored Hub room`);
  }

  let lifecycleProfileKey: string;
  let incomingReward: CanonicalResolvedIncomingReward;
  let entryState: CanonicalShopEntryState | undefined;
  if (expectedState === 'shop') {
    if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
      fail(`${room.gameName} fixed terminal has no complete shop state`);
    }
    lifecycleProfileKey = 'TerminalWorldShopRoom';
    incomingReward = shopIncomingReward(biome, occurrence, room);
    entryState = shopEntryState(catalog, biome, occurrence, room, occurrence.state.shop);
  } else {
    if (
      expectedState === 'counted' &&
      occurrence.state.kind !== 'counted' &&
      occurrence.state.kind !== 'ephyraCombat'
    ) {
      fail(`${room.gameName} fixed entry has no counted state`);
    }
    lifecycleProfileKey =
      expectedState === 'hubTarget'
        ? 'EphyraMainRoom'
        : room.encounterProfileKey === 'N_Opening'
          ? 'EphyraOpeningRoom'
          : 'StandardRewardRoom';
    incomingReward =
      expectedState === 'hubTarget' && occurrence.state.kind === 'fixed'
        ? fixedIncomingReward(biome, occurrence, room)
        : countedIncomingReward(biome, occurrence, room);
  }
  requireLifecycleSelection(catalog, room, lifecycleProfileKey, incomingReward);

  return Object.freeze({
    kind: 'authored',
    origin: createOccurrenceAddress(biome, occurrence.occurrenceId),
    occurrenceId: occurrence.occurrenceId,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    encounterPhases: encounterPhases(catalog, room),
    lifecycleProfileKey,
    counterEffects: room.counters,
    entered,
    ...(room.requiredObjects === undefined ? {} : { requiredObjects: room.requiredObjects }),
    incomingReward,
    ...(entryState === undefined ? {} : { entryState }),
  });
}

function materializeHubRoom(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: HubBiomeLayout,
): CanonicalHubRoom {
  const room = requireRoom(catalog, layout.hub.roomGameName);
  if (
    room.mode.kind !== 'derived' ||
    room.mode.classification !== 'hub' ||
    room.incomingReward.kind !== 'none'
  ) {
    fail(`${room.gameName} is not a derived reward-free Hub room`);
  }
  requireLifecycleSelection(catalog, room, 'EphyraHubRoom', undefined);
  return Object.freeze({
    kind: 'hub',
    origin: createHubRoomAddress(biome),
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    encounterPhases: encounterPhases(catalog, room),
    lifecycleProfileKey: 'EphyraHubRoom',
    counterEffects: room.counters,
    entered: true,
  });
}

function authoredRoomReference(room: CanonicalAuthoredRoom): CanonicalHubRoomReference {
  return Object.freeze({
    origin: room.origin,
    occurrenceId: room.occurrenceId,
    gameName: room.gameName,
  });
}

function hubRoomReference(room: CanonicalHubRoom): CanonicalHubRoomReference {
  return Object.freeze({ origin: room.origin, gameName: room.gameName });
}

function localIncomingReward(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId,
  groupKey: string,
  slot: FixedRoomSlotDescriptor,
  room: RoomDeclaration,
  state: EphyraSideRoomState,
): CanonicalResolvedIncomingReward {
  const binding = requireCountedBinding(room);
  const resolvedStoreKey = room.forcedRewardStoreKey ?? room.individualRewardStoreKey;
  if (resolvedStoreKey === undefined) {
    fail(`${room.gameName} has no resolved side-room store`);
  }
  return Object.freeze({
    origin: createLocalRewardAddress(biome, parentOccurrenceId, groupKey, slot.slotKey),
    kind: 'resolved',
    producerKind: 'countedChoice',
    producerLifecycleKey: binding.producerLifecycleKey,
    offer: state.offer,
    resolvedStoreKey,
  });
}

function materializeLocalSlots(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
): readonly CanonicalLocalChildRoom[] {
  const descriptor = room.localChildren[0];
  if (descriptor === undefined) {
    return Object.freeze([]);
  }
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
      if (authored === undefined) {
        fail(`${room.gameName} is missing side-room state ${slot.slotKey}`);
      }
      const sideRoom = requireRoom(catalog, slot.roomGameName);
      if (sideRoom.mode.kind !== 'authored' || sideRoom.mode.templateKey !== 'EphyraSideRoom') {
        fail(`${sideRoom.gameName} is not an authored Ephyra side room`);
      }
      const origin = createLocalChildAddress(
        biome,
        occurrence.occurrenceId,
        descriptor.key,
        slot.slotKey,
      );
      const incomingReward =
        authored.generation === 'generated'
          ? localIncomingReward(
              biome,
              occurrence.occurrenceId,
              descriptor.key,
              slot,
              sideRoom,
              authored,
            )
          : undefined;
      if (incomingReward !== undefined) {
        requireLifecycleSelection(catalog, sideRoom, 'EphyraSideRoom', incomingReward);
      }
      return Object.freeze({
        kind: 'localChild',
        origin,
        groupKey: descriptor.key,
        slotKey: slot.slotKey,
        gameName: sideRoom.gameName,
        physicalDoorId: slot.physicalDoorId,
        availabilityRank: slot.availabilityRank,
        generation: authored.generation,
        enteredOrdinal: authored.enteredOrdinal,
        encounterProfileKey: sideRoom.encounterProfileKey,
        encounterPhases: encounterPhases(catalog, sideRoom),
        lifecycleProfileKey: 'EphyraSideRoom',
        counterEffects: sideRoom.counters,
        entered: authored.enteredOrdinal !== null,
        ...(incomingReward === undefined ? {} : { incomingReward }),
      });
    }),
  );
}

function fixedDescriptors(layout: HubBiomeLayout): readonly FixedRoomDescriptor[] {
  if (
    layout.entries.some((entry) => entry.kind !== 'fixedAuthoredSlot') ||
    layout.terminal.kind !== 'fixedAuthoredSlot'
  ) {
    fail(`${layout.biomeKey} has no supported fixed Hub boundary`);
  }
  return Object.freeze([
    ...(layout.entries as readonly FixedAuthoredSlotDescriptor[]).map((descriptor) => ({
      ...descriptor,
      state: 'counted' as const,
    })),
    { ...layout.terminal, state: 'shop' as const },
  ]);
}

function requireHubLayout(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteHubCompletenessResult,
): HubBiomeLayout {
  if ((completeness as { readonly completion?: unknown }).completion !== 'complete') {
    fail('Hub materialization requires a complete biome result');
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (
    layout?.kind !== 'HubBiome' ||
    layout.hub.rewardStorePolicy.kind !== 'none' ||
    layout.fields.length !== 0 ||
    layout.hub.fields.length !== 0
  ) {
    fail(`catalog ${biome.biomeKey} layout is not supported by the canonical Hub materializer`);
  }
  fixedDescriptors(layout);
  return layout;
}

function fixedOccurrence(
  topology: HubBiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  descriptor: FixedRoomDescriptor,
): RoomOccurrence {
  const reference = topology.fixedRooms.find(
    (candidate) => candidate.fixedSlotKey === descriptor.slotKey,
  );
  if (reference === undefined) {
    fail(`trusted Hub topology lost fixed slot ${descriptor.slotKey}`);
  }
  return requireOccurrence(occurrences, reference.occurrenceId);
}

function materializeBoard(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: HubBiomeLayout,
  topology: HubBiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  hubRoom: CanonicalHubRoom,
): CanonicalHubBoard {
  const visitSet = new Set(topology.visitOrder);
  const slotByKey = new Map(layout.hub.slots.map((slot) => [slot.slotKey, slot]));
  return Object.freeze({
    origin: createHubOpenSetAddress(biome),
    room: hubRoom,
    targets: Object.freeze(
      topology.openTargets.map((target): CanonicalHubTarget => {
        const slot = slotByKey.get(target.hubSlotKey);
        if (slot === undefined) {
          fail(`trusted Hub topology lost slot ${target.hubSlotKey}`);
        }
        const occurrence = requireOccurrence(occurrences, target.occurrenceId);
        const room = requireRoom(catalog, occurrence.gameName);
        return Object.freeze({
          origin: createHubSlotAddress(biome, slot.slotKey),
          hubSlotKey: slot.slotKey,
          physicalDoorId: slot.physicalDoorId,
          room: materializeAuthoredRoom(
            catalog,
            biome,
            occurrence,
            room,
            visitSet.has(slot.slotKey),
            'hubTarget',
          ),
        });
      }),
    ),
  });
}

function materializeVisits(
  catalog: Catalog,
  biome: BiomeAddress,
  topology: HubBiomeTopology,
  board: CanonicalHubBoard,
): readonly CanonicalHubVisit[] {
  const targetBySlot = new Map(board.targets.map((target) => [target.hubSlotKey, target]));
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  return Object.freeze(
    topology.visitOrder.map((hubSlotKey, index): CanonicalHubVisit => {
      const visitIndex = index + 1;
      const origin = createHubVisitAddress(biome, visitIndex);
      const target = targetBySlot.get(hubSlotKey);
      if (target === undefined) {
        fail(`trusted Hub visit ${visitIndex} lost open slot ${hubSlotKey}`);
      }
      const occurrence = requireOccurrence(occurrences, target.room.occurrenceId);
      const room = requireRoom(catalog, occurrence.gameName);
      const localSlots = materializeLocalSlots(catalog, biome, occurrence, room);
      const enteredLocalRooms = Object.freeze(
        localSlots
          .filter((localRoom) => localRoom.enteredOrdinal !== null)
          .sort(
            (left, right) => (left.enteredOrdinal as number) - (right.enteredOrdinal as number),
          ),
      );
      const parentReference = authoredRoomReference(target.room);
      const parentRestores = Object.freeze(
        enteredLocalRooms.map((localRoom): CanonicalRoomRestore =>
          Object.freeze({ kind: 'restore', after: localRoom.origin, room: parentReference }),
        ),
      );
      return Object.freeze({
        origin,
        visitIndex,
        target,
        localSlots,
        enteredLocalRooms,
        parentRestores,
        hubRestore: Object.freeze({
          kind: 'restore',
          after: origin,
          room: hubRoomReference(board.room),
        }),
      });
    }),
  );
}

export function materializeHubBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteHubCompletenessResult,
): CanonicalHubBiome {
  const layout = requireHubLayout(catalog, biome, completeness);
  const topology = completeness.topology;
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const descriptors = fixedDescriptors(layout);
  const fixedRooms = descriptors.map((descriptor) => {
    const occurrence = fixedOccurrence(topology, occurrences, descriptor);
    return materializeAuthoredRoom(
      catalog,
      biome,
      occurrence,
      requireRoom(catalog, occurrence.gameName),
      true,
      descriptor.state,
    );
  });
  const entryRooms = Object.freeze(fixedRooms.slice(0, -1));
  const terminalEntry = fixedRooms.at(-1);
  if (terminalEntry === undefined) {
    fail(`${layout.biomeKey} has no fixed terminal room`);
  }
  const hubRoom = materializeHubRoom(catalog, biome, layout);
  const hubBoard = materializeBoard(catalog, biome, layout, topology, occurrences, hubRoom);
  return Object.freeze({
    kind: 'HubBiome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRooms,
    hubBoard,
    visits: materializeVisits(catalog, biome, topology, hubBoard),
    terminalEntry,
    completionRooms: materializeCompletionRooms({
      catalog,
      biome,
      completion: layout.completion,
      enteredStorePolicy: { kind: 'noneOnly' },
      lifecycleProducerPolicy: 'noneOnly',
      fail,
    }),
    biomeState: Object.freeze({}),
  });
}
