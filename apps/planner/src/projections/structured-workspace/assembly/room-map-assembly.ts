import type { RoomOccurrence } from '@run-planner/engine/authored-project';
import {
  nativeExitDoorOrder,
  type Catalog,
  type RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

import type { WorkspaceRoomMap } from '../contracts/features';

const point = ({ id, x, y }: { readonly id: number; readonly x: number; readonly y: number }) =>
  Object.freeze({ id, x, y });

/**
 * The room's map points for its map. Door N's target is realized at the Nth
 * map door in the game's door order; a room without a declared order names
 * its Door only where it has one door.
 */
export function assembleRoomMap(
  catalog: Pick<Catalog, 'rooms' | 'exitTypes'>,
  room: RoomDeclaration,
  occurrence: RoomOccurrence,
): WorkspaceRoomMap | undefined {
  const points = room.mapPoints;
  if (points === undefined) return undefined;
  const order =
    points.exitDoors.length === 1
      ? [points.exitDoors[0]!.id]
      : nativeExitDoorOrder(
          catalog,
          room.gameName,
          points.exitDoors.map((door) => ({ doorId: door.id })),
        );
  const chaos = occurrence.additionalExits?.find((exit) => exit.kind === 'chaos');
  // A room with one SecretPoint can place its gate only there.
  const chaosGate =
    chaos === undefined
      ? undefined
      : chaos.spawnPointIndex === undefined || chaos.spawnPointIndex === null
        ? points.secretPoints.length === 1
          ? points.secretPoints[0]
          : undefined
        : points.secretPoints[chaos.spawnPointIndex - 1];
  return Object.freeze({
    doors: Object.freeze(
      points.exitDoors.map((door) => {
        const rank = order?.indexOf(door.id) ?? -1;
        return Object.freeze({ ...point(door), ...(rank < 0 ? {} : { doorIndex: rank + 1 }) });
      }),
    ),
    entries: Object.freeze(points.heroStarts.map(point)),
    anchors: Object.freeze(points.challengeSwitchAnchors.map(point)),
    chaosPoints: Object.freeze(points.secretPoints.map(point)),
    fieldsCagePoints: Object.freeze((points.fieldsCagePoints ?? []).map(point)),
    fieldsOptionalPoints: Object.freeze((points.fieldsOptionalPoints ?? []).map(point)),
    ...(chaosGate === undefined ? {} : { chaosGate: point(chaosGate) }),
  });
}
