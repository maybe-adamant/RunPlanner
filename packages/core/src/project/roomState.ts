import type { Catalog, RoomDeclaration } from '../catalog';
import type {
  ConcreteReward,
  CountedRewardBinding,
  RewardPayload,
  RewardPrimitive,
  ShopProfile,
  ShopRewardBinding,
} from '../rewards';
import type { AuthoredRoomState, CountedRewardChoice, ShopOfferState, ShopState } from './model';
import {
  expectArray,
  expectBoolean,
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument,
} from './validation';

export type RoomOccurrenceRole = 'ordinary' | 'terminalFreeReward' | 'terminalShop';

function defaultCountedChoice(binding: CountedRewardBinding): CountedRewardChoice {
  return Object.freeze({
    storeKey: binding.defaultStoreKey,
    reward: binding.defaultReward,
  });
}

function defaultShopState(catalog: Catalog, binding: ShopRewardBinding, path: string): ShopState {
  const profile = catalog.shopProfiles.byKey[binding.shopProfileKey];
  if (profile === undefined) {
    failProjectDocument(path, `unknown shop profile ${binding.shopProfileKey}`);
  }

  const offers: Record<string, ShopOfferState> = {};
  for (const slot of profile.slots.values) {
    offers[slot.key] = Object.freeze({ reward: slot.defaultReward, purchased: false });
  }

  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
  });
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

export function createDefaultRoomState(
  catalog: Catalog,
  room: RoomDeclaration,
  role: RoomOccurrenceRole = 'ordinary',
): AuthoredRoomState {
  const path = `rooms.${room.gameName}.state`;

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
        choice: defaultCountedChoice(requireCountedBinding(room, path)),
      });
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(path, 'Story requires a fixed reward binding');
      }
      return Object.freeze({
        kind: 'fixed',
        ...(room.incomingReward.reward.payload === undefined
          ? {}
          : { payload: room.incomingReward.reward.payload }),
      });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({
        kind: 'shop',
        shop: defaultShopState(catalog, requireShopBinding(room, path), path),
      });
    case 'ForkedPreboss':
      if (role === 'ordinary') {
        failProjectDocument(path, 'ForkedPreboss requires a derived terminal role');
      }
      if (role === 'terminalShop') {
        return Object.freeze({
          kind: 'shop',
          shop: defaultShopState(catalog, requireShopBinding(room, path), path),
        });
      }
      if (room.entryOfferPolicy === undefined) {
        failProjectDocument(path, 'ForkedPreboss requires an entry offer policy');
      }
      return Object.freeze({
        kind: 'freeReward',
        choice: defaultCountedChoice(room.entryOfferPolicy.freeReward),
      });
  }
}

function decodePayload(
  value: unknown,
  primitive: RewardPrimitive,
  catalog: Catalog,
  path: string,
): RewardPayload | undefined {
  if (primitive.payloadDomain === undefined) {
    if (value !== undefined) {
      failProjectDocument(path, `${primitive.gameName} does not accept a payload`);
    }
    return undefined;
  }
  if (value === undefined) {
    failProjectDocument(path, `${primitive.gameName} requires a payload`);
  }

  const domain = catalog.rewardPayloadDomains.byKey[primitive.payloadDomain];
  if (domain === undefined) {
    failProjectDocument(path, `unknown payload domain ${primitive.payloadDomain}`);
  }
  const payload = expectRecord(value, path);

  if (domain.kind === 'oneOf') {
    expectExactKeys(payload, ['source'], path);
    const source = expectString(payload.source, `${path}.source`);
    if (!domain.values.includes(source)) {
      failProjectDocument(`${path}.source`, `${source} is not in ${domain.key}`);
    }
    return Object.freeze({ source });
  }

  expectExactKeys(payload, ['sources'], path);
  const sources = expectArray(payload.sources, `${path}.sources`);
  if (sources.length !== 2) {
    failProjectDocument(`${path}.sources`, 'must contain exactly two values');
  }
  const first = expectString(sources[0], `${path}.sources[0]`);
  const second = expectString(sources[1], `${path}.sources[1]`);
  if (first === second) {
    failProjectDocument(`${path}.sources`, 'must contain distinct values');
  }
  const valueDomain = catalog.rewardPayloadDomains.byKey[domain.valueDomain];
  if (valueDomain?.kind !== 'oneOf') {
    failProjectDocument(path, `invalid value domain ${domain.valueDomain}`);
  }
  for (const [index, source] of [first, second].entries()) {
    if (!valueDomain.values.includes(source)) {
      failProjectDocument(`${path}.sources[${index}]`, `${source} is not in ${valueDomain.key}`);
    }
  }
  return Object.freeze({ sources: Object.freeze([first, second]) as readonly [string, string] });
}

function decodeConcreteReward(value: unknown, catalog: Catalog, path: string): ConcreteReward {
  const reward = expectRecord(value, path);
  expectExactKeys(reward, ['rewardType', 'payload'], path);
  const rewardType = expectString(reward.rewardType, `${path}.rewardType`);
  const primitive = catalog.rewardPrimitives.byKey[rewardType];
  if (primitive === undefined) {
    failProjectDocument(`${path}.rewardType`, `unknown reward primitive ${rewardType}`);
  }
  const payload = decodePayload(reward.payload, primitive, catalog, `${path}.payload`);
  return Object.freeze({
    rewardType,
    ...(payload === undefined ? {} : { payload }),
  });
}

function decodeCountedChoice(
  value: unknown,
  catalog: Catalog,
  binding: CountedRewardBinding,
  path: string,
): CountedRewardChoice {
  const choice = expectRecord(value, path);
  expectExactKeys(choice, ['storeKey', 'reward'], path);
  const storeKey = expectString(choice.storeKey, `${path}.storeKey`);
  if (!binding.storeKeys.includes(storeKey)) {
    failProjectDocument(`${path}.storeKey`, `${storeKey} is not available from this room`);
  }
  const store = catalog.rewardStores.byKey[storeKey];
  if (store === undefined) {
    failProjectDocument(`${path}.storeKey`, `unknown reward store ${storeKey}`);
  }
  const reward = decodeConcreteReward(choice.reward, catalog, `${path}.reward`);
  if (!store.rewardTypes.includes(reward.rewardType)) {
    failProjectDocument(
      `${path}.reward.rewardType`,
      `${reward.rewardType} is not produced by ${storeKey}`,
    );
  }
  if (!binding.allowedRewardTypes.includes(reward.rewardType)) {
    failProjectDocument(
      `${path}.reward.rewardType`,
      `${reward.rewardType} is filtered from this room`,
    );
  }
  return Object.freeze({ storeKey, reward });
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
  const profile = catalog.shopProfiles.byKey[profileKey];
  if (profile === undefined) {
    failProjectDocument(`${path}.profileKey`, `unknown shop profile ${profileKey}`);
  }
  return decodeShopOffers(shop.offers, catalog, profile, path);
}

function decodeShopOffers(
  value: unknown,
  catalog: Catalog,
  profile: ShopProfile,
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
    expectExactKeys(rawOffer, ['reward', 'purchased'], offerPath);
    const reward = decodeConcreteReward(rawOffer.reward, catalog, `${offerPath}.reward`);
    const optionSet = catalog.shopOptionSets.byKey[slot.optionSetKey];
    if (optionSet === undefined) {
      failProjectDocument(offerPath, `unknown option set ${slot.optionSetKey}`);
    }
    if (!optionSet.rewardTypes.includes(reward.rewardType)) {
      failProjectDocument(
        `${offerPath}.reward.rewardType`,
        `${reward.rewardType} is not available from ${slot.optionSetKey}`,
      );
    }
    offers[slot.key] = Object.freeze({
      reward,
      purchased: expectBoolean(rawOffer.purchased, `${offerPath}.purchased`),
    });
  }

  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
  });
}

function decodeExpectedKind(value: unknown, expected: string, path: string): void {
  const kind = expectString(value, `${path}.kind`);
  if (kind !== expected) {
    failProjectDocument(`${path}.kind`, `expected ${expected}, received ${kind}`);
  }
}

export function decodeRoomState(
  value: unknown,
  catalog: Catalog,
  room: RoomDeclaration,
  role: RoomOccurrenceRole,
  path: string,
): AuthoredRoomState {
  const state = expectRecord(value, path);

  switch (room.templateKey) {
    case 'FixedIntro':
      requireOrdinaryRole(role, room, path);
      decodeExpectedKind(state.kind, 'none', path);
      expectExactKeys(state, ['kind'], path);
      return Object.freeze({ kind: 'none' });
    case 'FixedOpening':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat': {
      requireOrdinaryRole(role, room, path);
      decodeExpectedKind(state.kind, 'counted', path);
      expectExactKeys(state, ['kind', 'choice'], path);
      return Object.freeze({
        kind: 'counted',
        choice: decodeCountedChoice(
          state.choice,
          catalog,
          requireCountedBinding(room, path),
          `${path}.choice`,
        ),
      });
    }
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      decodeExpectedKind(state.kind, 'fixed', path);
      expectExactKeys(state, ['kind', 'payload'], path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(path, 'Story requires a fixed reward binding');
      }
      const primitive = catalog.rewardPrimitives.byKey[room.incomingReward.reward.rewardType];
      if (primitive === undefined) {
        failProjectDocument(path, `unknown fixed reward ${room.incomingReward.reward.rewardType}`);
      }
      const payload = decodePayload(state.payload, primitive, catalog, `${path}.payload`);
      return Object.freeze({ kind: 'fixed', ...(payload === undefined ? {} : { payload }) });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      decodeExpectedKind(state.kind, 'shop', path);
      expectExactKeys(state, ['kind', 'shop'], path);
      return Object.freeze({
        kind: 'shop',
        shop: decodeShopState(state.shop, catalog, requireShopBinding(room, path), `${path}.shop`),
      });
    case 'ForkedPreboss':
      if (role === 'ordinary') {
        failProjectDocument(path, 'ForkedPreboss requires a derived terminal role');
      }
      if (role === 'terminalShop') {
        decodeExpectedKind(state.kind, 'shop', path);
        expectExactKeys(state, ['kind', 'shop'], path);
        return Object.freeze({
          kind: 'shop',
          shop: decodeShopState(
            state.shop,
            catalog,
            requireShopBinding(room, path),
            `${path}.shop`,
          ),
        });
      }
      decodeExpectedKind(state.kind, 'freeReward', path);
      expectExactKeys(state, ['kind', 'choice'], path);
      if (room.entryOfferPolicy === undefined) {
        failProjectDocument(path, 'ForkedPreboss requires an entry offer policy');
      }
      return Object.freeze({
        kind: 'freeReward',
        choice: decodeCountedChoice(
          state.choice,
          catalog,
          room.entryOfferPolicy.freeReward,
          `${path}.choice`,
        ),
      });
  }
}
