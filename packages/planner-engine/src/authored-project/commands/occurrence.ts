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
import { createUnresolvedAcquisitionRewardState } from '../traits';
import { hermesShrineInitialSlotKey } from '../model';

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
        const { hermesShrine: _removed, ...withoutShrine } = occurrence;
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
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          hermesShrine: Object.freeze({
            ...occurrence.hermesShrine,
            offerBySlot: Object.freeze({
              ...occurrence.hermesShrine.offerBySlot,
              [command.slotKey]: createUnresolvedAcquisitionRewardState(catalog, command.value, {
                kind: 'producerLifecycle',
                key: 'HermesShrineDelivery',
              }),
            }),
          }),
        }),
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
      const { purchaseBySlot: _priorPurchaseBySlot, ...shrineWithoutPurchase } =
        occurrence.hermesShrine;
      return updateOccurrence(
        document,
        located,
        Object.freeze({
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
                      const { purchase: _priorPurchase, ...withoutPurchase } =
                        occurrence.hermesShrine.travelDealRefill ?? { offer: null };
                      return withoutPurchase;
                    })(),
                    ...(command.purchase === null
                      ? {}
                      : { purchase: Object.freeze(command.purchase) }),
                  }),
                }),
          }) as import('../model').HermesShrineState,
        }),
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
              offer: createUnresolvedAcquisitionRewardState(catalog, command.value, {
                kind: 'producerLifecycle',
                key: 'HermesShrineDelivery',
              }),
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
