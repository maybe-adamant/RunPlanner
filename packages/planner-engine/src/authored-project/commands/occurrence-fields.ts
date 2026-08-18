import type { Catalog } from '../../catalog-schema';
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
    failCommand(command, `${room.gameName} does not own Fields optional rewards`);
  }
  const state = occurrence.state;
  const optionalDescriptor = room.fieldsOptionalRewards;
  if (optionalDescriptor === undefined) {
    failCommand(command, `${room.gameName} does not declare Fields optional rewards`);
  }
  if (
    !Number.isInteger(command.optionalRewardCount) ||
    command.optionalRewardCount < 0 ||
    command.optionalRewardCount > optionalDescriptor.optionalRewardCapacity
  ) {
    failCommand(
      command,
      `optional reward count must be within 0..${optionalDescriptor.optionalRewardCapacity}`,
    );
  }
  if (command.optionalRewardCount === state.optionalRewardCount) return document;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...state,
          optionalRewardCount: command.optionalRewardCount,
        }),
      }),
    ),
  );
}
