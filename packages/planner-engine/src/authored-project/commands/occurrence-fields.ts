import type { Catalog } from '../../catalog-schema';
import { fieldsActionKey, fieldsCageActionDomain } from '../fields-actions';
import type { ProjectDocument } from '../model';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { FieldsOccurrenceCommand } from './types';

export function applyFieldsOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: FieldsOccurrenceCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  if (occurrence.state.kind !== 'fieldsCombat') {
    failCommand(command, `${room.gameName} does not own a Fields action order`);
  }
  const state = occurrence.state;
  const known = new Set(
    fieldsCageActionDomain(catalog, room).flatMap((entry) => [
      `complete:${entry.phaseKey}`,
      `interact:${entry.slotKey}`,
    ]),
  );
  const seen = new Set<string>();
  for (const action of command.actionOrder) {
    const key = fieldsActionKey(action);
    if (!known.has(key)) failCommand(command, `unknown Fields action ${key}`);
    if (seen.has(key)) failCommand(command, `duplicate Fields action ${key}`);
    seen.add(key);
  }
  if (
    command.actionOrder.length === state.actionOrder.length &&
    command.actionOrder.every(
      (action, index) => fieldsActionKey(action) === fieldsActionKey(state.actionOrder[index]!),
    )
  ) {
    return document;
  }
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...state,
          actionOrder: Object.freeze(
            command.actionOrder.map((action) => Object.freeze({ ...action })),
          ),
        }),
      }),
    ),
  );
}
