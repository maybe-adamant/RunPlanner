import type { Catalog } from '../catalog-schema';
import type { OccurrenceAddress } from '../authored-project/addresses';
import type { RoomOccurrence } from '../authored-project/model';

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
  const physicalMaximum =
    catalog.rooms.byKey[occurrence.gameName]?.fieldsOptionalRewards?.optionalRewardCapacity;
  if (physicalMaximum === undefined) return undefined;
  const reservesNemesisPosition =
    occurrence.encounters.encounterKeyByPhase.Passive === 'NemesisRandomEvent';
  return Object.freeze({
    occurrence: origin,
    physicalMaximum,
    effectiveMaximum: physicalMaximum - (reservesNemesisPosition ? 1 : 0),
    reservesNemesisPosition,
  });
}
