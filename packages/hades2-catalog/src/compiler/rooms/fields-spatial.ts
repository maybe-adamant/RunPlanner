import type { FieldsSpatialDeclaration } from '@run-planner/engine/catalog-schema';
import type { RawRoomDeclaration } from '../../declarations/index';
import { requirePositiveInteger } from '../common';
import { fail } from '../errors';

function normalizePointIds(values: readonly number[], path: string): readonly number[] {
  if (values.length === 0) fail(path, 'must contain at least one point');
  const seen = new Set<number>();
  const normalized = values.map((value, index) => {
    const point = requirePositiveInteger(value, `${path}[${index}]`);
    if (seen.has(point)) fail(`${path}[${index}]`, `duplicates ${point}`);
    seen.add(point);
    return point;
  });
  return Object.freeze(normalized);
}

export function normalizeFieldsSpatial(
  raw: RawRoomDeclaration['fieldsSpatial'],
  path: string,
  isFieldsCombat: boolean,
): FieldsSpatialDeclaration | undefined {
  if (raw === undefined) {
    if (isFieldsCombat) fail(path, 'FieldsCombat requires spatial point declarations');
    return undefined;
  }
  if (!isFieldsCombat) fail(path, 'is only valid for FieldsCombat');
  const starts = new Set<number>();
  if (raw.entryPairs.length === 0) fail(`${path}.entryPairs`, 'must contain at least one pair');
  const entryPairs = raw.entryPairs.map((pair, index) => {
    const startPointId = requirePositiveInteger(
      pair.startPointId,
      `${path}.entryPairs[${index}].startPointId`,
    );
    const endPointId = requirePositiveInteger(
      pair.endPointId,
      `${path}.entryPairs[${index}].endPointId`,
    );
    if (starts.has(startPointId))
      fail(`${path}.entryPairs[${index}].startPointId`, `duplicates ${startPointId}`);
    starts.add(startPointId);
    return Object.freeze({ startPointId, endPointId });
  });
  const cagePointIds = normalizePointIds(raw.cagePointIds, `${path}.cagePointIds`);
  const optionalPointIds = normalizePointIds(raw.optionalPointIds, `${path}.optionalPointIds`);
  const optionalSet = new Set(optionalPointIds);
  const excluded = raw.nemesisExcludedOptionalPointIds.map((point, index) => {
    const normalized = requirePositiveInteger(
      point,
      `${path}.nemesisExcludedOptionalPointIds[${index}]`,
    );
    if (!optionalSet.has(normalized)) {
      fail(
        `${path}.nemesisExcludedOptionalPointIds[${index}]`,
        `is not an optional point ${normalized}`,
      );
    }
    return normalized;
  });
  if (new Set(excluded).size !== excluded.length)
    fail(`${path}.nemesisExcludedOptionalPointIds`, 'must not contain duplicates');
  return Object.freeze({
    entryPairs: Object.freeze(entryPairs),
    cagePointIds,
    optionalPointIds,
    nemesisExcludedOptionalPointIds: Object.freeze(excluded),
  });
}
