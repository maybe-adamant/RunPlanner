import type { RoomDeclaration } from '../catalog-schema';

/** Static physical point domain, independent of natural/forced gate eligibility. */
export function chaosGateSpawnPointIndices(room: RoomDeclaration): readonly number[] {
  if (!room.additionalExits.some((exit) => exit.kind === 'chaos' && exit.canHost))
    return Object.freeze([]);
  return Object.freeze(
    Array.from({ length: room.secretPointAnchorCount ?? 0 }, (_, index) => index + 1),
  );
}
