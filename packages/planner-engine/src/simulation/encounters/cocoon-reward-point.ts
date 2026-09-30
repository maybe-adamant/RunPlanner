import type { RoomDeclaration } from '../../catalog-schema';
import type { AuthoredEncounterCustomization } from '../../authored-project/model';

/** Host membership is contextual validity, not persisted structural shape. */
export function cocoonRewardPointSupported(
  room: RoomDeclaration,
  value: AuthoredEncounterCustomization | undefined,
): boolean {
  return (
    value?.kind !== 'cocoonRewardPoint' ||
    (room.cocoonRewardPointIds ?? []).includes(value.spawnPointId)
  );
}
