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
import {
  createDefaultLevelResolutions,
  createDefaultTraitOffers,
  type TraitOfferDefaultsContext,
} from '../traits';
import { shopProfileUsesDeathDefianceCondition } from '../shop';

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

function defaultShopState(
  catalog: Catalog,
  binding: ShopRewardBinding,
  path: string,
  loadout: TraitOfferDefaultsContext,
): ShopState {
  const profile = catalog.rewards.shops.byKey[binding.shopProfileKey];
  if (profile === undefined) {
    failProjectDocument(path, `unknown shop profile ${binding.shopProfileKey}`);
  }
  const offers: Record<string, ShopOfferState> = {};
  for (const slot of profile.slots.values) {
    offers[slot.key] = Object.freeze({
      reward: Object.freeze({
        offer: slot.defaultOffer,
        traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, slot.defaultOffer, loadout),
        ...(createDefaultLevelResolutions(catalog, slot.defaultOffer) === undefined
          ? {}
          : {
              levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
                catalog,
                slot.defaultOffer,
              ),
            }),
      }),
    });
  }
  return Object.freeze({
    profileKey: profile.key,
    ...(shopProfileUsesDeathDefianceCondition(catalog, profile.key)
      ? { deathDefianceConditionMet: false }
      : {}),
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
  catalog: Catalog,
  descriptor: EncounterRewardWheelAttachment,
  path: string,
  loadout: TraitOfferDefaultsContext,
): RewardWheelState {
  const offer = defaultCountedOffer(descriptor.reward, descriptor.defaultStoreKey, path);
  return Object.freeze({
    storeKey: descriptor.defaultStoreKey,
    offerCount: descriptor.offerCount.defaultValue,
    offers: Object.freeze(
      Object.fromEntries(
        descriptor.offerKeys.map((offerKey) => [
          offerKey,
          Object.freeze({
            offer,
            traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, offer, loadout),
            ...(createDefaultLevelResolutions(catalog, offer) === undefined
              ? {}
              : {
                  levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(catalog, offer),
                }),
          }),
        ]),
      ),
    ),
    pickedOfferIndex: 1,
  });
}

function defaultShipCombatState(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
  loadout: TraitOfferDefaultsContext,
): ShipCombatState {
  const wheels = requireShipCombatWheels(catalog, room, path);
  return Object.freeze({
    kind: 'shipCombat',
    encounterCount: 2,
    wheels: Object.freeze(
      Object.fromEntries(
        wheels.map((wheel) => [wheel.key, defaultRewardWheel(catalog, wheel, path, loadout)]),
      ),
    ),
  });
}

function defaultEphyraCombatState(
  catalog: Catalog,
  room: RoomDeclaration,
  resolvedStoreKey: string | undefined,
  path: string,
  loadout: TraitOfferDefaultsContext,
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
      reward: Object.freeze({
        offer: defaultCountedOffer(
          requireCountedBinding(sideRoom, path),
          sideRoom.individualRewardStoreKey ?? sideRoom.forcedRewardStoreKey,
          `${path}.sideRooms.${slot.slotKey}.offer`,
        ),
        traitOffersByAcquisitionRole: createDefaultTraitOffers(
          catalog,
          defaultCountedOffer(
            requireCountedBinding(sideRoom, path),
            sideRoom.individualRewardStoreKey ?? sideRoom.forcedRewardStoreKey,
            `${path}.sideRooms.${slot.slotKey}.offer`,
          ),
          loadout,
        ),
        ...(createDefaultLevelResolutions(
          catalog,
          defaultCountedOffer(
            requireCountedBinding(sideRoom, path),
            sideRoom.individualRewardStoreKey ?? sideRoom.forcedRewardStoreKey,
            `${path}.sideRooms.${slot.slotKey}.offer`,
          ),
        ) === undefined
          ? {}
          : {
              levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
                catalog,
                defaultCountedOffer(
                  requireCountedBinding(sideRoom, path),
                  sideRoom.individualRewardStoreKey ?? sideRoom.forcedRewardStoreKey,
                  `${path}.sideRooms.${slot.slotKey}.offer`,
                ),
              ),
            }),
      }),
      encounters: createDefaultRoomEncounterState(
        catalog,
        sideRoom,
        `${path}.sideRooms.${slot.slotKey}.encounters`,
      ),
    });
  }
  const offer = defaultCountedOffer(
    requireCountedBinding(room, path),
    defaultCountedStoreKey(room, resolvedStoreKey),
    `${path}.offer`,
  );
  return Object.freeze({
    kind: 'ephyraCombat',
    reward: Object.freeze({
      offer,
      traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, offer, loadout),
      ...(createDefaultLevelResolutions(catalog, offer) === undefined
        ? {}
        : { levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(catalog, offer) }),
    }),
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
  const defaultLoadout = context.loadout;
  const traitOffers = (offer: ResolvedRewardOffer) => ({
    reward: Object.freeze({
      offer,
      traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, offer, defaultLoadout),
      ...(createDefaultLevelResolutions(catalog, offer) === undefined
        ? {}
        : { levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(catalog, offer) }),
    }),
  });

  switch (authoredTemplateKey(room, path)) {
    case 'FixedIntro':
    case 'RewardlessCombat':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({ kind: 'none' });
    case 'FieldsCombat':
      requireOrdinaryRole(role, room, path);
      {
        const cages = defaultFieldsCages(room, path);
        return Object.freeze({
          kind: 'fieldsCombat',
          cages: Object.freeze(
            Object.fromEntries(
              Object.entries(cages).map(([slotKey, offer]) => [
                slotKey,
                Object.freeze({
                  offer,
                  traitOffersByAcquisitionRole: createDefaultTraitOffers(
                    catalog,
                    offer,
                    defaultLoadout,
                  ),
                  ...(createDefaultLevelResolutions(catalog, offer) === undefined
                    ? {}
                    : {
                        levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
                          catalog,
                          offer,
                        ),
                      }),
                }),
              ]),
            ),
          ),
        });
      }
    case 'ShipCombat':
      requireOrdinaryRole(role, room, path);
      return defaultShipCombatState(catalog, room, path, defaultLoadout);
    case 'EphyraCombat':
      requireOrdinaryRole(role, room, path);
      return defaultEphyraCombatState(
        catalog,
        room,
        context.resolvedStoreKey,
        path,
        defaultLoadout,
      );
    case 'FixedOpening':
    case 'FixedPreHub':
    case 'ClockworkCombat':
    case 'EphyraSideRoom':
    case 'Fountain':
    case 'Miniboss':
    case 'StandardCombat': {
      requireOrdinaryRole(role, room, path);
      const offer = defaultCountedOffer(
        requireCountedBinding(room, path),
        defaultCountedStoreKey(room, context.resolvedStoreKey),
        path,
      );
      return Object.freeze({
        kind: 'counted',
        ...traitOffers(offer),
      });
    }
    case 'Anomaly': {
      requireOrdinaryRole(role, room, path);
      const offer = defaultCountedOffer(
        requireCountedBinding(room, path),
        defaultCountedStoreKey(room, context.resolvedStoreKey),
        path,
      );
      return Object.freeze({
        kind: 'anomaly',
        ...traitOffers(offer),
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
      const offer = room.incomingReward.offer;
      return Object.freeze({
        kind: 'fixed',
        reward: Object.freeze({
          offer,
          traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, offer, defaultLoadout),
          ...(createDefaultLevelResolutions(catalog, offer) === undefined
            ? {}
            : { levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(catalog, offer) }),
        }),
      });
    }
    case 'Shop':
      requireOrdinaryRole(role, room, path);
      return Object.freeze({
        kind: 'shop',
        ...(entryActive
          ? {
              shop: defaultShopState(catalog, requireShopBinding(room, path), path, defaultLoadout),
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
                shop: defaultShopState(
                  catalog,
                  requireShopBinding(room, path),
                  path,
                  defaultLoadout,
                ),
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
      const offer = defaultCountedOffer(
        room.prebossBatchPolicy.remainingOffers.reward,
        defaultCountedStoreKey(room, context.resolvedStoreKey),
        path,
      );
      return Object.freeze({
        kind: 'freeReward',
        ...traitOffers(offer),
      });
    }
  }
}
