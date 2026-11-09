import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress, createOccurrenceAddress, type OccurrenceAddress } from '../addresses';
import { hermesShrineDeliveryEntryKey } from '../hermes-shrine-delivery';
import type { ProjectDocument } from '../model';
import {
  chosenRoomActionIndexes,
  placeRoomActionsAtChosenIndex,
  type PlacedRoomActions,
} from '../room-actions/chosen-position';
import { roomActionKey } from '../room-actions/state';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../shop';
import { failCommand } from './contract';
import type { ProjectCommand } from './types';

/** Object interactions that place their actions at a default position or a chosen index. */
export type PositionedObjectCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceShopPurchaseParticipation'
      | 'PurchaseShopTravelDealRefill'
      | 'SetStygianWellPurchase'
      | 'SetHermesShrinePurchase'
      | 'PurchaseHermesShrineOffer';
  }
>;

function commandOccurrence(command: PositionedObjectCommand): OccurrenceAddress {
  return command.kind === 'ReplaceShopPurchaseParticipation'
    ? createOccurrenceAddress(
        createBiomeAddress(command.offer.routeKey, command.offer.biomeKey),
        command.offer.occurrenceId,
      )
    : command.occurrence;
}

/**
 * The actions the command placed, in the order they move together: the
 * purchase, then a rushed Shrine item's pickup when the rush placed one.
 */
function placedActions(
  placed: ProjectDocument,
  command: PositionedObjectCommand,
): PlacedRoomActions {
  const occurrence = commandOccurrence(command);
  let keys: string[];
  switch (command.kind) {
    case 'ReplaceShopPurchaseParticipation':
      keys = [roomActionKey({ kind: 'interactShopOffer', offerKey: command.offer.offerKey })];
      break;
    case 'PurchaseShopTravelDealRefill':
      keys = [
        roomActionKey({
          kind: 'interactAcquisitionEntry',
          siteKey: 'roomExit',
          entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
        }),
      ];
      break;
    case 'SetStygianWellPurchase':
      keys = [
        roomActionKey({
          kind: 'purchaseStygianWellOffer',
          generationKey: command.generationKey,
        }),
      ];
      break;
    case 'SetHermesShrinePurchase':
    case 'PurchaseHermesShrineOffer': {
      keys = [
        roomActionKey({
          kind: 'purchaseHermesShrineOffer',
          generationKey: command.generationKey,
          rushed: false,
        }),
      ];
      if (command.kind === 'PurchaseHermesShrineOffer' && command.rushed) {
        // A rushed item spawns as the Shrine closes; its optional pickup follows the purchase.
        const pickupKey = roomActionKey({
          kind: 'interactAcquisitionEntry',
          siteKey: 'hermesShrineDelivery',
          entryKey: hermesShrineDeliveryEntryKey(occurrence, command.generationKey),
        });
        const host = placed.route.biomes
          .find((plan) => plan.biomeKey === occurrence.biomeKey)
          ?.topology?.occurrences.find(
            (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
          );
        if (host?.roomActions.order.some((reference) => roomActionKey(reference) === pickupKey))
          keys.push(pickupKey);
      }
      break;
    }
  }
  return Object.freeze({ document: placed, occurrence, keys: Object.freeze(keys) });
}

/**
 * Moves the actions the command just placed by default to its chosen index,
 * or refuses the command; absent an index, the default placement stands.
 */
export function withChosenIndex(
  placed: ProjectDocument,
  catalog: Catalog,
  command: PositionedObjectCommand,
): ProjectDocument {
  if (command.index === undefined) return placed;
  const result = placeRoomActionsAtChosenIndex(
    catalog,
    placedActions(placed, command),
    command.index,
  );
  if (result.kind === 'refused') failCommand(command, result.reason);
  return result.document;
}

/**
 * Every index the command's new actions may take, ascending, given the
 * document before it and after its default placement; empty when the command
 * places no new action.
 */
export function chosenIndexesFor(
  before: ProjectDocument,
  placed: ProjectDocument,
  catalog: Catalog,
  command: PositionedObjectCommand,
): readonly number[] {
  const actions = placedActions(placed, command);
  const host = before.route.biomes
    .find((plan) => plan.biomeKey === actions.occurrence.biomeKey)
    ?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === actions.occurrence.occurrenceId,
    );
  if (host?.roomActions.order.some((reference) => roomActionKey(reference) === actions.keys[0]))
    return Object.freeze([]);
  return chosenRoomActionIndexes(catalog, actions);
}
