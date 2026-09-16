import type { Catalog } from '../../catalog-schema';
import { createRoomFeatureAddress, type OccurrenceAddress } from '../../authored-project/addresses';
import type { RoomOccurrence } from '../../authored-project/model';
import { directEncounterDefinitionKeyForSlot } from '../../authored-project/room-state/encounter-envelope';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { SemanticFinding } from '../model';

/**
 * Declaration-owned Fields count bounds for an occurrence. The physical bound
 * stays authorable; the effective bound reserves Nemesis's spawn position and
 * is the repair/candidate domain consumed by later application work.
 */
export interface FieldsOptionalRewardCountSupport {
  readonly occurrence: OccurrenceAddress;
  readonly physicalMaximum: number;
  readonly effectiveMaximum: number;
  readonly reservesNemesisPosition: boolean;
}

export function fieldsOptionalRewardCountSupport(
  catalog: Catalog,
  occurrence: Pick<RoomOccurrence, 'gameName' | 'encounters'>,
  origin: OccurrenceAddress,
): FieldsOptionalRewardCountSupport | undefined {
  const room = catalog.rooms.byKey[occurrence.gameName];
  const logicalMaximum = room?.fieldsOptionalRewards?.optionalRewardCapacity;
  const pointCount = room?.fieldsSpatial?.optionalPointIds.length;
  if (room === undefined || logicalMaximum === undefined || pointCount === undefined)
    return undefined;
  const physicalMaximum = pointCount;
  const ordinaryMaximum = Math.min(4, logicalMaximum, physicalMaximum);
  const reservesNemesisPosition =
    directEncounterDefinitionKeyForSlot(
      catalog,
      room,
      occurrence.encounters,
      'Passive',
      occurrence.gameName,
    ) === 'NemesisRandomEvent';
  return Object.freeze({
    occurrence: origin,
    physicalMaximum,
    effectiveMaximum: Math.min(
      ordinaryMaximum,
      physicalMaximum - (reservesNemesisPosition ? 1 : 0),
    ),
    reservesNemesisPosition,
  });
}

export function fieldsOptionalRewardCountFindings(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly SemanticFinding[] {
  const support = fieldsOptionalRewardCountSupport(catalog, room, room.origin);
  if (
    room.fieldsOptionalRewardCount === undefined ||
    support?.reservesNemesisPosition !== true ||
    room.fieldsOptionalRewardCount <= support.effectiveMaximum
  )
    return Object.freeze([]);
  return Object.freeze([
    Object.freeze({
      code: 'fieldsOptionalCapacityUnavailable',
      severity: 'error',
      phase: 'roomGeneration',
      origin: createRoomFeatureAddress(room.origin, { kind: 'fieldsOptionalRewardCount' }),
      evidence: Object.freeze({
        physicalCapacity: support.physicalMaximum,
        effectiveCapacity: support.effectiveMaximum,
        selectedCount: room.fieldsOptionalRewardCount,
      }),
    }),
  ]);
}
