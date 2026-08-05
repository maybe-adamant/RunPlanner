import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '../../catalog-schema';
import type { CountedRewardBinding, ShopRewardBinding } from '../../reward-kernel/bindings';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type {
  AuthoredRoomState,
  EphyraCombatState,
  EphyraSideRoomState,
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
  requireOrdinaryRole,
  requireShipCombatWheels,
  requireShopBinding,
  type RoomStateContext,
} from './declaration';
import { createDefaultRoomEncounterState } from './encounters';

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
    offers[slot.key] = Object.freeze({ offer: slot.defaultOffer });
  }
  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
    purchaseOrder: Object.freeze([]),
  });
}

function defaultFieldsCages(
  room: RoomDeclaration,
  path: string,
): Readonly<Record<string, ResolvedRewardOffer>> {
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

function defaultRewardWheel(
  descriptor: EncounterRewardWheelAttachment,
  path: string,
): RewardWheelState {
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
      encounters: createDefaultRoomEncounterState(
        catalog,
        sideRoom,
        `${path}.sideRooms.${slot.slotKey}.encounters`,
      ),
    });
  }
  return Object.freeze({
    kind: 'ephyraCombat',
    offer: defaultCountedOffer(
      requireCountedBinding(room, path),
      defaultCountedStoreKey(room, resolvedStoreKey),
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
    case 'Anomaly':
    case 'StandardCombat':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({
        kind: 'counted',
        offer: defaultCountedOffer(
          requireCountedBinding(room, path),
          defaultCountedStoreKey(room, context.resolvedStoreKey),
          path,
        ),
      });
    case 'Devotion':
    case 'ContractBoss':
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
    case 'Preboss':
      if (role === 'ordinary') {
        failProjectDocument(path, 'Preboss requires a declaration-derived offer role');
      }
      if (role === 'prebossShop') {
        return Object.freeze({
          kind: 'shop',
          ...(entryActive
            ? { shop: defaultShopState(catalog, requireShopBinding(room, path), path) }
            : {}),
        });
      }
      if (
        room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors' ||
        room.prebossBatchPolicy.remainingOffers.kind !== 'counted'
      ) {
        failProjectDocument(path, 'Preboss has no counted remaining-offer policy');
      }
      return Object.freeze({
        kind: 'freeReward',
        offer: defaultCountedOffer(
          room.prebossBatchPolicy.remainingOffers.reward,
          defaultCountedStoreKey(room, context.resolvedStoreKey),
          path,
        ),
      });
  }
}
