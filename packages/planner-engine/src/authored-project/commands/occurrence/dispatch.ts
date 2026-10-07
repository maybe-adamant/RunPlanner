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
import { applyFieldsOccurrenceCommand } from './fields';
import type { OccurrenceLeafCommand } from '../types';
import { requireOccurrence, failCommand } from '../contract';
import { updateOccurrence } from './mutation';
import { hermesShrineInitialSlotKey } from '../../model';
import {
  defaultHermesShrineDeliveryReward,
  firstRushedInitialPurchase,
  hermesShrineDeliveryEntryKey,
  hermesShrinePurchaseAction,
  offerFor,
  purchaseFor,
  unplaceHermesShrineDelivery,
} from '../../hermes-shrine-delivery';
import {
  createBiomeAddress,
  createOccurrenceAddress,
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
 * Keeps the refill purchase, and its rushed pickup, after the purchase that now
 * triggers Travel Deal when an edit changes the first rushed initial purchase.
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
      const shrine: import('../../model').HermesShrineState =
        occurrence.hermesShrine ??
        (room?.surfaceShop?.forced === true
          ? Object.freeze({
              offerBySlot: Object.freeze({ first: null, secondLeft: null, secondRight: null }),
            })
          : failCommand(command, 'occurrence has no Hermes Shrine'));
      if (!['first', 'secondLeft', 'secondRight'].includes(command.slotKey))
        failCommand(command, `unknown Hermes Shrine slot ${String(command.slotKey)}`);
      const profile = catalog.rewards.shops.byKey.SurfaceShop;
      const supportedRewardTypes = new Set(
        profile?.groups.values.flatMap((group) => group.rewardTypes) ?? [],
      );
      if (!supportedRewardTypes.has(command.value.rewardType))
        failCommand(command, `${command.value.rewardType} is not a SurfaceShop reward`);
      const nextOccurrence = Object.freeze({
        ...occurrence,
        hermesShrine: Object.freeze({
          ...shrine,
          offerBySlot: Object.freeze({
            ...shrine.offerBySlot,
            [command.slotKey]: Object.freeze({ rewardType: command.value.rewardType }),
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
    case 'SetHermesShrinePurchase': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.hermesShrine === undefined)
        failCommand(command, 'occurrence has no Hermes Shrine');
      const slotKey = hermesShrineInitialSlotKey(command.generationKey);
      if (
        command.generationKey !== 'travelDealRefill' &&
        (slotKey === undefined || !['first', 'secondLeft', 'secondRight'].includes(slotKey))
      )
        failCommand(command, `unknown Hermes Shrine generation ${String(command.generationKey)}`);
      const selectedOffer = offerFor(occurrence.hermesShrine, command.generationKey);
      if (selectedOffer === undefined || selectedOffer === null)
        failCommand(command, 'Shrine offer is unresolved');
      if (command.purchase !== null && Object.keys(command.purchase).some((key) => key !== 'delay'))
        failCommand(command, 'Shrine purchase carries only its delay; rush is on its action');
      if (
        command.purchase !== null &&
        command.purchase.delay !== 2 &&
        command.purchase.delay !== 3 &&
        command.purchase.delay !== 4 &&
        command.purchase.delay !== 5 &&
        command.purchase.delay !== 6 &&
        command.purchase.delay !== 7 &&
        command.purchase.delay !== 8
      )
        failCommand(command, 'Shrine purchase delay must be from 2 through 8');
      const existing = purchaseFor(occurrence.hermesShrine, command.generationKey);
      const purchase =
        command.purchase === null ? undefined : Object.freeze({ delay: command.purchase.delay });
      const nextPurchases = { ...occurrence.hermesShrine.purchaseBySlot };
      if (slotKey !== undefined) {
        if (purchase === undefined) delete nextPurchases[slotKey];
        else nextPurchases[slotKey] = purchase;
      }
      const shrineWithoutPurchases = { ...occurrence.hermesShrine };
      delete shrineWithoutPurchases.purchaseBySlot;
      const refillWithoutPurchase = {
        ...(occurrence.hermesShrine.travelDealRefill ?? { offer: null }),
      };
      delete refillWithoutPurchase.purchase;
      const hermesShrine: import('../../model').HermesShrineState = Object.freeze({
        ...shrineWithoutPurchases,
        ...(Object.keys(nextPurchases).length === 0
          ? {}
          : { purchaseBySlot: Object.freeze(nextPurchases) }),
        ...(command.generationKey !== 'travelDealRefill'
          ? {}
          : {
              travelDealRefill: Object.freeze({
                ...refillWithoutPurchase,
                ...(purchase === undefined ? {} : { purchase }),
              }),
            }),
      });
      const order = occurrence.roomActions.order;
      const nextOrder =
        purchase === undefined
          ? order.filter(
              (reference) =>
                !(
                  reference.kind === 'purchaseHermesShrineOffer' &&
                  reference.generationKey === command.generationKey
                ),
            )
          : order;
      const deliveryEntryKey = hermesShrineDeliveryEntryKey(
        command.occurrence,
        command.generationKey,
      );
      let updated = updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          hermesShrine,
          roomActions: Object.freeze({
            ...occurrence.roomActions,
            order: Object.freeze(nextOrder),
          }),
        }),
      );
      if (purchase === undefined) {
        // Clearing retracts the purchase's pickup and every placed delivery;
        // authored delivery payload remains for repair.
        updated = unplaceHermesShrineDelivery(updated, deliveryEntryKey);
        return command.generationKey !== 'travelDealRefill' &&
          firstRushedInitialPurchase(nextOrder) === undefined
          ? unplaceHermesShrineDelivery(
              updated,
              hermesShrineDeliveryEntryKey(command.occurrence, 'travelDealRefill'),
            )
          : followRefillTrigger(updated, catalog, located, command.occurrence);
      }
      if (existing !== undefined) {
        // Delay is the rushed item's price; it only retimes a delayed delivery.
        return hermesShrinePurchaseAction(order, command.generationKey)?.rushed === true
          ? updated
          : unplaceHermesShrineDelivery(updated, deliveryEntryKey);
      }
      // A new purchase starts unrushed at its canonical timeline position.
      const host = roomActionDomainForOccurrence(
        updated,
        catalog,
        createBiomeAddress(command.occurrence.routeKey, command.occurrence.biomeKey),
        command.occurrence.occurrenceId,
      );
      if (host === undefined) failCommand(command, 'Shrine host has no room-action domain');
      const purchaseKey = roomActionKey({
        kind: 'purchaseHermesShrineOffer',
        generationKey: command.generationKey,
        rushed: false,
      });
      const scheduled = scheduleRequiredRoomActions({
        catalog,
        domain: host.domain,
        order: host.occurrence.roomActions.order,
        requiredKeys: new Set([purchaseKey]),
        participation: 'any',
      });
      if (!scheduled.some((reference) => roomActionKey(reference) === purchaseKey))
        failCommand(command, 'Shrine purchase has no active room action');
      return unplaceHermesShrineDelivery(
        updateOccurrence(
          updated,
          { ...located, plan: updated.route.biomes[located.biomeIndex]! },
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
    case 'ReplaceHermesShrineTravelDealRefill': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.hermesShrine === undefined)
        failCommand(command, 'occurrence has no Hermes Shrine');
      const profile = catalog.rewards.shops.byKey.SurfaceShop;
      const supportedRewardTypes = new Set(
        profile?.groups.values.flatMap((group) => group.rewardTypes) ?? [],
      );
      // The qualifying initial rush determines the physical slot group at its
      // action prefix. Retained refill detail deliberately stays editable when
      // that prefix later changes, so command structural validation admits the
      // whole SurfaceShop union; candidate evaluation owns the exact group.
      if (!supportedRewardTypes.has(command.value.rewardType))
        failCommand(command, `${command.value.rewardType} is not a SurfaceShop reward`);
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          hermesShrine: Object.freeze({
            ...occurrence.hermesShrine,
            travelDealRefill: Object.freeze({
              ...(occurrence.hermesShrine.travelDealRefill ?? {}),
              offer: Object.freeze({ rewardType: command.value.rewardType }),
            }),
          }),
        }),
      );
    }
    case 'SetPurgingPoolInteraction': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.purgingPool === undefined)
        failCommand(command, 'occurrence has no Purging Pool');
      const roomActions = command.interacted
        ? occurrence.roomActions
        : Object.freeze({
            ...occurrence.roomActions,
            order: Object.freeze(
              occurrence.roomActions.order.filter(
                (reference) => reference.kind !== 'sellPurgingPoolTrait',
              ),
            ),
          });
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          roomActions,
          purgingPool: Object.freeze({ ...occurrence.purgingPool, interacted: command.interacted }),
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
      if (!occurrence.purgingPool.interacted)
        failCommand(command, 'Purging Pool is not being interacted with');
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
            interacted: false,
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
              occurrence.roomActions.order.filter((r) => r.kind !== 'purchaseStygianWellOffer'),
            ),
          }),
        }),
      );
    }
    case 'SetStygianWellInteraction': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const room = catalog.rooms.byKey[occurrence.gameName];
      if (room?.roomShop === undefined) failCommand(command, 'occurrence has no Stygian Well host');
      if (occurrence.stygianWell === undefined)
        failCommand(command, 'occurrence has no present Stygian Well');
      if (!command.interacted) {
        const { stygianWell: prior, ...withoutWell } = occurrence;
        if (prior === undefined) return document;
        return updateOccurrence(
          document,
          located,
          Object.freeze({
            ...withoutWell,
            // Retain dormant authored detail; only participation and chronology turn off.
            stygianWell: Object.freeze({
              ...prior,
              interacted: false,
              purchasedGenerationKeys: Object.freeze([]),
            }),
            roomActions: Object.freeze({
              ...occurrence.roomActions,
              order: Object.freeze(
                occurrence.roomActions.order.filter((r) => r.kind !== 'purchaseStygianWellOffer'),
              ),
            }),
          }),
        );
      }
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell: Object.freeze({ ...occurrence.stygianWell, interacted: true }),
        }),
      );
    }
    case 'ReplaceStygianWellOffer': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const well = occurrence.stygianWell;
      if (well === undefined || !well.interacted)
        failCommand(command, 'Stygian Well is not being interacted with');
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
      if (well === undefined || !well.interacted)
        failCommand(command, 'Stygian Well is not being interacted with');
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
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const well = occurrence.stygianWell;
      if (well === undefined || !well.interacted)
        failCommand(command, 'Stygian Well is not being interacted with');
      const generation = command.generationKey;
      const slot = generation.startsWith('initial:')
        ? (generation.slice(8) as import('../../model').StygianWellSlotKey)
        : undefined;
      const item =
        generation === 'travelDealRefill'
          ? well.travelDealRefillKey
          : slot === undefined
            ? undefined
            : well.offerKeyBySlot[slot];
      if (item === null || item === undefined)
        failCommand(command, 'Stygian Well offer is unresolved');
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
              const hasInitialPurchase = nextOrder.some(
                (r) =>
                  r.kind === 'purchaseStygianWellOffer' && r.generationKey.startsWith('initial:'),
              );
              if (generation.startsWith('initial:') && !hasInitialPurchase && refillIndex >= 0)
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
      if (well === undefined || !well.interacted)
        failCommand(command, 'Stygian Well is not being interacted with');
      if (
        ![
          'initial:healing',
          'initial:secondLeft',
          'initial:secondRight',
          'travelDealRefill',
        ].includes(command.generationKey)
      )
        failCommand(command, 'unknown Stygian Well generation');
      const slotKey = command.generationKey.startsWith('initial:')
        ? (command.generationKey.slice(
            'initial:'.length,
          ) as import('../../model').StygianWellSlotKey)
        : undefined;
      const parentItemKey =
        command.generationKey === 'travelDealRefill'
          ? well.travelDealRefillKey
          : slotKey === undefined
            ? undefined
            : well.offerKeyBySlot[slotKey];
      if (
        command.itemKey !== null &&
        (parentItemKey !== 'RandomStoreItem' ||
          !(well.purchasedGenerationKeys ?? []).includes(command.generationKey))
      )
        failCommand(command, 'Twist result requires a purchased RandomStoreItem generation');
      const twistResultItemKeys = new Set(
        catalog.rewards.shops.byKey.RoomShop?.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === 'RandomStoreItem')?.stygianWell?.nestedResultItemKeys ??
          [],
      );
      if (command.itemKey !== null && !twistResultItemKeys.has(command.itemKey))
        failCommand(command, 'item is not in the closed Twist result pool');
      const childKey = command.generationKey === 'travelDealRefill' ? 'travelDealRefill' : slotKey!;
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
