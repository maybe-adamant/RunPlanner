import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, RoomActionReference } from '../model';
import { roomActionKey } from '../room-actions';
import {
  roomActionDomainForOccurrence,
  scheduleRequiredRoomActions,
  structurallyActiveOccurrenceIds,
} from '../room-action-defaults';
import { createBiomeAddress } from '../addresses';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
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

function applyCompletionRoomActionCommand(
  document: ProjectDocument,
  located: LocatedBiome,
  command: Exclude<RoomActionCommand, { readonly kind: 'ReplaceShopPurchaseParticipation' }>,
): ProjectDocument {
  if (command.action.kind !== 'completionRoomAction') throw new Error('expected completion action');
  const action = command.action;
  if (
    action.completion.routeKey !== action.routeKey ||
    action.completion.biomeKey !== action.biomeKey ||
    action.completion.role !== 'postboss'
  )
    failCommand(command, 'completion action has an inconsistent owner');
  const state = located.plan.postbossRoomActions;
  if (state === undefined) failCommand(command, 'biome has no Postboss action chronology');
  const order = state.order;
  const existingIndex = order.findIndex(
    (reference) => roomActionKey(reference) === action.actionKey,
  );
  let nextOrder: RoomActionReference[];
  switch (command.kind) {
    case 'InsertRoomAction':
      if (command.reference.kind === 'interactKeepsakeRack')
        failCommand(command, 'Postboss rack membership belongs to ReplacePostbossKeepsake');
      if (command.reference.kind !== 'useFountain')
        failCommand(command, 'unsupported Postboss action');
      if (roomActionKey(command.reference) !== action.actionKey)
        failCommand(command, 'reference does not match the addressed room action');
      if (existingIndex >= 0) failCommand(command, 'room action is already ordered');
      requireIndex(command, command.index, order.length, 'index');
      nextOrder = [...order];
      nextOrder.splice(command.index, 0, command.reference);
      break;
    case 'RemoveRoomAction':
      if (existingIndex < 0) failCommand(command, 'room action is not ordered');
      if (order[existingIndex]?.kind === 'useFountain')
        failCommand(command, 'active required room action cannot be removed');
      if (order[existingIndex]?.kind === 'interactKeepsakeRack')
        failCommand(command, 'Postboss rack membership belongs to ReplacePostbossKeepsake');
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
  return {
    ...document,
    routes: document.routes.map((route, routeIndex) =>
      routeIndex !== located.routeIndex
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== located.plan.biomeKey
                ? plan
                : {
                    ...plan,
                    postbossRoomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
                  },
            ),
          },
    ),
  };
}

export function applyRoomActionCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: RoomActionCommand,
): ProjectDocument {
  if (
    command.kind !== 'ReplaceShopPurchaseParticipation' &&
    command.action.kind === 'completionRoomAction'
  ) {
    return applyCompletionRoomActionCommand(document, located, command);
  }
  const topology = requireTopology(located.plan, command);
  const occurrenceId =
    command.kind === 'ReplaceShopPurchaseParticipation'
      ? command.offer.occurrenceId
      : (command.action as import('../addresses').RoomActionAddress).occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  const occurrenceIsActive = structurallyActiveOccurrenceIds(topology).has(occurrenceId);
  const commandAddress =
    command.kind === 'ReplaceShopPurchaseParticipation' ? command.offer : command.action;
  const domain = roomActionDomainForOccurrence(
    document,
    catalog,
    createBiomeAddress(commandAddress.routeKey, commandAddress.biomeKey),
    occurrenceId,
  )?.domain;
  const order = occurrence.roomActions.order;
  if (command.kind === 'ReplaceShopPurchaseParticipation') {
    const reference = Object.freeze({
      kind: 'interactShopOffer' as const,
      offerKey: command.offer.offerKey,
    });
    const key = roomActionKey(reference);
    const existingIndex = order.findIndex((candidate) => roomActionKey(candidate) === key);
    if (!command.purchased) {
      if (existingIndex < 0) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          topology,
          Object.freeze({
            ...occurrence,
            roomActions: Object.freeze({
              order: Object.freeze(order.filter((_, index) => index !== existingIndex)),
            }),
          }),
        ),
      );
    }
    if (existingIndex >= 0) return document;
    if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
      failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
    }
    if (occurrence.state.shop.offers[command.offer.offerKey] === undefined) {
      failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
    }
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        topology,
        Object.freeze({
          ...occurrence,
          roomActions: Object.freeze({ order: Object.freeze([...order, reference]) }),
        }),
      ),
    );
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
    case 'RemoveRoomAction':
      if (existingIndex < 0) failCommand(command, 'room action is not ordered');
      if (order[existingIndex]?.kind === 'interactShopOffer') {
        failCommand(command, 'base Shop purchases use ReplaceShopPurchaseParticipation');
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

  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
      }),
    ),
  );
}
