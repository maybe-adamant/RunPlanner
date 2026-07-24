import type { Catalog, LinearBiomeLayout } from '../../catalog-schema';
import { replaceBiomeStateField } from '../biomeState';
import type { LinearBiomePlan, ProjectDocument } from '../model';
import { createDefaultRoomState, reconcileReplacementRoomState } from '../roomState';
import {
  stagedBatchIndex,
  stagedProgressionStages,
  stagedRoomIsAvailable,
} from '../stagedProgression';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  roomStateContext,
  withBiome,
  type LocatedBiome,
} from './contract';
import {
  isOccurrenceEntered,
  occurrenceRole,
  reconcileOwnedContinuationRewardStore,
  replaceOccurrence,
  resolvedStoreForOccurrence,
} from './topology-linear';
import type { LinearRoomStateProjectCommand } from './types';

export function applyLinearRoomStateCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  plan: LinearBiomePlan,
  layout: LinearBiomeLayout,
  command: LinearRoomStateProjectCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceBiomeField': {
      const state = replaceBiomeStateField(
        plan.state,
        layout,
        command.field.fieldKey,
        command.value,
        `commands.ReplaceBiomeField.${command.field.fieldKey}`,
      );
      return state === plan.state ? document : withBiome(document, located, { ...plan, state });
    }
    case 'ReplaceOccurrenceRoom': {
      const occurrence = requireOccurrence(plan, command.occurrence.occurrenceId, command);
      if (occurrence.gameName === command.gameName) {
        return document;
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeKey, command);
      const stages = stagedProgressionStages(layout);
      if (stages !== undefined && plan.topology !== null) {
        const owner = plan.topology.continuations.find((continuation) =>
          continuation.targets.some(
            (target) => target.occurrenceId === command.occurrence.occurrenceId,
          ),
        );
        if (owner?.kind === 'batch') {
          const stageIndex = stagedBatchIndex(plan.topology, owner.parentOccurrenceId);
          const stage = stageIndex === undefined ? undefined : stages[stageIndex];
          if (stage === undefined || !stagedRoomIsAvailable(stage, room.gameName)) {
            failCommand(command, `${room.gameName} is not available in stage ${stage?.key ?? '?'}`);
          }
        }
      }
      if (
        layout.terminal.kind === 'generatedTarget' &&
        room.gameName === layout.terminal.roomGameName &&
        plan.topology?.continuations.some(
          (continuation) => continuation.parentOccurrenceId === occurrence.occurrenceId,
        )
      ) {
        failCommand(
          command,
          'remove the downstream continuation before selecting the terminal room',
        );
      }
      const role = occurrenceRole(plan, catalog, layout, occurrence.occurrenceId, command, room);
      const replacementDefaultState = createDefaultRoomState(
        catalog,
        room,
        roomStateContext(
          role,
          resolvedStoreForOccurrence(plan, catalog, layout, occurrence.occurrenceId, room),
          isOccurrenceEntered(plan, occurrence.occurrenceId),
        ),
      );
      const replacement = {
        occurrenceId: occurrence.occurrenceId,
        gameName: room.gameName,
        state: reconcileReplacementRoomState(
          catalog,
          requireRoom(catalog, occurrence.gameName, layout.biomeKey, command),
          occurrence.state,
          room,
          replacementDefaultState,
        ),
      };
      const withReplacement = replaceOccurrence(plan, replacement, command);
      return withBiome(
        document,
        located,
        reconcileOwnedContinuationRewardStore(
          withReplacement,
          layout,
          occurrence.occurrenceId,
          room,
          command,
        ),
      );
    }
  }
}
