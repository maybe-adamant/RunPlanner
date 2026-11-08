import type {
  RoomMapDirection,
  RoomMapEntryPair,
  RoomMapExitDoor,
  RoomMapPoint,
  RoomMapPoints,
  RoomMapShipWheel,
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

function normalizeShipWheel(
  wheel: RoomMapShipWheel,
  seen: Set<number>,
  path: string,
): RoomMapShipWheel {
  const point = normalizePoint(wheel, path);
  if (seen.has(point.id)) fail(`${path}.id`, `duplicates ${point.id}`);
  seen.add(point.id);
  const offer = (spot: { readonly x: number; readonly y: number }, spotPath: string) => {
    if (!Number.isFinite(spot.x)) fail(`${spotPath}.x`, 'must be a finite number');
    if (!Number.isFinite(spot.y)) fail(`${spotPath}.y`, 'must be a finite number');
    return Object.freeze({ x: spot.x, y: spot.y });
  };
  return Object.freeze({
    ...point,
    leftOffer: offer(wheel.leftOffer, `${path}.leftOffer`),
    rightOffer: offer(wheel.rightOffer, `${path}.rightOffer`),
  });
}

const mapDirections: ReadonlySet<string> = new Set<RoomMapDirection>([
  'Left',
  'Right',
  'North',
  'East',
  'South',
  'West',
]);

function normalizeDirection(direction: RoomMapDirection, path: string): RoomMapDirection {
  if (!mapDirections.has(direction)) fail(path, 'must be a map direction');
  return direction;
}

function normalizeExitDoor(
  door: RoomMapExitDoor,
  path: string,
  heroExitIds: ReadonlySet<number>,
): RoomMapExitDoor {
  if (heroExitIds.size === 0 ? door.heroExitId !== undefined : !heroExitIds.has(door.heroExitId!))
    fail(`${path}.heroExitId`, 'must name the nearest of the room HeroExits, when it has any');
  if ((door.exitDirection === undefined) !== (door.heroExitId === undefined))
    fail(`${path}.exitDirection`, 'must accompany heroExitId');
  return Object.freeze({
    ...normalizePoint(door, path),
    obstacleName: requireNonEmpty(door.obstacleName, `${path}.obstacleName`),
    ...(door.heroExitId === undefined
      ? {}
      : {
          heroExitId: door.heroExitId,
          exitDirection: normalizeDirection(door.exitDirection!, `${path}.exitDirection`),
        }),
  });
}

function normalizeEntryPairs(
  pairs: readonly RoomMapEntryPair[],
  heroStarts: readonly RoomMapPoint[],
  heroEnds: readonly RoomMapPoint[],
  path: string,
): readonly RoomMapEntryPair[] {
  if (pairs.length !== heroStarts.length) fail(path, 'must pair each HeroStart once');
  const endIds = new Set(heroEnds.map((end) => end.id));
  return Object.freeze(
    pairs.map((pair, index) => {
      const pairPath = `${path}[${index}]`;
      if (pair.startPointId !== heroStarts[index]!.id)
        fail(`${pairPath}.startPointId`, 'must follow heroStarts order');
      if (!endIds.has(pair.endPointId)) fail(`${pairPath}.endPointId`, 'must name a HeroEnd');
      return Object.freeze({
        startPointId: pair.startPointId,
        endPointId: pair.endPointId,
        ...(pair.direction === undefined
          ? {}
          : { direction: normalizeDirection(pair.direction, `${pairPath}.direction`) }),
      });
    }),
  );
}

/**
 * One room's map points: each family ascending, every ObjectId once in the
 * room, door exits and entry pairs naming the room's own points.
 */
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
  const heroStarts = family(raw.heroStarts, 'heroStarts');
  const heroEnds = family(raw.heroEnds, 'heroEnds');
  const heroExits = family(raw.heroExits, 'heroExits');
  const heroExitIds = new Set(heroExits.map((heroExit) => heroExit.id));
  return Object.freeze({
    exitDoors: normalizeFamily(raw.exitDoors, seen, `${path}.exitDoors`, (door, doorPath) =>
      normalizeExitDoor(door, doorPath, heroExitIds),
    ),
    heroStarts,
    heroEnds,
    heroExits,
    entryPairs: normalizeEntryPairs(raw.entryPairs, heroStarts, heroEnds, `${path}.entryPairs`),
    secretPoints: family(raw.secretPoints, 'secretPoints'),
    challengeSwitchAnchors,
    ...(raw.wellAnchorId === undefined ? {} : { wellAnchorId: raw.wellAnchorId }),
    ...(fieldsCagePoints === undefined ? {} : { fieldsCagePoints }),
    ...(fieldsOptionalPoints === undefined ? {} : { fieldsOptionalPoints }),
    ...(cocoonRewardPoints === undefined ? {} : { cocoonRewardPoints }),
    ...(raw.shipWheel === undefined
      ? {}
      : { shipWheel: normalizeShipWheel(raw.shipWheel, seen, `${path}.shipWheel`) }),
  });
}
