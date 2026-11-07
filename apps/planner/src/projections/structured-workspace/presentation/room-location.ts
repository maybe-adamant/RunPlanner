import { routeRoomDeclaration, type OccurrenceAddress } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { requireWorkspaceRoom } from '../assembly/catalog-room';
import type { WorkspaceBiomeSource } from '../source-index';

/** A room named by where the run reaches it: its biome and Location. */
export interface WorkspaceRoomLocationLabel {
  /** Its biome and Location; the Location is unknown while the plan does not reach it. */
  readonly locationLabel: string;
  /** The room's run depth on entry, where it is reached. */
  readonly runDepth?: number;
  /** The room's name, where its Location is unknown. */
  readonly roomLabel?: string;
}

/**
 * The game calls a room's place in the run its Location; an unreached room has
 * none yet and is named instead.
 */
export function roomLocationLabel(
  catalog: Catalog,
  room: OccurrenceAddress,
  roomLocation: WorkspaceBiomeSource['roomLocation'] | undefined,
): WorkspaceRoomLocationLabel {
  const location = roomLocation?.(room);
  const runDepth = location?.runDepth;
  const biomeLabel = catalog.biomes.byKey[room.biomeKey]?.label ?? room.biomeKey;
  const roomLabel =
    runDepth !== undefined || location === undefined
      ? undefined
      : routeRoomDeclaration(requireWorkspaceRoom(catalog, location.gameName), room.routeKey).label;
  return Object.freeze({
    locationLabel: `${biomeLabel} · Location ${runDepth ?? '?'}`,
    ...(runDepth === undefined ? {} : { runDepth }),
    ...(roomLabel === undefined ? {} : { roomLabel }),
  });
}
