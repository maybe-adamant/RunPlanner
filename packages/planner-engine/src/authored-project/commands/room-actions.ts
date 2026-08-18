import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, RoomActionReference } from '../model';
import { roomActionKey, roomActionReferenceSupported } from '../room-actions';
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

export function applyRoomActionCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: RoomActionCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.action.occurrenceId, command);
  const order = occurrence.roomActions.order;
  const existingIndex = order.findIndex(
    (reference) => roomActionKey(reference) === command.action.actionKey,
  );

  let nextOrder: RoomActionReference[];
  switch (command.kind) {
    case 'InsertRoomAction': {
      const key = roomActionKey(command.reference);
      if (key !== command.action.actionKey) {
        failCommand(command, 'reference does not match the addressed room action');
      }
      if (
        !roomActionReferenceSupported(
          catalog,
          createBiomeAddress(command.action.routeKey, command.action.biomeKey),
          occurrence,
          command.reference,
        )
      ) {
        failCommand(command, 'room action is not active for this occurrence');
      }
      if (existingIndex >= 0) failCommand(command, 'room action is already ordered');
      requireIndex(command, command.index, order.length, 'index');
      nextOrder = [...order];
      nextOrder.splice(command.index, 0, command.reference);
      break;
    }
    case 'RemoveRoomAction':
      if (existingIndex < 0) failCommand(command, 'room action is not ordered');
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
