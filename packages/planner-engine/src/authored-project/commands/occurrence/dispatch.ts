import type { Catalog } from '../../../catalog-schema';
import { routeErisHost, routeRoomShop } from '../../route-profile';
import { resolveEntryDeclaration } from '../../room-state/entry-resolution';
import type { ProjectDocument } from '../../model';

import type { LocatedBiome } from '../contract';
import { applyEncounterOccurrenceCommand } from './encounter';
import { applyIncomingRewardCommand } from './incoming-reward';
import { applyLocalRewardCommand } from './local-reward';
import { applyShipOccurrenceCommand } from './ship';
import { applyShopOccurrenceCommand } from './shop';
import { applyInfernalContractPedestalCommand } from './infernal-contract-pedestal';
import { applyPhantomExitCommand } from './phantom-exit';
import { applyFieldsOccurrenceCommand } from './fields';
import { applyFeatureRollCommand, pinRollSlot, roomShopItemKeys } from './feature-rolls';
import {
  INITIAL_ROLL_KEY,
  parseStygianWellGenerationKey,
  stygianWellGenerationItemKey,
} from '../../feature-rolls';
import type { OccurrenceLeafCommand } from '../types';
import { requireOccurrence, failCommand } from '../contract';
import { updateOccurrence } from './mutation';
import {
  DEFAULT_HERMES_SHRINE_DELAY,
  HERMES_SHRINE_DELAYS,
  hermesShrineInitialSlotKey,
  type HermesShrineGenerationKey,
  type HermesShrineInventoryOffer,
  type HermesShrineState,
} from '../../model';
import {
  defaultHermesShrineDeliveryReward,
  firstRushedInitialPurchase,
  hermesShrineDeliveryEntryKey,
  hermesShrinePurchaseAction,
  offerFor,
  unplaceHermesShrineDelivery,
} from '../../hermes-shrine-delivery';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  type OccurrenceAddress,
} from '../../addresses';
import { roomActionKey } from '../../room-actions/key';
import {
  roomActionDomainForOccurrence,
  scheduleRequiredRoomActions,
} from '../../room-actions/defaults';

function withRushedHermesDelivery(
  occurrence: import('../../model').RoomOccurrence,
  origin: OccurrenceAddress,
  catalog: Catalog,
  generationKey: import('../../model').HermesShrineGenerationKey,
  rewardType: string,
): import('../../model').RoomOccurrence {
  const entryKey = hermesShrineDeliveryEntryKey(origin, generationKey);
  const site = occurrence.acquisitionSites?.hermesShrineDelivery;
  const current = site?.pickupEntries?.[entryKey];
  const reward =
    current !== undefined && current !== null && current.offer.rewardType === rewardType
      ? current
      : defaultHermesShrineDeliveryReward(catalog, rewardType, origin.routeKey);
  return Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      hermesShrineDelivery: Object.freeze({
        ...(site ?? {}),
        pickupEntries: Object.freeze({
          ...(site?.pickupEntries ?? {}),
          [entryKey]: reward,
        }),
      }),
    }),
  });
}

/**
 * Keeps the refill purchase, and its rushed pickup, after the first rushed
 * initial purchase when an edit changes it.
 */
function followRefillTrigger(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  source: OccurrenceAddress,
): ProjectDocument {
  const biome = createBiomeAddress(source.routeKey, source.biomeKey);
  const host = roomActionDomainForOccurrence(document, catalog, biome, source.occurrenceId);
  if (host === undefined) return document;
  const order = host.occurrence.roomActions.order;
  const trigger = firstRushedInitialPurchase(order);
  const refillKey = roomActionKey({
    kind: 'purchaseHermesShrineOffer',
    generationKey: 'travelDealRefill',
    rushed: false,
  });
  const pickupKey = roomActionKey({
    kind: 'interactAcquisitionEntry',
    siteKey: 'hermesShrineDelivery',
    entryKey: hermesShrineDeliveryEntryKey(source, 'travelDealRefill'),
  });
  const refillIndex = order.findIndex((reference) => roomActionKey(reference) === refillKey);
  if (trigger === undefined || refillIndex < 0 || refillIndex > order.indexOf(trigger))
    return document;
  const moved = new Set(
    order.map(roomActionKey).filter((key) => key === refillKey || key === pickupKey),
  );
  const scheduled = scheduleRequiredRoomActions({
    catalog,
    domain: host.domain,
    order: order.filter((reference) => !moved.has(roomActionKey(reference))),
    requiredKeys: moved,
    participation: 'any',
  });
  return updateOccurrence(
    document,
    { ...located, plan: document.route.biomes[located.biomeIndex]! },
    Object.freeze({
      ...host.occurrence,
      roomActions: Object.freeze({ ...host.occurrence.roomActions, order: scheduled }),
    }),
  );
}

/** A restocked item keeps the delay rolled with its slot, or the default when first stocked. */
function stockedOffer(
  current: HermesShrineInventoryOffer | null | undefined,
  rewardType: string,
): HermesShrineInventoryOffer {
  return Object.freeze({
    rewardType,
    delay: current?.delay ?? DEFAULT_HERMES_SHRINE_DELAY,
  });
}

function requireSurfaceShopReward(
  catalog: Catalog,
  command: OccurrenceLeafCommand,
  rewardType: string,
): void {
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  if (!(profile?.groups.values.some((group) => group.rewardTypes.includes(rewardType)) ?? false))
    failCommand(command, `${rewardType} is not a SurfaceShop reward`);
}

function requireShrineGeneration(
  command: OccurrenceLeafCommand,
  generationKey: HermesShrineGenerationKey,
): void {
  const slotKey = hermesShrineInitialSlotKey(generationKey);
  if (generationKey !== 'travelDealRefill' && slotKey === undefined)
    failCommand(command, `unknown Hermes Shrine generation ${String(generationKey)}`);
}

export function applyOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: OccurrenceLeafCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'SetHermesShrinePresence': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const room = catalog.rooms.byKey[occurrence.gameName];
      const surfaceShop = room?.surfaceShop;
      if (
        surfaceShop === undefined ||
        surfaceShop.forced ||
        surfaceShop.spawnChance <= 0 ||
        (room?.challengeSwitchAnchorCount ?? 0) <= 0
      )
        failCommand(command, 'occurrence is not an eligible ordinary Surface Shop host');
      if (!command.present) {
        const withoutShrine = { ...occurrence };
        delete withoutShrine.hermesShrine;
        return updateOccurrence(
          document,
          located,
          Object.freeze({
            ...withoutShrine,
            roomActions: Object.freeze({
              ...occurrence.roomActions,
              order: Object.freeze(
                occurrence.roomActions.order.filter(
                  (reference) => reference.kind !== 'purchaseHermesShrineOffer',
                ),
              ),
            }),
          }),
        );
      }
      if (occurrence.hermesShrine !== undefined) return document;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          hermesShrine: Object.freeze({
            offerBySlot: Object.freeze({ first: null, secondLeft: null, secondRight: null }),
          }),
        }),
      );
    }
    case 'ReplaceHermesShrineOffer': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const room = catalog.rooms.byKey[occurrence.gameName];
      const shrine: HermesShrineState =
        occurrence.hermesShrine ??
        (room?.surfaceShop?.forced === true
          ? Object.freeze({
              offerBySlot: Object.freeze({ first: null, secondLeft: null, secondRight: null }),
            })
          : failCommand(command, 'occurrence has no Hermes Shrine'));
      if (!['first', 'secondLeft', 'secondRight'].includes(command.slotKey))
        failCommand(command, `unknown Hermes Shrine slot ${String(command.slotKey)}`);
      requireSurfaceShopReward(catalog, command, command.value.rewardType);
      const nextOccurrence = Object.freeze({
        ...occurrence,
        hermesShrine: Object.freeze({
          ...shrine,
          offerBySlot: Object.freeze({
            ...shrine.offerBySlot,
            [command.slotKey]: stockedOffer(
              shrine.offerBySlot[command.slotKey],
              command.value.rewardType,
            ),
          }),
        }),
      });
      return updateOccurrence(
        document,
        located,
        hermesShrinePurchaseAction(occurrence.roomActions.order, `initial:${command.slotKey}`)
          ?.rushed === true
          ? withRushedHermesDelivery(
              nextOccurrence,
              command.occurrence,
              catalog,
              `initial:${command.slotKey}`,
              command.value.rewardType,
            )
          : nextOccurrence,
      );
    }
    case 'SetHermesShrineOfferDelay': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const shrine = occurrence.hermesShrine;
      if (shrine === undefined) failCommand(command, 'occurrence has no Hermes Shrine');
      requireShrineGeneration(command, command.generationKey);
      if (!HERMES_SHRINE_DELAYS.includes(command.delay))
        failCommand(command, 'Shrine delay must be from 2 through 8');
      const offer = offerFor(shrine, command.generationKey);
      if (offer === undefined || offer === null) failCommand(command, 'Shrine offer is unresolved');
      if (offer.delay === command.delay) return document;
      const retimed = Object.freeze({ ...offer, delay: command.delay });
      const slotKey = hermesShrineInitialSlotKey(command.generationKey);
      const updated = updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          hermesShrine: Object.freeze(
            slotKey === undefined
              ? { ...shrine, travelDealRefill: Object.freeze({ offer: retimed }) }
              : {
                  ...shrine,
                  offerBySlot: Object.freeze({ ...shrine.offerBySlot, [slotKey]: retimed }),
                },
          ),
        }),
      );
      // The delay only retimes a delayed delivery; a rush ignores it.
      const action = hermesShrinePurchaseAction(
        occurrence.roomActions.order,
        command.generationKey,
      );
      return action === undefined || action.rushed
        ? updated
        : unplaceHermesShrineDelivery(
            updated,
            hermesShrineDeliveryEntryKey(command.occurrence, command.generationKey),
          );
    }
    case 'SetHermesShrinePurchase': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.hermesShrine === undefined)
        failCommand(command, 'occurrence has no Hermes Shrine');
      requireShrineGeneration(command, command.generationKey);
      if (typeof command.purchased !== 'boolean')
        failCommand(command, 'Shrine purchased must be boolean');
      const selectedOffer = offerFor(occurrence.hermesShrine, command.generationKey);
      if (selectedOffer === undefined || selectedOffer === null)
        failCommand(command, 'Shrine offer is unresolved');
      const order = occurrence.roomActions.order;
      const existing = hermesShrinePurchaseAction(order, command.generationKey);
      const deliveryEntryKey = hermesShrineDeliveryEntryKey(
        command.occurrence,
        command.generationKey,
      );
      if (!command.purchased) {
        const nextOrder = order.filter((reference) => reference !== existing);
        // Clearing retracts the purchase's pickup and every placed delivery;
        // authored delivery payload remains for repair.
        const updated = unplaceHermesShrineDelivery(
          updateOccurrence(
            document,
            located,
            Object.freeze({
              ...occurrence,
              roomActions: Object.freeze({
                ...occurrence.roomActions,
                order: Object.freeze(nextOrder),
              }),
            }),
          ),
          deliveryEntryKey,
        );
        return command.generationKey !== 'travelDealRefill' &&
          firstRushedInitialPurchase(nextOrder) === undefined
          ? unplaceHermesShrineDelivery(
              updated,
              hermesShrineDeliveryEntryKey(command.occurrence, 'travelDealRefill'),
            )
          : followRefillTrigger(updated, catalog, located, command.occurrence);
      }
      if (existing !== undefined) return document;
      // A new purchase starts unrushed at its canonical timeline position.
      const reference = Object.freeze({
        kind: 'purchaseHermesShrineOffer' as const,
        generationKey: command.generationKey,
        rushed: false,
      });
      const appended = updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          roomActions: Object.freeze({
            ...occurrence.roomActions,
            order: Object.freeze([...order, reference]),
          }),
        }),
      );
      const host = roomActionDomainForOccurrence(
        appended,
        catalog,
        createBiomeAddress(command.occurrence.routeKey, command.occurrence.biomeKey),
        command.occurrence.occurrenceId,
      );
      if (host === undefined) failCommand(command, 'Shrine host has no room-action domain');
      const purchaseKey = roomActionKey(reference);
      const scheduled = scheduleRequiredRoomActions({
        catalog,
        domain: host.domain,
        order,
        requiredKeys: new Set([purchaseKey]),
        participation: 'any',
      });
      if (!scheduled.some((candidate) => roomActionKey(candidate) === purchaseKey))
        failCommand(command, 'Shrine purchase has no active room action');
      return unplaceHermesShrineDelivery(
        updateOccurrence(
          appended,
          { ...located, plan: appended.route.biomes[located.biomeIndex]! },
          Object.freeze({
            ...host.occurrence,
            roomActions: Object.freeze({ ...host.occurrence.roomActions, order: scheduled }),
          }),
        ),
        deliveryEntryKey,
      );
    }
    case 'SetHermesShrinePurchaseRush': {
      const occurrence = requireOccurrence(located.plan, command.action.occurrenceId, command);
      if (typeof command.rushed !== 'boolean')
        failCommand(command, 'Shrine purchase rushed must be boolean');
      const order = occurrence.roomActions.order;
      const index = order.findIndex(
        (reference) => roomActionKey(reference) === command.action.actionKey,
      );
      const action = order[index];
      if (action?.kind !== 'purchaseHermesShrineOffer')
        failCommand(command, 'action is not a Shrine purchase');
      if (action.rushed === command.rushed) return document;
      const offer = offerFor(occurrence.hermesShrine, action.generationKey);
      if (offer === undefined || offer === null) failCommand(command, 'Shrine offer is unresolved');
      const source = createOccurrenceAddress(
        createBiomeAddress(command.action.routeKey, command.action.biomeKey),
        occurrence.occurrenceId,
      );
      const nextOrder = Object.freeze(
        order.map((reference, position) =>
          position === index ? Object.freeze({ ...action, rushed: command.rushed }) : reference,
        ),
      );
      const withOrder = Object.freeze({
        ...occurrence,
        roomActions: Object.freeze({ ...occurrence.roomActions, order: nextOrder }),
      });
      const deliveryEntryKey = hermesShrineDeliveryEntryKey(source, action.generationKey);
      const updated = unplaceHermesShrineDelivery(
        updateOccurrence(
          document,
          located,
          command.rushed
            ? withRushedHermesDelivery(
                withOrder,
                source,
                catalog,
                action.generationKey,
                offer.rewardType,
              )
            : withOrder,
        ),
        deliveryEntryKey,
        command.rushed ? source : undefined,
      );
      if (!command.rushed)
        return action.generationKey !== 'travelDealRefill' &&
          firstRushedInitialPurchase(nextOrder) === undefined
          ? unplaceHermesShrineDelivery(
              updated,
              hermesShrineDeliveryEntryKey(source, 'travelDealRefill'),
            )
          : followRefillTrigger(updated, catalog, located, source);
      // A rushed item is optional loot; rank it once at its canonical position
      // so the author starts from the pickup and may remove it.
      const host = roomActionDomainForOccurrence(
        updated,
        catalog,
        createBiomeAddress(source.routeKey, source.biomeKey),
        source.occurrenceId,
      );
      if (host === undefined) failCommand(command, 'rushed Shrine host has no room-action domain');
      const scheduled = scheduleRequiredRoomActions({
        catalog,
        domain: host.domain,
        order: host.occurrence.roomActions.order,
        requiredKeys: new Set([
          roomActionKey({
            kind: 'interactAcquisitionEntry',
            siteKey: 'hermesShrineDelivery',
            entryKey: deliveryEntryKey,
          }),
        ]),
        participation: 'any',
      });
      return followRefillTrigger(
        scheduled === host.occurrence.roomActions.order
          ? updated
          : updateOccurrence(
              updated,
              { ...located, plan: updated.route.biomes[located.biomeIndex]! },
              Object.freeze({
                ...host.occurrence,
                roomActions: Object.freeze({ ...host.occurrence.roomActions, order: scheduled }),
              }),
            ),
        catalog,
        located,
        source,
      );
    }
    case 'PurchaseHermesShrineOffer': {
      const authored = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const shrine = authored.hermesShrine;
      if (shrine === undefined) failCommand(command, 'occurrence has no Hermes Shrine');
      requireShrineGeneration(command, command.generationKey);
      if (typeof command.rushed !== 'boolean')
        failCommand(command, 'Shrine purchase rushed must be boolean');
      if (command.rewardType !== undefined && command.generationKey !== 'travelDealRefill')
        failCommand(command, 'only the Travel Deal refill is stocked with its purchase');
      if (command.rewardType !== undefined)
        requireSurfaceShopReward(catalog, command, command.rewardType);
      const occurrence =
        command.rewardType === undefined
          ? authored
          : Object.freeze({
              ...authored,
              hermesShrine: Object.freeze({
                ...shrine,
                travelDealRefill: Object.freeze({
                  offer: stockedOffer(shrine.travelDealRefill?.offer, command.rewardType),
                }),
              }),
            });
      const offer = offerFor(occurrence.hermesShrine, command.generationKey);
      if (offer === undefined || offer === null) failCommand(command, 'Shrine offer is unresolved');
      const order = occurrence.roomActions.order;
      if (hermesShrinePurchaseAction(order, command.generationKey) !== undefined)
        failCommand(command, 'Shrine offer is already bought');
      // One pick appends the purchase at the end of the room's actions.
      const reference = Object.freeze({
        kind: 'purchaseHermesShrineOffer' as const,
        generationKey: command.generationKey,
        rushed: false,
      });
      const bought = unplaceHermesShrineDelivery(
        updateOccurrence(
          document,
          located,
          Object.freeze({
            ...occurrence,
            roomActions: Object.freeze({
              ...occurrence.roomActions,
              order: Object.freeze([...order, reference]),
            }),
          }),
        ),
        hermesShrineDeliveryEntryKey(command.occurrence, command.generationKey),
      );
      if (!command.rushed) return bought;
      return applyOccurrenceCommand(
        bought,
        catalog,
        { ...located, plan: bought.route.biomes[located.biomeIndex]! },
        {
          kind: 'SetHermesShrinePurchaseRush',
          action: createRoomActionAddress(
            createBiomeAddress(command.occurrence.routeKey, command.occurrence.biomeKey),
            command.occurrence.occurrenceId,
            roomActionKey(reference),
          ),
          rushed: true,
        },
      );
    }
    case 'ReplaceHermesShrineTravelDealRefill': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.hermesShrine === undefined)
        failCommand(command, 'occurrence has no Hermes Shrine');
      // The qualifying initial rush determines the physical slot group at its
      // action prefix. Retained refill detail deliberately stays editable when
      // that prefix later changes, so command structural validation admits the
      // whole SurfaceShop union; candidate evaluation owns the exact group.
      requireSurfaceShopReward(catalog, command, command.value.rewardType);
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          hermesShrine: Object.freeze({
            ...occurrence.hermesShrine,
            travelDealRefill: Object.freeze({
              offer: stockedOffer(
                occurrence.hermesShrine.travelDealRefill?.offer,
                command.value.rewardType,
              ),
            }),
          }),
        }),
      );
    }
    case 'SetErisSpawned': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (!command.spawned) {
        if (occurrence.eris === undefined) return document;
        const { eris: _removed, ...withoutEris } = occurrence;
        void _removed;
        return updateOccurrence(
          document,
          located,
          Object.freeze({
            ...withoutEris,
            roomActions: Object.freeze({
              ...occurrence.roomActions,
              order: Object.freeze(
                occurrence.roomActions.order.filter(
                  (reference) => reference.kind !== 'interactEris',
                ),
              ),
            }),
          }),
        );
      }
      const room = catalog.rooms.byKey[occurrence.gameName];
      if (
        room === undefined ||
        routeErisHost(resolveEntryDeclaration(room, located.routePosition), located.routeKey) ===
          undefined
      )
        failCommand(command, `${occurrence.gameName} hosts no Eris on this route`);
      if (occurrence.eris !== undefined) return document;
      return updateOccurrence(
        document,
        located,
        Object.freeze({ ...occurrence, eris: Object.freeze({ spawned: true as const }) }),
      );
    }
    case 'ReplacePurgingPoolSlot': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.purgingPool === undefined)
        failCommand(command, 'occurrence has no Purging Pool');
      if (command.slotKey !== 'left' && command.slotKey !== 'middle' && command.slotKey !== 'right')
        failCommand(command, `unknown Purging Pool slot ${String(command.slotKey)}`);
      if (command.traitKey !== null && catalog.traits.byKey[command.traitKey] === undefined)
        failCommand(command, 'unknown trait');
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          purgingPool: Object.freeze({
            ...occurrence.purgingPool,
            traitKeyBySlot: Object.freeze({
              ...occurrence.purgingPool.traitKeyBySlot,
              [command.slotKey]: command.traitKey,
            }),
          }),
        }),
      );
    }
    case 'AddStygianWell': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const room = catalog.rooms.byKey[occurrence.gameName];
      const roomShop = routeRoomShop(room, located.routeKey);
      if (
        roomShop === undefined ||
        roomShop.forced ||
        roomShop.spawnChance <= 0 ||
        (room?.challengeSwitchAnchorCount ?? 0) <= 0
      )
        failCommand(command, 'occurrence is not an eligible ordinary Stygian Well host');
      if (occurrence.stygianWell !== undefined) return document;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell: Object.freeze({
            offerKeyBySlot: Object.freeze({ healing: null, secondLeft: null, secondRight: null }),
          }),
        }),
      );
    }
    case 'RemoveStygianWell': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const room = catalog.rooms.byKey[occurrence.gameName];
      if (routeRoomShop(room, located.routeKey)?.forced === true)
        failCommand(command, 'forced Postboss Stygian Well cannot be removed');
      if (occurrence.stygianWell === undefined) return document;
      const withoutWell = { ...occurrence };
      delete withoutWell.stygianWell;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...withoutWell,
          roomActions: Object.freeze({
            ...occurrence.roomActions,
            order: Object.freeze(
              occurrence.roomActions.order.filter(
                (r) => r.kind !== 'purchaseStygianWellOffer' && r.kind !== 'rerollStygianWell',
              ),
            ),
          }),
        }),
      );
    }
    case 'InsertStygianWellReroll':
    case 'ReplaceStygianWellRollOffer':
    case 'InsertPurgingPoolReroll':
    case 'ReplacePurgingPoolRollSlot':
    case 'SellPurgingPoolRollSlot':
      return applyFeatureRollCommand(document, catalog, located, command);
    case 'ReplaceStygianWellOffer': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const well = occurrence.stygianWell;
      if (well === undefined) failCommand(command, 'occurrence has no present Stygian Well');
      if (!['healing', 'secondLeft', 'secondRight'].includes(command.slotKey))
        failCommand(command, 'unknown Stygian Well slot');
      const known = new Set(
        catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((g) =>
          [...g.options.values].map((o) => o.key),
        ) ?? [],
      );
      if (command.itemKey !== null && !known.has(command.itemKey))
        failCommand(command, 'unknown RoomShop item');
      const previousItemKey = well.offerKeyBySlot[command.slotKey];
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell: Object.freeze({
            ...well,
            offerKeyBySlot: Object.freeze({
              ...well.offerKeyBySlot,
              [command.slotKey]: command.itemKey,
            }),
            ...(previousItemKey === 'RandomStoreItem' && command.itemKey === 'RandomStoreItem'
              ? {}
              : well.twistResultKeyBySlot === undefined
                ? {}
                : {
                    twistResultKeyBySlot: Object.freeze(
                      Object.fromEntries(
                        Object.entries(well.twistResultKeyBySlot ?? {}).filter(
                          ([slotKey]) => slotKey !== command.slotKey,
                        ),
                      ),
                    ),
                  }),
          }),
        }),
      );
    }
    case 'ReplaceStygianWellTravelDealRefill': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const well = occurrence.stygianWell;
      if (well === undefined) failCommand(command, 'occurrence has no present Stygian Well');
      const known = new Set(
        catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((g) =>
          [...g.options.values].map((o) => o.key),
        ) ?? [],
      );
      if (command.itemKey !== null && !known.has(command.itemKey))
        failCommand(command, 'unknown RoomShop item');
      const previousItemKey = well.travelDealRefillKey;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell: Object.freeze({
            ...well,
            travelDealRefillKey: command.itemKey,
            ...(previousItemKey === 'RandomStoreItem' && command.itemKey === 'RandomStoreItem'
              ? {}
              : well.twistResultKeyBySlot === undefined
                ? {}
                : {
                    twistResultKeyBySlot: Object.freeze(
                      Object.fromEntries(
                        Object.entries(well.twistResultKeyBySlot ?? {}).filter(
                          ([slotKey]) => slotKey !== 'travelDealRefill',
                        ),
                      ),
                    ),
                  }),
          }),
        }),
      );
    }
    case 'SetStygianWellPurchase': {
      const authored = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (authored.stygianWell === undefined)
        failCommand(command, 'occurrence has no present Stygian Well');
      const roll = parseStygianWellGenerationKey(command.generationKey);
      if (command.itemKey !== undefined && !command.purchased)
        failCommand(command, 'a slot is pinned only with its purchase');
      if (command.itemKey !== undefined && !roomShopItemKeys(catalog).has(command.itemKey))
        failCommand(command, 'unknown RoomShop item');
      const occurrence =
        command.itemKey === undefined
          ? authored
          : roll === undefined
            ? withStygianWellInitialItem(authored, 'travelDealRefill', command.itemKey)
            : roll.rollKey === INITIAL_ROLL_KEY
              ? withStygianWellInitialItem(authored, roll.slotKey, command.itemKey)
              : pinRollSlot(
                  catalog,
                  command,
                  authored,
                  'stygianWell',
                  roll.rollKey,
                  roll.slotKey,
                  command.itemKey,
                );
      const well = occurrence.stygianWell;
      if (well === undefined) failCommand(command, 'occurrence has no present Stygian Well');
      const generation = command.generationKey;
      // A purchase needs its item; one whose roll or item is gone can still be removed.
      if (command.purchased) {
        const item = stygianWellGenerationItemKey(occurrence, generation);
        if (item === null || item === undefined)
          failCommand(command, 'Stygian Well offer is unresolved');
      }
      const purchased = new Set(well.purchasedGenerationKeys ?? []);
      if (command.purchased) purchased.add(generation);
      else purchased.delete(generation);
      const order = command.purchased
        ? occurrence.roomActions.order.some(
            (r) => r.kind === 'purchaseStygianWellOffer' && r.generationKey === generation,
          )
          ? occurrence.roomActions.order
          : (() => {
              const reference = Object.freeze({
                kind: 'purchaseStygianWellOffer' as const,
                generationKey: generation,
              });
              const nextOrder = [...occurrence.roomActions.order];
              const refillIndex = nextOrder.findIndex(
                (r) =>
                  r.kind === 'purchaseStygianWellOffer' && r.generationKey === 'travelDealRefill',
              );
              const hasFirstPurchase = nextOrder.some(
                (r) =>
                  r.kind === 'purchaseStygianWellOffer' && r.generationKey !== 'travelDealRefill',
              );
              if (generation !== 'travelDealRefill' && !hasFirstPurchase && refillIndex >= 0)
                nextOrder.splice(refillIndex, 0, reference);
              else nextOrder.push(reference);
              return nextOrder;
            })()
        : occurrence.roomActions.order.filter(
            (r) => !(r.kind === 'purchaseStygianWellOffer' && r.generationKey === generation),
          );
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(order) }),
          stygianWell: Object.freeze({
            ...well,
            purchasedGenerationKeys: Object.freeze([...purchased]),
          }),
        }),
      );
    }
    case 'ReplaceStygianWellTwistResult': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const well = occurrence.stygianWell;
      if (well === undefined) failCommand(command, 'occurrence has no present Stygian Well');
      const parsed = parseStygianWellGenerationKey(command.generationKey);
      if (command.generationKey !== 'travelDealRefill' && parsed === undefined)
        failCommand(command, 'unknown Stygian Well generation');
      const parentItemKey = stygianWellGenerationItemKey(occurrence, command.generationKey);
      if (
        command.itemKey !== null &&
        (parentItemKey !== 'RandomStoreItem' ||
          !(well.purchasedGenerationKeys ?? []).includes(command.generationKey))
      )
        failCommand(command, 'Twist result requires a purchased RandomStoreItem generation');
      const twistGrant = catalog.rewards.shops.byKey.RoomShop?.groups.values
        .flatMap((group) => group.options.values)
        .find((option) => option.key === 'RandomStoreItem')?.stygianWell?.grant;
      const twistResultItemKeys = new Set(twistGrant?.kind === 'twist' ? twistGrant.pool : []);
      if (command.itemKey !== null && !twistResultItemKeys.has(command.itemKey))
        failCommand(command, 'item is not in the closed Twist result pool');
      if (parsed !== undefined && parsed.rollKey !== INITIAL_ROLL_KEY) {
        const order = occurrence.roomActions.order;
        const index = order.findIndex(
          (reference) =>
            reference.kind === 'rerollStygianWell' && reference.rerollId === parsed.rollKey,
        );
        const reroll = order[index];
        if (reroll?.kind !== 'rerollStygianWell')
          failCommand(command, 'unknown Stygian Well generation');
        const nextOrder = [...order];
        nextOrder[index] = Object.freeze({
          ...reroll,
          twistResultKeyBySlot: Object.freeze({
            ...reroll.twistResultKeyBySlot,
            [parsed.slotKey]: command.itemKey,
          }),
        });
        return updateOccurrence(
          document,
          located,
          Object.freeze({
            ...occurrence,
            roomActions: Object.freeze({
              ...occurrence.roomActions,
              order: Object.freeze(nextOrder),
            }),
          }),
        );
      }
      const childKey = parsed === undefined ? 'travelDealRefill' : parsed.slotKey;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell: Object.freeze({
            ...well,
            twistResultKeyBySlot: Object.freeze({
              ...well.twistResultKeyBySlot,
              [childKey]: command.itemKey,
            }),
          }),
        }),
      );
    }
    case 'ReplaceFieldsOptionalRewardCount':
      return applyFieldsOccurrenceCommand(document, catalog, located, command);
    case 'ReplaceIncomingReward':
      return applyIncomingRewardCommand(document, catalog, located, command);
    case 'ReplaceLocalReward':
      return applyLocalRewardCommand(document, catalog, located, command);
    case 'ReplaceShipEncounterCount':
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelOffer':
    case 'ReplaceRewardWheelPicked':
      return applyShipOccurrenceCommand(document, catalog, located, command);
    case 'ReplaceShopOffer':
    case 'ClearShopOffer':
    case 'ReplaceShopOfferOption':
      return applyShopOccurrenceCommand(document, catalog, located, command);
    case 'ReplaceInfernalContractPedestalOffer':
    case 'ReplaceInfernalContractPedestalOption':
    case 'ClearInfernalContractPedestal':
    case 'SetInfernalContractPedestalCollected':
      return applyInfernalContractPedestalCommand(document, catalog, located, command);
    case 'ReplacePhantomExit':
      return applyPhantomExitCommand(document, catalog, located, command);
    case 'SelectEncounter':
    case 'ResetEncounter':
    case 'SelectNemesisRandomEventFamily':
    case 'ReplaceNemesisRandomEventInteraction':
    case 'ReplaceFigLeafSkip':
    case 'ReplaceAetosWave':
    case 'ReplaceEncounterCustomization':
    case 'ReplaceGorgonDeathDefianceCondition':
      return applyEncounterOccurrenceCommand(document, catalog, located, command);
  }
}

/**
 * Pins an initial slot's or the Travel Deal restock's item; a changed item
 * drops the Twist result it resolved.
 */
function withStygianWellInitialItem(
  occurrence: import('../../model').RoomOccurrence,
  slotKey: import('../../model').StygianWellSlotKey | 'travelDealRefill',
  itemKey: string,
): import('../../model').RoomOccurrence {
  const well = occurrence.stygianWell!;
  const previous =
    slotKey === 'travelDealRefill' ? well.travelDealRefillKey : well.offerKeyBySlot[slotKey];
  if (previous === itemKey) return occurrence;
  const twists = Object.fromEntries(
    Object.entries(well.twistResultKeyBySlot ?? {}).filter(([key]) => key !== slotKey),
  );
  const { twistResultKeyBySlot: _previousTwists, ...rest } = well;
  void _previousTwists;
  return Object.freeze({
    ...occurrence,
    stygianWell: Object.freeze({
      ...rest,
      ...(slotKey === 'travelDealRefill'
        ? { travelDealRefillKey: itemKey }
        : { offerKeyBySlot: Object.freeze({ ...well.offerKeyBySlot, [slotKey]: itemKey }) }),
      ...(Object.keys(twists).length === 0 ? {} : { twistResultKeyBySlot: Object.freeze(twists) }),
    }),
  });
}
