import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '../../catalog-schema';
import type { CountedRewardBinding, ShopRewardBinding } from '../../reward-kernel/bindings';
import type {
  ResolvedRewardOffer,
  RewardPayload,
  RewardTypeDeclaration,
  ShopProfileDeclaration,
} from '../../reward-kernel/model';
import type {
  AuthoredRoomState,
  EphyraCombatState,
  EphyraSideRoomState,
  RewardWheelState,
  ShipCombatState,
  ShopOfferState,
  ShopState,
} from '../model';
import {
  expectExactKeys,
  expectBoolean,
  expectPositiveInteger,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import {
  authoredTemplateKey,
  requireCountedBinding,
  requireEphyraSideRooms,
  requireFieldsCages,
  requireOrdinaryRole,
  requireShipCombatWheels,
  requireShopBinding,
  type RoomStateContext,
} from './declaration';
import { decodeRoomEncounterState } from './encounters';

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
  descriptor: EncounterRewardWheelAttachment,
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
    expectExactKeys(rawState, ['generation', 'enteredOrdinal', 'offer', 'encounters'], slotPath);
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
      encounters: decodeRoomEncounterState(
        rawState.encounters,
        catalog,
        sideRoom,
        `${slotPath}.encounters`,
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
  expectExactKeys(shop, ['profileKey', 'offers', 'purchaseOrder'], path);
  const profileKey = expectString(shop.profileKey, `${path}.profileKey`);
  if (profileKey !== binding.shopProfileKey) {
    failProjectDocument(`${path}.profileKey`, `expected ${binding.shopProfileKey}`);
  }
  const profile = catalog.rewards.shops.byKey[profileKey];
  if (profile === undefined) {
    failProjectDocument(`${path}.profileKey`, `unknown shop profile ${profileKey}`);
  }
  return decodeShopOffers(shop.offers, shop.purchaseOrder, catalog, profile, path);
}

function decodeShopOffers(
  value: unknown,
  rawPurchaseOrder: unknown,
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
    expectExactKeys(rawOffer, ['offer'], offerPath);
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
    offers[slot.key] = Object.freeze({ offer });
  }
  if (!Array.isArray(rawPurchaseOrder)) {
    failProjectDocument(`${path}.purchaseOrder`, 'must be an array');
  }
  const purchaseKeys = rawPurchaseOrder.map((value, index) =>
    expectString(value, `${path}.purchaseOrder[${index}]`),
  );
  const seen = new Set<string>();
  for (const key of purchaseKeys) {
    if (offers[key] === undefined) {
      failProjectDocument(`${path}.purchaseOrder`, `${key} is not a Shop offer`);
    }
    if (seen.has(key)) {
      failProjectDocument(`${path}.purchaseOrder`, `${key} is duplicated`);
    }
    seen.add(key);
  }
  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
    purchaseOrder: Object.freeze(purchaseKeys),
  });
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
    case 'Anomaly':
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'anomaly', path);
      expectExactKeys(state, ['kind', 'offer', 'success'], path);
      return Object.freeze({
        kind: 'anomaly',
        // The takeover can retain a normal G reward that Anomaly itself would
        // not normally offer. Keep it authored so evaluation can report the
        // incompatibility and the user can edit it deliberately.
        offer: decodeOffer(state.offer, catalog, `${path}.offer`),
        success: expectBoolean(state.success, `${path}.success`),
      });
    case 'Devotion':
    case 'ContractBoss':
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fixed', path);
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
      expectExactKeys(
        state,
        rewardType.payloadDomain === undefined ? ['kind'] : ['kind', 'payload'],
        path,
      );
      const payload = decodePayload(state.payload, rewardType, catalog, `${path}.payload`);
      return Object.freeze({ kind: 'fixed', ...(payload === undefined ? {} : { payload }) });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return decodeShopRoomState(state, catalog, room, entryActive, path);
    case 'Preboss':
      if (role === 'ordinary') {
        failProjectDocument(path, 'Preboss requires a declaration-derived offer role');
      }
      if (role === 'prebossShop') {
        return decodeShopRoomState(state, catalog, room, entryActive, path);
      }
      expectedKind(state.kind, 'freeReward', path);
      expectExactKeys(state, ['kind', 'offer'], path);
      if (
        room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors' ||
        room.prebossBatchPolicy.remainingOffers.kind !== 'counted'
      ) {
        failProjectDocument(path, 'Preboss has no counted remaining-offer policy');
      }
      return Object.freeze({
        kind: 'freeReward',
        offer: decodeCountedOffer(
          state.offer,
          catalog,
          room.prebossBatchPolicy.remainingOffers.reward,
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
