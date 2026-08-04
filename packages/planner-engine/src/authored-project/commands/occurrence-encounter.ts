import type { Catalog, EncounterSlotBinding, RoomDeclaration } from '../../catalog-schema';
import type { EncounterPhaseAddress } from '../addresses';
import type { ProjectDocument, RoomEncounterState, RoomOccurrence } from '../model';
import { encounterBindingsBySlot, encounterSetForBinding } from '../room-state/encounters';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { EncounterOccurrenceCommand } from './types';

function selectableBinding(
  catalog: Catalog,
  room: RoomDeclaration,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): Extract<EncounterSlotBinding, { readonly kind: 'set' }> {
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.phaseKey);
  if (binding === undefined) {
    failCommand(command, `${room.gameName} has no encounter phase ${phase.phaseKey}`);
  }
  if (binding.kind !== 'set') {
    failCommand(command, `${room.gameName}.${phase.phaseKey} is a fixed encounter phase`);
  }
  return binding;
}

function updatedSelections(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  const binding = selectableBinding(catalog, room, phase, command);
  const set = encounterSetForBinding(catalog, binding, room.gameName);
  const encounterKey =
    command.kind === 'ResetEncounter' ? set.defaultEncounterDefinitionKey : command.encounterKey;
  if (!set.encounterDefinitionKeys.includes(encounterKey)) {
    failCommand(command, `${encounterKey} is not available from ${set.key}`);
  }
  if (current.encounterKeyByPhase[phase.phaseKey] === encounterKey) return current;
  return Object.freeze({
    encounterKeyByPhase: Object.freeze({
      ...current.encounterKeyByPhase,
      [phase.phaseKey]: encounterKey,
    }),
  });
}

function localChildRoom(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  located: LocatedBiome,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
) {
  if (phase.owner.kind !== 'localChild') {
    failCommand(command, 'expected a local-child encounter owner');
  }
  const owner = phase.owner;
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCommand(command, `${occurrence.gameName} has no parent-local encounter children`);
  }
  const parent = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const group = parent.localChildren.find((child) => child.key === owner.groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    failCommand(command, `${occurrence.gameName} has no side-room group ${owner.groupKey}`);
  }
  const slot = group.slots.find((candidate) => candidate.slotKey === owner.slotKey);
  if (slot === undefined) {
    failCommand(command, `unknown side-room slot ${owner.slotKey}`);
  }
  const state = occurrence.state.sideRooms[slot.slotKey];
  if (state === undefined) {
    failCommand(command, `missing side-room state ${slot.slotKey}`);
  }
  const room = catalog.rooms.byKey[slot.roomGameName];
  if (
    room === undefined ||
    room.biomeKey !== located.layout.biomeKey ||
    room.mode.kind !== 'authored'
  ) {
    failCommand(command, `invalid declared side-room ${slot.roomGameName}`);
  }
  return { state, room, slot };
}

function replaceTopLevel(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EncounterOccurrenceCommand,
): ProjectDocument {
  if (command.phase.owner.kind !== 'occurrence') {
    failCommand(command, 'expected an occurrence encounter owner');
  }
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.phase.owner.occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const encounters = updatedSelections(
    catalog,
    room,
    occurrence.encounters,
    command.phase,
    command,
  );
  if (encounters === occurrence.encounters) return document;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, Object.freeze({ ...occurrence, encounters })),
  );
}

function replaceLocalChild(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EncounterOccurrenceCommand,
): ProjectDocument {
  if (command.phase.owner.kind !== 'localChild') {
    failCommand(command, 'expected a local-child encounter owner');
  }
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.phase.owner.occurrenceId, command);
  const { state, room, slot } = localChildRoom(
    catalog,
    occurrence,
    located,
    command.phase,
    command,
  );
  const encounters = updatedSelections(catalog, room, state.encounters, command.phase, command);
  if (encounters === state.encounters) return document;
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCommand(command, `${occurrence.gameName} has no parent-local encounter children`);
  }
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...occurrence.state,
          sideRooms: Object.freeze({
            ...occurrence.state.sideRooms,
            [slot.slotKey]: Object.freeze({ ...state, encounters }),
          }),
        }),
      }),
    ),
  );
}

/**
 * Encounter commands mutate only exact persisted room-instance state. Dynamic
 * candidate legality is published by simulation; a retained selection may be
 * context-invalid and is deliberately not repaired by this command path.
 */
export function applyEncounterOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EncounterOccurrenceCommand,
): ProjectDocument {
  return command.phase.owner.kind === 'occurrence'
    ? replaceTopLevel(document, catalog, located, command)
    : replaceLocalChild(document, catalog, located, command);
}
