import type {
  CatalogCollection,
  EncounterEnvelope,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';

import { fail } from './errors';

function validateContextRequirementReferences(
  requirement: RequirementExpression,
  rooms: CatalogCollection<RoomDeclaration>,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  path: string,
): void {
  if (requirement.kind === 'all' || requirement.kind === 'any') {
    requirement.requirements.forEach((child, index) =>
      validateContextRequirementReferences(
        child,
        rooms,
        encounterEnvelopes,
        `${path}.requirements[${index}]`,
      ),
    );
    return;
  }
  if (requirement.kind === 'not') {
    validateContextRequirementReferences(
      requirement.requirement,
      rooms,
      encounterEnvelopes,
      `${path}.requirement`,
    );
    return;
  }
  if (
    (requirement.kind === 'recordCount' || requirement.kind === 'distinctRecordKeyCount') &&
    requirement.record === 'roomsEntered'
  ) {
    requirement.keys.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined)
        fail(`${path}.keys[${index}]`, `unknown room ${gameName}`);
    });
  }
  if (requirement.kind === 'currentBatchRoomCount') {
    requirement.roomGameNames.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined)
        fail(`${path}.roomGameNames[${index}]`, `unknown room ${gameName}`);
    });
  }
  if (requirement.kind === 'recentEnvelopeSlotCount') {
    const envelope = encounterEnvelopes.byKey[requirement.envelopeKey];
    if (envelope === undefined)
      fail(`${path}.envelopeKey`, `unknown encounter envelope ${requirement.envelopeKey}`);
    if (!envelope.slots.some((slot) => slot.key === requirement.slotKey))
      fail(`${path}.slotKey`, `unknown slot ${requirement.slotKey} in ${requirement.envelopeKey}`);
  }
}

/** Closes normalized room references that cannot be checked until the room collection is frozen. */
export function validateRoomCollectionClosure(
  rooms: CatalogCollection<RoomDeclaration>,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
): void {
  const expectedContractDestinations = new Set([
    'F_PreBoss01',
    'G_PreBoss01',
    'H_PreBoss01',
    'I_PreBoss02',
    'N_PreBoss01',
    'O_PreBoss01',
    'P_PreBoss01',
    'Q_PreBoss01',
  ]);
  for (const room of rooms.values) {
    if (
      expectedContractDestinations.has(room.gameName) !==
      (room.infernalContractReward !== undefined)
    )
      fail(
        `rooms.${room.gameName}.infernalContractReward`,
        'must match the supported qualifying destination matrix',
      );
  }
  rooms.values.forEach((room, roomIndex) => {
    room.additionalExits.forEach((exit, exitIndex) => {
      if (exit.kind !== 'zagreusContract') return;
      const target = rooms.byKey[exit.targetRoomGameName];
      const path = `rooms[${roomIndex}].additionalExits[${exitIndex}].targetRoomGameName`;
      if (target === undefined) fail(path, `unknown room ${exit.targetRoomGameName}`);
      if (
        target.roomSetKey !== 'C' ||
        target.kind !== 'Boss' ||
        target.mode.kind !== 'authored' ||
        target.mode.templateKey !== 'ContractBoss' ||
        target.exits.length !== 1 ||
        target.exits[0]?.behavior.kind !== 'automaticHostContinuation'
      )
        fail(
          path,
          'Zagreus contract target must be an authored C ContractBoss with automatic host return',
        );
    });
    if (room.eligibility !== undefined)
      validateContextRequirementReferences(
        room.eligibility,
        rooms,
        encounterEnvelopes,
        `rooms[${roomIndex}].eligibility`,
      );
    if (room.force?.kind === 'requirement')
      validateContextRequirementReferences(
        room.force.requirement,
        rooms,
        encounterEnvelopes,
        `rooms[${roomIndex}].force.requirement`,
      );
    room.localChildren.forEach((child, childIndex) => {
      if (child.kind !== 'fixedRoomSlots') return;
      child.slots.forEach((slot, slotIndex) => {
        const referenced = rooms.byKey[slot.roomGameName];
        const path = `rooms[${roomIndex}].localChildren[${childIndex}].slots[${slotIndex}].roomGameName`;
        if (referenced === undefined) fail(path, `unknown room ${slot.roomGameName}`);
        if (referenced.roomSetKey !== room.roomSetKey || referenced.mode.kind !== 'authored')
          fail(path, `${slot.roomGameName} must be an authored room in ${room.roomSetKey}`);
      });
    });
  });
}
