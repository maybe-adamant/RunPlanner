import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { requireEphyraSideGroup } from './occurrence-ephyra';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { LocalRewardCommand } from './types';
import {
  createDefaultLevelResolutions,
  createDefaultTraitOffers,
  producerLevelEffectSource,
} from '../traits';
import { createDefaultConversionByAcquisitionRole } from '../reward-state';

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
    const group = room.localChildren.find((child) => child.key === command.reward.groupKey);
    if (
      command.reward.groupKey !== 'cages' ||
      group?.kind !== 'boundedRewardSlots' ||
      !group.slotKeys.includes(command.reward.slotKey)
    ) {
      failCommand(
        command,
        `unknown local reward ${command.reward.groupKey}.${command.reward.slotKey}`,
      );
    }
    const reward = occurrence.state.cages[command.reward.slotKey];
    const levelEffectSource = producerLevelEffectSource(group.reward);
    if (reward === undefined)
      failCommand(command, `missing local reward ${command.reward.slotKey}`);
    if (sameOccurrenceValue(reward.offer, command.value)) return document;
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        current,
        Object.freeze({
          ...occurrence,
          state: Object.freeze({
            ...occurrence.state,
            cages: Object.freeze({
              ...occurrence.state.cages,
              [command.reward.slotKey]: Object.freeze({
                offer: command.value,
                conversionByAcquisitionRole: createDefaultConversionByAcquisitionRole(
                  catalog,
                  command.value,
                ),
                traitOffersByAcquisitionRole: createDefaultTraitOffers(
                  catalog,
                  command.value,
                  located.loadout,
                ),
                ...(createDefaultLevelResolutions(catalog, command.value, levelEffectSource) ===
                undefined
                  ? {}
                  : {
                      levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
                        catalog,
                        command.value,
                        levelEffectSource,
                      ),
                    }),
              }),
            }),
          }),
        }),
      ),
    );
  }
  const { state, group } = requireEphyraSideGroup(
    occurrence,
    catalog,
    located,
    command.reward.groupKey,
    command,
  );
  if (!group.slots.some((slot) => slot.slotKey === command.reward.slotKey)) {
    failCommand(command, `unknown side-room slot ${command.reward.slotKey}`);
  }
  const sideRoom = state.sideRooms[command.reward.slotKey];
  if (sideRoom === undefined)
    failCommand(command, `missing side-room state ${command.reward.slotKey}`);
  if (sameOccurrenceValue(sideRoom.reward.offer, command.value)) return document;
  const sideDeclaration =
    catalog.rooms.byKey[
      group.slots.find((slot) => slot.slotKey === command.reward.slotKey)?.roomGameName ?? ''
    ];
  if (sideDeclaration === undefined || sideDeclaration.incomingReward.kind === 'none')
    failCommand(command, `missing side-room reward binding ${command.reward.slotKey}`);
  const levelEffectSource = producerLevelEffectSource(sideDeclaration.incomingReward);
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      current,
      Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...state,
          sideRooms: Object.freeze({
            ...state.sideRooms,
            [command.reward.slotKey]: Object.freeze({
              ...sideRoom,
              reward: Object.freeze({
                offer: command.value,
                conversionByAcquisitionRole: createDefaultConversionByAcquisitionRole(
                  catalog,
                  command.value,
                ),
                traitOffersByAcquisitionRole: createDefaultTraitOffers(
                  catalog,
                  command.value,
                  located.loadout,
                ),
                ...(createDefaultLevelResolutions(catalog, command.value, levelEffectSource) ===
                undefined
                  ? {}
                  : {
                      levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
                        catalog,
                        command.value,
                        levelEffectSource,
                      ),
                    }),
              }),
            }),
          }),
        }),
      }),
    ),
  );
}
