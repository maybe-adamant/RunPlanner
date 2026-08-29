import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import type { LocatedBiome } from './contract';
import { applyEncounterOccurrenceCommand } from './occurrence-encounter';
import { applyIncomingRewardCommand } from './occurrence-incoming-reward';
import { applyLocalRewardCommand } from './occurrence-local-reward';
import { applyShipOccurrenceCommand } from './occurrence-ship';
import { applyShopOccurrenceCommand } from './occurrence-shop';
import { applyFieldsOccurrenceCommand } from './occurrence-fields';
import type { OccurrenceLeafCommand } from './types';
import { requireOccurrence, failCommand } from './contract';
import { updateOccurrence } from './occurrence-mutation';
import { hermesShrineInitialSlotKey } from '../model';
import {
  defaultHermesShrineDeliveryReward,
  hermesShrineDeliveryEntryKey,
} from '../hermes-shrine-delivery';

function withRushedHermesDelivery(
  occurrence: import('../model').RoomOccurrence,
  origin: import('../addresses').OccurrenceAddress,
  catalog: Catalog,
  generationKey: import('../model').HermesShrineGenerationKey,
  rewardType: string,
): import('../model').RoomOccurrence {
  const entryKey = hermesShrineDeliveryEntryKey(origin, generationKey);
  const site = occurrence.acquisitionSites?.hermesShrineDelivery;
  const current = site?.pickupEntries?.[entryKey];
  const reward =
    current !== undefined && current !== null && current.offer.rewardType === rewardType
      ? current
      : defaultHermesShrineDeliveryReward(catalog, rewardType);
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
        const order = occurrence.roomActions.order.filter(
          (reference) => reference.kind !== 'purchaseHermesShrineOffer',
        );
        const withoutShrine = { ...occurrence };
        delete withoutShrine.hermesShrine;
        return updateOccurrence(
          document,
          located,
          Object.freeze({
            ...withoutShrine,
            roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(order) }),
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
      if (occurrence.hermesShrine === undefined)
        failCommand(command, 'occurrence has no Hermes Shrine');
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
          ...occurrence.hermesShrine,
          offerBySlot: Object.freeze({
            ...occurrence.hermesShrine.offerBySlot,
            [command.slotKey]: Object.freeze({ rewardType: command.value.rewardType }),
          }),
        }),
      });
      return updateOccurrence(
        document,
        located,
        occurrence.hermesShrine.purchaseBySlot?.[command.slotKey]?.rushed === true
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
      const selectedOffer =
        command.generationKey === 'travelDealRefill'
          ? occurrence.hermesShrine.travelDealRefill?.offer
          : occurrence.hermesShrine.offerBySlot[slotKey!];
      if (selectedOffer === undefined || selectedOffer === null)
        failCommand(command, 'Shrine offer is unresolved');
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
      if (command.purchase !== null && typeof command.purchase.rushed !== 'boolean')
        failCommand(command, 'Shrine purchase rushed must be boolean');
      if (command.generationKey === 'travelDealRefill' && command.purchase?.rushed === true)
        failCommand(command, 'Shrine Travel Deal refill cannot be rushed');
      const existing = occurrence.hermesShrine.purchaseBySlot ?? {};
      const next = { ...existing } as Record<string, unknown>;
      if (slotKey !== undefined) {
        if (command.purchase === null) delete next[slotKey];
        else next[slotKey] = Object.freeze({ ...command.purchase });
      }
      const roomActions = Object.freeze({
        ...occurrence.roomActions,
        order: Object.freeze(
          command.purchase === null
            ? occurrence.roomActions.order.filter(
                (reference) =>
                  !(
                    reference.kind === 'purchaseHermesShrineOffer' &&
                    reference.generationKey === command.generationKey
                  ),
              )
            : occurrence.roomActions.order.some(
                  (reference) =>
                    reference.kind === 'purchaseHermesShrineOffer' &&
                    reference.generationKey === command.generationKey,
                )
              ? occurrence.roomActions.order
              : [
                  ...occurrence.roomActions.order,
                  Object.freeze({
                    kind: 'purchaseHermesShrineOffer' as const,
                    generationKey: command.generationKey,
                  }),
                ],
        ),
      });
      const shrineWithoutPurchase = { ...occurrence.hermesShrine };
      delete shrineWithoutPurchase.purchaseBySlot;
      const nextOccurrence = Object.freeze({
        ...occurrence,
        roomActions,
        hermesShrine: Object.freeze({
          ...shrineWithoutPurchase,
          ...(Object.keys(next).length === 0
            ? {}
            : {
                purchaseBySlot: Object.freeze(
                  next,
                ) as import('../model').HermesShrineState['purchaseBySlot'],
              }),
          ...(command.generationKey !== 'travelDealRefill'
            ? {}
            : {
                travelDealRefill: Object.freeze({
                  ...(() => {
                    const withoutPurchase = {
                      ...(occurrence.hermesShrine.travelDealRefill ?? { offer: null }),
                    };
                    delete withoutPurchase.purchase;
                    return withoutPurchase;
                  })(),
                  ...(command.purchase === null
                    ? {}
                    : { purchase: Object.freeze(command.purchase) }),
                }),
              }),
        }) as import('../model').HermesShrineState,
      });
      return updateOccurrence(
        document,
        located,
        command.purchase?.rushed === true
          ? withRushedHermesDelivery(
              nextOccurrence,
              command.occurrence,
              catalog,
              command.generationKey,
              selectedOffer.rewardType,
            )
          : nextOccurrence,
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
      const roomShop = room?.roomShop;
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
      if (room?.roomShop?.forced === true)
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
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          stygianWell: Object.freeze({ ...well, travelDealRefillKey: command.itemKey }),
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
        ? (generation.slice(8) as import('../model').StygianWellSlotKey)
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
          : [
              ...occurrence.roomActions.order,
              Object.freeze({
                kind: 'purchaseStygianWellOffer' as const,
                generationKey: generation,
              }),
            ]
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
        ? (command.generationKey.slice('initial:'.length) as import('../model').StygianWellSlotKey)
        : undefined;
      const parentItemKey =
        command.generationKey === 'travelDealRefill'
          ? well.travelDealRefillKey
          : slotKey === undefined
            ? undefined
            : well.offerKeyBySlot[slotKey];
      if (
        parentItemKey !== 'RandomStoreItem' ||
        !(well.purchasedGenerationKeys ?? []).includes(command.generationKey)
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
      return applyShopOccurrenceCommand(document, catalog, located, command);
    case 'SelectEncounter':
    case 'ResetEncounter':
    case 'ReplaceNemesisRandomEventOutcome':
    case 'ReplaceFigLeafSkip':
    case 'ReplaceGorgonDeathDefianceCondition':
      return applyEncounterOccurrenceCommand(document, catalog, located, command);
  }
}
