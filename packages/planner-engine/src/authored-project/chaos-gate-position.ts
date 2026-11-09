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
 * Where a Chaos gate spawns in its source room: its stored point (the owner's
 * choice, kept even where it is invalid), else its stable default among the
 * room's points; undefined for a room with none.
 */
export function chaosGateSpawnPoint(
  room: RoomDeclaration,
  /** The gate's semantic key, which seeds its default. */
  gateKey: string,
  stored: number | undefined,
): { readonly spawnPointIndex: number; readonly source: 'chosen' | 'default' } | undefined {
  if (stored !== undefined) return Object.freeze({ spawnPointIndex: stored, source: 'chosen' });
  const spawnPointIndex = stableChoice(gateKey, chaosGateSpawnPointIndices(room));
  return spawnPointIndex === undefined
    ? undefined
    : Object.freeze({ spawnPointIndex, source: 'default' });
}
