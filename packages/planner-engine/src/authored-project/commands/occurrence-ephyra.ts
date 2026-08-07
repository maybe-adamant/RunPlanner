import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, RoomOccurrence } from '../model';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { EphyraOccurrenceCommand, LocalRewardCommand, TraitOfferCommand } from './types';

export function requireEphyraSideGroup(
  occurrence: RoomOccurrence,
  catalog: Catalog,
  located: LocatedBiome,
  groupKey: string,
  command: EphyraOccurrenceCommand | LocalRewardCommand | TraitOfferCommand,
) {
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCommand(command, `${occurrence.gameName} has no Ephyra side-room state`);
  }
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const group = room.localChildren.find((child) => child.key === groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    failCommand(command, `${occurrence.gameName} has no side-room group ${groupKey}`);
  }
  return { state: occurrence.state, group };
}

export function applyEphyraOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EphyraOccurrenceCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceSideRoomGeneration': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.sideRoom.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        located,
        command.sideRoom.groupKey,
        command,
      );
      if (!group.slots.some((slot) => slot.slotKey === command.sideRoom.slotKey)) {
        failCommand(command, `unknown side-room slot ${command.sideRoom.slotKey}`);
      }
      const sideRoom = state.sideRooms[command.sideRoom.slotKey];
      if (sideRoom === undefined) {
        failCommand(command, `missing side-room state ${command.sideRoom.slotKey}`);
      }
      if (command.generation === 'notGenerated' && sideRoom.enteredOrdinal !== null) {
        failCommand(command, 'remove the side room from entry order before disabling generation');
      }
      if (sideRoom.generation === command.generation) return document;
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
                [command.sideRoom.slotKey]: Object.freeze({
                  ...sideRoom,
                  generation: command.generation,
                }),
              }),
            }),
          }),
        ),
      );
    }
    case 'ReplaceSideRoomEntryOrder': {
      const current = requireTopology(located.plan, command);
      const occurrence = requireOccurrence(located.plan, command.group.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        located,
        command.group.groupKey,
        command,
      );
      if (new Set(command.enteredSlotKeys).size !== command.enteredSlotKeys.length) {
        failCommand(command, 'side-room entry order must contain distinct slots');
      }
      for (const slotKey of command.enteredSlotKeys) {
        if (!group.slots.some((slot) => slot.slotKey === slotKey)) {
          failCommand(command, `unknown side-room slot ${slotKey}`);
        }
        if (state.sideRooms[slotKey]?.generation !== 'generated') {
          failCommand(command, `${slotKey} must be generated before it can be entered`);
        }
      }
      const sideRooms = Object.freeze(
        Object.fromEntries(
          Object.entries(state.sideRooms).map(([slotKey, sideRoom]) => {
            const index = command.enteredSlotKeys.indexOf(slotKey);
            return [
              slotKey,
              Object.freeze({ ...sideRoom, enteredOrdinal: index < 0 ? null : index + 1 }),
            ];
          }),
        ),
      );
      if (sameOccurrenceValue(sideRooms, state.sideRooms)) return document;
      return updateOccurrenceTopology(
        document,
        located,
        replaceOccurrence(
          current,
          Object.freeze({ ...occurrence, state: { ...state, sideRooms } }),
        ),
      );
    }
  }
}
