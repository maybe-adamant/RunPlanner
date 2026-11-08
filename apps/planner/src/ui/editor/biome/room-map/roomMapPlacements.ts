import type {
  WorkspaceRoomLayoutControl,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { heldObjectIcon, heldObjectName } from '../room-features/roomObjectFace';
import { fieldsOccupantIcon } from '../room-layout/fieldsOccupantIcon';
import type { RoomMapPlacements } from './RoomMapPoints';

/** The value a layout fact settles to, where it is known. */
export function settledLayoutValue<T>(control: WorkspaceRoomLayoutControl<T>): T | undefined {
  const state = control.state;
  return state.kind === 'fixed' || state.kind === 'derived' || state.kind === 'choice'
    ? state.value
    : undefined;
}

/** The room's planned entry, anchor occupants and Fields slots, as its map shows them. */
export function roomMapPlacements(room: WorkspaceRoomSummary): Omit<RoomMapPlacements, 'preview'> {
  const layout = room.layout;
  const spots = room.objectSlots?.spots ?? [];
  const fields = room.roomLocal.kind === 'fields' ? room.roomLocal : undefined;
  const entryId = layout === undefined ? undefined : settledLayoutValue(layout.entry);
  return {
    ...(entryId === undefined ? {} : { entryId }),
    entryNumbers: new Map(layout?.entries.map((entry) => [entry.pointId, entry.number]) ?? []),
    anchors: new Map(
      spots.flatMap((spot) =>
        spot.occupant === undefined
          ? []
          : [
              [
                spot.anchorId,
                { label: heldObjectName(spot.occupant), icon: heldObjectIcon(spot.occupant) },
              ] as const,
            ],
      ),
    ),
    anchorNumbers: new Map(spots.map((spot) => [spot.anchorId, spot.number])),
    fieldsPoints: new Map(
      (fields?.spotLines ?? []).flatMap((line) =>
        line.spots.flatMap((spot) =>
          spot.occupant === undefined || fields === undefined
            ? []
            : [
                [
                  spot.pointId,
                  {
                    label: spot.occupant.label,
                    icon: fieldsOccupantIcon(fields, spot.occupant),
                    badge: spot.occupant.badge,
                  },
                ] as const,
              ],
        ),
      ),
    ),
  };
}
