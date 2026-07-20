import type {
  Catalog,
  LocalChildDescriptor,
  RewardWheelOfferPoint,
  RoomDeclaration,
} from '../catalog';
import type { CountedRewardBinding, ShopRewardBinding } from '../rewards';
import type {
  ResolvedRewardOffer,
  RewardPayload,
  RewardTypeDeclaration,
  ShopProfileDeclaration,
} from '../rewardKernel/model';
import type {
  AuthoredRoomState,
  EphyraCombatState,
  EphyraSideRoomState,
  RewardWheelState,
  ShipCombatState,
  ShopOfferState,
  ShopState,
} from './model';
import {
  expectBoolean,
  expectExactKeys,
  expectPositiveInteger,
  expectRecord,
  expectString,
  failProjectDocument,
} from './validation';

export type RoomOccurrenceRole = 'ordinary' | 'terminalFreeReward' | 'terminalShop';

export interface RoomStateContext {
  readonly role: RoomOccurrenceRole;
  readonly resolvedStoreKey?: string;
  readonly entryActive: boolean;
}

function requireOrdinaryRole(role: RoomOccurrenceRole, room: RoomDeclaration, path: string): void {
  if (role !== 'ordinary') {
    failProjectDocument(
      path,
      `${authoredTemplateKey(room, path)} cannot use terminal role ${role}`,
    );
  }
}

function requireShopPrebossRole(
  role: RoomOccurrenceRole,
  room: RoomDeclaration,
  path: string,
): void {
  if (role === 'terminalFreeReward') {
    failProjectDocument(
      path,
      `${authoredTemplateKey(room, path)} cannot use terminal free-reward role`,
    );
  }
}

function authoredTemplateKey(room: RoomDeclaration, path: string) {
  if (room.mode.kind !== 'authored') {
    failProjectDocument(path, `${room.gameName} is layout-derived and owns no authored room state`);
  }
  return room.mode.templateKey;
}

function requireCountedBinding(room: RoomDeclaration, path: string): CountedRewardBinding {
  if (room.incomingReward.kind !== 'countedChoice') {
    failProjectDocument(
      path,
      `${authoredTemplateKey(room, path)} requires a counted reward binding`,
    );
  }
  return room.incomingReward;
}

function requireShopBinding(room: RoomDeclaration, path: string): ShopRewardBinding {
  if (room.incomingReward.kind !== 'shop') {
    failProjectDocument(path, `${authoredTemplateKey(room, path)} requires a shop binding`);
  }
  return room.incomingReward;
}

function defaultCountedOffer(
  binding: CountedRewardBinding,
  storeKey: string | undefined,
  path: string,
): ResolvedRewardOffer {
  if (storeKey === undefined) {
    failProjectDocument(path, 'counted reward requires a resolved store');
  }
  const offer = binding.defaultOffersByStore[storeKey];
  if (offer === undefined) {
    failProjectDocument(path, `${storeKey} is not available from this room`);
  }
  return offer;
}

function defaultShopState(catalog: Catalog, binding: ShopRewardBinding, path: string): ShopState {
  const profile = catalog.rewards.shops.byKey[binding.shopProfileKey];
  if (profile === undefined) {
    failProjectDocument(path, `unknown shop profile ${binding.shopProfileKey}`);
  }
  const offers: Record<string, ShopOfferState> = {};
  for (const slot of profile.slots.values) {
    offers[slot.key] = Object.freeze({ offer: slot.defaultOffer, purchased: false });
  }
  return Object.freeze({ profileKey: profile.key, offers: Object.freeze(offers) });
}

function requireFieldsCages(
  room: RoomDeclaration,
  path: string,
): LocalChildDescriptor & {
  readonly kind: 'boundedRewardSlots';
} {
  const cages = room.localChildren.find((child) => child.key === 'cages');
  if (cages?.kind !== 'boundedRewardSlots') {
    failProjectDocument(path, 'FieldsCombat requires bounded cages');
  }
  return cages;
}

function defaultFieldsCages(room: RoomDeclaration, path: string) {
  const descriptor = requireFieldsCages(room, path);
  const cages: Record<string, ResolvedRewardOffer> = {};
  for (const slotKey of descriptor.slotKeys) {
    cages[slotKey] = defaultCountedOffer(
      descriptor.reward,
      room.individualRewardStoreKey,
      `${path}.cages.${slotKey}`,
    );
  }
  return Object.freeze(cages);
}

function requireShipCombatWheels(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): readonly RewardWheelOfferPoint[] {
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (profile === undefined) {
    failProjectDocument(path, `unknown encounter profile ${room.encounterProfileKey}`);
  }
  const wheels = profile.phases.flatMap((phase) =>
    phase.offerPoint === undefined ? [] : [phase.offerPoint],
  );
  if (wheels.length !== 2 || wheels[0]?.key !== 'wheel1' || wheels[1]?.key !== 'wheel2') {
    failProjectDocument(path, 'ShipCombat requires wheel1 and wheel2 offer points');
  }
  return wheels;
}

function defaultRewardWheel(descriptor: RewardWheelOfferPoint, path: string): RewardWheelState {
  const offer = defaultCountedOffer(descriptor.reward, descriptor.defaultStoreKey, path);
  return Object.freeze({
    storeKey: descriptor.defaultStoreKey,
    offerCount: descriptor.offerCount.defaultValue,
    offers: Object.freeze(
      Object.fromEntries(descriptor.offerKeys.map((offerKey) => [offerKey, offer])),
    ),
    pickedOfferIndex: 1,
  });
}

function defaultShipCombatState(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): ShipCombatState {
  const wheels = requireShipCombatWheels(catalog, room, path);
  return Object.freeze({
    kind: 'shipCombat',
    encounterCount: 2,
    wheels: Object.freeze(
      Object.fromEntries(wheels.map((wheel) => [wheel.key, defaultRewardWheel(wheel, path)])),
    ),
  });
}

function requireEphyraSideRooms(
  room: RoomDeclaration,
  path: string,
): Extract<LocalChildDescriptor, { readonly kind: 'fixedRoomSlots' }> | undefined {
  const descriptor = room.localChildren[0];
  if (descriptor === undefined) {
    return undefined;
  }
  if (room.localChildren.length !== 1 || descriptor.kind !== 'fixedRoomSlots') {
    failProjectDocument(path, 'EphyraCombat requires at most one fixed-room side group');
  }
  return descriptor;
}

function defaultEphyraCombatState(
  catalog: Catalog,
  room: RoomDeclaration,
  resolvedStoreKey: string | undefined,
  path: string,
): EphyraCombatState {
  const sideRooms: Record<string, EphyraSideRoomState> = {};
  for (const slot of requireEphyraSideRooms(room, path)?.slots ?? []) {
    const sideRoom = catalog.rooms.byKey[slot.roomGameName];
    if (sideRoom === undefined) {
      failProjectDocument(`${path}.sideRooms.${slot.slotKey}`, `unknown room ${slot.roomGameName}`);
    }
    sideRooms[slot.slotKey] = Object.freeze({
      generation: 'notGenerated',
      enteredOrdinal: null,
      offer: defaultCountedOffer(
        requireCountedBinding(sideRoom, path),
        sideRoom.individualRewardStoreKey ?? sideRoom.forcedRewardStoreKey,
        `${path}.sideRooms.${slot.slotKey}.offer`,
      ),
    });
  }
  return Object.freeze({
    kind: 'ephyraCombat',
    offer: defaultCountedOffer(
      requireCountedBinding(room, path),
      resolvedStoreKey ?? room.forcedRewardStoreKey,
      `${path}.offer`,
    ),
    sideRooms: Object.freeze(sideRooms),
  });
}

export function createDefaultRoomState(
  catalog: Catalog,
  room: RoomDeclaration,
  context: RoomStateContext,
): AuthoredRoomState {
  const path = `rooms.${room.gameName}.state`;
  const { role, entryActive } = context;

  switch (authoredTemplateKey(room, path)) {
    case 'FixedIntro':
    case 'RewardlessCombat':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({ kind: 'none' });
    case 'FieldsCombat':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({ kind: 'fieldsCombat', cages: defaultFieldsCages(room, path) });
    case 'ShipCombat':
      requireOrdinaryRole(role, room, path);
      return defaultShipCombatState(catalog, room, path);
    case 'EphyraCombat':
      requireOrdinaryRole(role, room, path);
      return defaultEphyraCombatState(catalog, room, context.resolvedStoreKey, path);
    case 'FixedOpening':
    case 'FixedPreHub':
    case 'ClockworkCombat':
    case 'EphyraSideRoom':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({
        kind: 'counted',
        offer: defaultCountedOffer(
          requireCountedBinding(room, path),
          context.resolvedStoreKey ?? room.forcedRewardStoreKey ?? room.individualRewardStoreKey,
          path,
        ),
      });
    case 'Devotion':
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(
          path,
          `${authoredTemplateKey(room, path)} requires a fixed reward binding`,
        );
      }
      return Object.freeze({
        kind: 'fixed',
        ...(room.incomingReward.offer.payload === undefined
          ? {}
          : { payload: room.incomingReward.offer.payload }),
      });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({
        kind: 'shop',
        ...(entryActive
          ? { shop: defaultShopState(catalog, requireShopBinding(room, path), path) }
          : {}),
      });
    case 'ShopPreboss':
      requireShopPrebossRole(role, room, path);
      return Object.freeze({
        kind: 'shop',
        ...(entryActive
          ? { shop: defaultShopState(catalog, requireShopBinding(room, path), path) }
          : {}),
      });
    case 'ForkedPreboss':
      if (role === 'ordinary') {
        failProjectDocument(path, 'ForkedPreboss requires a derived terminal role');
      }
      if (role === 'terminalShop') {
        return Object.freeze({
          kind: 'shop',
          ...(entryActive
            ? { shop: defaultShopState(catalog, requireShopBinding(room, path), path) }
            : {}),
        });
      }
      if (room.entryOfferPolicy === undefined) {
        failProjectDocument(path, 'ForkedPreboss requires an entry offer policy');
      }
      return Object.freeze({
        kind: 'freeReward',
        offer: defaultCountedOffer(
          room.entryOfferPolicy.freeReward,
          context.resolvedStoreKey,
          path,
        ),
      });
  }
}

function decodePayload(
  value: unknown,
  rewardType: RewardTypeDeclaration,
  catalog: Catalog,
  path: string,
): RewardPayload | undefined {
  if (rewardType.payloadDomain === undefined) {
    if (value !== undefined) {
      failProjectDocument(path, `${rewardType.gameName} does not accept a payload`);
    }
    return undefined;
  }
  if (value === undefined) {
    failProjectDocument(path, `${rewardType.gameName} requires a payload`);
  }
  const domain = catalog.rewards.payloadDomains.byKey[rewardType.payloadDomain];
  if (domain === undefined) {
    failProjectDocument(path, `unknown payload domain ${rewardType.payloadDomain}`);
  }
  const payload = expectRecord(value, path);
  if (domain.kind === 'oneOf') {
    expectExactKeys(payload, ['kind', 'source'], path);
    if (expectString(payload.kind, `${path}.kind`) !== 'BoonSource') {
      failProjectDocument(`${path}.kind`, 'expected BoonSource');
    }
    const source = expectString(payload.source, `${path}.source`);
    if (!domain.values.includes(source)) {
      failProjectDocument(`${path}.source`, `${source} is not in ${domain.key}`);
    }
    return Object.freeze({ kind: 'BoonSource', source });
  }
  expectExactKeys(payload, ['kind', 'chosenSource', 'spurnedSource'], path);
  if (expectString(payload.kind, `${path}.kind`) !== 'DevotionPair') {
    failProjectDocument(`${path}.kind`, 'expected DevotionPair');
  }
  const chosenSource = expectString(payload.chosenSource, `${path}.chosenSource`);
  const spurnedSource = expectString(payload.spurnedSource, `${path}.spurnedSource`);
  if (chosenSource === spurnedSource) {
    failProjectDocument(path, 'chosenSource and spurnedSource must be distinct');
  }
  const valueDomain = catalog.rewards.payloadDomains.byKey[domain.valueDomain];
  if (valueDomain?.kind !== 'oneOf') {
    failProjectDocument(path, `invalid value domain ${domain.valueDomain}`);
  }
  for (const [field, source] of [
    ['chosenSource', chosenSource],
    ['spurnedSource', spurnedSource],
  ] as const) {
    if (!valueDomain.values.includes(source)) {
      failProjectDocument(`${path}.${field}`, `${source} is not in ${valueDomain.key}`);
    }
  }
  return Object.freeze({ kind: 'DevotionPair', chosenSource, spurnedSource });
}

function decodeOffer(value: unknown, catalog: Catalog, path: string): ResolvedRewardOffer {
  const offer = expectRecord(value, path);
  expectExactKeys(offer, ['rewardType', 'payload'], path);
  const rewardTypeName = expectString(offer.rewardType, `${path}.rewardType`);
  const rewardType = catalog.rewards.rewardTypes.byKey[rewardTypeName];
  if (rewardType === undefined) {
    failProjectDocument(`${path}.rewardType`, `unknown reward type ${rewardTypeName}`);
  }
  const payload = decodePayload(offer.payload, rewardType, catalog, `${path}.payload`);
  return Object.freeze({
    rewardType: rewardTypeName,
    ...(payload === undefined ? {} : { payload }),
  });
}

function decodeCountedOffer(
  value: unknown,
  catalog: Catalog,
  binding: CountedRewardBinding,
  path: string,
): ResolvedRewardOffer {
  const offer = decodeOffer(value, catalog, path);
  if (!binding.allowedRewardTypes.includes(offer.rewardType)) {
    failProjectDocument(`${path}.rewardType`, `${offer.rewardType} is filtered from this room`);
  }
  return offer;
}

function decodeRewardWheel(
  value: unknown,
  catalog: Catalog,
  descriptor: RewardWheelOfferPoint,
  path: string,
): RewardWheelState {
  const wheel = expectRecord(value, path);
  expectExactKeys(wheel, ['storeKey', 'offerCount', 'offers', 'pickedOfferIndex'], path);
  const storeKey = expectString(wheel.storeKey, `${path}.storeKey`);
  if (!descriptor.reward.storeKeys.includes(storeKey)) {
    failProjectDocument(`${path}.storeKey`, `${storeKey} is not available from this wheel`);
  }
  const offerCount = expectPositiveInteger(wheel.offerCount, `${path}.offerCount`);
  if (offerCount < descriptor.offerCount.min || offerCount > descriptor.offerCount.max) {
    failProjectDocument(
      `${path}.offerCount`,
      `must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
    );
  }
  const rawOffers = expectRecord(wheel.offers, `${path}.offers`);
  expectExactKeys(rawOffers, descriptor.offerKeys, `${path}.offers`);
  const offers: Record<string, ResolvedRewardOffer> = {};
  for (const offerKey of descriptor.offerKeys) {
    offers[offerKey] = decodeCountedOffer(
      rawOffers[offerKey],
      catalog,
      descriptor.reward,
      `${path}.offers.${offerKey}`,
    );
  }
  const pickedOfferIndex = expectPositiveInteger(
    wheel.pickedOfferIndex,
    `${path}.pickedOfferIndex`,
  );
  if (pickedOfferIndex > offerCount) {
    failProjectDocument(`${path}.pickedOfferIndex`, 'must select an active offer');
  }
  return Object.freeze({
    storeKey,
    offerCount,
    offers: Object.freeze(offers),
    pickedOfferIndex,
  });
}

function decodeShipCombatState(
  value: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): ShipCombatState {
  expectedKind(value.kind, 'shipCombat', path);
  expectExactKeys(value, ['kind', 'encounterCount', 'wheels'], path);
  const encounterCount = expectPositiveInteger(value.encounterCount, `${path}.encounterCount`);
  if (encounterCount !== 2 && encounterCount !== 3) {
    failProjectDocument(`${path}.encounterCount`, 'must be 2 or 3');
  }
  const descriptors = requireShipCombatWheels(catalog, room, path);
  const rawWheels = expectRecord(value.wheels, `${path}.wheels`);
  expectExactKeys(
    rawWheels,
    descriptors.map((descriptor) => descriptor.key),
    `${path}.wheels`,
  );
  const wheels: Record<string, RewardWheelState> = {};
  for (const descriptor of descriptors) {
    wheels[descriptor.key] = decodeRewardWheel(
      rawWheels[descriptor.key],
      catalog,
      descriptor,
      `${path}.wheels.${descriptor.key}`,
    );
  }
  return Object.freeze({
    kind: 'shipCombat',
    encounterCount,
    wheels: Object.freeze(wheels),
  });
}

function decodeEphyraCombatState(
  value: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): EphyraCombatState {
  expectedKind(value.kind, 'ephyraCombat', path);
  expectExactKeys(value, ['kind', 'offer', 'sideRooms'], path);
  const descriptor = requireEphyraSideRooms(room, path);
  const slots = descriptor?.slots ?? [];
  const rawSideRooms = expectRecord(value.sideRooms, `${path}.sideRooms`);
  expectExactKeys(
    rawSideRooms,
    slots.map((slot) => slot.slotKey),
    `${path}.sideRooms`,
  );
  const enteredOrdinals = new Set<number>();
  const sideRooms: Record<string, EphyraSideRoomState> = {};
  for (const slot of slots) {
    const slotPath = `${path}.sideRooms.${slot.slotKey}`;
    const rawState = expectRecord(rawSideRooms[slot.slotKey], slotPath);
    expectExactKeys(rawState, ['generation', 'enteredOrdinal', 'offer'], slotPath);
    const generation = expectString(rawState.generation, `${slotPath}.generation`);
    if (generation !== 'generated' && generation !== 'notGenerated') {
      failProjectDocument(`${slotPath}.generation`, 'must be generated or notGenerated');
    }
    let enteredOrdinal: number | null = null;
    if (rawState.enteredOrdinal !== null) {
      enteredOrdinal = expectPositiveInteger(rawState.enteredOrdinal, `${slotPath}.enteredOrdinal`);
      if (enteredOrdinal > slots.length) {
        failProjectDocument(`${slotPath}.enteredOrdinal`, 'exceeds the local side-room capacity');
      }
      if (enteredOrdinals.has(enteredOrdinal)) {
        failProjectDocument(`${slotPath}.enteredOrdinal`, `duplicates ${enteredOrdinal}`);
      }
      enteredOrdinals.add(enteredOrdinal);
      if (generation !== 'generated') {
        failProjectDocument(`${slotPath}.enteredOrdinal`, 'requires a generated side room');
      }
    }
    const sideRoom = catalog.rooms.byKey[slot.roomGameName];
    if (sideRoom === undefined) {
      failProjectDocument(slotPath, `unknown room ${slot.roomGameName}`);
    }
    sideRooms[slot.slotKey] = Object.freeze({
      generation,
      enteredOrdinal,
      offer: decodeCountedOffer(
        rawState.offer,
        catalog,
        requireCountedBinding(sideRoom, slotPath),
        `${slotPath}.offer`,
      ),
    });
  }
  for (let ordinal = 1; ordinal <= enteredOrdinals.size; ordinal += 1) {
    if (!enteredOrdinals.has(ordinal)) {
      failProjectDocument(
        `${path}.sideRooms.enteredOrdinals`,
        `must contain contiguous ordinal ${ordinal}`,
      );
    }
  }
  return Object.freeze({
    kind: 'ephyraCombat',
    offer: decodeCountedOffer(
      value.offer,
      catalog,
      requireCountedBinding(room, path),
      `${path}.offer`,
    ),
    sideRooms: Object.freeze(sideRooms),
  });
}

function decodeShopState(
  value: unknown,
  catalog: Catalog,
  binding: ShopRewardBinding,
  path: string,
): ShopState {
  const shop = expectRecord(value, path);
  expectExactKeys(shop, ['profileKey', 'offers'], path);
  const profileKey = expectString(shop.profileKey, `${path}.profileKey`);
  if (profileKey !== binding.shopProfileKey) {
    failProjectDocument(`${path}.profileKey`, `expected ${binding.shopProfileKey}`);
  }
  const profile = catalog.rewards.shops.byKey[profileKey];
  if (profile === undefined) {
    failProjectDocument(`${path}.profileKey`, `unknown shop profile ${profileKey}`);
  }
  return decodeShopOffers(shop.offers, catalog, profile, path);
}

function decodeShopOffers(
  value: unknown,
  catalog: Catalog,
  profile: ShopProfileDeclaration,
  path: string,
): ShopState {
  const rawOffers = expectRecord(value, `${path}.offers`);
  expectExactKeys(
    rawOffers,
    profile.slots.values.map((slot) => slot.key),
    `${path}.offers`,
  );
  const offers: Record<string, ShopOfferState> = {};
  for (const slot of profile.slots.values) {
    const offerPath = `${path}.offers.${slot.key}`;
    const rawOffer = expectRecord(rawOffers[slot.key], offerPath);
    expectExactKeys(rawOffer, ['offer', 'purchased'], offerPath);
    const offer = decodeOffer(rawOffer.offer, catalog, `${offerPath}.offer`);
    const group = profile.groups.byKey[slot.groupKey];
    if (group === undefined) {
      failProjectDocument(offerPath, `unknown shop group ${slot.groupKey}`);
    }
    if (
      !group.options.values.some((option) => option.defaultOffer.rewardType === offer.rewardType)
    ) {
      failProjectDocument(
        `${offerPath}.offer.rewardType`,
        `${offer.rewardType} is not available from ${slot.groupKey}`,
      );
    }
    offers[slot.key] = Object.freeze({
      offer,
      purchased: expectBoolean(rawOffer.purchased, `${offerPath}.purchased`),
    });
  }
  return Object.freeze({ profileKey: profile.key, offers: Object.freeze(offers) });
}

function expectedKind(value: unknown, expected: string, path: string): void {
  const kind = expectString(value, `${path}.kind`);
  if (kind !== expected) {
    failProjectDocument(`${path}.kind`, `expected ${expected}, received ${kind}`);
  }
}

export function decodeRoomState(
  value: unknown,
  catalog: Catalog,
  room: RoomDeclaration,
  context: Pick<RoomStateContext, 'role' | 'entryActive'>,
  path: string,
): AuthoredRoomState {
  const state = expectRecord(value, path);
  const { role, entryActive } = context;
  switch (authoredTemplateKey(room, path)) {
    case 'FixedIntro':
    case 'RewardlessCombat':
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'none', path);
      expectExactKeys(state, ['kind'], path);
      return Object.freeze({ kind: 'none' });
    case 'FieldsCombat': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fieldsCombat', path);
      expectExactKeys(state, ['kind', 'cages'], path);
      const descriptor = requireFieldsCages(room, path);
      const rawCages = expectRecord(state.cages, `${path}.cages`);
      expectExactKeys(rawCages, descriptor.slotKeys, `${path}.cages`);
      const cages: Record<string, ResolvedRewardOffer> = {};
      for (const slotKey of descriptor.slotKeys) {
        cages[slotKey] = decodeCountedOffer(
          rawCages[slotKey],
          catalog,
          descriptor.reward,
          `${path}.cages.${slotKey}`,
        );
      }
      return Object.freeze({ kind: 'fieldsCombat', cages: Object.freeze(cages) });
    }
    case 'ShipCombat':
      requireOrdinaryRole(role, room, path);
      return decodeShipCombatState(state, catalog, room, path);
    case 'EphyraCombat':
      requireOrdinaryRole(role, room, path);
      return decodeEphyraCombatState(state, catalog, room, path);
    case 'FixedOpening':
    case 'FixedPreHub':
    case 'ClockworkCombat':
    case 'EphyraSideRoom':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat':
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'counted', path);
      expectExactKeys(state, ['kind', 'offer'], path);
      return Object.freeze({
        kind: 'counted',
        offer: decodeCountedOffer(
          state.offer,
          catalog,
          requireCountedBinding(room, path),
          `${path}.offer`,
        ),
      });
    case 'Devotion':
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fixed', path);
      expectExactKeys(state, ['kind', 'payload'], path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(
          path,
          `${authoredTemplateKey(room, path)} requires a fixed reward binding`,
        );
      }
      const rewardType = catalog.rewards.rewardTypes.byKey[room.incomingReward.offer.rewardType];
      if (rewardType === undefined) {
        failProjectDocument(path, `unknown fixed reward ${room.incomingReward.offer.rewardType}`);
      }
      const payload = decodePayload(state.payload, rewardType, catalog, `${path}.payload`);
      return Object.freeze({ kind: 'fixed', ...(payload === undefined ? {} : { payload }) });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return decodeShopRoomState(state, catalog, room, entryActive, path);
    case 'ShopPreboss':
      requireShopPrebossRole(role, room, path);
      return decodeShopRoomState(state, catalog, room, entryActive, path);
    case 'ForkedPreboss':
      if (role === 'ordinary') {
        failProjectDocument(path, 'ForkedPreboss requires a derived terminal role');
      }
      if (role === 'terminalShop') {
        return decodeShopRoomState(state, catalog, room, entryActive, path);
      }
      expectedKind(state.kind, 'freeReward', path);
      expectExactKeys(state, ['kind', 'offer'], path);
      if (room.entryOfferPolicy === undefined) {
        failProjectDocument(path, 'ForkedPreboss requires an entry offer policy');
      }
      return Object.freeze({
        kind: 'freeReward',
        offer: decodeCountedOffer(
          state.offer,
          catalog,
          room.entryOfferPolicy.freeReward,
          `${path}.offer`,
        ),
      });
  }
}

function decodeShopRoomState(
  state: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  entryActive: boolean,
  path: string,
): AuthoredRoomState {
  expectedKind(state.kind, 'shop', path);
  expectExactKeys(state, ['kind', 'shop'], path);
  if (state.shop === undefined) {
    if (entryActive) {
      failProjectDocument(`${path}.shop`, 'is required for an entered shop occurrence');
    }
    return Object.freeze({ kind: 'shop' });
  }
  return Object.freeze({
    kind: 'shop',
    shop: decodeShopState(state.shop, catalog, requireShopBinding(room, path), `${path}.shop`),
  });
}
