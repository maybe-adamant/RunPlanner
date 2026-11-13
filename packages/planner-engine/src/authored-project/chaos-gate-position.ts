import type { RoomDeclaration } from '../catalog-schema';
import { stableChoice } from './stable-hash';

/** Static physical point domain, independent of natural/forced gate eligibility. */
export function chaosGateSpawnPointIndices(room: RoomDeclaration): readonly number[] {
  if (!room.additionalExits.some((exit) => exit.kind === 'chaos' && exit.canHost))
    return Object.freeze([]);
  return Object.freeze(
    Array.from({ length: room.secretPointAnchorCount ?? 0 }, (_, index) => index + 1),
  );
}

/**
 * Where a Chaos gate spawns in its source room: its stored point (kept even
 * where it is invalid), else its stable draw among the room's points, which
 * settlement stores once the walk reaches the room; undefined for a room with none.
 */
export function chaosGateSpawnPoint(
  room: RoomDeclaration,
  /** The gate's semantic key, which seeds its draw. */
  gateKey: string,
  stored: number | undefined,
): number | undefined {
  return stored ?? stableChoice(gateKey, chaosGateSpawnPointIndices(room));
}
