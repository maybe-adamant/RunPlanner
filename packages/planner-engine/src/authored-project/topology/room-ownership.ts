import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import type { BiomeTopology, ExitDecision, OccurrenceId, RoomOccurrence } from '../model';

function occurrenceFor(
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
): RoomOccurrence | undefined {
  return topology.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
}

function isAnomalyReplacementOccurrence(
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
): boolean {
  const replacement =
    layout.progression.kind === 'generated' ? layout.progression.anomalyReplacement : undefined;
  if (
    replacement === undefined ||
    room.mode.kind !== 'authored' ||
    room.mode.templateKey !== 'Anomaly' ||
    occurrence.state.kind !== 'anomaly' ||
    occurrence.anomalyReplacement === undefined ||
    !replacement.replacementRoomGameNames.includes(room.gameName) ||
    !replacement.replaceableTargetRoomGameNames.includes(
      occurrence.anomalyReplacement.replacedRoomGameName,
    )
  ) {
    return false;
  }
  return topology.decisions.some(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.targets.some((target) => target.occurrenceId === occurrence.occurrenceId),
  );
}

function isContractAdditionalTarget(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
): boolean {
  if (
    room.mode.kind !== 'authored' ||
    room.mode.templateKey !== 'ContractBoss' ||
    occurrence.state.kind !== 'fixed' ||
    occurrence.anomalyReplacement !== undefined
  ) {
    return false;
  }
  return topology.decisions.some((decision): boolean => {
    if (decision.kind !== 'exit' || decision.source.kind !== 'occurrence') return false;
    const source = occurrenceFor(topology, decision.source.occurrenceId);
    const sourceRoom = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
    if (sourceRoom === undefined || sourceRoom.roomSetKey !== layout.biomeKey) return false;
    return decision.additional.some((additional) => {
      if (
        additional.kind !== 'zagreusContract' ||
        additional.occurrenceId !== occurrence.occurrenceId
      )
        return false;
      return sourceRoom.additionalExits.some(
        (declaration) =>
          declaration.kind === 'zagreusContract' &&
          declaration.key === additional.key &&
          declaration.targetRoomGameName === room.gameName,
      );
    });
  });
}

/**
 * Resolves a declaration for one already-decoded authored occurrence in its
 * host topology. A matching room set is the ordinary case. The only foreign
 * cases are the two closed route-detour ownership forms; this is deliberately
 * not a general relaxation of room-set identity.
 */
export function legalTopologyOccurrenceRoom(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
): RoomDeclaration | undefined {
  const occurrence = occurrenceFor(topology, occurrenceId);
  if (occurrence === undefined) return undefined;
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined || room.mode.kind !== 'authored') return undefined;
  if (room.roomSetKey === layout.biomeKey) return room;
  if (isAnomalyReplacementOccurrence(layout, topology, occurrence, room)) return room;
  return isContractAdditionalTarget(catalog, layout, topology, occurrence, room) ? room : undefined;
}
