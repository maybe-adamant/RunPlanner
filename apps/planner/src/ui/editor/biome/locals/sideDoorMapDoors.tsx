import type { WorkspaceLocalVisitDecision } from '@planner/projections/structured-workspace';
import { DoorChipFace } from '../DecisionWorkbench';
import { doorRewardIcons } from '../doorSummary';
import type { RoomMapSideDoor } from '../room-map/RoomMapPoints';

/** The main room's side doors as its map shows them: shut, or open on its side room and visit. */
export function sideDoorMapDoors(
  localVisit: WorkspaceLocalVisitDecision,
): readonly RoomMapSideDoor[] {
  return localVisit.slots.map((slot) => ({
    slotKey: slot.key,
    label: slot.label,
    ...(slot.generation === 'generated'
      ? {
          face: (
            <DoorChipFace
              chip={{
                key: slot.key,
                label: slot.label,
                roomIcon: slot.roomIcon,
                rewards: doorRewardIcons(slot, 'final'),
              }}
            />
          ),
        }
      : {}),
    ...(slot.enteredOrdinal === null ? {} : { visit: slot.enteredOrdinal }),
  }));
}
