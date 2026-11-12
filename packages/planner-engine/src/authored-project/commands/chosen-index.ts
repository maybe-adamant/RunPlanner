import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress, createOccurrenceAddress, type OccurrenceAddress } from '../addresses';
import type { ProjectDocument, RoomActionReference } from '../model';
import {
  chosenRoomActionIndexes,
  placeRoomActionsAtChosenIndex,
  type PlacedRoomActions,
} from '../room-actions/chosen-position';
import { roomActionKey } from '../room-actions/state';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../shop';
import { failCommand } from './contract';
import type { ProjectCommand } from './types';

/**
 * Commands that place a new action at a default position or a chosen index:
 * object purchases and the placement of a derived pickup.
 */
export type PositionedCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceShopPurchaseParticipation'
      | 'PurchaseShopTravelDealRefill'
      | 'SetStygianWellPurchase'
      | 'SetHermesShrinePurchase'
      | 'SetHermesShrineRush'
      | 'PurchaseHermesShrineOffer'
      | 'PlaceHermesShrineDelivery'
      | 'PlaceClockedTraitPickup'
      | 'PlaceEchoGoldPickup';
  }
>;

/** The room a derived pickup's entry belongs to, or the object's own room. */
function commandOccurrence(command: PositionedCommand): OccurrenceAddress {
  switch (command.kind) {
    case 'ReplaceShopPurchaseParticipation':
      return createOccurrenceAddress(
        createBiomeAddress(command.offer.routeKey, command.offer.biomeKey),
        command.offer.occurrenceId,
      );
    case 'PlaceHermesShrineDelivery':
    case 'PlaceClockedTraitPickup':
    case 'PlaceEchoGoldPickup': {
      const site = command.entry.site;
      if (site.owner.kind !== 'occurrence')
        throw new Error(`${site.pointKey} is not an occurrence's acquisition site`);
      return createOccurrenceAddress(
        createBiomeAddress(site.routeKey, site.biomeKey),
        site.owner.occurrenceId,
      );
    }
    default:
      return command.occurrence;
  }
}

/** The room action a positioned command places first. */
export function positionedCommandReference(command: PositionedCommand): RoomActionReference {
  switch (command.kind) {
    case 'PlaceHermesShrineDelivery':
    case 'PlaceClockedTraitPickup':
    case 'PlaceEchoGoldPickup':
      return Object.freeze({
        kind: 'interactAcquisitionEntry',
        siteKey: command.entry.site.pointKey,
        entryKey: command.entry.entryKey,
      });
    case 'ReplaceShopPurchaseParticipation':
      return Object.freeze({ kind: 'interactShopOffer', offerKey: command.offer.offerKey });
    case 'PurchaseShopTravelDealRefill':
      return Object.freeze({
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: TRAVEL_DEAL_REFILL_ENTRY_KEY,
      });
    case 'SetStygianWellPurchase':
      return Object.freeze({
        kind: 'purchaseStygianWellOffer',
        generationKey: command.generationKey,
      });
    case 'SetHermesShrinePurchase':
    case 'PurchaseHermesShrineOffer':
      return Object.freeze({
        kind: 'purchaseHermesShrineOffer',
        generationKey: command.generationKey,
      });
    case 'SetHermesShrineRush':
      return Object.freeze({ kind: 'rushHermesShrineOffer', generationKey: command.generationKey });
  }
}

/** The actions the command placed, in the order they move together. */
function placedActions(placed: ProjectDocument, command: PositionedCommand): PlacedRoomActions {
  return Object.freeze({
    document: placed,
    occurrence: commandOccurrence(command),
    keys: Object.freeze([roomActionKey(positionedCommandReference(command))]),
  });
}

/**
 * Moves the actions the command just placed by default to its chosen index,
 * or refuses the command; absent an index, the default placement stands.
 */
export function withChosenIndex(
  placed: ProjectDocument,
  catalog: Catalog,
  command: PositionedCommand,
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
  command: PositionedCommand,
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
