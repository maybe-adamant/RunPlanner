import { routeRoomDeclaration, type OccurrenceAddress } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { placeName, type PlaceName } from '@planner/projections/placeName';
import { requireWorkspaceRoom } from '../assembly/catalog-room';
import type { WorkspaceBiomeSource } from '../source-index';

/** A room as references from elsewhere name it, by where the run reaches it. */
export interface WorkspaceRoomPlace {
  readonly place: PlaceName;
  /** The room's run depth on entry, where it is reached. */
  readonly runDepth?: number;
}

/**
 * A room named from elsewhere: by its Location where the plan reaches it, else by its own
 * name; a room the plan does not hold at all, by its biome's name (its key when the catalog
 * declares no such biome).
 */
export function roomPlace(
  catalog: Catalog,
  room: OccurrenceAddress,
  roomLocation: WorkspaceBiomeSource['roomLocation'] | undefined,
): WorkspaceRoomPlace {
  const location = roomLocation?.(room);
  const runDepth = location?.runDepth;
  const name =
    location === undefined
      ? (catalog.biomes.byKey[room.biomeKey]?.label ?? room.biomeKey)
      : routeRoomDeclaration(requireWorkspaceRoom(catalog, location.gameName), room.routeKey).label;
  return Object.freeze({
    place: placeName(name, runDepth),
    ...(runDepth === undefined ? {} : { runDepth }),
  });
}
