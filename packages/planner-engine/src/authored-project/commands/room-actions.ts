import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, RoomActionReference } from '../model';
import { roomActionKey } from '../room-actions/state';
import {
  roomActionDomainForOccurrence,
  scheduleRequiredRoomActions,
  structurallyActiveOccurrenceIds,
} from '../room-actions/defaults';
import { createBiomeAddress, createOccurrenceAddress } from '../addresses';
import { reconcileAcquisitionResolvedRewardEntry } from '../acquisition/acquisition-entry';
import { parseClockedTraitGeneratedPickupEntryKey } from '../acquisition/pickup-producers';
import {
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  hermesShrineDeliverySourceAddress,
  isSameRoomDelivery,
  parseHermesShrineDeliveryEntryKey,
} from '../hermes-shrine-delivery';
import { authoredShopOffer, TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../shop';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { updateOccurrence } from './occurrence/mutation';
import type { RoomActionCommand } from './types';

function requireIndex(
  command: RoomActionCommand,
  value: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    failCommand(command, `${field} must be an integer from 0 through ${maximum}`);
  }
}

export function applyRoomActionCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: RoomActionCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const occurrenceId =
    command.kind === 'ReplaceShopPurchaseParticipation'
      ? command.offer.occurrenceId
      : command.kind === 'ReplaceFieldsCageOrder'
        ? command.occurrence.occurrenceId
        : (command.action as import('../addresses').RoomActionAddress).occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  const occurrenceIsActive = structurallyActiveOccurrenceIds(topology).has(occurrenceId);
  const commandAddress =
    command.kind === 'ReplaceShopPurchaseParticipation'
      ? command.offer
      : command.kind === 'ReplaceFieldsCageOrder'
        ? command.occurrence
        : command.action;
  const domain = roomActionDomainForOccurrence(
    document,
    catalog,
    createBiomeAddress(commandAddress.routeKey, commandAddress.biomeKey),
    occurrenceId,
  )?.domain;
  const order = occurrence.roomActions.order;
  if (command.kind === 'ReplaceFieldsCageOrder') {
    const cageOrder = domain?.fieldsCageOrder;
    if (cageOrder === undefined) {
      failCommand(command, 'occurrence does not own Fields cage order');
    }
    const activePhases = new Set(cageOrder.activePhaseKeys);
    if (
      activePhases.size === 0 ||
      command.phaseKeys.length !== activePhases.size ||
      new Set(command.phaseKeys).size !== activePhases.size ||
      command.phaseKeys.some((phaseKey) => !activePhases.has(phaseKey))
    ) {
      failCommand(command, 'phaseKeys must contain each active Fields cage exactly once');
    }
    if (!cageOrder.available) {
      failCommand(command, 'restore missing cage actions before changing their order');
    }
    if (cageOrder.phaseKeys.every((phaseKey, index) => phaseKey === command.phaseKeys[index]))
      return document;
    const activeCagePositions = (references: readonly RoomActionReference[]) =>
      references.flatMap((reference, index) =>
        reference.kind === 'completeFieldsCage' && activePhases.has(reference.phaseKey)
          ? [{ index, phaseKey: reference.phaseKey }]
          : [],
      );
    const nextOrder = [...order];
    // Resolve the prefix with ordinary insertion moves, without publishing or
    // reconciling an intermediate permutation. Other actions retain their sequence.
    for (let slot = 0; slot < command.phaseKeys.length - 1; slot += 1) {
      const current = activeCagePositions(nextOrder);
      const target = current[slot]!;
      const source = current.find((position) => position.phaseKey === command.phaseKeys[slot])!;
      if (source.index === target.index) continue;
      const [reference] = nextOrder.splice(source.index, 1);
      nextOrder.splice(target.index, 0, reference!);
    }
    return updateOccurrence(
      document,
      located,
      Object.freeze({
        ...occurrence,
        roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
      }),
    );
  }
  if (command.kind === 'ReplaceShopPurchaseParticipation') {
    if (command.offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY)
      failCommand(command, 'Travel Deal uses its roomExit acquisition entry participation');
    const reference = Object.freeze({
      kind: 'interactShopOffer' as const,
      offerKey: command.offer.offerKey,
    });
    const key = roomActionKey(reference);
    const existingIndex = order.findIndex((candidate) => roomActionKey(candidate) === key);
    const participationChanges = command.purchased ? existingIndex < 0 : existingIndex >= 0;
    if (command.purchased && participationChanges) {
      if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
      }
      if (authoredShopOffer(occurrence, command.offer.offerKey) === undefined) {
        failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
      }
    }
    const nextOrder = participationChanges
      ? command.purchased
        ? Object.freeze([...order, reference])
        : Object.freeze(order.filter((_, index) => index !== existingIndex))
      : order;
    const withParticipation =
      nextOrder === order
        ? occurrence
        : Object.freeze({
            ...occurrence,
            roomActions: Object.freeze({ order: nextOrder }),
          });
    const nextOccurrence = reconcileAcquisitionResolvedRewardEntry(
      catalog,
      withParticipation,
      command.offer.offerKey,
      command.purchased,
      occurrence.state.kind === 'shop'
        ? authoredShopOffer(occurrence, command.offer.offerKey)?.reward
        : undefined,
    );
    if (nextOccurrence === occurrence) return document;
    return updateOccurrence(document, located, nextOccurrence);
  }
  const existingIndex = order.findIndex(
    (reference) => roomActionKey(reference) === command.action.actionKey,
  );

  let nextOrder: RoomActionReference[];
  switch (command.kind) {
    case 'InsertRoomAction': {
      if (command.reference.kind === 'interactShopOffer') {
        failCommand(command, 'base Shop purchases use ReplaceShopPurchaseParticipation');
      }
      if (command.reference.kind === 'purchaseHermesShrineOffer') {
        failCommand(command, 'Shrine purchases use SetHermesShrinePurchase');
      }
      if (command.reference.kind === 'purchaseStygianWellOffer') {
        failCommand(command, 'Well purchases use SetStygianWellPurchase');
      }
      const key = roomActionKey(command.reference);
      if (key !== command.action.actionKey) {
        failCommand(command, 'reference does not match the addressed room action');
      }
      const contribution = domain?.contributions.find(
        (entry) =>
          entry.kind === 'action' && roomActionKey(entry.reference) === command.action.actionKey,
      );
      if (!occurrenceIsActive || domain === undefined || contribution?.kind !== 'action') {
        failCommand(command, 'room action is not active for this occurrence');
      }
      if (existingIndex >= 0) failCommand(command, 'room action is already ordered');
      requireIndex(command, command.index, order.length, 'index');
      if (contribution.participation === 'required') {
        const canonical = scheduleRequiredRoomActions({
          catalog,
          domain,
          order,
          requiredKeys: new Set([command.action.actionKey]),
        });
        const canonicalIndex = canonical.findIndex(
          (reference) => roomActionKey(reference) === command.action.actionKey,
        );
        if (command.index !== canonicalIndex) {
          failCommand(command, `required room action canonical index is ${canonicalIndex}`);
        }
      }
      nextOrder = [...order];
      nextOrder.splice(command.index, 0, command.reference);
      break;
    }
    case 'UnplaceGeneratedDelivery': {
      if (existingIndex < 0) failCommand(command, 'delivery is not ordered');
      const reference = order[existingIndex];
      if (
        reference?.kind !== 'interactAcquisitionEntry' ||
        reference.siteKey !== HERMES_SHRINE_DELIVERY_SITE_KEY
      )
        failCommand(command, 'action is not a relocatable generated delivery');
      const source = parseHermesShrineDeliveryEntryKey(reference.entryKey);
      if (source === undefined || source.routeKey !== document.route.routeKey)
        failCommand(command, 'delivery does not name an exact route source');
      if (
        isSameRoomDelivery(
          hermesShrineDeliverySourceAddress(source),
          createOccurrenceAddress(
            createBiomeAddress(command.action.routeKey, command.action.biomeKey),
            occurrenceId,
          ),
        )
      )
        failCommand(command, 'same-room Shrine delivery uses purchase repair');
      nextOrder = order.filter((_, index) => index !== existingIndex);
      break;
    }
    case 'RemoveRoomAction':
      if (existingIndex < 0) failCommand(command, 'room action is not ordered');
      if (order[existingIndex]?.kind === 'interactShopOffer') {
        failCommand(command, 'base Shop purchases use ReplaceShopPurchaseParticipation');
      }
      if (order[existingIndex]?.kind === 'purchaseHermesShrineOffer') {
        failCommand(command, 'Shrine purchases use SetHermesShrinePurchase');
      }
      if (order[existingIndex]?.kind === 'purchaseStygianWellOffer') {
        failCommand(command, 'Well purchases use SetStygianWellPurchase');
      }
      if (
        occurrenceIsActive &&
        domain?.contributions.some(
          (entry) =>
            entry.kind === 'action' &&
            entry.participation === 'required' &&
            roomActionKey(entry.reference) === command.action.actionKey,
        )
      ) {
        failCommand(command, 'active required room action cannot be removed');
      }
      nextOrder = order.filter((_, index) => index !== existingIndex);
      break;
    case 'MoveRoomAction':
      if (existingIndex < 0) failCommand(command, 'room action is not ordered');
      requireIndex(command, command.toIndex, order.length - 1, 'toIndex');
      if (existingIndex === command.toIndex) return document;
      nextOrder = [...order];
      {
        const [reference] = nextOrder.splice(existingIndex, 1);
        if (reference === undefined) failCommand(command, 'room action disappeared while moving');
        nextOrder.splice(command.toIndex, 0, reference);
      }
      break;
  }

  let nextOccurrence = {
    ...occurrence,
    roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
  };
  const removed =
    command.kind === 'RemoveRoomAction' || command.kind === 'UnplaceGeneratedDelivery'
      ? order[existingIndex]
      : undefined;
  const inserted = command.kind === 'InsertRoomAction' ? command.reference : undefined;
  const travelParticipation =
    removed?.kind === 'interactAcquisitionEntry' &&
    removed.siteKey === 'roomExit' &&
    removed.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? false
      : inserted?.kind === 'interactAcquisitionEntry' &&
          inserted.siteKey === 'roomExit' &&
          inserted.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
        ? true
        : undefined;
  if (travelParticipation !== undefined && nextOccurrence.state.kind === 'shop') {
    nextOccurrence = reconcileAcquisitionResolvedRewardEntry(
      catalog,
      nextOccurrence,
      TRAVEL_DEAL_REFILL_ENTRY_KEY,
      travelParticipation,
      authoredShopOffer(nextOccurrence, TRAVEL_DEAL_REFILL_ENTRY_KEY)?.reward,
    );
  }
  if (
    removed?.kind === 'interactAcquisitionEntry' &&
    (command.kind === 'UnplaceGeneratedDelivery' ||
      (removed.siteKey === 'roomExit' &&
        parseClockedTraitGeneratedPickupEntryKey(removed.entryKey) !== undefined))
  ) {
    const acquisitionSites = { ...occurrence.acquisitionSites };
    const site = acquisitionSites[removed.siteKey];
    const pickupEntries = { ...site?.pickupEntries };
    delete pickupEntries[removed.entryKey];
    if (Object.keys(pickupEntries).length === 0) delete acquisitionSites[removed.siteKey];
    else
      acquisitionSites[removed.siteKey] = Object.freeze({
        pickupEntries: Object.freeze(pickupEntries),
      });
    if (Object.keys(acquisitionSites).length === 0) delete nextOccurrence.acquisitionSites;
    else nextOccurrence.acquisitionSites = Object.freeze(acquisitionSites);
  }
  return updateOccurrence(document, located, Object.freeze(nextOccurrence));
}
