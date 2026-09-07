import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { requireFieldsCages, requireFieldsOptionalRewards } from '../room-state/declaration';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { FieldsSpatialCommand } from './types';

export function applyFieldsSpatialCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: FieldsSpatialCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.spatial.occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  if (occurrence.state.kind !== 'fieldsCombat')
    failCommand(command, 'occurrence is not FieldsCombat');
  const spatial = occurrence.state.spatial;
  const declaration = room.fieldsSpatial;
  if (declaration === undefined) failCommand(command, 'room has no Fields spatial declaration');
  const target = command.spatial.target;
  const cages = requireFieldsCages(room, command.spatial.occurrenceId);
  const optional = requireFieldsOptionalRewards(room, command.spatial.occurrenceId);
  const allowed =
    target.kind === 'entry'
      ? new Set(declaration.entryPairs.map((pair) => pair.startPointId))
      : target.kind === 'cage'
        ? new Set(declaration.cagePointIds)
        : new Set(declaration.optionalPointIds);
  if (target.kind === 'cage' && !cages.slotKeys.includes(target.slotKey))
    failCommand(command, `unknown cage slot ${target.slotKey}`);
  if (target.kind === 'optional' && !optional.slotKeys.includes(target.slotKey))
    failCommand(command, `unknown optional slot ${target.slotKey}`);
  if (command.pointId !== null && !allowed.has(command.pointId))
    failCommand(command, `point ${command.pointId} is outside this target's declaration domain`);
  const next =
    target.kind === 'entry'
      ? { ...spatial, entryStartPointId: command.pointId }
      : target.kind === 'cage'
        ? {
            ...spatial,
            cagePointIdBySlot: Object.freeze({
              ...spatial.cagePointIdBySlot,
              [target.slotKey]: command.pointId,
            }),
          }
        : target.kind === 'optional'
          ? {
              ...spatial,
              optionalPointIdBySlot: Object.freeze({
                ...spatial.optionalPointIdBySlot,
                [target.slotKey]: command.pointId,
              }),
            }
          : { ...spatial, nemesisPointId: command.pointId };
  if (
    (target.kind === 'entry' && spatial.entryStartPointId === command.pointId) ||
    (target.kind === 'cage' && spatial.cagePointIdBySlot[target.slotKey] === command.pointId) ||
    (target.kind === 'optional' &&
      spatial.optionalPointIdBySlot[target.slotKey] === command.pointId) ||
    (target.kind === 'nemesis' && spatial.nemesisPointId === command.pointId)
  )
    return document;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, {
      ...occurrence,
      state: Object.freeze({ ...occurrence.state, spatial: Object.freeze(next) }),
    }),
  );
}
