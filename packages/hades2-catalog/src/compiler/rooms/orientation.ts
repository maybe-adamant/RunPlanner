import type { RoomMapPoints, RoomOrientation } from '@run-planner/engine/catalog-schema';

import { requireBoolean, requireNonEmpty, requirePositiveInteger } from '../common';
import { fail } from '../errors';

const entranceDirections: ReadonlySet<string> = new Set(['Left', 'Right', 'LeftRight']);
const compass: ReadonlySet<string> = new Set(['North', 'East', 'South', 'West']);

function normalizeEntry(
  entry: { readonly startPointId: number; readonly endPointId: number },
  path: string,
) {
  return Object.freeze({
    startPointId: requirePositiveInteger(entry.startPointId, `${path}.startPointId`),
    endPointId: requirePositiveInteger(entry.endPointId, `${path}.endPointId`),
  });
}

/**
 * Directions the room's flags let its map name: the compass in cardinal rooms,
 * otherwise Left or Right, which every non-strict entry pair names.
 */
function validateMapDirections(
  orientation: RoomOrientation,
  mapPoints: RoomMapPoints,
  path: string,
): void {
  const named = (direction: string | undefined, directionPath: string, required: boolean) => {
    if (direction === undefined) {
      if (required) fail(directionPath, 'must be named outside StrictLeftRight rooms');
      return;
    }
    if (compass.has(direction) !== orientation.cardinalEntrance)
      fail(directionPath, 'must use the compass exactly in cardinal-entrance rooms');
  };
  mapPoints.exitDoors.forEach((door, index) =>
    named(door.exitDirection, `${path}.exitDoors[${index}].exitDirection`, false),
  );
  mapPoints.entryPairs.forEach((pair, index) =>
    named(
      pair.direction,
      `${path}.entryPairs[${index}].direction`,
      orientation.cardinalEntrance || !orientation.strictLeftRight,
    ),
  );
  if (orientation.entry === undefined) return;
  if (!mapPoints.heroStarts.some((start) => start.id === orientation.entry!.startPointId))
    fail(`${path}.entry.startPointId`, 'must name a HeroStart of the room');
  if (!mapPoints.heroEnds.some((end) => end.id === orientation.entry!.endPointId))
    fail(`${path}.entry.endPointId`, 'must name a HeroEnd of the room');
}

/** One room's orientation facts, checked against the directions its map points name. */
export function normalizeRoomOrientation(
  raw: RoomOrientation,
  mapPoints: RoomMapPoints | undefined,
  path: string,
): RoomOrientation {
  if (raw.entranceDirection !== undefined && !entranceDirections.has(raw.entranceDirection))
    fail(`${path}.entranceDirection`, 'must be Left, Right or LeftRight');
  if (
    raw.flipChance !== undefined &&
    (!Number.isFinite(raw.flipChance) || raw.flipChance < 0 || raw.flipChance > 1)
  )
    fail(`${path}.flipChance`, 'must be a chance from 0 to 1');
  const nextRoomEntries = raw.nextRoomEntries?.map((entry, index) => {
    const entryPath = `${path}.nextRoomEntries[${index}]`;
    const obstacleName = requireNonEmpty(entry.obstacleName, `${entryPath}.obstacleName`);
    if (index > 0 && obstacleName <= raw.nextRoomEntries![index - 1]!.obstacleName)
      fail(`${entryPath}.obstacleName`, 'must ascend');
    return Object.freeze({ obstacleName, ...normalizeEntry(entry, entryPath) });
  });
  const orientation: RoomOrientation = Object.freeze({
    ...(raw.entranceDirection === undefined ? {} : { entranceDirection: raw.entranceDirection }),
    ...(raw.flipChance === undefined ? {} : { flipChance: raw.flipChance }),
    ignoresExitDirection: requireBoolean(raw.ignoresExitDirection, `${path}.ignoresExitDirection`),
    cardinalEntrance: requireBoolean(raw.cardinalEntrance, `${path}.cardinalEntrance`),
    strictLeftRight: requireBoolean(raw.strictLeftRight, `${path}.strictLeftRight`),
    ...(raw.entry === undefined ? {} : { entry: normalizeEntry(raw.entry, `${path}.entry`) }),
    ...(nextRoomEntries === undefined ? {} : { nextRoomEntries: Object.freeze(nextRoomEntries) }),
  });
  if (mapPoints !== undefined) validateMapDirections(orientation, mapPoints, path);
  return orientation;
}
