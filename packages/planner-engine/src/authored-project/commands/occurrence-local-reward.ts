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
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { LocalRewardCommand } from './types';
import { createUnresolvedAcquisitionRewardState, producerLevelEffectSource } from '../traits';

export function applyLocalRewardCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: LocalRewardCommand,
): ProjectDocument {
  const current = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.reward.occurrenceId, command);
  if (occurrence.state.kind === 'fieldsCombat') {
    const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
    const cageGroup = room.localChildren.find((child) => child.key === 'cages');
    const optionalGroup = room.fieldsOptionalRewards;
    const binding =
      command.reward.groupKey === 'cages' && cageGroup?.kind === 'boundedRewardSlots'
        ? cageGroup.reward
        : command.reward.groupKey === optionalGroup?.key
          ? optionalGroup.reward
          : undefined;
    const slotKeys =
      command.reward.groupKey === 'cages' && cageGroup?.kind === 'boundedRewardSlots'
        ? cageGroup.slotKeys
        : command.reward.groupKey === optionalGroup?.key
          ? optionalGroup.slotKeys
          : [];
    if (binding === undefined || !slotKeys.includes(command.reward.slotKey)) {
      failCommand(
        command,
        `unknown local reward ${command.reward.groupKey}.${command.reward.slotKey}`,
      );
    }
    const rewardMap =
      command.reward.groupKey === 'cages'
        ? occurrence.state.cages
        : occurrence.state.optionalRewards;
    const reward = rewardMap[command.reward.slotKey];
    const levelEffectSource = producerLevelEffectSource(binding);
    if (reward === undefined)
      failCommand(command, `missing local reward ${command.reward.slotKey}`);
    if (reward !== null && sameOccurrenceValue(reward.offer, command.value)) return document;
    const replacementReward = createUnresolvedAcquisitionRewardState(
      catalog,
      command.value,
      levelEffectSource,
    );
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        current,
        Object.freeze({
          ...occurrence,
          state: Object.freeze({
            ...occurrence.state,
            ...(command.reward.groupKey === 'cages'
              ? {
                  cages: Object.freeze({
                    ...occurrence.state.cages,
                    [command.reward.slotKey]: replacementReward,
                  }),
                }
              : {
                  optionalRewards: Object.freeze({
                    ...occurrence.state.optionalRewards,
                    [command.reward.slotKey]: replacementReward,
                  }),
                }),
          }),
        }),
      ),
    );
  }
  failCommand(command, `${occurrence.gameName} has no local reward ${command.reward.groupKey}`);
}
