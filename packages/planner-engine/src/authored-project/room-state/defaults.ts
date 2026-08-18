import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '../../catalog-schema';
import type { CountedRewardBinding, ShopRewardBinding } from '../../reward-kernel/bindings';
import type {
  AuthoredRoomState,
  EphyraCombatState,
  RewardWheelState,
  ShipCombatState,
  ShopOfferState,
  ShopState,
} from '../model';
import { failProjectDocument } from '../validation';
import {
  authoredTemplateKey,
  requireCountedBinding,
  requireEphyraSideRooms,
  requireFieldsCages,
  requireFieldsOptionalRewards,
  requireOrdinaryRole,
  requireShipCombatWheels,
  requireShopBinding,
  type RoomStateContext,
} from './declaration';
import { createUnresolvedAcquisitionRewardState, producerLevelEffectSource } from '../traits';
import { shopProfileUsesDeathDefianceCondition } from '../shop';

function requireCountedStore(
  binding: CountedRewardBinding,
  storeKey: string | undefined,
  path: string,
): void {
  if (storeKey === undefined) {
    failProjectDocument(path, 'counted reward requires a resolved store');
  }
  if (!binding.storeKeys.includes(storeKey)) {
    failProjectDocument(path, `${storeKey} is not available from this room`);
  }
}

/**
 * A declaration-owned store narrows the set of defaults an occurrence may
 * use. A normal batch store is only the fallback for declarations that do
 * not impose either a forced or individual store.
 */
function defaultCountedStoreKey(
  room: RoomDeclaration,
  batchStoreKey: string | undefined,
): string | undefined {
  return room.forcedRewardStoreKey ?? room.individualRewardStoreKey ?? batchStoreKey;
}

function defaultShopState(catalog: Catalog, binding: ShopRewardBinding, path: string): ShopState {
  const profile = catalog.rewards.shops.byKey[binding.shopProfileKey];
  if (profile === undefined) {
    failProjectDocument(path, `unknown shop profile ${binding.shopProfileKey}`);
  }
  const offers: Record<string, ShopOfferState> = {};
  for (const slot of profile.slots.values) {
    offers[slot.key] = Object.freeze({ reward: null });
  }
  return Object.freeze({
    profileKey: profile.key,
    ...(shopProfileUsesDeathDefianceCondition(catalog, profile.key)
      ? { deathDefianceConditionMet: false }
      : {}),
    offers: Object.freeze(offers),
  });
}

function defaultFieldsCages(room: RoomDeclaration, path: string): Readonly<Record<string, null>> {
  const descriptor = requireFieldsCages(room, path);
  const cages: Record<string, null> = {};
  for (const slotKey of descriptor.slotKeys) {
    requireCountedStore(
      descriptor.reward,
      room.individualRewardStoreKey,
      `${path}.cages.${slotKey}`,
    );
    cages[slotKey] = null;
  }
  return Object.freeze(cages);
}

function defaultFieldsOptionalRewards(
  room: RoomDeclaration,
  path: string,
): Readonly<Record<string, null>> {
  const descriptor = requireFieldsOptionalRewards(room, path);
  return Object.freeze(
    Object.fromEntries(
      descriptor.slotKeys.map((slotKey) => [
        slotKey,
        (requireCountedStore(
          descriptor.reward,
          'FieldsOptionalRewards',
          `${path}.optionalRewards.${slotKey}`,
        ),
        null),
      ]),
    ),
  );
}

function defaultRewardWheel(
  catalog: Catalog,
  descriptor: EncounterRewardWheelAttachment,
  path: string,
): RewardWheelState {
  requireCountedStore(descriptor.reward, descriptor.defaultStoreKey, path);
  return Object.freeze({
    storeKey: descriptor.defaultStoreKey,
    offerCount: descriptor.offerCount.defaultValue,
    offers: Object.freeze(
      Object.fromEntries(descriptor.offerKeys.map((offerKey) => [offerKey, null])),
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
      Object.fromEntries(
        wheels.map((wheel) => [wheel.key, defaultRewardWheel(catalog, wheel, path)]),
      ),
    ),
  });
}

function defaultEphyraCombatState(
  _catalog: Catalog,
  room: RoomDeclaration,
  resolvedStoreKey: string | undefined,
  path: string,
): EphyraCombatState {
  requireEphyraSideRooms(room, path);
  requireCountedStore(
    requireCountedBinding(room, path),
    defaultCountedStoreKey(room, resolvedStoreKey),
    `${path}.offer`,
  );
  return Object.freeze({
    kind: 'ephyraCombat',
    reward: null,
  });
}

export function createDefaultRoomState(
  catalog: Catalog,
  room: RoomDeclaration,
  context: RoomStateContext,
): AuthoredRoomState {
  const path = `rooms.${room.gameName}.state`;
  const { role, entryActive } = context;
  const fixedReward = (
    offer: import('../../reward-kernel/model').ResolvedRewardOffer,
    source: import('../../reward-kernel/level-effects').LevelResolutionEffectSource,
  ) =>
    catalog.rewards.rewardTypes.byKey[offer.rewardType]?.payloadDomain === undefined
      ? createUnresolvedAcquisitionRewardState(catalog, offer, source)
      : null;

  switch (authoredTemplateKey(room, path)) {
    case 'FixedIntro':
    case 'RewardlessCombat':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({ kind: 'none' });
    case 'FieldsCombat':
      requireOrdinaryRole(role, room, path);
      {
        if (context.activeCageCount === undefined) {
          failProjectDocument(path, 'FieldsCombat default requires the selected active cage count');
        }
        const cages = defaultFieldsCages(room, path);
        const optionalRewards = defaultFieldsOptionalRewards(room, path);
        return Object.freeze({
          kind: 'fieldsCombat',
          optionalRewardCount: 2,
          optionalRewards: Object.freeze(
            Object.fromEntries(Object.entries(optionalRewards).map(([slotKey]) => [slotKey, null])),
          ),
          cages: Object.freeze(
            Object.fromEntries(Object.entries(cages).map(([slotKey]) => [slotKey, null])),
          ),
        });
      }
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
    case 'StandardCombat': {
      requireOrdinaryRole(role, room, path);
      requireCountedStore(
        requireCountedBinding(room, path),
        defaultCountedStoreKey(room, context.resolvedStoreKey),
        path,
      );
      return Object.freeze({
        kind: 'counted',
        reward: null,
      });
    }
    case 'Anomaly': {
      requireOrdinaryRole(role, room, path);
      requireCountedStore(
        requireCountedBinding(room, path),
        defaultCountedStoreKey(room, context.resolvedStoreKey),
        path,
      );
      return Object.freeze({
        kind: 'anomaly',
        reward: null,
        success: true,
      });
    }
    case 'Devotion':
    case 'ContractBoss':
    case 'Chaos':
    case 'Story': {
      requireOrdinaryRole(role, room, path);
      if (room.incomingReward.kind !== 'fixed') {
        failProjectDocument(
          path,
          `${authoredTemplateKey(room, path)} requires a fixed reward binding`,
        );
      }
      const offer = Object.freeze({ rewardType: room.incomingReward.rewardType });
      return Object.freeze({
        kind: 'fixed',
        reward: fixedReward(offer, producerLevelEffectSource(room.incomingReward)),
      });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({
        kind: 'shop',
        ...(entryActive
          ? {
              shop: defaultShopState(catalog, requireShopBinding(room, path), path),
            }
          : {}),
      });
    case 'Preboss': {
      if (role === 'ordinary') {
        failProjectDocument(path, 'Preboss requires a declaration-derived offer role');
      }
      if (role === 'prebossShop') {
        return Object.freeze({
          kind: 'shop',
          ...(entryActive
            ? {
                shop: defaultShopState(catalog, requireShopBinding(room, path), path),
              }
            : {}),
        });
      }
      if (
        room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors' ||
        room.prebossBatchPolicy.remainingOffers.kind !== 'counted'
      ) {
        failProjectDocument(path, 'Preboss has no counted remaining-offer policy');
      }
      requireCountedStore(
        room.prebossBatchPolicy.remainingOffers.reward,
        defaultCountedStoreKey(room, context.resolvedStoreKey),
        path,
      );
      return Object.freeze({
        kind: 'freeReward',
        reward: null,
      });
    }
  }
}
