import type { WorkspaceRoomSummary } from '@planner/projections/structured-workspace';
import { heldObjectIcon, heldObjectName } from '../room-features/roomObjectFace';
import { fieldsSlotBadge, fieldsSlotIcon } from '../room-layout/fieldsSlotFace';
import type { RoomMapPlacements } from './RoomMapPoints';

/** The room's planned entry, anchor occupants and Fields slots, as its map shows them. */
export function roomMapPlacements(room: WorkspaceRoomSummary): Omit<RoomMapPlacements, 'preview'> {
  const layout = room.layout;
  const anchors = room.objectSlots?.anchors ?? [];
  const fields = room.roomLocal.kind === 'fields' ? room.roomLocal : undefined;
  return {
    ...(layout?.entryId === undefined ? {} : { entryId: layout.entryId }),
    entryEligible: layout?.eligible ?? [],
    entryNumbers: new Map(layout?.entries.map((entry) => [entry.pointId, entry.number]) ?? []),
    anchors: new Map(
      anchors.flatMap((anchor) =>
        anchor.occupant === undefined
          ? []
          : [
              [
                anchor.anchorId,
                { label: heldObjectName(anchor.occupant), icon: heldObjectIcon(anchor.occupant) },
              ] as const,
            ],
      ),
    ),
    anchorNumbers: new Map(anchors.map((anchor) => [anchor.anchorId, anchor.number])),
    fieldsPoints: new Map(
      (fields?.spatial ?? []).flatMap((control) =>
        control.pointId === null || fields === undefined
          ? []
          : [
              [
                control.pointId,
                {
                  label: control.label,
                  icon: fieldsSlotIcon(fields, control.target),
                  badge: fieldsSlotBadge(fields, control.target),
                },
              ] as const,
            ],
      ),
    ),
  };
}
