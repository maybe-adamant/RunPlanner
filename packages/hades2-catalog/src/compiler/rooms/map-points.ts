import type {
  RoomMapExitDoor,
  RoomMapPoint,
  RoomMapPoints,
} from '@run-planner/engine/catalog-schema';

import { requireNonEmpty, requirePositiveInteger } from '../common';
import { fail } from '../errors';

function normalizePoint(point: RoomMapPoint, path: string): RoomMapPoint {
  requirePositiveInteger(point.id, `${path}.id`);
  if (!Number.isFinite(point.x)) fail(`${path}.x`, 'must be a finite number');
  if (!Number.isFinite(point.y)) fail(`${path}.y`, 'must be a finite number');
  return Object.freeze({ id: point.id, x: point.x, y: point.y });
}

function normalizeFamily<T extends RoomMapPoint>(
  points: readonly T[],
  seen: Set<number>,
  path: string,
  normalize: (point: T, path: string) => T,
): readonly T[] {
  return Object.freeze(
    points.map((point, index) => {
      const pointPath = `${path}[${index}]`;
      const normalized = normalize(point, pointPath);
      if (index > 0 && normalized.id <= points[index - 1]!.id)
        fail(`${pointPath}.id`, 'must ascend');
      if (seen.has(normalized.id)) fail(`${pointPath}.id`, `duplicates ${normalized.id}`);
      seen.add(normalized.id);
      return normalized;
    }),
  );
}

function normalizeExitDoor(door: RoomMapExitDoor, path: string): RoomMapExitDoor {
  return Object.freeze({
    ...normalizePoint(door, path),
    obstacleName: requireNonEmpty(door.obstacleName, `${path}.obstacleName`),
  });
}

/** One room's map points: each family ascending, every ObjectId once in the room. */
export function normalizeRoomMapPoints(raw: RoomMapPoints, path: string): RoomMapPoints {
  const seen = new Set<number>();
  const family = (points: readonly RoomMapPoint[], key: string) =>
    normalizeFamily(points, seen, `${path}.${key}`, normalizePoint);
  const optionalFamily = (points: readonly RoomMapPoint[] | undefined, key: string) =>
    points === undefined ? undefined : family(points, key);
  const challengeSwitchAnchors = family(raw.challengeSwitchAnchors, 'challengeSwitchAnchors');
  if (
    raw.wellAnchorId !== undefined &&
    !challengeSwitchAnchors.some((anchor) => anchor.id === raw.wellAnchorId)
  )
    fail(`${path}.wellAnchorId`, 'must name one of the room challenge switch anchors');
  const fieldsCagePoints = optionalFamily(raw.fieldsCagePoints, 'fieldsCagePoints');
  const fieldsOptionalPoints = optionalFamily(raw.fieldsOptionalPoints, 'fieldsOptionalPoints');
  const cocoonRewardPoints = optionalFamily(raw.cocoonRewardPoints, 'cocoonRewardPoints');
  return Object.freeze({
    exitDoors: normalizeFamily(raw.exitDoors, seen, `${path}.exitDoors`, normalizeExitDoor),
    heroStarts: family(raw.heroStarts, 'heroStarts'),
    heroEnds: family(raw.heroEnds, 'heroEnds'),
    secretPoints: family(raw.secretPoints, 'secretPoints'),
    challengeSwitchAnchors,
    ...(raw.wellAnchorId === undefined ? {} : { wellAnchorId: raw.wellAnchorId }),
    ...(fieldsCagePoints === undefined ? {} : { fieldsCagePoints }),
    ...(fieldsOptionalPoints === undefined ? {} : { fieldsOptionalPoints }),
    ...(cocoonRewardPoints === undefined ? {} : { cocoonRewardPoints }),
  });
}
