import type { Catalog, RoomDeclaration } from '../catalog';
import type { CountedRewardBinding, ShopRewardBinding } from '../rewards';
import type {
  ResolvedRewardOffer,
  RewardPayload,
  RewardTypeDeclaration,
  ShopProfileDeclaration,
} from '../rewardKernel/model';
import type { AuthoredRoomState, ShopOfferState, ShopState } from './model';
import {
  expectBoolean,
  expectExactKeys,
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
    failProjectDocument(path, `${room.templateKey} cannot use terminal role ${role}`);
  }
}

function requireCountedBinding(room: RoomDeclaration, path: string): CountedRewardBinding {
  if (room.incomingReward.kind !== 'countedChoice') {
    failProjectDocument(path, `${room.templateKey} requires a counted reward binding`);
  }
  return room.incomingReward;
}

function requireShopBinding(room: RoomDeclaration, path: string): ShopRewardBinding {
  if (room.incomingReward.kind !== 'shop') {
    failProjectDocument(path, `${room.templateKey} requires a shop binding`);
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

export function createDefaultRoomState(
  catalog: Catalog,
  room: RoomDeclaration,
  context: RoomStateContext,
): AuthoredRoomState {
  const path = `rooms.${room.gameName}.state`;
  const { role, entryActive } = context;

  switch (room.templateKey) {
    case 'FixedIntro':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({ kind: 'none' });
    case 'FixedOpening':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({
        kind: 'counted',
        offer: defaultCountedOffer(
          requireCountedBinding(room, path),
          context.resolvedStoreKey,
          path,
        ),
      });
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(path, 'Story requires a fixed reward binding');
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
  switch (room.templateKey) {
    case 'FixedIntro':
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'none', path);
      expectExactKeys(state, ['kind'], path);
      return Object.freeze({ kind: 'none' });
    case 'FixedOpening':
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
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fixed', path);
      expectExactKeys(state, ['kind', 'payload'], path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(path, 'Story requires a fixed reward binding');
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
