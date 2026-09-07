import type { FieldsSpatialDeclaration, RoomDeclaration } from '../../catalog-schema';
import type { FieldsSpatialState } from '../model';
import {
  expectExactKeys,
  expectRecord,
  expectPositiveInteger,
  failProjectDocument,
} from '../validation';
import {
  requireFieldsCages,
  requireFieldsOptionalRewards,
  requireFieldsSpatial,
} from './declaration';

function decodePoint(value: unknown, allowed: ReadonlySet<number>, path: string): number | null {
  if (value === null) return null;
  const point = expectPositiveInteger(value, path);
  if (!allowed.has(point)) failProjectDocument(path, `is outside this room's declared point set`);
  return point;
}

function decodePointMap(
  value: unknown,
  keys: readonly string[],
  allowed: ReadonlySet<number>,
  path: string,
): Readonly<Record<string, number | null>> {
  const record = expectRecord(value, path);
  expectExactKeys(record, keys, path);
  return Object.freeze(
    Object.fromEntries(
      keys.map((key) => [key, decodePoint(record[key], allowed, `${path}.${key}`)]),
    ),
  );
}

export function decodeFieldsSpatialState(
  value: unknown,
  room: RoomDeclaration,
  path: string,
): FieldsSpatialState {
  const raw = expectRecord(value, path);
  expectExactKeys(
    raw,
    ['entryStartPointId', 'cagePointIdBySlot', 'optionalPointIdBySlot', 'nemesisPointId'],
    path,
  );
  const declaration: FieldsSpatialDeclaration = requireFieldsSpatial(room, path);
  const entryStarts = new Set(declaration.entryPairs.map((pair) => pair.startPointId));
  const cages = requireFieldsCages(room, path);
  const optional = requireFieldsOptionalRewards(room, path);
  return Object.freeze({
    entryStartPointId: decodePoint(raw.entryStartPointId, entryStarts, `${path}.entryStartPointId`),
    cagePointIdBySlot: decodePointMap(
      raw.cagePointIdBySlot,
      cages.slotKeys,
      new Set(declaration.cagePointIds),
      `${path}.cagePointIdBySlot`,
    ),
    optionalPointIdBySlot: decodePointMap(
      raw.optionalPointIdBySlot,
      optional.slotKeys,
      new Set(declaration.optionalPointIds),
      `${path}.optionalPointIdBySlot`,
    ),
    nemesisPointId: decodePoint(
      raw.nemesisPointId,
      new Set(declaration.optionalPointIds),
      `${path}.nemesisPointId`,
    ),
  });
}
