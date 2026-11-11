import type { Catalog } from '../../../catalog-schema';
import { routeErisHost, routeRoomShop } from '../../route-profile';
import { resolveEntryDeclaration } from '../../room-state/entry-resolution';
import type { ProjectDocument, RoomEncounterState } from '../../model';

import type { LocatedBiome } from '../contract';
import { applyEncounterOccurrenceCommand } from './encounter';
import { applyIncomingRewardCommand } from './incoming-reward';
import { applyLocalRewardCommand } from './local-reward';
import { applyShipOccurrenceCommand } from './ship';
import { applyShopOccurrenceCommand } from './shop';
import { applyInfernalContractPedestalCommand } from './infernal-contract-pedestal';
import { applyPhantomExitCommand } from './phantom-exit';
import { applyFieldsOccurrenceCommand } from './fields';
import {
  applyFeatureRollCommand,
  pinRollSlot,
  roomShopItemKeys,
  withoutStygianWellTwistResults,
} from './feature-rolls';
import {
  INITIAL_ROLL_KEY,
  parseStygianWellGenerationKey,
  stygianWellGenerationItemKey,
  stygianWellGenerationKey,
  stygianWellPurchasedGenerationKeys,
} from '../../feature-rolls';
import type { OccurrenceLeafCommand } from '../types';
import { requireOccurrence, failCommand } from '../contract';
import { withChosenIndex } from '../chosen-index';
import { updateOccurrence } from './mutation';
import {
  challengeSwitchCustomizationIssue,
  challengeSwitchHost,
  challengeSwitchOutcomeForVariant,
  challengeSwitchShapeIssue,
  defaultChallengeSwitch,
} from '../../acquisition/challenge-switch';
import { decodeGeneratedEncounterCustomization } from '../../room-state/decoding/generated-encounter-codec';
import {
  lockedExitsIssue,
  orderedLockedExits,
  unlockExitCustomizationIssue,
} from '../../locked-exits';
import {
  type AuthoredEncounterCustomization,
  defaultHermesShrineDelay,
  HERMES_SHRINE_DELAYS,
  hermesShrineInitialGenerationKey,
  hermesShrineInitialSlotKey,
  type HermesShrineGenerationKey,
  type HermesShrineInventoryOffer,
  type HermesShrineState,
} from '../../model';
import {
  defaultHermesShrineDeliveryReward,
  firstInitialRush,
  hermesShrineDeliveryEntryKey,
  hermesShrinePurchaseAction,
  hermesShrineRushAction,
  offerFor,
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
 * Keeps the refill purchase, its rush and its rushed pickup after the first
 * initial rush when an edit changes it.
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
  const trigger = firstInitialRush(order);
  const refillKey = roomActionKey({
    kind: 'purchaseHermesShrineOffer',
    generationKey: 'travelDealRefill',
  });
  const refillRushKey = roomActionKey({
    kind: 'rushHermesShrineOffer',
    generationKey: 'travelDealRefill',
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
    order
      .map(roomActionKey)
      .filter((key) => key === refillKey || key === refillRushKey || key === pickupKey),
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

/**
 * After a generation's rush or purchase leaves: the refill follows the first
 * initial rush still made, and with none left its rushed pickup is retracted.
 */
function afterRushChange(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  source: OccurrenceAddress,
  generationKey: HermesShrineGenerationKey,
): ProjectDocument {
  if (generationKey === 'travelDealRefill')
    return followRefillTrigger(document, catalog, located, source);
  const order =
    document.route.biomes[located.biomeIndex]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === source.occurrenceId,
    )?.roomActions.order ?? [];
  return firstInitialRush(order) === undefined
    ? unplaceHermesShrineDelivery(
        document,
        hermesShrineDeliveryEntryKey(source, 'travelDealRefill'),
      )
    : followRefillTrigger(document, catalog, located, source);
}

/** A restocked item keeps its rolled delay; a newly stocked one takes its identity's default. */
function stockedOffer(
  current: HermesShrineInventoryOffer | null | undefined,
  rewardType: string,
  occurrenceId: string,
  generationKey: HermesShrineGenerationKey,
): HermesShrineInventoryOffer {
  return Object.freeze({
    rewardType,
    delay: current?.delay ?? defaultHermesShrineDelay(occurrenceId, generationKey),
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
                  (reference) =>
                    reference.kind !== 'purchaseHermesShrineOffer' &&
                    reference.kind !== 'rushHermesShrineOffer',
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
              occurrence.occurrenceId,
              hermesShrineInitialGenerationKey(command.slotKey),
            ),
          }),
        }),
      });
      return updateOccurrence(
        document,
        located,
        hermesShrineRushAction(occurrence.roomActions.order, `initial:${command.slotKey}`) !==
          undefined
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
      const order = occurrence.roomActions.order;
      return hermesShrinePurchaseAction(order, command.generationKey) === undefined ||
        hermesShrineRushAction(order, command.generationKey) !== undefined
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
      const order = occurrence.roomActions.order;
      const existing = hermesShrinePurchaseAction(order, command.generationKey);
      const deliveryEntryKey = hermesShrineDeliveryEntryKey(
        command.occurrence,
        command.generationKey,
      );
      if (!command.purchased) {
        if (command.index !== undefined)
          failCommand(command, 'an index places only a new purchase');
        const rush = hermesShrineRushAction(order, command.generationKey);
        const nextOrder = order.filter((reference) => reference !== existing && reference !== rush);
        // Clearing retracts the purchase's rush, its pickup and every placed
        // delivery; authored delivery payload remains for repair.
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
        return afterRushChange(
          updated,
          catalog,
          located,
          command.occurrence,
          command.generationKey,
        );
      }
      if (existing !== undefined) {
        if (command.index !== undefined)
          failCommand(command, 'an index places only a new purchase');
        return document;
      }
      // Only a purchase needs its offer; an existing purchase leaves without it.
      const selectedOffer = offerFor(occurrence.hermesShrine, command.generationKey);
      if (selectedOffer === undefined || selectedOffer === null)
        failCommand(command, 'Shrine offer is unresolved');
      // A new purchase enters at its canonical timeline position.
      const reference = Object.freeze({
        kind: 'purchaseHermesShrineOffer' as const,
        generationKey: command.generationKey,
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
      return withChosenIndex(
        unplaceHermesShrineDelivery(
          updateOccurrence(
            appended,
            { ...located, plan: appended.route.biomes[located.biomeIndex]! },
            Object.freeze({
              ...host.occurrence,
              roomActions: Object.freeze({ ...host.occurrence.roomActions, order: scheduled }),
            }),
          ),
          deliveryEntryKey,
        ),
        catalog,
        command,
      );
    }
    case 'SetHermesShrineRush': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.hermesShrine === undefined)
        failCommand(command, 'occurrence has no Hermes Shrine');
      requireShrineGeneration(command, command.generationKey);
      if (typeof command.rushed !== 'boolean')
        failCommand(command, 'Shrine rushed must be boolean');
      const order = occurrence.roomActions.order;
      const existing = hermesShrineRushAction(order, command.generationKey);
      const source = createOccurrenceAddress(
        createBiomeAddress(command.occurrence.routeKey, command.occurrence.biomeKey),
        occurrence.occurrenceId,
      );
      const deliveryEntryKey = hermesShrineDeliveryEntryKey(source, command.generationKey);
      if (!command.rushed) {
        if (command.index !== undefined) failCommand(command, 'an index places only a new rush');
        if (existing === undefined) return document;
        // Un-rushing retracts the same-room pickup; its payload remains for repair.
        const updated = unplaceHermesShrineDelivery(
          updateOccurrence(
            document,
            located,
            Object.freeze({
              ...occurrence,
              roomActions: Object.freeze({
                ...occurrence.roomActions,
                order: Object.freeze(order.filter((reference) => reference !== existing)),
              }),
            }),
          ),
          deliveryEntryKey,
        );
        return afterRushChange(updated, catalog, located, source, command.generationKey);
      }
      if (existing !== undefined) {
        if (command.index !== undefined) failCommand(command, 'an index places only a new rush');
        return document;
      }
      const purchase = hermesShrinePurchaseAction(order, command.generationKey);
      if (purchase === undefined) failCommand(command, 'only a bought Shrine item can be rushed');
      const offer = offerFor(occurrence.hermesShrine, command.generationKey);
      if (offer === undefined || offer === null) failCommand(command, 'Shrine offer is unresolved');
      // A new rush enters right after its purchase unless an index places it
      // later; a rushed item is optional loot the owner picks up, so nothing ranks its pickup.
      const purchaseIndex = order.indexOf(purchase);
      const rush = Object.freeze({
        kind: 'rushHermesShrineOffer' as const,
        generationKey: command.generationKey,
      });
      const rushed = unplaceHermesShrineDelivery(
        updateOccurrence(
          document,
          located,
          withRushedHermesDelivery(
            Object.freeze({
              ...occurrence,
              roomActions: Object.freeze({
                ...occurrence.roomActions,
                order: Object.freeze([
                  ...order.slice(0, purchaseIndex + 1),
                  rush,
                  ...order.slice(purchaseIndex + 1),
                ]),
              }),
            }),
            source,
            catalog,
            command.generationKey,
            offer.rewardType,
          ),
        ),
        deliveryEntryKey,
        source,
      );
      return withChosenIndex(
        followRefillTrigger(rushed, catalog, located, source),
        catalog,
        command,
      );
    }
    case 'PurchaseHermesShrineOffer': {
      const authored = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const shrine = authored.hermesShrine;
      if (shrine === undefined) failCommand(command, 'occurrence has no Hermes Shrine');
      requireShrineGeneration(command, command.generationKey);
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
                  offer: stockedOffer(
                    shrine.travelDealRefill?.offer,
                    command.rewardType,
                    authored.occurrenceId,
                    'travelDealRefill',
                  ),
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
      return withChosenIndex(bought, catalog, command);
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
                occurrence.occurrenceId,
                'travelDealRefill',
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
    case 'ReplaceChallengeSwitch': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (command.variantKey === null) {
        if (occurrence.challengeSwitch === undefined) return document;
        const withoutSwitch = { ...occurrence };
        delete withoutSwitch.challengeSwitch;
        return updateOccurrence(
          document,
          located,
          Object.freeze({
            ...withoutSwitch,
            roomActions: Object.freeze({
              ...occurrence.roomActions,
              order: Object.freeze(
                occurrence.roomActions.order.filter(
                  (reference) => reference.kind !== 'interactChallengeSwitch',
                ),
              ),
            }),
          }),
        );
      }
      if (challengeSwitchHost(catalog, occurrence.gameName) === undefined)
        failCommand(command, `${occurrence.gameName} hosts no challenge switch`);
      // The game rolls a lock only where no switch spawned (RunLogic.lua CreateRoom).
      if ((occurrence.lockedExits ?? []).length > 0)
        failCommand(command, 'a room with locked doors never holds a challenge switch');
      const observed = defaultChallengeSwitch(catalog, command.variantKey);
      if (observed === undefined)
        failCommand(command, `unknown challenge switch ${command.variantKey}`);
      const current = occurrence.challengeSwitch;
      if (current?.variantKey === command.variantKey) return document;
      const sameKind =
        current !== undefined &&
        catalog.challengeSwitches.variants.byKey[current.variantKey]?.switchKind ===
          catalog.challengeSwitches.variants.byKey[command.variantKey]?.switchKind;
      // The outcome survives a variant change the new kind can end with.
      const next = Object.freeze({
        ...observed,
        ...(current === undefined
          ? {}
          : challengeSwitchOutcomeForVariant(catalog, current, command.variantKey)),
        // A pinned elite belongs to its RoomSet's Elite encounter, kept across Elite variants.
        ...(current?.elite === undefined ||
        catalog.challengeSwitches.variants.byKey[command.variantKey]?.switchKind !== 'elite'
          ? {}
          : { elite: current.elite }),
        // The kind fixes the encounter, so its customization survives within the kind.
        ...(current?.customization === undefined || !sameKind
          ? {}
          : { customization: current.customization }),
        // The switch stands where it stood whatever variant it shows.
        ...(current?.anchorId === undefined ? {} : { anchorId: current.anchorId }),
      });
      return updateOccurrence(
        document,
        located,
        Object.freeze({ ...occurrence, challengeSwitch: next }),
      );
    }
    case 'ReplaceLockedExit': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const current = occurrence.lockedExits ?? [];
      if (current.includes(command.exitKey) === command.locked) return document;
      const exitKeys = command.locked
        ? [...current, command.exitKey]
        : current.filter((exitKey) => exitKey !== command.exitKey);
      const issue = lockedExitsIssue(catalog, occurrence, exitKeys);
      if (issue !== undefined) failCommand(command, issue);
      const { lockedExits: _previous, ...withoutLocks } = occurrence;
      void _previous;
      const order = command.locked
        ? occurrence.roomActions.order
        : occurrence.roomActions.order.filter(
            (reference) => reference.kind !== 'unlockExit' || reference.exitKey !== command.exitKey,
          );
      // An opened door is no longer an item: its press and its fight go with it.
      const encounters = command.locked
        ? occurrence.encounters
        : withLockedExitCustomization(occurrence.encounters, command.exitKey, undefined);
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...withoutLocks,
          ...(exitKeys.length === 0
            ? {}
            : { lockedExits: orderedLockedExits(catalog, occurrence.gameName, exitKeys) }),
          encounters,
          roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(order) }),
        }),
      );
    }
    case 'ReplaceLockedExitCustomization': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (!(occurrence.lockedExits ?? []).includes(command.exitKey))
        failCommand(command, `${command.exitKey} is not locked`);
      if (command.value !== null) {
        const issue = unlockExitCustomizationIssue(
          catalog,
          occurrence.gameName,
          command.decisionKey,
          command.value,
        );
        if (issue !== undefined) failCommand(command, issue);
      }
      const current = occurrence.encounters.customizationByLockedExit?.[command.exitKey];
      const decisions: Record<string, AuthoredEncounterCustomization> = { ...(current ?? {}) };
      if (command.value === null) delete decisions[command.decisionKey];
      else
        decisions[command.decisionKey] = decodeGeneratedEncounterCustomization(
          command.value,
          command.decisionKey,
        );
      if (JSON.stringify(decisions) === JSON.stringify(current ?? {})) return document;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          encounters: withLockedExitCustomization(
            occurrence.encounters,
            command.exitKey,
            Object.keys(decisions).length === 0 ? undefined : Object.freeze(decisions),
          ),
        }),
      );
    }
    case 'ReplaceChallengeSwitchCustomization': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const current = occurrence.challengeSwitch;
      if (current === undefined) failCommand(command, 'occurrence has no challenge switch');
      if (command.value !== null) {
        const issue = challengeSwitchCustomizationIssue(
          catalog,
          occurrence.gameName,
          current.variantKey,
          command.decisionKey,
          command.value,
        );
        if (issue !== undefined) failCommand(command, issue);
      }
      const decisions: Record<string, AuthoredEncounterCustomization> = {
        ...(current.customization ?? {}),
      };
      if (command.value === null) delete decisions[command.decisionKey];
      else
        decisions[command.decisionKey] = decodeGeneratedEncounterCustomization(
          command.value,
          command.decisionKey,
        );
      if (JSON.stringify(decisions) === JSON.stringify(current.customization ?? {}))
        return document;
      const { customization: _previous, ...withoutCustomization } = current;
      void _previous;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          challengeSwitch: Object.freeze({
            ...withoutCustomization,
            ...(Object.keys(decisions).length === 0
              ? {}
              : { customization: Object.freeze(decisions) }),
          }),
        }),
      );
    }
    case 'ReplaceChallengeSwitchOutcome': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const current = occurrence.challengeSwitch;
      if (current === undefined) failCommand(command, 'occurrence has no challenge switch');
      const next = Object.freeze({
        variantKey: current.variantKey,
        outcome: command.outcome,
        nectarDropped: command.nectarDropped,
        ...(current.elite === undefined ? {} : { elite: current.elite }),
        ...(current.customization === undefined ? {} : { customization: current.customization }),
        ...(current.anchorId === undefined ? {} : { anchorId: current.anchorId }),
      });
      const issue = challengeSwitchShapeIssue(catalog, next);
      if (issue !== undefined) failCommand(command, issue);
      if (current.outcome === next.outcome && current.nectarDropped === next.nectarDropped)
        return document;
      return updateOccurrence(
        document,
        located,
        Object.freeze({ ...occurrence, challengeSwitch: next }),
      );
    }
    case 'ReplaceChallengeSwitchElite': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      const current = occurrence.challengeSwitch;
      if (current === undefined) failCommand(command, 'occurrence has no challenge switch');
      const { elite: _previous, ...withoutElite } = current;
      void _previous;
      const next = Object.freeze({
        ...withoutElite,
        ...(command.elite === null
          ? {}
          : {
              elite: Object.freeze({
                enemyKey: command.elite.enemyKey,
                attributeKeys: Object.freeze([...command.elite.attributeKeys]),
              }),
            }),
      });
      const issue = challengeSwitchShapeIssue(catalog, next);
      if (issue !== undefined) failCommand(command, issue);
      if (JSON.stringify(next.elite) === JSON.stringify(current.elite)) return document;
      return updateOccurrence(
        document,
        located,
        Object.freeze({ ...occurrence, challengeSwitch: next }),
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
      const restocked = Object.freeze({
        ...well,
        offerKeyBySlot: Object.freeze({
          ...well.offerKeyBySlot,
          [command.slotKey]: command.itemKey,
        }),
      });
      const generation = stygianWellGenerationKey(INITIAL_ROLL_KEY, command.slotKey);
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell:
            previousItemKey === 'RandomStoreItem' && command.itemKey === 'RandomStoreItem'
              ? restocked
              : withoutStygianWellTwistResults(restocked, (key) => key === generation),
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
      const restocked = Object.freeze({ ...well, travelDealRefillKey: command.itemKey });
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell:
            previousItemKey === 'RandomStoreItem' && command.itemKey === 'RandomStoreItem'
              ? restocked
              : withoutStygianWellTwistResults(restocked, (key) => key === 'travelDealRefill'),
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
      const alreadyOrdered = occurrence.roomActions.order.some(
        (r) => r.kind === 'purchaseStygianWellOffer' && r.generationKey === generation,
      );
      if (command.index !== undefined && (!command.purchased || alreadyOrdered))
        failCommand(command, 'an index places only a new purchase');
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
      return withChosenIndex(
        updateOccurrence(
          document,
          located,
          Object.freeze({
            ...occurrence,
            roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(order) }),
          }),
        ),
        catalog,
        command,
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
          !stygianWellPurchasedGenerationKeys(occurrence.roomActions.order).includes(
            command.generationKey,
          ))
      )
        failCommand(command, 'Twist result requires a purchased RandomStoreItem generation');
      const twistGrant = catalog.rewards.shops.byKey.RoomShop?.groups.values
        .flatMap((group) => group.options.values)
        .find((option) => option.key === 'RandomStoreItem')?.stygianWell?.grant;
      const twistResultItemKeys = new Set(twistGrant?.kind === 'twist' ? twistGrant.pool : []);
      if (command.itemKey !== null && !twistResultItemKeys.has(command.itemKey))
        failCommand(command, 'item is not in the closed Twist result pool');
      if (
        parsed !== undefined &&
        parsed.rollKey !== INITIAL_ROLL_KEY &&
        parentItemKey === undefined
      )
        failCommand(command, 'unknown Stygian Well generation');
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell: Object.freeze({
            ...well,
            twistResultKeyByGeneration: Object.freeze({
              ...well.twistResultKeyByGeneration,
              [command.generationKey]: command.itemKey,
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
    case 'SwapRewardWheelOffers':
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
    case 'ReplaceNemesisBetOutcome':
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
  const generation =
    slotKey === 'travelDealRefill' ? slotKey : stygianWellGenerationKey(INITIAL_ROLL_KEY, slotKey);
  return Object.freeze({
    ...occurrence,
    stygianWell: withoutStygianWellTwistResults(
      Object.freeze({
        ...well,
        ...(slotKey === 'travelDealRefill'
          ? { travelDealRefillKey: itemKey }
          : { offerKeyBySlot: Object.freeze({ ...well.offerKeyBySlot, [slotKey]: itemKey }) }),
      }),
      (key) => key === generation,
    ),
  });
}

/** The room's encounters with one locked door's fight decisions replaced, or dropped when undefined. */
function withLockedExitCustomization(
  encounters: RoomEncounterState,
  exitKey: string,
  decisions: Readonly<Record<string, AuthoredEncounterCustomization>> | undefined,
): RoomEncounterState {
  const { customizationByLockedExit: previous, ...rest } = encounters;
  if (decisions === undefined && previous?.[exitKey] === undefined) return encounters;
  const doors = { ...(previous ?? {}) };
  if (decisions === undefined) delete doors[exitKey];
  else doors[exitKey] = decisions;
  return Object.freeze({
    ...rest,
    ...(Object.keys(doors).length === 0 ? {} : { customizationByLockedExit: Object.freeze(doors) }),
  });
}
