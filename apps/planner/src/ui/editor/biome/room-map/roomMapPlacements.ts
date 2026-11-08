import type {
  WorkspaceAnchorObject,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { doorArtwork } from '@planner/ui/artwork/doors/doorArtwork';
import { heldObjectIcon, heldObjectName } from '../room-features/roomObjectFace';
import { fieldsSlotBadge, fieldsSlotIcon } from '../room-layout/fieldsSlotFace';
import type { RoomMapPlacements, RoomMapUnplaced } from './RoomMapPoints';

/** The map link of an anchor object the game places. */
export const unplacedObjectKey = (object: WorkspaceAnchorObject): string => `object:${object}`;

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
    unplaced: unplacedItems(room),
  };
}

/**
 * What the room holds with no position, each with the points it can take: a
 * Chaos gate among its positions, an object among the free anchors it is
 * offered, a Fields slot among its family's points no sibling holds.
 */
function unplacedItems(room: WorkspaceRoomSummary): readonly RoomMapUnplaced[] {
  const items: RoomMapUnplaced[] = [];
  const chaos = room.workbench.features.find((feature) => feature.kind === 'chaos');
  if (
    chaos?.action === 'remove' &&
    chaos.position !== undefined &&
    room.map !== undefined &&
    room.map.chaosGate === undefined
  ) {
    const points = room.map.chaosPoints;
    items.push({
      key: 'chaos',
      label: 'Chaos Gate',
      icon: doorArtwork.ChaosExitDoor ?? undefined,
      family: 'chaos',
      target: { kind: 'chaosGate' },
      pointIds: chaos.position.choices.flatMap((index) => {
        const point = points[index - 1];
        return point === undefined ? [] : [point.id];
      }),
    });
  }
  for (const object of room.objectSlots?.objects ?? []) {
    const anchor = object.anchor;
    if (!object.present || anchor === undefined) continue;
    if ((anchor.pinned ?? anchor.derivedAnchorId ?? anchor.anchorId) !== undefined) continue;
    const key = unplacedObjectKey(object.object);
    items.push({
      key,
      label: heldObjectName(object),
      icon: heldObjectIcon(object),
      family: 'anchor',
      target: { kind: 'unplaced', key },
      pointIds: anchor.choices.flatMap((choice) =>
        choice.anchorId === null ? [] : [choice.anchorId],
      ),
    });
  }
  if (room.roomLocal.kind === 'fields') {
    const fields = room.roomLocal;
    const held = new Set(fields.spatial.flatMap((control) => control.pointId ?? []));
    for (const control of fields.spatial) {
      if (control.pointId !== null) continue;
      items.push({
        key: control.interactionKey,
        label: control.label,
        icon: fieldsSlotIcon(fields, control.target),
        badge: fieldsSlotBadge(fields, control.target),
        family: control.target.kind === 'cage' ? 'cage' : 'pickup',
        target: { kind: 'unplaced', key: control.interactionKey },
        pointIds: control.pointChoices.flatMap((choice) =>
          choice.value === null || held.has(choice.value) ? [] : [choice.value],
        ),
      });
    }
  }
  return items;
}
