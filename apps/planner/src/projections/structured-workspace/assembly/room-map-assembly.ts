import {
  nativeExitDoorOrder,
  worldShopItemPoints,
  type Catalog,
  type RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

import type { WorkspaceRoomMap } from '../contracts/features';

const point = ({ id, x, y }: { readonly id: number; readonly x: number; readonly y: number }) =>
  Object.freeze({ id, x, y });

/**
 * The room's map points for its map. Door N's target is realized at the Nth
 * map door in the game's door order; a room without a declared order names
 * its Door only where it has one door. An Ephyra side door is no exit of the
 * room: it is bound to the local slot whose side room lies behind it.
 */
export function assembleRoomMap(
  catalog: Pick<Catalog, 'rooms' | 'exitTypes'>,
  room: RoomDeclaration,
  exits: {
    /** The authored Chaos gate's one-based spawn point, chosen or default. */
    readonly chaosGateSpawnPointIndex: number | undefined;
    /** The room authors its Contract door. */
    readonly contractExit: boolean;
  },
  stock: {
    /** The World Shop's stocked offers in native order, its empty slots left out. */
    readonly shopOfferKeys: readonly string[];
    /** The room holds the Infernal Contract pedestal. */
    readonly contractPedestal: boolean;
  },
): WorkspaceRoomMap | undefined {
  const points = room.mapPoints;
  if (points === undefined) return undefined;
  const sideSlots = new Map(
    room.localChildren.flatMap((child) =>
      child.kind === 'fixedRoomSlots'
        ? child.slots.map((slot) => [slot.physicalDoorId, slot.slotKey] as const)
        : [],
    ),
  );
  const exitDoors = points.exitDoors.filter((door) => !sideSlots.has(door.id));
  const order =
    exitDoors.length === 1
      ? [exitDoors[0]!.id]
      : nativeExitDoorOrder(
          catalog,
          room.gameName,
          exitDoors.map((door) => ({ doorId: door.id })),
        );
  const chaosGate =
    exits.chaosGateSpawnPointIndex === undefined
      ? undefined
      : points.secretPoints[exits.chaosGateSpawnPointIndex - 1];
  return Object.freeze({
    doors: Object.freeze(
      exitDoors.map((door) => {
        const rank = order?.indexOf(door.id) ?? -1;
        return Object.freeze({ ...point(door), ...(rank < 0 ? {} : { doorIndex: rank + 1 }) });
      }),
    ),
    sideDoors: Object.freeze(
      points.exitDoors.flatMap((door) => {
        const slotKey = sideSlots.get(door.id);
        return slotKey === undefined ? [] : [Object.freeze({ ...point(door), slotKey })];
      }),
    ),
    entries: Object.freeze(points.heroStarts.map(point)),
    anchors: Object.freeze(points.challengeSwitchAnchors.map(point)),
    chaosPoints: Object.freeze(points.secretPoints.map(point)),
    fieldsCagePoints: Object.freeze((points.fieldsCagePoints ?? []).map(point)),
    fieldsOptionalPoints: Object.freeze((points.fieldsOptionalPoints ?? []).map(point)),
    shopItems: Object.freeze(
      worldShopItemPoints(points, stock.shopOfferKeys).map(({ item, point: at }) =>
        Object.freeze({ ...point(at), offerKey: item }),
      ),
    ),
    ...(stock.contractPedestal && points.contractPedestalPoint !== undefined
      ? { contractPedestal: point(points.contractPedestalPoint) }
      : {}),
    ...(chaosGate === undefined ? {} : { chaosGate: point(chaosGate) }),
    ...(exits.contractExit && points.contractExitPoint !== undefined
      ? { contractExit: point(points.contractExitPoint) }
      : {}),
    ...(points.shipWheel === undefined
      ? {}
      : {
          wheel: Object.freeze({
            ...point(points.shipWheel),
            leftOffer: points.shipWheel.leftOffer,
            rightOffer: points.shipWheel.rightOffer,
          }),
        }),
  });
}
