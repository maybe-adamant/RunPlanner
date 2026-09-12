import type { Catalog } from '../../../catalog-schema';
import type { BiomeTopology, LocalVisitDecision, OccurrenceId, ProjectDocument } from '../../model';
import { requireEphyraSideRooms } from '../../room-state/declaration';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from '../contract';
import type { TopologyCommand } from '../types';
import { replaceDecision, updateTopology } from './construction';

function localVisitDecisionForSource(
  topology: BiomeTopology,
  sourceOccurrenceId: OccurrenceId,
  groupKey: string,
): LocalVisitDecision | undefined {
  return topology.decisions.find(
    (decision): decision is LocalVisitDecision =>
      decision.kind === 'localVisit' &&
      decision.sourceOccurrenceId === sourceOccurrenceId &&
      decision.groupKey === groupKey,
  );
}

export function updateLocalVisit(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    TopologyCommand,
    { readonly kind: 'SetLocalVisitGeneration' | 'ReplaceLocalVisitOrder' }
  >,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const address = command.kind === 'SetLocalVisitGeneration' ? command.slot : command.order;
  const decision = localVisitDecisionForSource(
    topology,
    address.sourceOccurrenceId,
    address.groupKey,
  );
  if (decision === undefined) failCommand(command, 'local visit decision does not exist');
  const source = requireOccurrence(located.plan, decision.sourceOccurrenceId, command);
  const room = requireRoom(catalog, source.gameName, located.layout.biomeKey, command);
  const descriptor = requireEphyraSideRooms(room, room.gameName);
  if (descriptor?.key !== decision.groupKey) {
    failCommand(command, 'local visit decision does not match its source declaration');
  }
  if (command.kind === 'SetLocalVisitGeneration') {
    const slot = descriptor.slots.find((candidate) => candidate.slotKey === command.slot.slotKey);
    const target = decision.targetsBySlot[command.slot.slotKey];
    if (slot === undefined || target === undefined)
      failCommand(command, 'unknown local visit slot');
    if (
      command.generation === 'notGenerated' &&
      decision.visitOrder.includes(target.occurrenceId)
    ) {
      failCommand(command, 'remove the local occurrence from visit order before disabling it');
    }
    if (target.generation === command.generation) return document;
    return updateTopology(
      document,
      located,
      replaceDecision(
        topology,
        Object.freeze({
          ...decision,
          targetsBySlot: Object.freeze({
            ...decision.targetsBySlot,
            [command.slot.slotKey]: Object.freeze({
              ...target,
              generation: command.generation,
            }),
          }),
        }),
      ),
    );
  }
  if (new Set(command.occurrenceIds).size !== command.occurrenceIds.length) {
    failCommand(command, 'local visit order must contain distinct occurrences');
  }
  const targets = Object.values(decision.targetsBySlot);
  for (const occurrenceId of command.occurrenceIds) {
    const target = targets.find((candidate) => candidate.occurrenceId === occurrenceId);
    if (target === undefined) failCommand(command, `unknown local occurrence ${occurrenceId}`);
    if (target.generation !== 'generated') {
      failCommand(command, `${occurrenceId} must be generated before it can be entered`);
    }
  }
  if (
    command.occurrenceIds.length === decision.visitOrder.length &&
    command.occurrenceIds.every(
      (occurrenceId, index) => decision.visitOrder[index] === occurrenceId,
    )
  ) {
    return document;
  }
  return updateTopology(
    document,
    located,
    replaceDecision(
      topology,
      Object.freeze({ ...decision, visitOrder: Object.freeze([...command.occurrenceIds]) }),
    ),
  );
}
