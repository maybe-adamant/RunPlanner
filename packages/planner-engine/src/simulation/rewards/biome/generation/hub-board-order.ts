import { offeredExitDoorOrder } from '../../../../catalog-schema/exit-door-order';

/**
 * The game's reward-assignment order for an open Hub board.
 *
 * `SetupDefaultDoor` inserts each open door into `MapState.OfferedExitDoors`
 * in the map's fixed door-setup order, and `DoUnlockRoomExits` processes the
 * table in native exit-door order. Each door draws its reward in that order,
 * after the doors before it.
 */
export interface HubBoardDoor {
  readonly physicalDoorId: number;
  readonly offeredExitInsertionRank: number;
}

/** Returns the doors in the order the game assigns their rewards. */
export function hubBoardRewardAssignmentOrder<Door extends HubBoardDoor>(
  doors: readonly Door[],
): readonly Door[] {
  const inserted = [...doors].sort(
    (left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank,
  );
  const byId = new Map(inserted.map((door) => [door.physicalDoorId, door]));
  // The catalog checks that every board door has one obstacle name, so they all tie in the sort.
  const walked = offeredExitDoorOrder(
    inserted.map((door) => ({ doorId: door.physicalDoorId, obstacleName: 'EphyraExitDoor' })),
  );
  return Object.freeze(walked.map((id) => byId.get(id)!));
}
