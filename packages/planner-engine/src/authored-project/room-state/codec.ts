import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { AuthoredRewardState, AuthoredRoomState } from '../model';
import {
  expectBoolean,
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import {
  authoredTemplateKey,
  requireCountedBinding,
  requireFieldsCages,
  requireFieldsOptionalRewards,
  requireOrdinaryRole,
  requireShopBinding,
  type RoomStateContext,
} from './declaration';
import {
  decodeCountedOffer,
  decodeNullableRewardState,
  decodePayload,
  decodeRewardState,
} from './reward-acquisition-codec';
import { decodeEphyraCombatState, decodeShipCombatState } from './ship-ephyra-codec';
import { decodeShopState } from './shop-codec';

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
  context: Pick<
    RoomStateContext,
    'role' | 'entryActive' | 'rememberedCountedBinding' | 'activeCageCount'
  >,
  path: string,
): AuthoredRoomState {
  const state = expectRecord(value, path);
  const { role, entryActive, rememberedCountedBinding } = context;
  switch (authoredTemplateKey(room, path)) {
    case 'FixedIntro':
    case 'Boss':
    case 'PostBoss':
    case 'RewardlessCombat':
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'none', path);
      expectExactKeys(state, ['kind'], path);
      return Object.freeze({ kind: 'none' });
    case 'FieldsCombat': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fieldsCombat', path);
      expectExactKeys(state, ['kind', 'cages', 'optionalRewardCount', 'optionalRewards'], path);
      const descriptor = requireFieldsCages(room, path);
      const rawCages = expectRecord(state.cages, `${path}.cages`);
      expectExactKeys(rawCages, descriptor.slotKeys, `${path}.cages`);
      const cages: Record<string, AuthoredRewardState | null> = {};
      for (const slotKey of descriptor.slotKeys) {
        const reward = decodeNullableRewardState(
          rawCages[slotKey],
          catalog,
          `${path}.cages.${slotKey}`,
          {
            kind: 'producerLifecycle',
            key: descriptor.reward.producerLifecycleKey,
          },
        );
        if (reward === null) {
          cages[slotKey] = null;
          continue;
        }
        const offer = decodeCountedOffer(
          reward.offer,
          catalog,
          descriptor.reward,
          `${path}.cages.${slotKey}.offer`,
        );
        cages[slotKey] = Object.freeze({ ...reward, offer });
      }
      const optionalDescriptor = requireFieldsOptionalRewards(room, path);
      const optionalRewardCount = state.optionalRewardCount;
      if (
        typeof optionalRewardCount !== 'number' ||
        !Number.isInteger(optionalRewardCount) ||
        optionalRewardCount < 0 ||
        optionalRewardCount > optionalDescriptor.optionalRewardCapacity
      ) {
        failProjectDocument(
          `${path}.optionalRewardCount`,
          `must be within 0..${optionalDescriptor.optionalRewardCapacity}`,
        );
      }
      const rawOptionalRewards = expectRecord(state.optionalRewards, `${path}.optionalRewards`);
      expectExactKeys(rawOptionalRewards, optionalDescriptor.slotKeys, `${path}.optionalRewards`);
      const optionalRewards: Record<string, AuthoredRewardState | null> = {};
      for (const slotKey of optionalDescriptor.slotKeys) {
        const reward = decodeNullableRewardState(
          rawOptionalRewards[slotKey],
          catalog,
          `${path}.optionalRewards.${slotKey}`,
          { kind: 'producerLifecycle', key: optionalDescriptor.reward.producerLifecycleKey },
        );
        if (reward === null) {
          optionalRewards[slotKey] = null;
          continue;
        }
        const offer = decodeCountedOffer(
          reward.offer,
          catalog,
          optionalDescriptor.reward,
          `${path}.optionalRewards.${slotKey}.offer`,
        );
        optionalRewards[slotKey] = Object.freeze({ ...reward, offer });
      }
      return Object.freeze({
        kind: 'fieldsCombat',
        cages: Object.freeze(cages),
        optionalRewardCount,
        optionalRewards: Object.freeze(optionalRewards),
      });
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
    case 'StandardCombat': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'counted', path);
      expectExactKeys(state, ['kind', 'reward'], path);
      const reward = decodeNullableRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: requireCountedBinding(room, path).producerLifecycleKey,
      });
      if (reward === null) return Object.freeze({ kind: 'counted', reward: null });
      const offer = decodeCountedOffer(
        reward.offer,
        catalog,
        requireCountedBinding(room, path),
        `${path}.reward.offer`,
      );
      return Object.freeze({
        kind: 'counted',
        reward: Object.freeze({ ...reward, offer }),
      });
    }
    case 'Anomaly': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'anomaly', path);
      expectExactKeys(state, ['kind', 'reward', 'success'], path);
      if (rememberedCountedBinding === undefined) {
        failProjectDocument(path, 'Anomaly requires its remembered counted reward binding');
      }
      const reward = decodeNullableRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: rememberedCountedBinding.producerLifecycleKey,
      });
      if (reward === null)
        return Object.freeze({
          kind: 'anomaly',
          reward: null,
          success: expectBoolean(state.success, `${path}.success`),
        });
      const offer = decodeCountedOffer(
        reward.offer,
        catalog,
        rememberedCountedBinding,
        `${path}.reward.offer`,
      );
      return Object.freeze({
        kind: 'anomaly',
        // The takeover can retain a normal G reward that this Anomaly map
        // would not normally offer. The remembered G declaration remains the
        // persisted offer domain; evaluation reports the Anomaly mismatch.
        reward: Object.freeze({ ...reward, offer }),
        success: expectBoolean(state.success, `${path}.success`),
      });
    }
    case 'Devotion':
    case 'ContractBoss':
    case 'Chaos':
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      expectedKind(state.kind, 'fixed', path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(
          path,
          `${authoredTemplateKey(room, path)} requires a fixed reward binding`,
        );
      }
      const rewardType = catalog.rewards.rewardTypes.byKey[room.incomingReward.rewardType];
      if (rewardType === undefined) {
        failProjectDocument(path, `unknown fixed reward ${room.incomingReward.rewardType}`);
      }
      if (state.reward === null) {
        if (rewardType.payloadDomain === undefined)
          failProjectDocument(`${path}.reward`, 'fixed payload-free reward cannot be unresolved');
        return Object.freeze({ kind: 'fixed', reward: null });
      }
      const reward = decodeRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: room.incomingReward.producerLifecycleKey,
      });
      const payload = decodePayload(
        reward.offer.payload,
        rewardType,
        catalog,
        `${path}.reward.offer.payload`,
      );
      const offer = Object.freeze({
        rewardType: room.incomingReward.rewardType,
        ...(payload === undefined ? {} : { payload }),
      });
      if (offer.rewardType !== reward.offer.rewardType)
        failProjectDocument(
          `${path}.reward.offer.rewardType`,
          'fixed reward type is declaration-owned',
        );
      return Object.freeze({
        kind: 'fixed',
        reward: Object.freeze({ ...reward, offer }),
      });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return decodeShopRoomState(state, catalog, room, entryActive, path);
    case 'Preboss': {
      if (role === 'ordinary') {
        failProjectDocument(path, 'Preboss requires a declaration-derived offer role');
      }
      if (role === 'prebossShop') {
        return decodeShopRoomState(state, catalog, room, entryActive, path);
      }
      expectedKind(state.kind, 'freeReward', path);
      expectExactKeys(state, ['kind', 'reward'], path);
      if (
        room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors' ||
        room.prebossBatchPolicy.remainingOffers.kind !== 'counted'
      ) {
        failProjectDocument(path, 'Preboss has no counted remaining-offer policy');
      }
      const reward = decodeNullableRewardState(state.reward, catalog, `${path}.reward`, {
        kind: 'producerLifecycle',
        key: room.prebossBatchPolicy.remainingOffers.reward.producerLifecycleKey,
      });
      if (reward === null) return Object.freeze({ kind: 'freeReward', reward: null });
      const offer = decodeCountedOffer(
        reward.offer,
        catalog,
        room.prebossBatchPolicy.remainingOffers.reward,
        `${path}.reward.offer`,
      );
      return Object.freeze({
        kind: 'freeReward',
        reward: Object.freeze({ ...reward, offer }),
      });
    }
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
