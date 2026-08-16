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
  const optionalDescriptor = room.fieldsOptionalRewards;
  if (optionalDescriptor === undefined) {
    failCommand(command, `${room.gameName} does not declare Fields optional rewards`);
  }
  if (command.kind === 'ReplaceFieldsOptionalRewardCount') {
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
    const activeSlotKeys = new Set(
      optionalDescriptor.slotKeys.slice(0, command.optionalRewardCount),
    );
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
            actionOrder: Object.freeze(
              state.actionOrder.filter(
                (action) =>
                  action.kind !== 'interactOptionalReward' || activeSlotKeys.has(action.slotKey),
              ),
            ),
          }),
        }),
      ),
    );
  }
  const known = new Set([
    ...fieldsCageActionDomain(catalog, room).flatMap((entry) => [
      `complete:${entry.phaseKey}`,
      `interact:${entry.slotKey}`,
    ]),
    ...optionalDescriptor.slotKeys
      .slice(0, state.optionalRewardCount)
      .map((slotKey) => `interactOptional:${slotKey}`),
  ]);
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
